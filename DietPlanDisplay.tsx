import React, { useState } from 'react';
import { CalculatedMetrics, DietResponse, DayPlan, Meal } from '../types';

interface Props {
  metrics: CalculatedMetrics;
  plan: DietResponse;
  patientName?: string;
}

const MealRow: React.FC<{ name: string, description: string, calories?: number, ingredients?: string[] }> = ({ name, description, calories, ingredients }) => {
    return (
        <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#15231b] border border-gray-100 dark:border-gray-700 rounded-lg group hover:border-primary/50 transition-colors">
            <div className="size-12 rounded-lg bg-cover bg-center shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                <span className="material-symbols-outlined">restaurant</span>
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-[#111813] dark:text-white truncate">{name}</h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{description}</p>
                {ingredients && (
                    <p className="text-[10px] text-primary mt-1 truncate">
                        {ingredients.join(', ')}
                    </p>
                )}
            </div>
            {calories && (
                <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[#111813] dark:text-gray-200">{calories} kcal</p>
                </div>
            )}
        </div>
    )
}

const MealSection: React.FC<{ title: string, time: string, meal: Meal, icon: string, kcal?: number }> = ({ title, time, meal, icon, kcal }) => {
    if (!meal) return null;
    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] shadow-sm overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-[#f0f4f2] dark:border-[#233629] flex justify-between items-center bg-gray-50 dark:bg-[#1A2C20]">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </div>
                    <div>
                        <h4 className="text-base font-bold text-[#111813] dark:text-white">{title}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-3">
                <MealRow name={meal.name} description={meal.description} ingredients={meal.ingredients} calories={kcal} />
            </div>
        </div>
    );
};

const DietPlanDisplay: React.FC<Props> = ({ metrics, plan, patientName }) => {
  const [activeDay, setActiveDay] = useState<number>(1);
  const activeDayPlan = plan.weeklyPlan?.find(d => d.day === activeDay);

  const printPlan = () => {
    window.print();
  };

  const downloadPDF = () => {
    alert("Para guardar como PDF:\n1. En la ventana que se abrirá, busca 'Destino' o 'Impresora'.\n2. Selecciona 'Guardar como PDF'.\n3. Haz clic en 'Guardar'.");
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col print:block print:overflow-visible print:h-auto">
      {/* --- SCREEN VIEW --- */}
      <div className="flex-1 overflow-y-auto print:overflow-visible bg-background-light dark:bg-background-dark p-6 lg:p-10 no-print">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black tracking-tight text-text-main dark:text-white">Plan Nutricional: {patientName || 'Paciente'}</h2>
                    <div className="flex items-center flex-wrap gap-4 text-sm font-bold text-text-sub dark:text-gray-400">
                        <span className="bg-primary/20 text-green-800 dark:text-primary px-3 py-1 rounded-full text-xs uppercase">Calculado OMS-FAO</span>
                        <span>IMC: {metrics.imc}</span>
                        <span>TMB: {metrics.bmr} kcal</span>
                        <span>GET: {metrics.tee} kcal</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                     <button onClick={downloadPDF} className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-red-500 text-white border-2 border-red-600 text-sm font-bold hover:bg-red-600 transition-all shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                        <span>Descargar PDF</span>
                    </button>
                    <button onClick={printPlan} className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark text-text-main dark:text-white text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">print</span>
                        <span>Imprimir</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-transparent dark:border-[#233629] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Calorías</span>
                    <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{metrics.tee}</span>
                    <div className="absolute bottom-0 left-0 h-1 bg-primary w-full"></div>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-transparent dark:border-[#233629] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Proteínas</span>
                    <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{metrics.macros.protein}g</span>
                    <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full opacity-50"></div>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-transparent dark:border-[#233629] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Carbos</span>
                    <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{metrics.macros.carbs}g</span>
                    <div className="absolute bottom-0 left-0 h-1 bg-yellow-500 w-full opacity-50"></div>
                </div>
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-transparent dark:border-[#233629] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">Grasas</span>
                    <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{metrics.macros.fats}g</span>
                    <div className="absolute bottom-0 left-0 h-1 bg-red-400 w-full opacity-50"></div>
                </div>
            </div>

            <div className="flex overflow-x-auto pb-2 gap-2 border-b border-border-light dark:border-border-dark scrollbar-hide">
                {plan.weeklyPlan?.map((day) => (
                    <button
                        key={day.day}
                        onClick={() => setActiveDay(day.day)}
                        className={`whitespace-nowrap px-6 py-2.5 font-bold rounded-xl text-sm transition-all ${activeDay === day.day ? 'bg-primary text-background-dark shadow-lg shadow-primary/20' : 'bg-transparent text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        Día {day.day}
                    </button>
                ))}
            </div>
            
            {activeDayPlan && activeDayPlan.meals && (
                <div className="grid grid-cols-1 gap-6">
                    <MealSection title="Desayuno" time="08:00 AM" meal={activeDayPlan.meals.breakfast} icon="wb_twilight" />
                    <MealSection title="Media Mañana" time="11:00 AM" meal={activeDayPlan.meals.morningSnack} icon="light_mode" />
                    <MealSection title="Almuerzo" time="02:00 PM" meal={activeDayPlan.meals.lunch} icon="wb_sunny" />
                    <MealSection title="Merienda" time="05:30 PM" meal={activeDayPlan.meals.afternoonSnack} icon="bakery_dining" />
                    <MealSection title="Cena" time="09:00 PM" meal={activeDayPlan.meals.dinner} icon="nights_stay" />
                </div>
            )}

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] p-6 shadow-sm mb-20">
                <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Pautas de Nutrición</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plan.generalGuidelines?.map((guide, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-text-sub dark:text-gray-400 bg-background-light dark:bg-background-dark p-3 rounded-lg border border-border-light dark:border-border-dark">
                            <span className="material-symbols-outlined text-primary text-sm mt-0.5">verified</span>
                            {guide}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      </div>

      {/* --- PRINT VIEW --- */}
      <div className="hidden only-print bg-white text-black p-12 w-full">
        <div className="flex justify-between items-center border-b-4 border-green-500 pb-6 mb-8">
          <div>
             <h1 className="text-4xl font-black uppercase tracking-tighter text-green-600">NutriPlan Pro</h1>
             <p className="text-lg font-bold text-gray-700">Dra. Ester Correa - Nutrición Clínica</p>
          </div>
          <div className="text-right border-l-2 border-gray-200 pl-6">
            <h2 className="text-2xl font-black">{patientName || 'PACIENTE'}</h2>
            <p className="text-sm font-medium text-gray-500">Fecha: {new Date().toLocaleDateString('es-ES')}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-10 text-center bg-gray-50 p-6 rounded-2xl border border-gray-200">
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">IMC Estimado</span><span className="text-xl font-black">{metrics.imc}</span></div>
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">Energía (GET)</span><span className="text-xl font-black">{metrics.tee} kcal</span></div>
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">Metabolismo Basal</span><span className="text-xl font-black">{metrics.bmr} kcal</span></div>
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">Distribución Macros</span><span className="text-xs font-bold block mt-1">P:{metrics.macros.protein}g • C:{metrics.macros.carbs}g • G:{metrics.macros.fats}g</span></div>
        </div>

        <div className="space-y-8">
            {plan.weeklyPlan?.map((day) => (
              <div key={day.day} className="break-inside-avoid mb-6 border-b border-gray-100 pb-6">
                <h4 className="font-black text-xl mb-4 text-white bg-black inline-block px-4 py-1 rounded-md">DÍA {day.day}</h4>
                <div className="grid grid-cols-1 gap-3">
                   <div className="flex gap-4">
                      <div className="w-24 font-bold uppercase text-[9px] text-gray-400 pt-1">Desayuno</div>
                      <div className="flex-1 text-sm font-bold">{day.meals.breakfast.name} <span className="block text-[11px] font-normal text-gray-600 italic">{day.meals.breakfast.description}</span></div>
                   </div>
                   <div className="flex gap-4 bg-gray-50 p-2 rounded">
                      <div className="w-24 font-bold uppercase text-[9px] text-gray-400 pt-1">Media Mañana</div>
                      <div className="flex-1 text-sm font-bold">{day.meals.morningSnack.name} <span className="block text-[11px] font-normal text-gray-600 italic">{day.meals.morningSnack.description}</span></div>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-24 font-bold uppercase text-[9px] text-gray-400 pt-1">Almuerzo</div>
                      <div className="flex-1 text-sm font-bold">{day.meals.lunch.name} <span className="block text-[11px] font-normal text-gray-600 italic">{day.meals.lunch.description}</span></div>
                   </div>
                   <div className="flex gap-4 bg-gray-50 p-2 rounded">
                      <div className="w-24 font-bold uppercase text-[9px] text-gray-400 pt-1">Merienda</div>
                      <div className="flex-1 text-sm font-bold">{day.meals.afternoonSnack.name} <span className="block text-[11px] font-normal text-gray-600 italic">{day.meals.afternoonSnack.description}</span></div>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-24 font-bold uppercase text-[9px] text-gray-400 pt-1">Cena</div>
                      <div className="flex-1 text-sm font-bold">{day.meals.dinner.name} <span className="block text-[11px] font-normal text-gray-600 italic">{day.meals.dinner.description}</span></div>
                   </div>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-8 pt-8 border-t-2 border-green-500 break-inside-avoid">
            <h5 className="font-black text-lg mb-4 uppercase text-green-700">Recomendaciones del Especialista</h5>
            <ul className="space-y-2">
                {plan.generalGuidelines?.map((g, i) => (
                    <li key={i} className="text-xs flex gap-3"><span className="text-green-500 font-bold">•</span> {g}</li>
                ))}
            </ul>
        </div>
        
        <div className="mt-10 text-center text-[9px] text-gray-400 italic">
            Documento generado por NutriPlan Pro AI para Ester Correa.
        </div>
      </div>
    </div>
  );
};

export default DietPlanDisplay;