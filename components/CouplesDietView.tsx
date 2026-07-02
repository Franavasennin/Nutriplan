import React, { useState, useEffect, useMemo } from 'react';
import { CouplesDiet, SavedDiet, DietResponse, DayPlan, Meal, CustomFood } from '../types';
import DietPlanDisplay from './DietPlanDisplay';
import { getMealSwap } from '../services/geminiService';
import { useToast } from './Toast';
import { generateShoppingList, ShoppingList } from '../utils/shoppingList';

// ─── Types ────────────────────────────────────────────────────────────────────

type MealKey = 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner';
type ViewMode = 'shared' | 'A' | 'B';

interface Props {
  couplesDiet: CouplesDiet;
  customFoods?: CustomFood[];
  onUpdateCouplesDiet?: (personA: SavedDiet, personB: SavedDiet) => void;
}

// ─── Meal config ──────────────────────────────────────────────────────────────

const MEAL_CONFIGS: { key: MealKey; title: string; time: string; icon: string }[] = [
  { key: 'breakfast',      title: 'Desayuno',     icon: 'wb_twilight',   time: '08:00' },
  { key: 'morningSnack',   title: 'Media Mañana', icon: 'light_mode',    time: '11:00' },
  { key: 'lunch',          title: 'Almuerzo',     icon: 'wb_sunny',      time: '14:00' },
  { key: 'afternoonSnack', title: 'Merienda',     icon: 'bakery_dining', time: '17:30' },
  { key: 'dinner',         title: 'Cena',         icon: 'nights_stay',   time: '20:30' },
];

// ─── Person column inside the shared view ────────────────────────────────────

const PersonColumn: React.FC<{ name: string; meal: Meal | undefined }> = ({ name, meal }) => {
  if (!meal) {
    return (
      <div className="p-4 flex items-center justify-center text-xs text-text-sub dark:text-gray-500 italic">
        Sin esta toma
      </div>
    );
  }
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[16px]">person</span>
          <span className="text-sm font-bold text-text-main dark:text-white">{name}</span>
        </div>
        {meal.calories != null && (
          <span className="text-xs font-black text-primary">{meal.calories} kcal</span>
        )}
      </div>
      {meal.ingredients?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meal.ingredients.map((ing, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 dark:bg-primary/15 text-[10px] font-semibold text-green-800 dark:text-primary border border-primary/20"
            >
              <span className="material-symbols-outlined text-[9px]">grocery</span>
              {ing}
            </span>
          ))}
        </div>
      )}
      {(meal.protein != null || meal.carbs != null || meal.fats != null) && (
        <div className="flex gap-3 text-[10px] font-semibold text-text-sub dark:text-gray-400">
          {meal.protein != null && <span className="text-blue-500">P {meal.protein}g</span>}
          {meal.carbs   != null && <span className="text-yellow-600 dark:text-yellow-400">HC {meal.carbs}g</span>}
          {meal.fats    != null && <span className="text-red-400">G {meal.fats}g</span>}
        </div>
      )}
    </div>
  );
};

// ─── Shared day view ──────────────────────────────────────────────────────────

