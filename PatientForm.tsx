import React, { useState } from 'react';
import { 
  PatientData, 
  Gender, 
  ActivityLevel, 
  Condition, 
  DietType, 
  Duration 
} from '../types';

interface Props {
  onSubmit: (data: PatientData) => void;
  isLoading: boolean;
}

const PatientForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<PatientData>({
    age: 30,
    gender: Gender.Male,
    weight: 70,
    height: 170,
    activity: ActivityLevel.Moderate,
    conditions: [],
    dietType: DietType.Balanced,
    duration: Duration.OneMonth,
    name: ''
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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
                        onClick={handleSubmit} 
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-lg bg-primary text-text-main font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:brightness-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-[20px]">save</span>
                        )}
                        {isLoading ? 'Generando...' : 'Generar Perfil'}
                    </button>
                </div>
            </div>

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
                                    className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none" 
                                    type="number"
                                    min="1"
                                    value={formData.age}
                                    onChange={(e) => setFormData({...formData, age: Number(e.target.value)})}
                                />
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
                                        className="h-12 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white outline-none capitalize"
                                        value={formData.dietType}
                                        onChange={(e) => setFormData({...formData, dietType: e.target.value as DietType})}
                                    >
                                        {Object.values(DietType).map(t => (
                                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                                </div>
                            </label>
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
                                <div className="relative">
                                    <input 
                                        className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none" 
                                        type="number"
                                        step="0.1"
                                        value={formData.weight}
                                        onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})}
                                    />
                                </div>
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-text-main dark:text-slate-200">Altura (cm)</span>
                                <div className="relative">
                                    <input 
                                        className="h-12 w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white placeholder:text-text-sub/60 outline-none" 
                                        type="number"
                                        value={formData.height}
                                        onChange={(e) => setFormData({...formData, height: Number(e.target.value)})}
                                    />
                                </div>
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
                                className="absolute top-0 bottom-0 w-1 bg-text-main dark:bg-white border-x border-white/50 transform -translate-x-1/2 shadow-lg transition-all duration-500"
                                style={{ left: `${Math.min(Math.max((parseFloat(bmi) / 40) * 100, 0), 100)}%` }}
                            ></div>
                        </div>
                    </div>
                    </div>
            </form>
        </div>
    </div>
  );
};

export default PatientForm;