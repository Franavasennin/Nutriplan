import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalculatedMetrics, DietResponse, DayPlan, Meal, FastingProtocol, DietType, DIET_TYPE_LABELS, PatientData, ActivityLevel, Condition, PlanVersion, Recipe } from '../types';
import { CLINIC } from '../config/clinic';
import { RECIPES } from '../data/recipes';
import { generateShoppingList, ShoppingList } from '../utils/shoppingList';
import { generateSingleMeal } from '../services/geminiService';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

interface Props {
  metrics: CalculatedMetrics;
  plan: DietResponse;
  patientName?: string;
  mealCount?: number;
  fastingProtocol?: FastingProtocol;
  patientData?: PatientData;
  isLoading?: boolean;
  planVersions?: PlanVersion[];
  dietId?: string;
  onUpdatePlan?: (updatedPlan: DietResponse) => void;
  onRegenerate?: (newDietType: DietType) => void;
  onRegenerateDay?: (dayNumber: number) => void;
  onSwapMeal?: (dayNumber: number, mealKey: string, currentMeal: Meal) => Promise<Meal>;
  onRestoreVersion?: (version: PlanVersion) => void;
}

// ─── Editor de comida ─────────────────────────────────────────────────────────

interface MealEditorProps {
  meal: Meal;
  mealKey: string;
  onSave: (updated: Meal) => void;
  onCancel: () => void;
}

