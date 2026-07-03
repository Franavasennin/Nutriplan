import React, { useState, useRef, useEffect } from 'react';
import {
  PatientData,
  Gender,
  ActivityLevel,
  Condition,
  DietType,
  Duration,
  FastingProtocol,
  FASTING_LABELS,
  AthleteGoal,
  ATHLETE_GOAL_LABELS,
  CalorieGoal,
  CALORIE_GOAL_LABELS,
} from '../types';
import { getClinicalSafetyFlags } from '../utils/clinicalSafety';

// ─── Recomendación de nº de comidas ──────────────────────────────────────────

interface MealRecommendation { count: number; reason: string; }

function getMealRecommendation(data: Partial<PatientData>): MealRecommendation {
  const { dietType, conditions = [], activity, weight, height } = data;
  const bmi = weight && height ? weight / ((height / 100) ** 2) : 0;

  if (activity === ActivityLevel.Athlete || activity === ActivityLevel.Heavy) {
    return { count: 5, reason: 'Alta actividad: 5 tomas para recuperación muscular y energía constante.' };
  }
  if (conditions.includes(Condition.DiabetesType1) || conditions.includes(Condition.DiabetesType2)) {
    return { count: 5, reason: 'Diabetes: 5 tomas regulares para un control glucémico estable.' };
  }
  if (dietType === DietType.ProteinDAP4 || dietType === DietType.ProteinDAP5) {
    return { count: 5, reason: 'Protocolo Protéifine: requiere exactamente 5 tomas diarias.' };
  }
  if (dietType === DietType.Keto || dietType === DietType.LowCarb) {
    return { count: 3, reason: 'Cetogénica/Baja en carbs: la cetosis produce saciedad natural. 3 comidas son suficientes.' };
  }
  if (bmi > 35) {
    return { count: 3, reason: 'Obesidad: 3 comidas principales ayudan a regular el apetito y reducir el picoteo.' };
  }
  if (bmi > 27) {
    return { count: 4, reason: 'Sobrepeso leve: 4 tomas equilibran saciedad y control calórico.' };
  }
  if (activity === ActivityLevel.Sedentary) {
    return { count: 3, reason: 'Vida sedentaria: 3 comidas bien planificadas evitan el exceso calórico.' };
  }
  return { count: 4, reason: '4 tomas es el equilibrio ideal para la mayoría de perfiles activos.' };
}

interface Props {
  onSubmit: (data: PatientData) => void;
  isLoading: boolean;
  initialData?: PatientData;
  onSubmitCouple?: (personA: PatientData, personB: PatientData) => void;
}

const DEFAULT_FORM: PatientData = {
  age: 30,
  gender: Gender.Male,
  weight: 70,
  height: 170,
  activity: ActivityLevel.Moderate,
  conditions: [],
  dietType: DietType.Balanced,
  duration: Duration.OneMonth,
  name: '',
  excludedFoods: '',
  weeks: 1,
  mealCount: 4,
  fastingProtocol: FastingProtocol.None,
  targetWeight: undefined,
  calorieGoal: CalorieGoal.Maintenance,
  clinicalNotes: '',
};

