import React from 'react';
import { PatientData, Gender, ActivityLevel, CalorieGoal, Allergen, ALLERGEN_LABELS } from '../types';
import { FoodAutocompleteInput } from './FoodAutocomplete';

interface Props {
  value: PatientData;
  onChange: (data: PatientData) => void;
}

// Objetivo simplificado a 3 opciones (lo que pide el flujo de pareja: "Perder
// grasa / Mantener / Ganar masa muscular") — se mapea al CalorieGoal completo
// que ya usa calculateMacros, sin inventar un cálculo nuevo. DeficitSlow/
// SurplusSlow como ritmos por defecto (más seguros que los "rápidos").
const GOAL_OPTIONS: { value: CalorieGoal; label: string; icon: string }[] = [
  { value: CalorieGoal.DeficitSlow, label: 'Perder grasa', icon: 'trending_flat' },
  { value: CalorieGoal.Maintenance, label: 'Mantener',      icon: 'balance' },
  { value: CalorieGoal.SurplusSlow, label: 'Ganar músculo', icon: 'fitness_center' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: ActivityLevel.Sedentary, label: 'Sedentario' },
  { value: ActivityLevel.Light,     label: 'Ligero' },
  { value: ActivityLevel.Moderate,  label: 'Moderado' },
  { value: ActivityLevel.Heavy,     label: 'Intenso' },
  { value: ActivityLevel.Athlete,   label: 'Muy intenso' },
];

const inputCls = "h-11 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none text-sm";
const labelCls = "text-xs font-semibold text-text-sub dark:text-gray-400 uppercase";

const PartnerForm: React.FC<Props> = ({ value, onChange }) => {
  const set = <K extends keyof PatientData>(key: K, val: PatientData[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Nombre</span>
        <input className={inputCls} type="text" value={value.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Nombre de la pareja" required />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Edad</span>
          <input className={inputCls} type="number" min={1} max={120} value={value.age} onChange={e => set('age', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Peso (kg)</span>
          <input className={inputCls} type="number" step={0.1} min={20} max={300} value={value.weight} onChange={e => set('weight', Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Altura (cm)</span>
          <input className={inputCls} type="number" min={100} max={250} value={value.height} onChange={e => set('height', Number(e.target.value))} />
        </label>
      </div>

      <div>
        <span className={labelCls}>Sexo</span>
        <div className="flex rounded-lg bg-background-light dark:bg-background-dark p-1 border border-border-light dark:border-border-dark mt-1.5">
          {[{ val: Gender.Male, label: 'Hombre' }, { val: Gender.Female, label: 'Mujer' }].map(g => (
            <button key={g.val} type="button"
              onClick={() => set('gender', g.val)}
              className={`flex-1 rounded py-2 text-sm font-bold transition-all ${value.gender === g.val ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelCls}>Objetivo</span>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {GOAL_OPTIONS.map(g => (
            <button key={g.value} type="button"
              onClick={() => set('calorieGoal', g.value)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-xs font-bold border transition-colors ${value.calorieGoal === g.value ? 'bg-primary/10 border-primary text-primary-accessible dark:text-primary' : 'bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark text-text-sub'}`}
            >
              <span className="material-symbols-outlined text-[18px]">{g.icon}</span>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Nivel de actividad</span>
        <div className="relative">
          <select className={`${inputCls} appearance-none pr-9`} value={value.activity} onChange={e => set('activity', e.target.value as ActivityLevel)}>
            {ACTIVITY_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub text-base">expand_more</span>
        </div>
      </label>

      <div>
        <span className={labelCls}>Alergias</span>
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark mt-1.5">
          {Object.values(Allergen).map(a => {
            const checked = (value.allergens ?? []).includes(a);
            return (
              <label key={a} className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium cursor-pointer border transition-colors ${checked ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-300' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-sub'}`}>
                <input type="checkbox" className="sr-only" checked={checked} onChange={e => {
                  const current = value.allergens ?? [];
                  set('allergens', e.target.checked ? [...current, a] : current.filter(x => x !== a));
                }} />
                {ALLERGEN_LABELS[a]}
              </label>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Intolerancias / preferencias alimentarias</span>
        <FoodAutocompleteInput className={inputCls} type="text" separator="," value={value.excludedFoods ?? ''} onChange={v => set('excludedFoods', v)} placeholder="Ej: intolerante a la lactosa, no le gusta el pescado..." />
      </label>
    </div>
  );
};

export default PartnerForm;
