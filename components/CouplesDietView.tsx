import React, { useState } from 'react';
import { CouplesDiet, SavedDiet } from '../types';
import DietPlanDisplay from './DietPlanDisplay';

interface Props {
  couplesDiet: CouplesDiet;
}

const PersonTab: React.FC<{ active: boolean; name: string; onClick: () => void }> = ({ active, name, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
      active
        ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
        : 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-primary'
    }`}
  >
    <span className="material-symbols-outlined text-[18px]">person</span>
    {name}
  </button>
);

const CouplesDietView: React.FC<Props> = ({ couplesDiet }) => {
  const [active, setActive] = useState<'A' | 'B'>('A');
  const { personA, personB } = couplesDiet;

  const nameA = personA.patientData.name || 'Persona A';
  const nameB = personB.patientData.name || 'Persona B';

  const current: SavedDiet = active === 'A' ? personA : personB;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Cabecera de pareja + tabs */}
      <div className="px-6 lg:px-10 pt-6 no-print">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">group</span>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-text-main dark:text-white">
              Plan de Pareja — {nameA} &amp; {nameB}
            </h1>
          </div>
          <div className="flex gap-2">
            <PersonTab active={active === 'A'} name={nameA} onClick={() => setActive('A')} />
            <PersonTab active={active === 'B'} name={nameB} onClick={() => setActive('B')} />
          </div>
        </div>
      </div>

      {/* Plan de la persona seleccionada (reutiliza DietPlanDisplay completo) */}
      <DietPlanDisplay
        key={current.id}
        metrics={current.metrics}
        plan={current.plan}
        patientName={current.patientData.name}
        mealCount={current.patientData.mealCount}
        fastingProtocol={current.patientData.fastingProtocol}
        patientData={current.patientData}
        dietId={current.id}
      />
    </div>
  );
};

export default CouplesDietView;