const MealEditor: React.FC<MealEditorProps> = ({ meal, mealKey, onSave, onCancel }) => {
  const [tab,         setTab]         = useState<'manual' | 'recipes'>('manual');
  const [name,        setName]        = useState(meal.name);
  const [description, setDescription] = useState(meal.description);
  const [ingredients, setIngredients] = useState(meal.ingredients.join('\n'));
  const [recipeQuery, setRecipeQuery] = useState('');

  const mealTagMap: Record<string, string> = {
    breakfast: 'desayuno', morningSnack: 'merienda',
    lunch: 'almuerzo', afternoonSnack: 'merienda', dinner: 'cena',
  };

  const filteredRecipes = RECIPES.filter(r => {
    const mealTag = mealTagMap[mealKey] ?? '';
    const hasMealTag = mealTag ? r.tags.some(t => t.includes(mealTag)) : true;
    if (!hasMealTag) return false;
    if (!recipeQuery.trim()) return true;
    const q = recipeQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
           r.tags.some(t => t.includes(q));
  }).slice(0, 20);

  const handleInsertRecipe = (recipe: Recipe) => {
    setName(recipe.title);
    setDescription(recipe.description);
    setIngredients(recipe.ingredients.join('\n'));
    setTab('manual');
  };

  const handleSave = () => {
    const parsed = ingredients.split('\n').map(s => s.trim()).filter(Boolean);
    onSave({ ...meal, name, description, ingredients: parsed });
  };

  return (
    <div className="p-4 bg-white dark:bg-[#15231b] border-2 border-primary/50 rounded-lg space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button type="button" onClick={() => setTab('manual')}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${tab === 'manual' ? 'bg-white dark:bg-gray-700 text-text-main dark:text-white shadow-sm' : 'text-text-sub dark:text-gray-400'}`}>
          Editar manual
        </button>
        <button type="button" onClick={() => setTab('recipes')}
          className={`flex-1 py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 ${tab === 'recipes' ? 'bg-white dark:bg-gray-700 text-text-main dark:text-white shadow-sm' : 'text-text-sub dark:text-gray-400'}`}>
          <span className="material-symbols-outlined text-[14px]">menu_book</span>
          Importar receta
        </button>
      </div>

      {tab === 'recipes' ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Buscar receta..."
            value={recipeQuery}
            onChange={e => setRecipeQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm dark:text-white outline-none focus:border-primary"
          />
          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {filteredRecipes.length === 0 && (
              <p className="text-xs text-center text-text-sub py-4">Sin resultados. Prueba otro término.</p>
            )}
            {filteredRecipes.map(recipe => (
              <button key={recipe.id} type="button" onClick={() => handleInsertRecipe(recipe)}
                className="w-full text-left p-3 rounded-lg border border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">{recipe.title}</p>
                    <p className="text-[11px] text-text-sub dark:text-gray-400 mt-0.5">{recipe.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-primary">{recipe.calories} kcal</p>
                    <p className="text-[10px] text-text-sub">{recipe.prepTime} min</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Nombre</label>
            <input title="Nombre de la comida" value={name} onChange={e => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-text-main dark:text-white outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Descripción</label>
            <input title="Descripción de la comida" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Ingredientes (uno por línea)</label>
            <textarea title="Ingredientes de la comida" value={ingredients} onChange={e => setIngredients(e.target.value)} rows={4}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
          Cancelar
        </button>
        {tab === 'manual' && (
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs font-black bg-primary text-background-dark hover:brightness-90 transition-all">
            Guardar
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Fila de comida ───────────────────────────────────────────────────────────

const MealRow: React.FC<{ meal: Meal; onEditRequest: () => void; onSwapRequest?: () => void; isSwapping?: boolean }> = ({ meal, onEditRequest, onSwapRequest, isSwapping }) => (
  <div className="p-4 bg-white dark:bg-[#15231b] border border-gray-100 dark:border-gray-700 rounded-lg group hover:border-primary/50 transition-colors">
    <div className="flex items-start gap-4">
      <div className="size-10 rounded-lg shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 mt-0.5">
        <span className="material-symbols-outlined text-[20px]">restaurant</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h5 className="text-sm font-bold text-[#111813] dark:text-white">{meal.name}</h5>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meal.description}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
            {onSwapRequest && (
              <button onClick={onSwapRequest} title="Sugerir alternativa con IA"
                disabled={isSwapping}
                className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-all disabled:opacity-40">
                {isSwapping
                  ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  : <span className="material-symbols-outlined text-base">shuffle</span>
                }
              </button>
            )}
            <button onClick={onEditRequest} title="Editar"
              className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary transition-all">
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
          </div>
        </div>
        {meal.ingredients?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {meal.ingredients.map((ing, idx) => (
              <span key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/15 text-[11px] font-semibold text-green-800 dark:text-primary border border-primary/20">
                <span className="material-symbols-outlined text-[11px]">grocery</span>
                {ing}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

// ─── Sección de toma ──────────────────────────────────────────────────────────

interface MealSectionProps {
  title: string; time: string; meal: Meal; icon: string; mealKey: string;
  editingKey: string; activeEditKey: string | null;
  onEditRequest: (key: string) => void;
  onSave: (updated: Meal) => void;
  onCancel: () => void;
  onSwapRequest?: () => void;
  isSwapping?: boolean;
  onRemove?: () => void;
}

const MealSection: React.FC<MealSectionProps> = ({
  title, time, meal, icon, mealKey, editingKey, activeEditKey, onEditRequest, onSave, onCancel, onSwapRequest, isSwapping, onRemove,
}) => {
  if (!meal) return null;
  const isEditing = activeEditKey === editingKey;
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#f0f4f2] dark:border-[#233629] flex items-center gap-3 bg-gray-50 dark:bg-[#1A2C20]">
        <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div>
          <h4 className="text-base font-bold text-[#111813] dark:text-white">{title}</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
        </div>
        {meal.calories != null && (
          <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-text-sub dark:text-gray-400">
            <span className="text-primary font-bold">{meal.calories} kcal</span>
            {meal.protein != null && <span>P {meal.protein}g</span>}
            {meal.carbs   != null && <span>HC {meal.carbs}g</span>}
            {meal.fats    != null && <span>G {meal.fats}g</span>}
          </div>
        )}
        {onRemove && (
          <button onClick={onRemove} title={`Eliminar ${title}`}
            className={`size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all no-print ${meal.calories != null ? '' : 'ml-auto'}`}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
      <div className="p-4">
        {isEditing
          ? <MealEditor meal={meal} mealKey={mealKey} onSave={onSave} onCancel={onCancel} />
          : <MealRow meal={meal} onEditRequest={() => onEditRequest(editingKey)} onSwapRequest={onSwapRequest} isSwapping={isSwapping} />
        }
      </div>
    </div>
  );
};

// ─── Config de tomas (dinámica según protocolo) ───────────────────────────────

type MealKey = 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner';

interface MealSectionConfig {
  key: MealKey;
  title: string;
  time: string;
  icon: string;
}

const ALL_MEAL_CONFIGS: MealSectionConfig[] = [
  { key: 'breakfast',      title: 'Desayuno',     icon: 'wb_twilight'   , time: '08:00' },
  { key: 'morningSnack',   title: 'Media Mañana', icon: 'light_mode'    , time: '11:00' },
  { key: 'lunch',          title: 'Almuerzo',     icon: 'wb_sunny'      , time: '14:00' },
  { key: 'afternoonSnack', title: 'Merienda',     icon: 'bakery_dining' , time: '17:30' },
  { key: 'dinner',         title: 'Cena',         icon: 'nights_stay'   , time: '20:30' },
];

// Meal times per fasting protocol
const FASTING_TIMES: Record<string, Partial<Record<MealKey, string>>> = {
  [FastingProtocol.IF16_8]: { breakfast: '12:00', morningSnack: '13:30', lunch: '15:30', afternoonSnack: '17:30', dinner: '19:30' },
  [FastingProtocol.IF18_6]: { breakfast: '13:00', morningSnack: '14:30', lunch: '16:00', afternoonSnack: undefined,  dinner: '18:45' },
  [FastingProtocol.IF20_4]: { breakfast: undefined,   morningSnack: undefined,   lunch: '14:00', afternoonSnack: undefined,  dinner: '17:30' },
  [FastingProtocol.IF5_2]:  { breakfast: '08:00', morningSnack: '11:00', lunch: '14:00', afternoonSnack: '17:30', dinner: '20:30' },
};

const MEAL_KEYS_BY_COUNT: Record<number, MealKey[]> = {
  2: ['lunch', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'morningSnack', 'lunch', 'dinner'],
  5: ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'],
};

function getMealSections(mealCount = 5, fastingProtocol?: FastingProtocol): MealSectionConfig[] {
  const allowedKeys = MEAL_KEYS_BY_COUNT[mealCount] ?? MEAL_KEYS_BY_COUNT[5];
  const times = (fastingProtocol && fastingProtocol !== FastingProtocol.None)
    ? FASTING_TIMES[fastingProtocol] ?? {}
    : {};

  return ALL_MEAL_CONFIGS
    .filter(cfg => allowedKeys.includes(cfg.key))
    .map(cfg => ({
      ...cfg,
      time: times[cfg.key] ?? cfg.time,
    }))
    .filter(cfg => {
      if (!fastingProtocol || fastingProtocol === FastingProtocol.None) return true;
      const t = FASTING_TIMES[fastingProtocol];
      if (!t) return true;
      return cfg.key in t ? (t[cfg.key] !== undefined) : true;
    });
}

// ─── Recomendación de tipo de dieta ──────────────────────────────────────────

function getRecommendedDiet(metrics: CalculatedMetrics, patient: PatientData): { type: DietType; reason: string } {
  const { imc } = metrics;
  const { conditions = [], activity, targetWeight, weight } = patient;
  const isWeightLoss = targetWeight != null && targetWeight < weight;
  const isWeightGain = targetWeight != null && targetWeight > weight;

  if (conditions.includes(Condition.DiabetesType1) || conditions.includes(Condition.DiabetesType2)) {
    return { type: DietType.LowCarb, reason: 'Diabetes: reducir carbohidratos mejora el control glucémico.' };
  }
  if (conditions.includes(Condition.Hypertriglyceridemia)) {
    return { type: DietType.Mediterranean, reason: 'Hipertrigliceridemia: la mediterránea reduce los triglicéridos.' };
  }
  if (activity === ActivityLevel.Athlete || activity === ActivityLevel.Heavy) {
    return { type: DietType.Athlete, reason: 'Alta actividad: más carbohidratos para rendir y recuperar.' };
  }
  if (isWeightGain) {
    return { type: DietType.Protein, reason: 'Ganancia de peso: alta proteína para aumentar masa magra.' };
  }
  if (isWeightLoss && imc > 30) {
    return { type: DietType.LowCarb, reason: 'Pérdida con obesidad: restricción de carbohidratos acelera los resultados.' };
  }
  if (isWeightLoss && imc > 25) {
    return { type: DietType.Mediterranean, reason: 'Pérdida moderada: la mediterránea es sostenible y efectiva.' };
  }
  return { type: DietType.Balanced, reason: 'Perfil general: dieta equilibrada OMS como base sólida.' };
}

// ─── Totales reales de un día ─────────────────────────────────────────────────

function sumDayMacros(meals: DayPlan['meals']) {
  let calories = 0, protein = 0, carbs = 0, fats = 0, hasData = false;
  for (const meal of Object.values(meals)) {
    if (!meal) continue;
    if (meal.calories != null) { calories += meal.calories; hasData = true; }
    if (meal.protein  != null)   protein += meal.protein;
    if (meal.carbs    != null)   carbs   += meal.carbs;
    if (meal.fats     != null)   fats    += meal.fats;
  }
  return hasData ? { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fats: Math.round(fats) } : null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

const DietPlanDisplay: React.FC<Props> = ({
  metrics, plan, patientName, mealCount, fastingProtocol, patientData,
  isLoading, planVersions, dietId, onUpdatePlan, onRegenerate, onRegenerateDay, onSwapMeal, onRestoreVersion,
}) => {
  const { confirm } = useConfirm();
  const { toast }   = useToast();

  const [activeDay,      setActiveDay]      = useState<number>(1);
  const [activeEdit,     setActiveEdit]     = useState<string | null>(null);
  const [hasChanges,     setHasChanges]     = useState(false);
  const [localPlan,      setLocalPlan]      = useState<DietResponse>(plan);
  const [showRegen,      setShowRegen]      = useState(false);
  const [showVersions,   setShowVersions]   = useState(false);
  const [showShopping,   setShowShopping]   = useState(false);
  const [selectedDiet,   setSelectedDiet]   = useState<DietType>(patientData?.dietType ?? DietType.Balanced);
  const [swappingKey,    setSwappingKey]    = useState<string | null>(null); // `${day}-${mealKey}`
  const [listHasChanges, setListHasChanges] = useState(false);   // feature 4: lista compra
  const [addingMeal,     setAddingMeal]     = useState(false);   // feature 1: spinner añadir toma
  const [showMealPicker, setShowMealPicker] = useState(false);   // feature 1: selector de toma

  const shoppingList: ShoppingList = useMemo(() => generateShoppingList(localPlan), [localPlan]);

  // ── Editable shopping list ──────────────────────────────────────────────────
  interface EditItem { name: string; amounts: string[]; checked: boolean; }
  interface EditCat  { category: string; icon: string; color: string; items: EditItem[]; }
  const [editList,    setEditList]    = useState<EditCat[]>([]);
  const [addingToCat, setAddingToCat] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // feature 4: clave localStorage por dieta y helpers seguros (modo incógnito)
  const shoppingKey = dietId ? `shopping_list_${dietId}` : null;
  const canPersistList = (() => {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch { return false; }
  })();

  useEffect(() => {
    if (showShopping) {
      // Intentar cargar una lista guardada para esta dieta
      let loaded: EditCat[] | null = null;
      if (shoppingKey && canPersistList) {
        try {
          const raw = localStorage.getItem(shoppingKey);
          if (raw) loaded = JSON.parse(raw) as EditCat[];
        } catch { loaded = null; }
      }
      setEditList(loaded ?? shoppingList.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, checked: false })),
      })));
      setListHasChanges(false);
      setAddingToCat(null);
      setNewItemName('');
    }
  }, [showShopping, shoppingList]);

  const saveShoppingList = () => {
    if (!shoppingKey || !canPersistList) return;
    try {
      localStorage.setItem(shoppingKey, JSON.stringify(editList));
      setListHasChanges(false);
      toast('Lista de la compra guardada.', 'success');
    } catch {
      toast('No se pudo guardar la lista (almacenamiento no disponible).', 'error');
    }
  };

  const toggleShopItem = (ci: number, ii: number) => {
    setEditList(prev => prev.map((cat, c) =>
      c !== ci ? cat : { ...cat, items: cat.items.map((it, i) => i !== ii ? it : { ...it, checked: !it.checked }) }
    ));
    setListHasChanges(true);
  };

  const removeShopItem = (ci: number, ii: number) => {
    setEditList(prev =>
      prev.map((cat, c) =>
        c !== ci ? cat : { ...cat, items: cat.items.filter((_, i) => i !== ii) }
      ).filter(cat => cat.items.length > 0)
    );
    setListHasChanges(true);
  };

  const addShopItem = (ci: number) => {
    const name = newItemName.trim();
    if (!name) return;
    setEditList(prev => prev.map((cat, c) =>
      c !== ci ? cat : {
        ...cat,
        items: [...cat.items, { name: name.charAt(0).toUpperCase() + name.slice(1), amounts: [], checked: false }]
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    ));
    setNewItemName('');
    setAddingToCat(null);
    setListHasChanges(true);
  };

  useEffect(() => {
    setLocalPlan(plan);
    setActiveDay(plan.weeklyPlan?.[0]?.day ?? 1);
    setHasChanges(false);
    setActiveEdit(null);
  }, [plan]);

  const mealSections = getMealSections(mealCount, fastingProtocol);

  const activeDayPlan = localPlan.weeklyPlan?.find(d => d.day === activeDay);
  const dayTotals = activeDayPlan ? sumDayMacros(activeDayPlan.meals) : null;

  const recommendation = patientData ? getRecommendedDiet(metrics, patientData) : null;

  const handleSaveMeal = (mealKey: MealKey, updated: Meal) => {
    setLocalPlan(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(d =>
        d.day === activeDay ? { ...d, meals: { ...d.meals, [mealKey]: updated } } : d
      ),
    }));
    setActiveEdit(null);
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    onUpdatePlan?.(localPlan);
    setHasChanges(false);
    // feature 4: el plan cambió → invalidar lista guardada
    if (shoppingKey && canPersistList) {
      try { localStorage.removeItem(shoppingKey); } catch { /* silent */ }
    }
  };

  // ── feature 1: añadir / quitar tomas sin rehacer la dieta ───────────────────
  // Tomas disponibles que NO están presentes en el día activo
  const presentMealKeys = activeDayPlan ? Object.keys(activeDayPlan.meals).filter(k => !!activeDayPlan.meals[k as MealKey]) : [];
  const availableToAdd = ALL_MEAL_CONFIGS.filter(cfg => !presentMealKeys.includes(cfg.key));

  const handleAddMeal = async (mealKey: MealKey) => {
    if (!patientData || !activeDayPlan) {
      toast('Faltan datos del paciente para generar la toma.', 'error');
      return;
    }
    setShowMealPicker(false);
    setAddingMeal(true);
    try {
      // Macros residuales = objetivo diario − lo que ya suman las tomas del día
      const used = sumDayMacros(activeDayPlan.meals) ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
      const residual = {
        calories: metrics.macros.calories - used.calories,
        protein:  metrics.macros.protein  - used.protein,
        carbs:    metrics.macros.carbs    - used.carbs,
        fats:     metrics.macros.fats     - used.fats,
      };
      const newMeal = await generateSingleMeal(mealKey, residual, patientData, metrics);
      setLocalPlan(prev => ({
        ...prev,
        weeklyPlan: prev.weeklyPlan.map(d =>
          d.day === activeDay ? { ...d, meals: { ...d.meals, [mealKey]: newMeal } } : d
        ),
      }));
      setHasChanges(true);
      toast('Toma añadida. Recuerda guardar los cambios.', 'success');
    } catch (err: any) {
      toast(err.message || 'No se pudo generar la toma.', 'error');
    } finally {
      setAddingMeal(false);
    }
  };

  const handleRemoveMeal = async (mealKey: MealKey, mealName: string) => {
    if (!activeDayPlan) return;
    if (presentMealKeys.length <= 1) {
      toast('No puedes eliminar la última toma del día.', 'error');
      return;
    }
    const ok = await confirm({
      title:        'Eliminar toma',
      message:      `¿Eliminar "${mealName}" del día ${activeDay}? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel:  'Cancelar',
      danger:       true,
    });
    if (!ok) return;
    setLocalPlan(prev => ({
      ...prev,
      weeklyPlan: prev.weeklyPlan.map(d => {
        if (d.day !== activeDay) return d;
        const meals = { ...d.meals };
        delete meals[mealKey];
        return { ...d, meals };
      }),
    }));
    setHasChanges(true);
    toast('Toma eliminada. Recuerda guardar los cambios.', 'success');
  };

  // ── feature 5: rehacer día con confirmación ─────────────────────────────────
  const handleRegenerateDayConfirm = async () => {
    if (!onRegenerateDay) return;
    const ok = await confirm({
      title:        `¿Rehacer el día ${activeDay}?`,
      message:      `Se regenerará el menú completo del día ${activeDay}. El contenido actual se perderá.`,
      confirmLabel: 'Rehacer',
      cancelLabel:  'Cancelar',
      danger:       true,
    });
    if (ok) onRegenerateDay(activeDay);
  };

  const handleSwap = useCallback(async (dayNumber: number, mealKey: MealKey) => {
    if (!onSwapMeal) return;
    const dayPlan = localPlan.weeklyPlan.find(d => d.day === dayNumber);
    const currentMeal = dayPlan?.meals[mealKey];
    if (!currentMeal) return;
    const swapId = `${dayNumber}-${mealKey}`;
    setSwappingKey(swapId);
    try {
      const swapped = await onSwapMeal(dayNumber, mealKey, currentMeal);
      setLocalPlan(prev => ({
        ...prev,
        weeklyPlan: prev.weeklyPlan.map(d =>
          d.day === dayNumber ? { ...d, meals: { ...d.meals, [mealKey]: swapped } } : d
        ),
      }));
      setHasChanges(true);
    } finally {
      setSwappingKey(null);
    }
  }, [localPlan, onSwapMeal]);

  return (
    <div className="flex-1 flex flex-col print:block print:overflow-visible print:h-auto">

      {/* ── Vista pantalla ── */}
      <div className="flex-1 overflow-y-auto print:overflow-visible bg-background-light dark:bg-background-dark p-6 lg:p-10 no-print">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-black tracking-tight text-text-main dark:text-white">
                Plan Nutricional: {patientName || 'Paciente'}
              </h2>
              <div className="flex items-center flex-wrap gap-4 text-sm font-bold text-text-sub dark:text-gray-400">
                <span className="bg-primary/20 text-green-800 dark:text-primary px-3 py-1 rounded-full text-xs uppercase">OMS-FAO</span>
                <span>IMC: {metrics.imc}</span>
                <span>TMB: {metrics.bmr} kcal</span>
                <span>GET: {metrics.tee} kcal</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {hasChanges && (
                <button onClick={handleSaveAll}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-background-dark text-sm font-black hover:brightness-90 transition-all shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  Guardar cambios
                </button>
              )}
              {planVersions && planVersions.length > 0 && onRestoreVersion && (
                <button onClick={() => setShowVersions(v => !v)}
                  className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-amber-400 transition-all">
                  <span className="material-symbols-outlined text-[18px] text-amber-500">history</span>
                  <span className="text-xs">{planVersions.length}</span>
                </button>
              )}
              <button onClick={() => { setShowShopping(v => !v); setShowRegen(false); setShowVersions(false); }}
                className={`flex items-center gap-2 h-11 px-6 rounded-xl border text-sm font-bold transition-all ${showShopping ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-emerald-400'}`}>
                <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                <span className="hidden sm:inline">Lista compra</span>
              </button>
              {onRegenerateDay && (
                <button onClick={handleRegenerateDayConfirm}
                  disabled={isLoading}
                  title={`Rehacer el menú del día ${activeDay}`}
                  className="flex items-center gap-2 h-11 px-5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className={`material-symbols-outlined text-[20px] text-amber-500 ${isLoading ? 'animate-spin' : ''}`}>
                    {isLoading ? 'progress_activity' : 'replay'}
                  </span>
                  <span className="hidden sm:inline">Rehacer día {activeDay}</span>
                </button>
              )}
              {onRegenerate && (
                <button onClick={() => setShowRegen(v => !v)}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-primary transition-all">
                  <span className="material-symbols-outlined text-[20px] text-primary">refresh</span>
                  Rehacer plan
                </button>
              )}
              <button onClick={() => window.print()}
                className="flex items-center gap-2 h-11 px-6 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                PDF / Imprimir
              </button>
            </div>
          </div>

          {/* Regen panel */}
          {showRegen && onRegenerate && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-primary/40 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_fix_high</span>
                <h3 className="font-bold text-text-main dark:text-white">Rehacer plan nutricional</h3>
              </div>
              {recommendation && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/25">
                  <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">lightbulb</span>
                  <div>
                    <p className="text-xs font-bold text-green-800 dark:text-primary">Recomendación del sistema</p>
                    <p className="text-sm font-semibold text-text-main dark:text-white mt-0.5">{DIET_TYPE_LABELS[recommendation.type]}</p>
                    <p className="text-xs text-text-sub dark:text-gray-400 mt-0.5">{recommendation.reason}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedDiet(recommendation.type)}
                    className="ml-auto shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-background-dark hover:brightness-90 transition-all">
                    Usar
                  </button>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1">
                  <select
                    title="Tipo de dieta"
                    className="h-11 w-full appearance-none rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pr-10 focus:ring-2 focus:ring-primary dark:text-white outline-none text-sm"
                    value={selectedDiet}
                    onChange={e => setSelectedDiet(e.target.value as DietType)}
                  >
                    {(Object.values(DietType) as DietType[]).map(d => (
                      <option key={d} value={d}>{DIET_TYPE_LABELS[d]}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined pointer-events-none text-text-sub">expand_more</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowRegen(false)}
                    className="h-11 px-5 rounded-lg border border-border-light dark:border-border-dark text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => { onRegenerate(selectedDiet); setShowRegen(false); }}
                    disabled={isLoading}
                    className="h-11 px-6 rounded-lg bg-primary text-background-dark text-sm font-black hover:brightness-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Generar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Calorías',  target: `${metrics.tee}`,             actual: dayTotals ? `${dayTotals.calories}` : null,             color: 'bg-primary',    unit: 'kcal' },
              { label: 'Proteínas', target: `${metrics.macros.protein}`,  actual: dayTotals ? `${dayTotals.protein}`  : null,             color: 'bg-blue-500',   unit: 'g'    },
              { label: 'Carbos',    target: `${metrics.macros.carbs}`,    actual: dayTotals ? `${dayTotals.carbs}`    : null,             color: 'bg-yellow-500', unit: 'g'    },
              { label: 'Grasas',    target: `${metrics.macros.fats}`,     actual: dayTotals ? `${dayTotals.fats}`     : null,             color: 'bg-red-400',    unit: 'g'    },
            ].map(s => (
              <div key={s.label} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-transparent dark:border-[#233629] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-1">{s.label}</span>
                {s.actual != null ? (
                  <>
                    <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{s.actual}{s.unit}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">obj. {s.target}{s.unit}</span>
                  </>
                ) : (
                  <span className="text-2xl font-extrabold text-[#111813] dark:text-white">{s.target}{s.unit}</span>
                )}
                <div className={`absolute bottom-0 left-0 h-1 w-full ${s.color} opacity-70`} />
              </div>
            ))}
          </div>

          {/* Version history panel */}
          {showVersions && planVersions && planVersions.length > 0 && onRestoreVersion && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-amber-300/50 dark:border-amber-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">history</span>
                  Versiones anteriores
                </h3>
                <button onClick={() => setShowVersions(false)} className="text-text-sub hover:text-text-main transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="space-y-2">
                {[...planVersions].reverse().map((v, i) => (
                  <div key={v.timestamp} className="flex items-center justify-between p-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                    <div>
                      <p className="text-sm font-semibold text-text-main dark:text-white">
                        Versión {planVersions.length - i}
                      </p>
                      <p className="text-xs text-text-sub dark:text-gray-400">
                        {new Date(v.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {' · '}{v.plan.weeklyPlan.length} días
                      </p>
                    </div>
                    <button onClick={() => { onRestoreVersion(v); setShowVersions(false); }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shopping list panel */}
          {showShopping && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-emerald-300/60 dark:border-emerald-700/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500 text-[20px]">shopping_cart</span>
                  Lista de la Compra — {localPlan.weeklyPlan.length} días
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-sub dark:text-gray-400 hidden sm:inline">
                    {editList.reduce((s, c) => s + c.items.filter(i => !i.checked).length, 0)} pendientes · {editList.reduce((s, c) => s + c.items.length, 0)} total
                  </span>
                  {listHasChanges && canPersistList && (
                    <button onClick={saveShoppingList}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Guardar lista
                    </button>
                  )}
                  <button onClick={() => setShowShopping(false)} className="text-text-sub hover:text-text-main transition-colors">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {editList.map((cat, ci) => (
                  <div key={cat.category} className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-light dark:border-border-dark">
                      <span className="material-symbols-outlined text-emerald-500 text-[16px]">{cat.icon}</span>
                      <p className="text-xs font-black uppercase text-text-main dark:text-white tracking-wide flex-1">{cat.category}</p>
                      <span className="text-[10px] font-bold text-text-sub bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                        {cat.items.filter(i => !i.checked).length}/{cat.items.length}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {cat.items.map((item, ii) => (
                        <li key={`${item.name}-${ii}`} className="group flex items-start gap-1.5 text-sm">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleShopItem(ci, ii)}
                            className={`mt-0.5 shrink-0 size-4 rounded border flex items-center justify-center transition-all ${
                              item.checked
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                            }`}
                          >
                            {item.checked && <span className="material-symbols-outlined text-[10px]">check</span>}
                          </button>
                          {/* Name */}
                          <span className={`flex-1 leading-tight transition-all ${item.checked ? 'line-through text-text-sub dark:text-gray-500' : 'text-text-main dark:text-gray-200'}`}>
                            {item.name}
                          </span>
                          {/* Amount */}
                          {item.amounts.length > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {item.amounts.join(' + ')}
                            </span>
                          )}
                          {/* Remove */}
                          <button
                            onClick={() => removeShopItem(ci, ii)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                            title="Eliminar"
                          >
                            <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {/* Add item */}
                    {addingToCat === ci ? (
                      <div className="flex gap-1 mt-2">
                        <input
                          autoFocus
                          type="text"
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addShopItem(ci); if (e.key === 'Escape') { setAddingToCat(null); setNewItemName(''); } }}
                          placeholder="Nombre del artículo..."
                          className="flex-1 text-xs px-2 py-1 rounded border border-primary outline-none bg-background-light dark:bg-background-dark dark:text-white"
                        />
                        <button onClick={() => addShopItem(ci)} className="text-xs px-2 py-1 bg-emerald-500 text-white rounded font-bold hover:bg-emerald-600">✓</button>
                        <button onClick={() => { setAddingToCat(null); setNewItemName(''); }} className="text-xs px-1.5 py-1 text-text-sub hover:text-text-main">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToCat(ci)}
                        className="mt-2 w-full flex items-center gap-1 text-[11px] text-text-sub hover:text-emerald-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">add_circle</span>
                        Añadir artículo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2 border-b border-border-light dark:border-border-dark items-center">
            {localPlan.weeklyPlan?.map(day => (
              <button
                key={day.day}
                onClick={() => { setActiveDay(day.day); setActiveEdit(null); }}
                className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold rounded-xl text-sm transition-all ${
                  activeDay === day.day
                    ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                    : 'bg-transparent text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                Día {day.day}
              </button>
            ))}
          </div>

          {/* Meals */}
          {activeDayPlan?.meals && (() => {
            // Render según las tomas PRESENTES en el día (en orden lógico), no según mealCount.
            // Esto permite que las tomas añadidas aparezcan y las eliminadas desaparezcan.
            const timeMap = new Map(mealSections.map(s => [s.key, s.time]));
            const presentSections = ALL_MEAL_CONFIGS
              .filter(cfg => !!activeDayPlan.meals[cfg.key])
              .map(cfg => ({ ...cfg, time: timeMap.get(cfg.key) ?? cfg.time }));

            return (
              <div className="grid grid-cols-1 gap-6">
                {presentSections.map(({ key, title, time, icon }) => (
                  <MealSection
                    key={key}
                    title={title} time={time} icon={icon} mealKey={key}
                    meal={activeDayPlan.meals[key]!}
                    editingKey={`${activeDay}-${key}`}
                    activeEditKey={activeEdit}
                    onEditRequest={setActiveEdit}
                    onSave={(updated) => handleSaveMeal(key, updated)}
                    onCancel={() => setActiveEdit(null)}
                    onSwapRequest={onSwapMeal ? () => handleSwap(activeDay, key) : undefined}
                    isSwapping={swappingKey === `${activeDay}-${key}`}
                    onRemove={presentSections.length > 1 ? () => handleRemoveMeal(key, activeDayPlan.meals[key]!.name) : undefined}
                  />
                ))}

                {/* feature 1: añadir toma */}
                {patientData && (
                  <div className="no-print">
                    {addingMeal ? (
                      <div className="flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-dashed border-primary/40 text-sm font-bold text-text-sub">
                        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                        Generando toma con IA…
                      </div>
                    ) : availableToAdd.length > 0 ? (
                      <div className="relative">
                        <button
                          onClick={() => setShowMealPicker(v => !v)}
                          className="w-full flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark text-sm font-bold text-text-sub hover:border-primary hover:text-primary transition-all">
                          <span className="material-symbols-outlined text-[20px]">add_circle</span>
                          Añadir toma
                        </button>
                        {showMealPicker && (
                          <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-64 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-xl p-2">
                            <p className="text-[10px] font-black uppercase text-text-sub px-2 py-1.5">Elige la toma a añadir</p>
                            {availableToAdd.map(cfg => (
                              <button key={cfg.key} onClick={() => handleAddMeal(cfg.key)}
                                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-semibold text-text-main dark:text-white hover:bg-primary/10 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-[18px] text-primary">{cfg.icon}</span>
                                {cfg.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Guidelines */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] p-6 shadow-sm mb-20">
            <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Pautas de Nutrición</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localPlan.generalGuidelines?.map((guide, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-text-sub dark:text-gray-400 bg-background-light dark:bg-background-dark p-3 rounded-lg border border-border-light dark:border-border-dark">
                  <span className="material-symbols-outlined text-primary text-sm mt-0.5">verified</span>
                  {guide}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Vista impresión ── */}
      <div className="hidden only-print bg-white text-black p-4 w-full">
        {/* Cabecera */}
        <div className="flex justify-between items-center border-b-4 border-green-500 pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-green-600">{CLINIC.appName}</h1>
            <p className="text-sm font-bold text-gray-700">{CLINIC.subtitle}</p>
          </div>
          <div className="text-right border-l-2 border-gray-200 pl-4">
            <h2 className="text-lg font-black">{patientName || 'PACIENTE'}</h2>
            <p className="text-xs font-medium text-gray-500">Fecha: {new Date().toLocaleDateString('es-ES')}</p>
            {patientData && (
              <p className="text-xs text-gray-400 mt-0.5">
                {patientData.age} años · {patientData.weight} kg · {patientData.height} cm
              </p>
            )}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-3 mb-4 text-center bg-gray-50 p-3 rounded border border-gray-200">
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">IMC</span><span className="text-xl font-black">{metrics.imc}</span></div>
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">GET</span><span className="text-xl font-black">{metrics.tee} kcal</span></div>
          <div><span className="block text-gray-500 uppercase text-[10px] font-bold">TMB</span><span className="text-xl font-black">{metrics.bmr} kcal</span></div>
          <div>
            <span className="block text-gray-500 uppercase text-[10px] font-bold">Macros objetivo/día</span>
            <span className="text-xs font-bold block mt-1">P:{metrics.macros.protein}g • C:{metrics.macros.carbs}g • G:{metrics.macros.fats}g • {metrics.macros.calories} kcal</span>
          </div>
        </div>

        {/* Días — iteramos sobre los meals presentes en el plan, no sobre mealSections,
            para evitar que comidas generadas no aparezcan si mealCount no coincide exactamente */}
        <div>
          {localPlan.weeklyPlan?.map((day, dayIdx) => {
            const MEAL_PRINT_ORDER: { key: MealKey; title: string }[] = [
              { key: 'breakfast',      title: 'Desayuno'     },
              { key: 'morningSnack',   title: 'Media Mañana' },
              { key: 'lunch',          title: 'Almuerzo'     },
              { key: 'afternoonSnack', title: 'Merienda'     },
              { key: 'dinner',         title: 'Cena'         },
            ];
            const presentMeals = MEAL_PRINT_ORDER.filter(({ key }) => !!day.meals[key]);

            return (
              <div
                key={day.day}
                className={`mb-4 border-b border-gray-100 pb-4${dayIdx > 0 && dayIdx % 3 === 0 ? ' print-page-break' : ''}`}
              >
                <h4 className="font-black text-xl mb-3 text-white bg-black inline-block px-4 py-1 rounded-md">DÍA {day.day}</h4>
                <div className="flex flex-col gap-2">
                  {presentMeals.map(({ key, title }, i) => {
                    const meal = day.meals[key]!;
                    return (
                      <div key={key} className={`break-inside-avoid flex gap-4 ${i % 2 === 1 ? 'bg-gray-50 p-2 rounded' : ''}`}>
                        <div className="w-28 font-bold uppercase text-[9px] text-gray-400 pt-1 shrink-0">{title}</div>
                        <div className="flex-1 text-sm font-bold">
                          {meal.name}
                          <span className="block text-[11px] font-normal text-gray-600 italic">{meal.description}</span>
                          {(meal.ingredients?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {meal.ingredients.map((ing, idx) => (
                                <span key={idx} className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{ing}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recomendaciones — sin break-inside-avoid en el contenedor para no bloquear la sección entera;
            cada ítem tiene su propio break-inside-avoid */}
        <div className="mt-8 pt-6 border-t-2 border-green-500 print-page-break">
          <h5 className="font-black text-lg mb-4 uppercase text-green-700">Recomendaciones</h5>
          <ul className="space-y-2">
            {localPlan.generalGuidelines?.map((g, i) => (
              <li key={i} className="break-inside-avoid text-xs flex gap-3">
                <span className="text-green-500 font-bold shrink-0">•</span>
                {g}
              </li>
            ))}
          </ul>
        </div>

        {/* Lista de la compra — siempre incluida en el PDF */}
        <div className="mt-10 print-page-break">
          <h5 className="font-black text-lg mb-4 uppercase text-green-700 border-b-2 border-green-500 pb-2 flex items-center gap-2">
            🛒 Lista de la Compra ({localPlan.weeklyPlan.length} días)
          </h5>
          <div className="grid grid-cols-3 gap-3">
            {shoppingList.map(cat => (
              <div key={cat.category} className="break-inside-avoid">
                <p className="text-[9px] font-black uppercase text-gray-500 mb-1 tracking-wider border-b border-gray-200 pb-0.5">{cat.category}</p>
                <ul className="space-y-0.5">
                  {cat.items.map(item => (
                    <li key={item.name} className="flex items-start gap-1 text-[10px]">
                      <span className="text-green-600 shrink-0 mt-0.5">□</span>
                      <span className="flex-1 text-gray-800">{item.name}</span>
                      {item.amounts.length > 0 && (
                        <span className="text-[8px] text-gray-400 shrink-0">{item.amounts.slice(0, 2).join('/')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-[9px] text-gray-400 italic">
          Documento generado por {CLINIC.appName} AI para {CLINIC.name}.
        </div>
      </div>
    </div>
  );
};

export default DietPlanDisplay;
