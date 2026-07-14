import React from 'react';
import { SavedDiet, CALORIE_GOAL_LABELS } from '../types';
import { useConfirm } from './ConfirmDialog';

interface Props {
  partner: SavedDiet;
  onEdit: () => void;
  onRegenerate: () => void;
  onUnlink: () => void;
  onDeletePartner: () => void;
  onViewPartner: () => void;
}

const LinkedPartnerPanel: React.FC<Props> = ({ partner, onEdit, onRegenerate, onUnlink, onDeletePartner, onViewPartner }) => {
  const { confirm } = useConfirm();
  const goal = partner.patientData.calorieGoal ? CALORIE_GOAL_LABELS[partner.patientData.calorieGoal] : undefined;

  const handleUnlink = async () => {
    const ok = await confirm({
      title: 'Convertir en cliente independiente',
      message: `${partner.patientData.name} dejará de estar vinculado — conserva su dieta y datos, pero ya no se resincronizará automáticamente.`,
      confirmLabel: 'Convertir',
    });
    if (ok) onUnlink();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Eliminar pareja',
      message: `Se eliminará la dieta y el vínculo de ${partner.patientData.name}. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) onDeletePartner();
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-pink-200 dark:border-pink-900/40 shadow-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-pink-500 text-xl">group</span>
        <h3 className="font-bold text-text-main dark:text-white">Pareja vinculada</h3>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button onClick={onViewPartner} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
          <div className="size-10 rounded-full flex items-center justify-center bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300 font-bold">
            {partner.patientData.name ? partner.patientData.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div>
            <p className="font-bold text-text-main dark:text-white text-sm">{partner.patientData.name}</p>
            <p className="text-xs text-text-sub dark:text-gray-400">
              {goal?.title ?? 'Sin objetivo'} · {partner.patientData.weight}kg · {partner.metrics.macros.calories} kcal
            </p>
            <p className="text-[11px] text-text-sub dark:text-gray-500">
              P {partner.metrics.macros.protein}g · HC {partner.metrics.macros.carbs}g · G {partner.metrics.macros.fats}g
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={onEdit} title="Editar datos personales"
            className="flex items-center gap-1 h-9 px-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs font-bold hover:border-primary transition-all">
            <span className="material-symbols-outlined text-[16px]">edit</span> Editar
          </button>
          <button onClick={onRegenerate} title="Actualizar dieta de la pareja"
            className="flex items-center gap-1 h-9 px-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs font-bold hover:border-primary transition-all">
            <span className="material-symbols-outlined text-[16px] text-primary">refresh</span> Actualizar
          </button>
          <button onClick={handleUnlink} title="Convertir en cliente independiente"
            className="flex items-center gap-1 h-9 px-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs font-bold hover:border-amber-400 transition-all">
            <span className="material-symbols-outlined text-[16px] text-amber-500">remove_circle</span> Desvincular
          </button>
          <button onClick={handleDelete} title="Eliminar pareja"
            className="flex items-center justify-center size-9 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark hover:border-red-400 transition-all">
            <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkedPartnerPanel;