const SharedDayView: React.FC<{
  dayPlanA: DayPlan | undefined;
  dayPlanB: DayPlan | undefined;
  nameA: string;
  nameB: string;
}> = ({ dayPlanA, dayPlanB, nameA, nameB }) => {
  if (!dayPlanA && !dayPlanB) return null;

  const presentMeals = MEAL_CONFIGS.filter(cfg =>
    !!(dayPlanA?.meals[cfg.key]) || !!(dayPlanB?.meals[cfg.key])
  );

  return (
    <div className="space-y-4">
      {presentMeals.map(({ key, title, time, icon }) => {
        const mealA = dayPlanA?.meals[key];
        const mealB = dayPlanB?.meals[key];
        const sharedMeal = mealA ?? mealB!;

        return (
          <div
            key={key}
            className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] shadow-sm overflow-hidden"
          >
            {/* Meal header — shared recipe name */}
            <div className="px-5 py-3 border-b border-[#f0f4f2] dark:border-[#233629] flex items-center gap-3 bg-gray-50 dark:bg-[#1A2C20]">
              <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary shrink-0">
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
              <div className="shrink-0">
                <h4 className="text-sm font-bold text-[#111813] dark:text-white">{title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
              </div>
              <div className="ml-auto text-right min-w-0">
                <p className="text-sm font-bold text-text-main dark:text-white truncate">{sharedMeal.name}</p>
                <p className="text-[11px] text-text-sub dark:text-gray-400 truncate">{sharedMeal.description}</p>
              </div>
            </div>

            {/* Two-person columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#f0f4f2] dark:divide-[#233629]">
              <PersonColumn name={nameA} meal={mealA} />
              <PersonColumn name={nameB} meal={mealB} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Tab button ───────────────────────────────────────────────────────────────

const TabBtn: React.FC<{
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
      active
        ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
        : 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-sub dark:text-gray-400 hover:border-primary'
    }`}
  >
    <span className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CouplesDietView: React.FC<Props> = ({ couplesDiet, customFoods = [], onUpdateCouplesDiet }) => {
  const { toast } = useToast();

  const [viewMode,       setViewMode]       = useState<ViewMode>('shared');
  const [activeDay,      setActiveDay]      = useState<number>(1);
  const [localA,         setLocalA]         = useState<SavedDiet>(couplesDiet.personA);
  const [localB,         setLocalB]         = useState<SavedDiet>(couplesDiet.personB);
  const [showShopping,   setShowShopping]   = useState(false);
  const [checkedItems,   setCheckedItems]   = useState<Set<string>>(new Set());

  // Lista de la compra conjunta: suma cantidades de ambos planes
  const combinedShoppingList: ShoppingList = useMemo(
    () => generateShoppingList(localA.plan, localB.plan),
    [localA.plan, localB.plan]
  );

  const toggleItem = (key: string) =>
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const pendingCount = combinedShoppingList.reduce(
    (s, cat) => s + cat.items.filter(i => !checkedItems.has(`${cat.category}::${i.name}`)).length,
    0
  );
  const totalCount = combinedShoppingList.reduce((s, cat) => s + cat.items.length, 0);

  // Reset when a different couple is loaded
  useEffect(() => {
    setLocalA(couplesDiet.personA);
    setLocalB(couplesDiet.personB);
    setActiveDay(couplesDiet.personA.plan.weeklyPlan?.[0]?.day ?? 1);
    setViewMode('shared');
    setShowShopping(false);
    setCheckedItems(new Set());
  }, [couplesDiet.id]);

  const nameA = localA.patientData.name || 'Persona A';
  const nameB = localB.patientData.name || 'Persona B';

  const daysA = localA.plan.weeklyPlan ?? [];
  const daysB = localB.plan.weeklyPlan ?? [];

  // ── Save handlers ───────────────────────────────────────────────────────────

  const handleUpdatePlanA = (updatedPlan: DietResponse) => {
    const updated = { ...localA, plan: updatedPlan };
    setLocalA(updated);
    onUpdateCouplesDiet?.(updated, localB);
    toast(`Plan de ${nameA} guardado.`, 'success');
  };

  const handleUpdatePlanB = (updatedPlan: DietResponse) => {
    const updated = { ...localB, plan: updatedPlan };
    setLocalB(updated);
    onUpdateCouplesDiet?.(localA, updated);
    toast(`Plan de ${nameB} guardado.`, 'success');
  };

  // ── Swap handlers ───────────────────────────────────────────────────────────

  const handleSwapMealA = async (_day: number, mealKey: string, currentMeal: Meal): Promise<Meal> => {
    return getMealSwap(currentMeal, mealKey, localA.patientData, localA.metrics);
  };

  const handleSwapMealB = async (_day: number, mealKey: string, currentMeal: Meal): Promise<Meal> => {
    return getMealSwap(currentMeal, mealKey, localB.patientData, localB.metrics);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* ── Header ── */}
      <div className="px-6 lg:px-10 pt-6 no-print">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">group</span>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-text-main dark:text-white">
              Plan de Pareja — {nameA} &amp; {nameB}
            </h1>
          </div>

          {/* View mode tabs */}
          <div className="flex gap-2 flex-wrap">
            <TabBtn
              active={viewMode === 'shared'}
              icon="view_agenda"
              label="Vista conjunta"
              onClick={() => setViewMode('shared')}
            />
            <TabBtn
              active={viewMode === 'A'}
              icon="person"
              label={nameA}
              onClick={() => setViewMode('A')}
            />
            <TabBtn
              active={viewMode === 'B'}
              icon="person"
              label={nameB}
              onClick={() => setViewMode('B')}
            />
          </div>
        </div>
      </div>

      {/* ── Shared view ── */}
      {viewMode === 'shared' && (
        <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6 lg:p-10">
          <div className="max-w-6xl mx-auto flex flex-col gap-6">

            {/* Info banner + shopping list button */}
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <div className="flex-1 flex items-start gap-3 p-4 rounded-xl bg-primary/10 dark:bg-primary/15 border border-primary/25">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">info</span>
                <p className="text-sm text-green-800 dark:text-primary font-medium">
                  Ambos comparten las mismas recetas en cada comida. Las cantidades e ingredientes están adaptados a las macros individuales de cada persona. Para editar o cambiar platos, usa las pestañas individuales.
                </p>
              </div>
              <button
                onClick={() => setShowShopping(v => !v)}
                className={`shrink-0 flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-bold transition-all ${
                  showShopping
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-emerald-400 text-text-main dark:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                Lista conjunta
                {totalCount > 0 && (
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${showShopping ? 'bg-white/30' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'}`}>
                    {pendingCount}/{totalCount}
                  </span>
                )}
              </button>
            </div>

            {/* ── Lista de la compra conjunta ── */}
            {showShopping && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-emerald-300/60 dark:border-emerald-700/40 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]">shopping_cart</span>
                    Lista de la Compra — {nameA} &amp; {nameB}
                    <span className="text-xs font-normal text-text-sub dark:text-gray-400">
                      ({localA.plan.weeklyPlan.length} días · ambas personas sumadas)
                    </span>
                  </h3>
                  <button onClick={() => setShowShopping(false)} className="text-text-sub hover:text-text-main transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {combinedShoppingList.map(cat => (
                    <div key={cat.category} className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-light dark:border-border-dark">
                        <span className="material-symbols-outlined text-emerald-500 text-[16px]">{cat.icon}</span>
                        <p className="text-xs font-black uppercase text-text-main dark:text-white tracking-wide flex-1">{cat.category}</p>
                        <span className="text-[10px] font-bold text-text-sub bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                          {cat.items.filter(i => !checkedItems.has(`${cat.category}::${i.name}`)).length}/{cat.items.length}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {cat.items.map(item => {
                          const key = `${cat.category}::${item.name}`;
                          const checked = checkedItems.has(key);
                          return (
                            <li key={item.name} className="flex items-start gap-1.5 text-sm">
                              <button
                                onClick={() => toggleItem(key)}
                                className={`mt-0.5 shrink-0 size-4 rounded border flex items-center justify-center transition-all ${
                                  checked
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                                }`}
                              >
                                {checked && <span className="material-symbols-outlined text-[10px]">check</span>}
                              </button>
                              <span className={`flex-1 leading-tight transition-all ${checked ? 'line-through text-text-sub dark:text-gray-500' : 'text-text-main dark:text-gray-200'}`}>
                                {item.name}
                              </span>
                              {item.amounts.length > 0 && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {item.amounts.join(' + ')}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Macro summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { name: nameA, metrics: localA.metrics },
                { name: nameB, metrics: localB.metrics },
              ] as const).map(({ name, metrics }) => (
                <div
                  key={name}
                  className="flex items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm"
                >
                  <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-text-main dark:text-white text-sm truncate">{name}</p>
                    <p className="text-[11px] text-text-sub dark:text-gray-400 mt-0.5">
                      <span className="font-bold text-primary">{metrics.macros.calories} kcal</span>
                      {' · '}P {metrics.macros.protein}g
                      {' · '}HC {metrics.macros.carbs}g
                      {' · '}G {metrics.macros.fats}g
                    </p>
                    <p className="text-[10px] text-text-sub dark:text-gray-500 mt-0.5">
                      IMC {metrics.imc} · TMB {metrics.bmr} kcal · GET {metrics.tee} kcal
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Day tabs */}
            <div className="flex overflow-x-auto pb-2 gap-2 border-b border-border-light dark:border-border-dark items-center">
              {daysA.map(day => (
                <button
                  key={day.day}
                  onClick={() => setActiveDay(day.day)}
                  className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold rounded-xl text-sm transition-all ${
                    activeDay === day.day
                      ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                      : 'bg-transparent text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  Día {day.day}
                </button>
              ))}
            </div>

            {/* Shared meals for active day */}
            <SharedDayView
              dayPlanA={daysA.find(d => d.day === activeDay)}
              dayPlanB={daysB.find(d => d.day === activeDay)}
              nameA={nameA}
              nameB={nameB}
            />
          </div>
        </div>
      )}

      {/* ── Person A individual view ── */}
      {viewMode === 'A' && (
        <DietPlanDisplay
          key={`${localA.id}-A`}
          metrics={localA.metrics}
          plan={localA.plan}
          patientName={nameA}
          mealCount={localA.patientData.mealCount}
          fastingProtocol={localA.patientData.fastingProtocol}
          patientData={localA.patientData}
          dietId={localA.id}
          planVersions={localA.planVersions}
          onUpdatePlan={handleUpdatePlanA}
          onSwapMeal={handleSwapMealA}
        />
      )}

      {/* ── Person B individual view ── */}
      {viewMode === 'B' && (
        <DietPlanDisplay
          key={`${localB.id}-B`}
          metrics={localB.metrics}
          plan={localB.plan}
          patientName={nameB}
          mealCount={localB.patientData.mealCount}
          fastingProtocol={localB.patientData.fastingProtocol}
          patientData={localB.patientData}
          dietId={localB.id}
          planVersions={localB.planVersions}
          onUpdatePlan={handleUpdatePlanB}
          onSwapMeal={handleSwapMealB}
        />
      )}

    </div>
  );
};

export default CouplesDietView;