const PatientForm: React.FC<Props> = ({ onSubmit, isLoading, initialData, onSubmitCouple }) => {
  const [formData, setFormData] = useState<PatientData>(initialData ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── feature 2: modo pareja ──────────────────────────────────────────────────
  const [coupleMode, setCoupleMode] = useState(false);
  const [partner, setPartner] = useState<PatientData>({ ...DEFAULT_FORM, gender: Gender.Female, name: '' });

  const recommendation = getMealRecommendation(formData);

  // ── Cribado de seguridad clínica (auditoría) ────────────────────────────────
  const safety        = getClinicalSafetyFlags(formData);
  const partnerSafety = getClinicalSafetyFlags(partner);

  // BMI marker ref — CSS variable set after bmi is calculated below
  const bmiMarkerRef = useRef<HTMLDivElement>(null);

  const handleConditionChange = (condition: Condition) => {
    setFormData(prev => {
      const current = prev.conditions;
      if (current.includes(condition)) {
        return { ...prev, conditions: current.filter(c => c !== condition) };
      } else {
        return { ...prev, conditions: [...current, condition] };
      }
    });
  };

  const validate = (data: PatientData): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!data.age    || data.age    < 1   || data.age    > 120) e.age    = 'Edad debe estar entre 1 y 120 años';
    if (!data.weight || data.weight < 20  || data.weight > 300) e.weight = 'Peso debe estar entre 20 y 300 kg';
    if (!data.height || data.height < 100 || data.height > 250) e.height = 'Altura debe estar entre 100 y 250 cm';
    if (data.targetWeight != null && (data.targetWeight < 20 || data.targetWeight > 300))
      e.targetWeight = 'Peso objetivo debe estar entre 20 y 300 kg';
    if ((data.name?.length ?? 0) > 100)
      e.name = 'El nombre no puede superar 100 caracteres';
    if ((data.excludedFoods?.length ?? 0) > 300)
      e.excludedFoods = 'El listado de exclusiones no puede superar 300 caracteres';
    if ((data.clinicalNotes?.length ?? 0) > 1000)
      e.clinicalNotes = 'Las notas clínicas no pueden superar 1000 caracteres';
    return e;
  };

  /** Limpia los campos de texto libre antes de enviar */
  const sanitizeData = (data: PatientData): PatientData => ({
    ...data,
    name:          data.name?.trim().slice(0, 100) ?? '',
    excludedFoods: data.excludedFoods?.trim().slice(0, 300) ?? '',
    clinicalNotes: data.clinicalNotes?.trim().slice(0, 1000) ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Modo pareja: validar también a la persona B y enviar ambas
    if (coupleMode && onSubmitCouple) {
      const errsB = validate(partner);
      if (Object.keys(errsB).length > 0) {
        setErrors({ ...errs, partner: 'Revisa los datos de la persona B (edad/peso/altura).' });
        return;
      }
      // La persona B hereda los ajustes de planificación de la persona A
      const partnerFull: PatientData = {
        ...partner,
        weeks:           formData.weeks,
        duration:        formData.duration,
        fastingProtocol: formData.fastingProtocol,
      };
      onSubmitCouple(sanitizeData(formData), sanitizeData(partnerFull));
      return;
    }
    onSubmit(sanitizeData(formData));
  };

  // Calculate BMI preview
  const bmi = formData.weight && formData.height ? (formData.weight / ((formData.height/100) ** 2)).toFixed(1) : '0.0';
  const getBmiStatus = (val: string) => {
      const v = parseFloat(val);
      if (v < 18.5) return { label: 'Bajo Peso', color: 'text-blue-500 bg-blue-100' };
      if (v < 25) return { label: 'Saludable', color: 'text-green-700 bg-green-100' };
      if (v < 30) return { label: 'Sobrepeso', color: 'text-orange-600 bg-orange-100' };
      return { label: 'Obesidad', color: 'text-red-600 bg-red-100' };
  };
  const bmiStatus = getBmiStatus(bmi);

  useEffect(() => {
    const pos = `${Math.min(Math.max((parseFloat(bmi) / 40) * 100, 0), 100)}%`;
    bmiMarkerRef.current?.style.setProperty('--bmi-pos', pos);
  }, [bmi]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-10 flex justify-center">
        <div className="w-full max-w-[1200px] flex flex-col gap-6">
            
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-border-light dark:border-border-dark">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-text-main dark:text-white">Registro de Nuevo Cliente</h1>
                    <p className="text-text-sub dark:text-gray-400 text-lg">Introduce los datos antropométricos y personales para comenzar.</p>
                </div>
                <div className="flex gap-3">
                    <button type="button" className="px-5 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-transparent font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-lg bg-primary text-text-main font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:brightness-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[20px]">{coupleMode ? 'group' : 'save'}</span>
                        )}
                        {isLoading ? 'Generando...' : coupleMode ? 'Generar planes para pareja' : 'Generar Perfil'}
                    </button>
                </div>
            </div>

            {/* ── feature 2: toggle dieta para pareja ── */}
            <div className={`rounded-xl p-4 border transition-colors ${coupleMode ? 'bg-primary/5 border-primary/40' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        className="w-5 h-5 text-primary rounded focus:ring-primary bg-white dark:bg-surface-dark border-gray-300 dark:border-gray-600"
                        checked={coupleMode}
                        onChange={(e) => setCoupleMode(e.target.checked)}
                    />
                    <span className="material-symbols-outlined text-primary">group</span>
                    <div>
                        <span className="text-sm font-bold text-text-main dark:text-white">Generar dieta para pareja</span>
                        <p className="text-xs text-text-sub dark:text-gray-400">Crea dos planes vinculados, cada uno adaptado a los parámetros y macros de cada persona.</p>
                    </div>
                </label>
                {errors.partner && <p className="text-xs text-red-500 font-medium mt-2 ml-8">{errors.partner}</p>}
            </div>

            {/* ── Aviso de seguridad clínica (auditoría) ── */}
            {(safety.isVulnerable || (coupleMode && partnerSafety.isVulnerable)) && (
              <div className="rounded-xl p-4 border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-2xl shrink-0">gpp_maybe</span>
                <div>
                  <p className="text-sm font-bold text-red-800 dark:text-red-300">Perfil clínicamente vulnerable — requiere supervisión profesional directa</p>
                  {safety.isVulnerable && (
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {formData.name || 'Este paciente'}: {safety.reasons.join(' · ')}. Se ha desactivado automáticamente el déficit/superávit calórico y el ayuno intermitente; el plan se generará en mantenimiento.
                    </p>
                  )}
                  {coupleMode && partnerSafety.isVulnerable && (
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      {partner.name || 'Persona B'}: {partnerSafety.reasons.join(' · ')}. Mismas restricciones aplicadas.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* Personal Info */}
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-2xl">badge</span>
                            <h3 className="text-xl font-bold dark:text-white">1. Información Personal</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nombre Completo</span>
                                <input 
                                    className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none" 
                                    placeholder="Ej. María González" 
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Edad</span>
                                <input
                                    className={`h-12 w-full rounded-lg border bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none ${errors.age ? 'border-red-400 dark:border-red-500' : 'border-border-light dark:border-border-dark'}`}
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={formData.age}
                                    onChange={(e) => { setFormData({...formData, age: Number(e.target.value)}); setErrors(p => ({...p, age: ''})); }}
                                />
                                {errors.age && <span className="text-xs text-red-500 font-medium">{errors.age}</span>}
                            </label>
                        </div>
                        {/* Cribado de seguridad: embarazo / lactancia — solo relevante en mujeres */}
                        {formData.gender === Gender.Female && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-colors ${formData.isPregnant ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                                    <input type="checkbox" className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        checked={!!formData.isPregnant}
                                        onChange={(e) => setFormData({ ...formData, isPregnant: e.target.checked })} />
                                    <span className="text-sm font-medium text-text-main dark:text-gray-200">Embarazo</span>
                                </label>
                                <label className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer border transition-colors ${formData.isLactating ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                                    <input type="checkbox" className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        checked={!!formData.isLactating}
                                        onChange={(e) => setFormData({ ...formData, isLactating: e.target.checked })} />
                                    <span className="text-sm font-medium text-text-main dark:text-gray-200">Lactancia</span>
                                </label>
                            </div>
                        )}
                        {/* Notas clínicas del nutricionista */}
                        <div className="mt-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-primary">clinical_notes</span>
                                    Notas clínicas (solo visibles para el nutricionista)
                                </span>
                                <textarea
                                    className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none resize-none text-sm"
                                    rows={3}
                                    placeholder="Ej. Paciente con ansiedad por la comida, requiere seguimiento semanal. Intolerancia leve a los lácteos no diagnosticada..."
                                    value={formData.clinicalNotes ?? ''}
                                    onChange={(e) => setFormData({...formData, clinicalNotes: e.target.value})}
                                />
                                <span className="text-[10px] text-text-sub dark:text-gray-500">Estas notas no se envían a la IA ni aparecen en el informe del paciente.</span>
                            </label>
                        </div>
                    </div>
                    {/* Activity & Goals */}
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-2xl">fitness_center</span>
                            <h3 className="text-xl font-bold dark:text-white">2. Actividad y Dieta</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nivel de Actividad</span>
                                <div className="relative">
                                    <select
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none"
                                        value={formData.activity}
                                        onChange={(e) => setFormData({...formData, activity: e.target.value as ActivityLevel})}
                                    >
                                        <option value={ActivityLevel.Sedentary}>Sedentario</option>
                                        <option value={ActivityLevel.Light}>Ligero</option>
                                        <option value={ActivityLevel.Moderate}>Moderado</option>
                                        <option value={ActivityLevel.Heavy}>Intenso</option>
                                        <option value={ActivityLevel.Athlete}>Atleta</option>
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Tipo de Dieta</span>
                                <div className="relative">
                                    <select
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none"
                                        value={formData.dietType}
                                        onChange={(e) => setFormData({...formData, dietType: e.target.value as DietType})}
                                    >
                                        <option value={DietType.Balanced}>Equilibrada</option>
                                        <option value={DietType.Mediterranean}>Mediterránea</option>
                                        <option value={DietType.LowCarb}>Baja en Carbohidratos</option>
                                        <option value={DietType.Keto}>Cetogénica</option>
                                        <option value={DietType.Vegetarian}>Vegetariana</option>
                                        <option value={DietType.Vegan}>Vegana</option>
                                        <option value={DietType.Paleo}>Paleo</option>
                                        <option value={DietType.Protein}>Proteica</option>
                                        <option value={DietType.Athlete}>Atleta</option>
                                        <option value={DietType.Precooked}>Sin cocina (conservas y precocinados)</option>
                                        {/* DAP: protocolo médico restrictivo — no disponible en menores (auditoría) */}
                                        {!safety.isMinor && (
                                            <optgroup label="── Protéifine DAP ──">
                                                <option value={DietType.ProteinDAP4}>Protéifine DAP 4 - Fase Transición</option>
                                                <option value={DietType.ProteinDAP5}>Protéifine DAP 5 - Fase Transición</option>
                                            </optgroup>
                                        )}
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                                {safety.isMinor && <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-0.5">Protéifine no disponible para menores de edad.</span>}
                            </label>
                        </div>

                        {/* ── Objetivo calórico — bloqueado en perfiles vulnerables (auditoría) ── */}
                        {formData.dietType !== DietType.Athlete &&
                         formData.dietType !== DietType.ProteinDAP4 &&
                         formData.dietType !== DietType.ProteinDAP5 && safety.isVulnerable && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 mt-1">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[18px]">lock</span>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300">Objetivo calórico bloqueado en Mantenimiento — perfil vulnerable ({safety.reasons.join(', ')}).</p>
                          </div>
                        )}
                        {formData.dietType !== DietType.Athlete &&
                         formData.dietType !== DietType.ProteinDAP4 &&
                         formData.dietType !== DietType.ProteinDAP5 && !safety.isVulnerable && (() => {
                          const GOAL_ORDER: CalorieGoal[] = [
                            CalorieGoal.DeficitFast, CalorieGoal.DeficitSlow,
                            CalorieGoal.Maintenance,
                            CalorieGoal.SurplusSlow, CalorieGoal.SurplusFast,
                          ];
                          const COLOR_MAP: Record<string, { active: string; inactive: string }> = {
                            blue:   { active: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',   inactive: 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-blue-300' },
                            sky:    { active: 'border-sky-400 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300',         inactive: 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-sky-300' },
                            green:  { active: 'border-primary bg-primary/10 text-green-700 dark:text-primary',                     inactive: 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-primary/50' },
                            amber:  { active: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', inactive: 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-amber-300' },
                            orange: { active: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', inactive: 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-orange-300' },
                          };
                          const currentGoal = formData.calorieGoal ?? CalorieGoal.Maintenance;
                          return (
                            <div className="flex flex-col gap-2 mt-1">
                              <span className="text-sm font-semibold text-text-main dark:text-slate-200">Objetivo calórico</span>
                              <div className="grid grid-cols-5 gap-1.5">
                                {GOAL_ORDER.map(goal => {
                                  const meta  = CALORIE_GOAL_LABELS[goal];
                                  const isActive = currentGoal === goal;
                                  const colors = COLOR_MAP[meta.color];
                                  return (
                                    <button
                                      type="button"
                                      key={goal}
                                      onClick={() => setFormData({ ...formData, calorieGoal: goal })}
                                      className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 text-xs font-semibold transition-all ${isActive ? colors.active : colors.inactive}`}
                                    >
                                      <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                                      <span className="text-center leading-tight">{meta.title}</span>
                                      <span className={`text-[9px] font-medium ${isActive ? 'opacity-90' : 'opacity-60'}`}>{meta.subtitle}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Hora de entrenamiento — solo para dieta atleta */}
                        {formData.dietType === DietType.Athlete && (
                          <div className="flex flex-col gap-2 mt-1">
                            <span className="text-sm font-semibold text-text-main dark:text-slate-200 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                              Hora habitual de entrenamiento
                              <span className="text-[10px] font-normal text-text-sub dark:text-gray-500">(opcional)</span>
                            </span>
                            <div className="flex items-center gap-3">
                              <input
                                type="time"
                                className="h-12 w-36 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none"
                                value={formData.trainingTime ?? ''}
                                onChange={e => setFormData({ ...formData, trainingTime: e.target.value || undefined })}
                              />
                              <span className="text-xs text-text-sub dark:text-gray-500 leading-tight">
                                Ajusta el timing pre/post WO.<br />
                                Sin rellenar → se asume 17:00–19:00.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Objetivo atleta — solo visible cuando dietType === Atleta */}
                        {formData.dietType === DietType.Athlete && (
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Objetivo atleta</span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {(Object.values(AthleteGoal) as AthleteGoal[]).map(goal => {
                                        const active = (formData.athleteGoal ?? AthleteGoal.Performance) === goal;
                                        // Seguridad clínica: "Definición" implica déficit — bloqueado en perfiles vulnerables
                                        const isBlocked = safety.isVulnerable && goal === AthleteGoal.Definition;
                                        const icons: Record<AthleteGoal, string> = {
                                            [AthleteGoal.Performance]: 'bolt',
                                            [AthleteGoal.Definition]:  'monitor_weight',
                                            [AthleteGoal.Volume]:      'fitness_center',
                                        };
                                        return (
                                            <button
                                                type="button"
                                                key={goal}
                                                disabled={isBlocked}
                                                title={isBlocked ? 'Bloqueado: implica déficit calórico, no permitido en perfil vulnerable' : undefined}
                                                onClick={() => setFormData({ ...formData, athleteGoal: goal })}
                                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                                    active
                                                        ? 'border-primary bg-primary/10 text-primary dark:text-primary'
                                                        : 'border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-primary/50'
                                                }`}
                                            >
                                                <span className="material-symbols-outlined text-[22px]">{isBlocked ? 'lock' : icons[goal]}</span>
                                                <span className="text-center text-xs leading-tight">{ATHLETE_GOAL_LABELS[goal]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Semanas a generar</span>
                                <div className="relative">
                                    <select
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none"
                                        value={formData.weeks ?? 1}
                                        onChange={(e) => setFormData({...formData, weeks: Number(e.target.value)})}
                                    >
                                        <option value={1}>1 semana (7 días)</option>
                                        <option value={2}>2 semanas (14 días)</option>
                                        <option value={3}>3 semanas (21 días)</option>
                                        <option value={4}>4 semanas (28 días)</option>
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Alimentos a excluir</span>
                                <input
                                    className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none"
                                    type="text"
                                    placeholder="Ej: mariscos, nueces, lácteos..."
                                    value={formData.excludedFoods ?? ''}
                                    onChange={(e) => setFormData({...formData, excludedFoods: e.target.value})}
                                />
                                <span className="text-xs text-text-sub dark:text-gray-500">Separa con comas los alimentos que no quieres en el plan.</span>
                            </label>
                        </div>

                        {/* ── Nº de comidas + ayuno intermitente ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nº de comidas al día</span>
                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        Recomendado: {recommendation.count}
                                    </span>
                                </div>
                                <div className="relative">
                                    <select
                                        title="Número de comidas al día"
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none"
                                        value={formData.mealCount ?? 4}
                                        onChange={(e) => setFormData({...formData, mealCount: Number(e.target.value)})}
                                    >
                                        <option value={2}>2 comidas (comida + cena)</option>
                                        <option value={3}>3 comidas (desayuno, comida, cena)</option>
                                        <option value={4}>4 comidas (+ merienda)</option>
                                        <option value={5}>5 comidas (+ media mañana)</option>
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                                {formData.mealCount !== recommendation.count && (
                                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                                        <span className="material-symbols-outlined text-amber-500 text-[16px] shrink-0 mt-0.5">lightbulb</span>
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">{recommendation.reason}</p>
                                    </div>
                                )}
                                {formData.mealCount === recommendation.count && (
                                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                                        <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">verified</span>
                                        <p className="text-[11px] text-green-700 dark:text-green-300 font-medium">{recommendation.reason}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Ayuno intermitente</span>
                                <div className="relative">
                                    <select
                                        title="Protocolo de ayuno intermitente"
                                        disabled={safety.isVulnerable}
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={safety.isVulnerable ? FastingProtocol.None : (formData.fastingProtocol ?? FastingProtocol.None)}
                                        onChange={(e) => setFormData({...formData, fastingProtocol: e.target.value as FastingProtocol})}
                                    >
                                        {Object.values(FastingProtocol).map(f => (
                                            <option key={f} value={f}>{FASTING_LABELS[f]}</option>
                                        ))}
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                                {safety.isVulnerable && (
                                    <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
                                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[16px]">lock</span>
                                        <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">Ayuno bloqueado — perfil vulnerable.</p>
                                    </div>
                                )}
                                {!safety.isVulnerable && formData.fastingProtocol !== FastingProtocol.None && (
                                    <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                                        <span className="material-symbols-outlined text-blue-500 text-[16px] shrink-0 mt-0.5">schedule</span>
                                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                            {formData.fastingProtocol === FastingProtocol.IF16_8 && 'Ventana de alimentación: 12:00–20:00. Ayuno nocturno de 16 horas.'}
                                            {formData.fastingProtocol === FastingProtocol.IF18_6 && 'Ventana de alimentación: 13:00–19:00. Más restrictivo, ideal para pérdida de peso.'}
                                            {formData.fastingProtocol === FastingProtocol.IF20_4 && 'Ventana de alimentación: 14:00–18:00. Muy intenso, solo recomendado con adaptación previa.'}
                                            {formData.fastingProtocol === FastingProtocol.IF5_2 && '5 días normales + 2 días no consecutivos con 500 kcal. Flexible y sostenible.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="material-symbols-outlined text-red-500 text-2xl">medical_services</span>
                            <h3 className="text-xl font-bold dark:text-white">3. Condiciones Clínicas</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                             {[
                                { val: Condition.DiabetesType2, label: 'Diabetes Tipo 2' },
                                { val: Condition.Hypertension, label: 'Hipertensión' },
                                { val: Condition.Hypothyroidism, label: 'Hipotiroidismo' },
                                { val: Condition.Hypertriglyceridemia, label: 'Hipertrigliceridemia' },
                                { val: Condition.LactoseIntolerance, label: 'Intol. Lactosa' },
                                { val: Condition.Celiac, label: 'Celiaquía' },
                                { val: Condition.Obesity, label: 'Obesidad' },
                                { val: Condition.DiabetesType1, label: 'Diabetes Tipo 1' },
                                { val: Condition.Hyperthyroidism, label: 'Hipertiroidismo' },
                                { val: Condition.RenalDisease, label: 'Enfermedad Renal / ERC' },
                                { val: Condition.EatingDisorderHistory, label: 'Antecedente TCA' },
                              ].map((c) => (
                                <label key={c.val} className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-colors border ${formData.conditions.includes(c.val) ? 'bg-primary/10 border-primary' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-primary rounded focus:ring-primary bg-white dark:bg-surface-dark border-gray-300 dark:border-gray-600"
                                    checked={formData.conditions.includes(c.val)}
                                    onChange={() => handleConditionChange(c.val)}
                                  />
                                  <span className="text-sm text-text-main dark:text-gray-200 font-medium">{c.label}</span>
                                </label>
                              ))}
                        </div>
                    </div>
                </div>
                
                {/* Right Column */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-primary text-2xl">accessibility_new</span>
                            <h3 className="text-xl font-bold dark:text-white">4. Composición</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="col-span-2 flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Género Biológico</span>
                                <div className="flex rounded-lg bg-background-light dark:bg-background-dark p-1 border border-border-light dark:border-border-dark">
                                    <button 
                                        className={`flex-1 rounded py-2 text-sm font-bold shadow-sm transition-all ${formData.gender === Gender.Male ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`} 
                                        type="button"
                                        onClick={() => setFormData({...formData, gender: Gender.Male})}
                                    >
                                        Hombre
                                    </button>
                                    <button 
                                        className={`flex-1 rounded py-2 text-sm font-bold shadow-sm transition-all ${formData.gender === Gender.Female ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`} 
                                        type="button"
                                        onClick={() => setFormData({...formData, gender: Gender.Female})}
                                    >
                                        Mujer
                                    </button>
                                </div>
                            </label>
                                <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Peso (kg)</span>
                                <input
                                    className={`h-12 w-full rounded-lg border bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none ${errors.weight ? 'border-red-400 dark:border-red-500' : 'border-border-light dark:border-border-dark'}`}
                                    type="number"
                                    step="0.1"
                                    min="20"
                                    max="300"
                                    value={formData.weight}
                                    onChange={(e) => { setFormData({...formData, weight: Number(e.target.value)}); setErrors(p => ({...p, weight: ''})); }}
                                />
                                {errors.weight && <span className="text-xs text-red-500 font-medium">{errors.weight}</span>}
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Altura (cm)</span>
                                <input
                                    className={`h-12 w-full rounded-lg border bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none ${errors.height ? 'border-red-400 dark:border-red-500' : 'border-border-light dark:border-border-dark'}`}
                                    type="number"
                                    min="100"
                                    max="250"
                                    value={formData.height}
                                    onChange={(e) => { setFormData({...formData, height: Number(e.target.value)}); setErrors(p => ({...p, height: ''})); }}
                                />
                                {errors.height && <span className="text-xs text-red-500 font-medium">{errors.height}</span>}
                            </label>
                            <label className="col-span-2 flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Objetivo de peso (kg)</span>
                                <input
                                    className={`h-12 w-full rounded-lg border bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none ${errors.targetWeight ? 'border-red-400 dark:border-red-500' : 'border-border-light dark:border-border-dark'}`}
                                    type="number"
                                    step="0.1"
                                    placeholder={`Ej. ${Math.round(formData.weight * 0.9)}`}
                                    value={formData.targetWeight ?? ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({...formData, targetWeight: e.target.value ? Number(e.target.value) : undefined}); setErrors(p => ({...p, targetWeight: ''})); }}
                                />
                                {errors.targetWeight && <span className="text-xs text-red-500 font-medium">{errors.targetWeight}</span>}
                                {!errors.targetWeight && formData.targetWeight != null && formData.targetWeight > 0 && (
                                    <span className={`text-xs font-semibold ${formData.targetWeight < formData.weight ? 'text-blue-600 dark:text-blue-400' : formData.targetWeight > formData.weight ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                                        {formData.targetWeight < formData.weight
                                            ? `Pérdida de ${(formData.weight - formData.targetWeight).toFixed(1)} kg`
                                            : formData.targetWeight > formData.weight
                                            ? `Ganancia de ${(formData.targetWeight - formData.weight).toFixed(1)} kg`
                                            : 'Mantenimiento de peso'}
                                    </span>
                                )}
                            </label>
                        </div>
                    </div>
                    {/* BMI Preview */}
                    <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col gap-4 relative overflow-hidden group">
                        <h4 className="text-base font-bold text-text-sub relative z-10">Estimación IMC</h4>
                        <div className="flex items-baseline gap-2 relative z-10">
                            <span className="text-5xl font-black text-text-main dark:text-white">{bmi}</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded ${bmiStatus.color}`}>{bmiStatus.label}</span>
                        </div>
                        <div className="w-full bg-background-light dark:bg-background-dark h-3 rounded-full overflow-hidden flex relative z-10">
                            <div className="bg-blue-400 h-full w-[20%]"></div>
                            <div className="bg-green-500 h-full w-[40%]"></div>
                            <div className="bg-orange-400 h-full w-[20%]"></div>
                            <div className="bg-red-500 h-full w-[20%]"></div>
                            {/* Marker position approximation */}
                            <div
                                ref={bmiMarkerRef}
                                className="bmi-marker absolute top-0 bottom-0 w-1 bg-text-main dark:bg-white border-x border-white/50 transform -translate-x-1/2 shadow-lg transition-all duration-500"
                            ></div>
                        </div>
                    </div>
                    </div>

                {/* ── feature 2: tarjeta Persona B (solo en modo pareja) ── */}
                {coupleMode && (
                  <div className="lg:col-span-12 bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border-2 border-primary/40">
                    <div className="flex items-center gap-3 mb-6">
                      <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                      <h3 className="text-xl font-bold dark:text-white">Persona B — datos de la pareja</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nombre</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="text" placeholder="Ej. Carlos Pérez"
                          value={partner.name} onChange={e => setPartner({ ...partner, name: e.target.value })} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Edad</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="number" min="1" max="120"
                          value={partner.age} onChange={e => setPartner({ ...partner, age: Number(e.target.value) })} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Género Biológico</span>
                        <div className="flex rounded-lg bg-background-light dark:bg-background-dark p-1 border border-border-light dark:border-border-dark h-12">
                          <button type="button" onClick={() => setPartner({ ...partner, gender: Gender.Male })}
                            className={`flex-1 rounded text-sm font-bold transition-all ${partner.gender === Gender.Male ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`}>Hombre</button>
                          <button type="button" onClick={() => setPartner({ ...partner, gender: Gender.Female })}
                            className={`flex-1 rounded text-sm font-bold transition-all ${partner.gender === Gender.Female ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white ring-1 ring-black/5 dark:ring-white/10' : 'text-text-sub'}`}>Mujer</button>
                        </div>
                      </label>
                      {partner.gender === Gender.Female && (
                        <label className="flex flex-col gap-2">
                          <span className="text-sm font-semibold text-text-main dark:text-slate-200">Embarazo / Lactancia</span>
                          <div className="flex gap-3 h-12 items-center">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-text-main dark:text-gray-200 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                checked={!!partner.isPregnant} onChange={e => setPartner({ ...partner, isPregnant: e.target.checked })} />
                              Embarazo
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-text-main dark:text-gray-200 cursor-pointer">
                              <input type="checkbox" className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                checked={!!partner.isLactating} onChange={e => setPartner({ ...partner, isLactating: e.target.checked })} />
                              Lactancia
                            </label>
                          </div>
                        </label>
                      )}
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Peso (kg)</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="number" step="0.1" min="20" max="300"
                          value={partner.weight} onChange={e => setPartner({ ...partner, weight: Number(e.target.value) })} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Altura (cm)</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="number" min="100" max="250"
                          value={partner.height} onChange={e => setPartner({ ...partner, height: Number(e.target.value) })} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Objetivo de peso (kg)</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="number" step="0.1" placeholder="Opcional"
                          value={partner.targetWeight ?? ''} onChange={e => setPartner({ ...partner, targetWeight: e.target.value ? Number(e.target.value) : undefined })} />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nivel de Actividad</span>
                        <div className="relative">
                          <select className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary outline-none dark:text-white"
                            value={partner.activity} onChange={e => setPartner({ ...partner, activity: e.target.value as ActivityLevel })}>
                            <option value={ActivityLevel.Sedentary}>Sedentario</option>
                            <option value={ActivityLevel.Light}>Ligero</option>
                            <option value={ActivityLevel.Moderate}>Moderado</option>
                            <option value={ActivityLevel.Heavy}>Intenso</option>
                            <option value={ActivityLevel.Athlete}>Atleta</option>
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                        </div>
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Tipo de Dieta</span>
                        <div className="relative">
                          <select className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary outline-none dark:text-white"
                            value={partner.dietType} onChange={e => setPartner({ ...partner, dietType: e.target.value as DietType })}>
                            <option value={DietType.Balanced}>Equilibrada</option>
                            <option value={DietType.Mediterranean}>Mediterránea</option>
                            <option value={DietType.LowCarb}>Baja en Carbohidratos</option>
                            <option value={DietType.Keto}>Cetogénica</option>
                            <option value={DietType.Vegetarian}>Vegetariana</option>
                            <option value={DietType.Vegan}>Vegana</option>
                            <option value={DietType.Paleo}>Paleo</option>
                            <option value={DietType.Protein}>Proteica</option>
                            <option value={DietType.Athlete}>Atleta</option>
                            <option value={DietType.Precooked}>Sin cocina</option>
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                        </div>
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Nº de comidas al día</span>
                        <div className="relative">
                          <select className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary outline-none dark:text-white"
                            value={partner.mealCount ?? 4} onChange={e => setPartner({ ...partner, mealCount: Number(e.target.value) })}>
                            <option value={2}>2 comidas</option>
                            <option value={3}>3 comidas</option>
                            <option value={4}>4 comidas</option>
                            <option value={5}>5 comidas</option>
                          </select>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                        </div>
                      </label>
                      <label className="md:col-span-3 flex flex-col gap-2">
                        <span className="text-sm font-semibold text-text-main dark:text-slate-200">Alimentos a excluir</span>
                        <input className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary outline-none dark:text-white" type="text" placeholder="Ej: mariscos, nueces, lácteos..."
                          value={partner.excludedFoods ?? ''} onChange={e => setPartner({ ...partner, excludedFoods: e.target.value })} />
                      </label>
                    </div>
                    <div className="mt-5">
                      <span className="text-sm font-semibold text-text-main dark:text-slate-200 mb-2 block">Condiciones clínicas</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { val: Condition.DiabetesType2, label: 'Diabetes T2' },
                          { val: Condition.Hypertension, label: 'Hipertensión' },
                          { val: Condition.Hypothyroidism, label: 'Hipotiroidismo' },
                          { val: Condition.Hypertriglyceridemia, label: 'Hipertriglic.' },
                          { val: Condition.LactoseIntolerance, label: 'Intol. Lactosa' },
                          { val: Condition.Celiac, label: 'Celiaquía' },
                          { val: Condition.Obesity, label: 'Obesidad' },
                          { val: Condition.DiabetesType1, label: 'Diabetes T1' },
                          { val: Condition.RenalDisease, label: 'Enf. Renal / ERC' },
                          { val: Condition.EatingDisorderHistory, label: 'Antecedente TCA' },
                        ].map(c => (
                          <label key={c.val} className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors border text-xs ${partner.conditions.includes(c.val) ? 'bg-primary/10 border-primary' : 'bg-background-light dark:bg-background-dark border-transparent'}`}>
                            <input type="checkbox" className="w-4 h-4 text-primary rounded focus:ring-primary"
                              checked={partner.conditions.includes(c.val)}
                              onChange={() => setPartner(prev => ({
                                ...prev,
                                conditions: prev.conditions.includes(c.val)
                                  ? prev.conditions.filter(x => x !== c.val)
                                  : [...prev.conditions, c.val],
                              }))} />
                            <span className="text-text-main dark:text-gray-200 font-medium">{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </form>
        </div>
    </div>
  );
};

export default PatientForm;