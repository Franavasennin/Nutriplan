import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalculatedMetrics, DietResponse, DayPlan, Meal, FastingProtocol, DietType, DIET_TYPE_LABELS,
  PatientData, ActivityLevel, Condition, PlanVersion, Recipe, Gender, FASTING_LABELS,
  CALORIE_GOAL_LABELS, ATHLETE_GOAL_LABELS, BUDGET_LEVEL_LABELS, BudgetLevel, CalorieGoal,
  ALLERGEN_LABELS, AppliedSubstitution, SavedDiet,
} from '../types';
import { CLINIC } from '../config/clinic';
import { openWhatsApp } from '../utils/whatsapp';
import { RECIPES } from '../data/recipes';
import { generateShoppingList, ShoppingList, findMatchingAllergens, SUPERMARKET_AISLES, formatShoppingListForShare } from '../utils/shoppingList';
import { normalizeIngredient, sumDayMacros } from '../utils/macroValidation';
import { generateSingleMeal, reportionMeal } from '../services/geminiService';
import { MEAL_PRINT_ORDER, alignCoupleDays, pairIngredients, extractQuantityLabel, AlignedMealSlot } from '../utils/couplePrint';
import { scalePlanToTarget } from '../utils/planScaling';
import { adaptRecipeToMealTarget } from '../utils/recipeToMeal';
import { getMealEquivalents, MealEquivalenceLine } from '../utils/equivalences';
import { computeMetrics } from '../utils/calculations';
import { MealKey, MealSectionConfig, getMealSections, ALL_MEAL_CONFIGS } from '../utils/mealSchedule';
import { FoodAutocompleteInput, IngredientTextarea } from './FoodAutocomplete';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import { PlanDiffModal } from './PlanDiffModal';

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
  /** "Pautas de la nutricionista": ajusta solo las comidas necesarias para
   *  cumplir una instrucción en lenguaje natural (ej: "todos los desayunos
   *  con pan integral"), conservando el resto del plan intacto. */
  onApplyInstructions?: (instructions: string) => Promise<void>;
  // ─── Pareja Inteligente: bloqueo de comidas editadas manualmente ───────────
  /** Claves "<day>-<mealKey>" bloqueadas — no se tocan al resincronizar con el principal. */
  lockedMeals?: string[];
  /** Sustituciones por alergia aplicadas al generar/resincronizar (aviso visual). */
  substitutions?: AppliedSubstitution[];
  /** Se invoca cuando el usuario edita o intercambia una comida manualmente.
   *  Recibe el plan YA actualizado con ese cambio (localPlan aún no ha
   *  re-renderizado en el momento de la llamada, así que no sirve leerlo
   *  desde fuera — hay que pasarlo explícitamente). */
  onMealManuallyEdited?: (day: number, mealKey: string, updatedPlan: DietResponse) => void;
  /** "Volver a sincronizar con la dieta principal" — quita el bloqueo de una comida. */
  onUnlockMeal?: (day: number, mealKey: string) => void;
  // ─── Impresión "Dieta de Pareja" ────────────────────────────────────────────
  /** La otra persona vinculada (principal si se ve la pareja, o viceversa).
   *  Presente independientemente de qué lado se esté viendo — App.tsx resuelve
   *  la relación simétricamente. Habilita el selector de formato de impresión. */
  otherPersonDiet?: SavedDiet;
  /** Recalcula las cantidades del plan (sin cambiar recetas) para un nuevo
   *  nivel de actividad / objetivo calórico: recibe patientData, metrics y
   *  plan ya actualizados — persiste igual que "Rehacer plan" (inmediato,
   *  no requiere "Guardar cambios"). */
  onRecalculateTargets?: (patientData: PatientData, metrics: CalculatedMetrics, plan: DietResponse) => void;
  /** RECETAS AI (tabla real de Supabase) — fuente para "Cambiar por receta
   *  guardada" y la pestaña "Importar receta" del editor manual. */
  recipes?: Recipe[];
  /** Sube una comida (editada a mano o ya en el plan) como receta reutilizable
   *  a RECETAS AI para otros pacientes. Acción explícita, nunca automática. */
  onSaveAsRecipe?: (recipe: Recipe) => void;
}

// ─── Editor de comida ─────────────────────────────────────────────────────────

interface MealEditorProps {
  meal: Meal;
  mealKey: string;
  onSave: (updated: Meal) => void;
  onCancel: () => void;
  /** RECETAS AI (Supabase) — si no se pasa, cae a la lista estática de
   *  ejemplo (data/recipes.ts) como antes. */
  recipes?: Recipe[];
  onSaveAsRecipe?: (recipe: Recipe) => void;
}

const MEAL_TAG_MAP: Record<string, string> = {
  breakfast: 'desayuno', morningSnack: 'merienda',
  lunch: 'almuerzo', afternoonSnack: 'merienda', dinner: 'cena',
};

const MealEditor: React.FC<MealEditorProps> = ({ meal, mealKey, onSave, onCancel, recipes, onSaveAsRecipe }) => {
  const [tab,         setTab]         = useState<'manual' | 'recipes'>('manual');
  const [name,        setName]        = useState(meal.name);
  const [description, setDescription] = useState(meal.description);
  const [ingredients, setIngredients] = useState(meal.ingredients.map(normalizeIngredient).join('\n'));
  const [instructions, setInstructions] = useState((meal.instructions ?? []).join('\n'));
  const [recipeQuery, setRecipeQuery] = useState('');
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);
  // Macros de la comida importada desde RECETAS AI (ya ajustados al objetivo
  // de esta toma) — se mantienen fuera del textarea porque el formulario
  // manual no tiene campos numéricos de macros; se aplican tal cual al guardar.
  const [importedMacros, setImportedMacros] = useState<Pick<Meal, 'calories' | 'protein' | 'carbs' | 'fats'> | null>(null);
  const [importWarning, setImportWarning] = useState<string | undefined>(undefined);

  const recipeSource = recipes ?? RECIPES;
  const filteredRecipes = recipeSource.filter(r => {
    const mealTag = MEAL_TAG_MAP[mealKey] ?? '';
    const hasMealTag = mealTag ? r.tags.some(t => t.includes(mealTag)) : true;
    if (!hasMealTag) return false;
    if (!recipeQuery.trim()) return true;
    const q = recipeQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
           r.tags.some(t => t.includes(q));
  }).slice(0, 20);

  const handleInsertRecipe = (recipe: Recipe) => {
    // Ajusta cantidades y macros de la receta a los macros de ESTA toma
    // (motor determinista, sin IA — mismo criterio que "Pareja Inteligente").
    const { meal: adapted, warning } = adaptRecipeToMealTarget(recipe, meal);
    setName(adapted.name);
    setDescription(adapted.description);
    setIngredients(adapted.ingredients.map(normalizeIngredient).join('\n'));
    setInstructions((adapted.instructions ?? []).join('\n'));
    setImportedMacros({ calories: adapted.calories, protein: adapted.protein, carbs: adapted.carbs, fats: adapted.fats });
    setImportWarning(warning);
    setTab('manual');
  };

  const handleSave = () => {
    const parsed = ingredients.split('\n').map(s => s.trim()).filter(Boolean);
    const parsedInstructions = instructions.split('\n').map(s => s.trim()).filter(Boolean);
    const updated: Meal = {
      ...meal,
      ...(importedMacros ?? {}),
      name, description, ingredients: parsed,
      instructions: parsedInstructions.length ? parsedInstructions : undefined,
    };
    onSave(updated);
    if (saveAsRecipe && onSaveAsRecipe) {
      onSaveAsRecipe({
        id: `plan-${Date.now()}`,
        title: updated.name,
        description: updated.description,
        prepTime: 0,
        calories: updated.calories ?? 0,
        protein: updated.protein ?? 0,
        carbs: updated.carbs ?? 0,
        fats: updated.fats ?? 0,
        ingredients: updated.ingredients,
        instructions: updated.instructions ?? [],
        tags: [MEAL_TAG_MAP[mealKey] ?? 'otros'],
      });
    }
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
                    <p className="text-xs font-bold text-primary-accessible dark:text-primary">{recipe.calories} kcal</p>
                    <p className="text-[10px] text-text-sub">P{recipe.protein} · HC{recipe.carbs} · G{recipe.fats}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {importedMacros && (
            <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2 text-[11px] text-text-main dark:text-white">
              <p className="font-bold">
                Receta importada y ajustada: {importedMacros.calories} kcal · P {importedMacros.protein}g · HC {importedMacros.carbs}g · G {importedMacros.fats}g
              </p>
              {importWarning && <p className="text-text-sub dark:text-gray-400 mt-0.5">{importWarning}</p>}
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Nombre</label>
            <FoodAutocompleteInput title="Nombre de la comida" value={name} onChange={setName}
              wrapperClassName="mt-1"
              className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-text-main dark:text-white outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Descripción</label>
            <input title="Descripción de la comida" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Ingredientes (uno por línea)</label>
            <IngredientTextarea title="Ingredientes de la comida" value={ingredients} onChange={setIngredients} rows={4}
              wrapperClassName="mt-1"
              className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:border-primary transition-colors resize-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Preparación (opcional, un paso por línea)</label>
            <textarea title="Preparación de la comida" value={instructions} onChange={e => setInstructions(e.target.value)} rows={4}
              placeholder={'Calentar la leche...\nAñadir la avena...'}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm text-text-main dark:text-white outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </>
      )}

      {tab === 'manual' && onSaveAsRecipe && (
        <label className="flex items-center gap-2 text-[11px] font-semibold text-text-sub dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={saveAsRecipe} onChange={e => setSaveAsRecipe(e.target.checked)}
            className="rounded border-border-light dark:border-border-dark text-primary focus:ring-primary" />
          Guardar también en RECETAS AI (reutilizable con otros pacientes)
        </label>
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

const MealRow: React.FC<{
  meal: Meal; mealKey: string; onEditRequest: () => void; onSwapRequest?: () => void; isSwapping?: boolean;
  equivalents?: MealEquivalenceLine[];
  onSaveEquivalents?: (updated: Meal) => void;
  /** RECETAS AI — habilita el botón "Cambiar por receta guardada". */
  recipes?: Recipe[];
  onReplaceWithRecipe?: (updated: Meal) => void;
}> = ({ meal, mealKey, onEditRequest, onSwapRequest, isSwapping, equivalents, onSaveEquivalents, recipes, onReplaceWithRecipe }) => {
  const [editingEquiv, setEditingEquiv] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipePickerQuery, setRecipePickerQuery] = useState('');

  const pickerRecipes = (recipes ?? []).filter(r => {
    const mealTag = MEAL_TAG_MAP[mealKey] ?? '';
    const hasMealTag = mealTag ? r.tags.some(t => t.includes(mealTag)) : true;
    if (!hasMealTag) return false;
    if (!recipePickerQuery.trim()) return true;
    const q = recipePickerQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) ||
           r.tags.some(t => t.includes(q));
  }).slice(0, 20);

  const { toast } = useToast();

  const handlePickRecipe = (recipe: Recipe) => {
    const { meal: adapted, warning } = adaptRecipeToMealTarget(recipe, meal);
    onReplaceWithRecipe?.(adapted);
    setShowRecipePicker(false);
    setRecipePickerQuery('');
    if (warning) toast(warning, 'error');
  };

  const openEquivEditor = () => {
    const byIng = new Map((equivalents ?? []).map(e => [e.ing, e]));
    setDrafts((meal.ingredients ?? []).map(ing => (byIng.get(ing)?.options ?? []).map(o => o.label).join(', ')));
    setEditingEquiv(true);
  };

  const handleSaveEquiv = () => {
    const equivalentOverrides: Record<string, string[]> = {};
    (meal.ingredients ?? []).forEach((ing, idx) => {
      equivalentOverrides[ing] = (drafts[idx] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    });
    onSaveEquivalents?.({ ...meal, equivalentOverrides });
    setEditingEquiv(false);
  };

  return (
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
            {onReplaceWithRecipe && (
              <button onClick={() => setShowRecipePicker(v => !v)} title="Cambiar por receta guardada"
                className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 transition-all">
                <span className="material-symbols-outlined text-base">menu_book</span>
              </button>
            )}
            {onSaveEquivalents && (
              <button onClick={() => (editingEquiv ? setEditingEquiv(false) : openEquivEditor())} title="Editar equivalencias"
                className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all">
                <span className="material-symbols-outlined text-base">tune</span>
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
                {normalizeIngredient(ing)}
              </span>
            ))}
          </div>
        )}

        {showRecipePicker && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-400">
              Cambiar por receta guardada (se ajustan cantidades a {meal.protein ?? '?'}g P · {meal.carbs ?? '?'}g HC · {meal.fats ?? '?'}g G)
            </p>
            <input
              type="text"
              placeholder="Buscar en RECETAS AI..."
              value={recipePickerQuery}
              onChange={e => setRecipePickerQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm dark:text-white outline-none focus:border-primary"
            />
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {pickerRecipes.length === 0 && (
                <p className="text-xs text-center text-text-sub py-4">Sin resultados en RECETAS AI para esta toma. Prueba otro término.</p>
              )}
              {pickerRecipes.map(recipe => (
                <button key={recipe.id} type="button" onClick={() => handlePickRecipe(recipe)}
                  className="w-full text-left p-3 rounded-lg border border-border-light dark:border-border-dark hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">{recipe.title}</p>
                      <p className="text-[11px] text-text-sub dark:text-gray-400 mt-0.5">{recipe.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-primary-accessible dark:text-primary">{recipe.calories} kcal</p>
                      <p className="text-[10px] text-text-sub">P{recipe.protein} · HC{recipe.carbs} · G{recipe.fats}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowRecipePicker(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {editingEquiv ? (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
            <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-400">
              Equivalencias por ingrediente (separadas por comas)
            </p>
            {(meal.ingredients ?? []).map((ing, idx) => (
              <div key={idx}>
                <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{normalizeIngredient(ing)}</label>
                <input
                  type="text"
                  value={drafts[idx] ?? ''}
                  onChange={e => setDrafts(prev => { const next = [...prev]; next[idx] = e.target.value; return next; })}
                  placeholder="Ej: 180g merluza, 3 huevos"
                  className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs text-text-main dark:text-white outline-none focus:border-primary transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditingEquiv(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
                Cancelar
              </button>
              <button onClick={handleSaveEquiv}
                className="px-3 py-1.5 rounded-lg text-xs font-black bg-primary text-background-dark hover:brightness-90 transition-all">
                Guardar equivalencias
              </button>
            </div>
          </div>
        ) : equivalents && equivalents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1">
            <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-400">🔄 Equivalencias</p>
            {equivalents.map((e, i) => (
              <p key={i} className="text-[11px] text-text-sub dark:text-gray-400">
                <span className="font-semibold text-gray-600 dark:text-gray-300">{normalizeIngredient(e.ing)}</span>
                {' → '}
                {e.options.map(o => o.label).join(' · ')}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};

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
  isLocked?: boolean;
  onUnlock?: () => void;
  mealSubstitutions?: AppliedSubstitution[];
  /** "Cambiar de sitio": otras tomas del mismo día con las que se puede
   *  intercambiar esta (ej. cambiar el almuerzo por la cena). */
  moveOptions?: { key: string; title: string }[];
  onMove?: (targetKey: string) => void;
  /** Equivalencias nutricionales de esta comida (override manual o cálculo
   *  automático — ver utils/equivalences.ts getMealEquivalents) y el guardado
   *  de las que edite la nutricionista. */
  equivalents?: MealEquivalenceLine[];
  onSaveEquivalents?: (updated: Meal) => void;
  /** RECETAS AI (Supabase) para "Cambiar por receta guardada" e "Importar receta". */
  recipes?: Recipe[];
  onSaveAsRecipe?: (recipe: Recipe) => void;
}

const MealSection: React.FC<MealSectionProps> = ({
  title, time, meal, icon, mealKey, editingKey, activeEditKey, onEditRequest, onSave, onCancel, onSwapRequest, isSwapping, onRemove,
  isLocked, onUnlock, mealSubstitutions, moveOptions, onMove, equivalents, onSaveEquivalents, recipes, onSaveAsRecipe,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  if (!meal) return null;
  const isEditing = activeEditKey === editingKey;
  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#f0f4f2] dark:border-[#233629] flex items-center gap-3 bg-gray-50 dark:bg-[#1A2C20]">
        <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div>
          <h4 className="text-base font-bold text-[#111813] dark:text-white flex items-center gap-1.5">
            {title}
            {isLocked && (
              <span title="Editada manualmente — no se toca al actualizar la dieta de la pareja" className="material-symbols-outlined text-[14px] text-amber-500">lock</span>
            )}
            {mealSubstitutions && mealSubstitutions.length > 0 && (
              <span
                title={`Alimento(s) sustituido(s) por alergia: ${mealSubstitutions.map(s => `"${s.original}" → "${s.replaced}"`).join(', ')}`}
                className="material-symbols-outlined text-[14px] text-orange-500"
              >
                warning
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">{time}</p>
        </div>
        {meal.calories != null && (
          <div className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-text-sub dark:text-gray-400">
            <span className="text-primary-accessible dark:text-primary font-bold">{meal.calories} kcal</span>
            {meal.protein != null && <span>P {meal.protein}g</span>}
            {meal.carbs   != null && <span>HC {meal.carbs}g</span>}
            {meal.fats    != null && <span>G {meal.fats}g</span>}
          </div>
        )}
        {isLocked && onUnlock && (
          <button onClick={onUnlock} title="Volver a sincronizar con la dieta principal"
            className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all no-print">
            <span className="material-symbols-outlined text-[16px]">sync_alt</span>
            Resincronizar
          </button>
        )}
        {onMove && moveOptions && moveOptions.length > 0 && (
          <div className={`relative no-print ${meal.calories != null || (isLocked && onUnlock) ? '' : 'ml-auto'}`}>
            <button onClick={() => setShowMoveMenu(v => !v)} title={`Cambiar de sitio "${title}"`}
              className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all">
              <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
            </button>
            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoveMenu(false)} />
                <div className="absolute right-0 top-9 z-20 w-48 py-1 rounded-lg bg-white dark:bg-[#1A2C20] border border-border-light dark:border-border-dark shadow-lg">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase text-text-sub dark:text-gray-400">Cambiar por</p>
                  {moveOptions.map(opt => (
                    <button key={opt.key} onClick={() => { onMove(opt.key); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs font-semibold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      {opt.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {onRemove && (
          <button onClick={onRemove} title={`Eliminar ${title}`}
            className={`size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all no-print ${meal.calories != null || onMove ? '' : 'ml-auto'}`}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
      <div className="p-4">
        {isEditing
          ? <MealEditor meal={meal} mealKey={mealKey} onSave={onSave} onCancel={onCancel} recipes={recipes} onSaveAsRecipe={onSaveAsRecipe} />
          : <MealRow meal={meal} mealKey={mealKey} onEditRequest={() => onEditRequest(editingKey)} onSwapRequest={onSwapRequest} isSwapping={isSwapping}
              equivalents={equivalents} onSaveEquivalents={onSaveEquivalents}
              recipes={recipes} onReplaceWithRecipe={onSave} />
        }
      </div>
    </div>
  );
};

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

// ─── Datos del paciente (pestaña) ─────────────────────────────────────────────

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  [ActivityLevel.Sedentary]: 'Sedentario',
  [ActivityLevel.Light]:     'Ligero',
  [ActivityLevel.Moderate]:  'Moderado',
  [ActivityLevel.Heavy]:     'Intenso',
  [ActivityLevel.Athlete]:   'Muy intenso (atleta)',
};

const CONDITION_LABELS: Record<Condition, string> = {
  [Condition.None]:                  'Ninguna',
  [Condition.DiabetesType1]:         'Diabetes Tipo 1',
  [Condition.DiabetesType2]:         'Diabetes Tipo 2',
  [Condition.Hypertension]:          'Hipertensión',
  [Condition.Hypothyroidism]:        'Hipotiroidismo',
  [Condition.Hyperthyroidism]:       'Hipertiroidismo',
  [Condition.LactoseIntolerance]:    'Intolerancia a la lactosa',
  [Condition.Hypertriglyceridemia]:  'Hipertrigliceridemia',
  [Condition.Celiac]:                'Celiaquía',
  [Condition.Obesity]:               'Obesidad',
  [Condition.RenalDisease]:          'Enfermedad renal / ERC',
  [Condition.EatingDisorderHistory]: 'Antecedente TCA',
};

const PatientDataPanel: React.FC<{ patientData: PatientData }> = ({ patientData: p }) => {
  const field = (label: string, value: React.ReactNode) => value == null || value === '' ? null : (
    <div className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
      <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-text-main dark:text-white">{value}</p>
    </div>
  );

  const realConditions = (p.conditions ?? []).filter(c => c !== Condition.None);

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] p-6 shadow-sm">
      <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Datos del Paciente</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {field('Nombre', p.name)}
        {field('Edad', `${p.age} años`)}
        {field('Sexo', p.gender === Gender.Male ? 'Hombre' : 'Mujer')}
        {field('Peso', `${p.weight} kg`)}
        {field('Altura', `${p.height} cm`)}
        {field('% Grasa corporal', p.bodyFatPercent != null ? `${p.bodyFatPercent}%` : null)}
        {field('Peso objetivo', p.targetWeight != null ? `${p.targetWeight} kg` : null)}
        {field('Actividad', ACTIVITY_LABELS[p.activity])}
        {field('Tipo de dieta', DIET_TYPE_LABELS[p.dietType])}
        {field('Objetivo calórico', p.calorieGoal ? CALORIE_GOAL_LABELS[p.calorieGoal].title : null)}
        {field('Objetivo atleta', p.athleteGoal ? ATHLETE_GOAL_LABELS[p.athleteGoal] : null)}
        {field('Ayuno intermitente', p.fastingProtocol ? FASTING_LABELS[p.fastingProtocol] : null)}
        {field('Hora de entrenamiento', p.trainingTime)}
        {field('Presupuesto', p.budgetLevel ? BUDGET_LEVEL_LABELS[p.budgetLevel] : BUDGET_LEVEL_LABELS[BudgetLevel.Standard])}
        {field('Embarazo', p.isPregnant ? 'Sí' : null)}
        {field('Lactancia', p.isLactating ? 'Sí' : null)}
      </div>

      {realConditions.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-500 mb-2">Condiciones médicas</p>
          <div className="flex flex-wrap gap-2">
            {realConditions.map(c => (
              <span key={c} className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-semibold">
                {CONDITION_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
      )}

      {p.excludedFoods && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-500 mb-1">Alimentos excluidos</p>
          <p className="text-sm text-text-main dark:text-white">{p.excludedFoods}</p>
        </div>
      )}

      {p.clinicalNotes && (
        <div className="mt-4">
          <p className="text-[10px] font-black uppercase text-text-sub dark:text-gray-500 mb-1">Notas clínicas</p>
          <p className="text-sm text-text-main dark:text-white whitespace-pre-wrap">{p.clinicalNotes}</p>
        </div>
      )}
    </div>
  );
};

// ─── Recalcular objetivo (actividad / calórico) sin tocar recetas ─────────────
// Cambia solo el NIVEL DE ACTIVIDAD y/o OBJETIVO CALÓRICO del paciente y
// reescala las cantidades de las recetas ya elegidas para cuadrar con el
// nuevo objetivo (mismo motor que "Pareja Inteligente" — scalePlanToTarget),
// sin llamar a la IA ni cambiar qué platos hay en el plan.
const RecalculateTargetsPanel: React.FC<{
  patientData: PatientData;
  metrics: CalculatedMetrics;
  onRecalculate: (activity: ActivityLevel, calorieGoal: CalorieGoal, manualCalorieTarget?: number) => void;
  isRecalculating?: boolean;
}> = ({ patientData, metrics, onRecalculate, isRecalculating }) => {
  const [activity, setActivity] = useState<ActivityLevel>(patientData.activity);
  const [calorieGoal, setCalorieGoal] = useState<CalorieGoal>(patientData.calorieGoal ?? CalorieGoal.Maintenance);
  const [useManual, setUseManual] = useState(patientData.manualCalorieTarget != null);
  const [manualText, setManualText] = useState(String(patientData.manualCalorieTarget ?? ''));

  const manualValue = Number(manualText);
  const manualIsValid = manualText.trim() !== '' && Number.isFinite(manualValue) && manualValue > 0;
  // Mismo suelo clínico que utils/calculations.ts — se muestra aquí para que
  // la nutricionista sepa de antemano por qué la app no bajará de esa cifra.
  const floor = patientData.gender === Gender.Female ? 1200 : 1500;
  const belowFloor = manualIsValid && manualValue < floor;

  const nextManual = useManual && manualIsValid ? manualValue : undefined;
  const hasChanged =
    activity !== patientData.activity ||
    calorieGoal !== (patientData.calorieGoal ?? CalorieGoal.Maintenance) ||
    nextManual !== patientData.manualCalorieTarget;

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-transparent dark:border-[#233629] p-6 shadow-sm mt-6">
      <h3 className="font-bold text-lg text-text-main dark:text-white mb-1">Cambiar objetivo calórico</h3>
      <p className="text-xs text-text-sub dark:text-gray-400 mb-4">
        Cambia el nivel de actividad y/o el objetivo calórico y recalcula las cantidades de las
        recetas YA elegidas para el nuevo objetivo — no genera platos nuevos con IA.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Nivel de actividad</label>
          <select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-semibold text-text-main dark:text-white outline-none focus:border-primary transition-colors">
            {Object.values(ActivityLevel).map(a => (
              <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase">Objetivo calórico</label>
          <select value={calorieGoal} onChange={e => setCalorieGoal(e.target.value as CalorieGoal)}
            disabled={useManual}
            className="w-full mt-1 px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-semibold text-text-main dark:text-white outline-none focus:border-primary transition-colors disabled:opacity-40">
            {Object.values(CalorieGoal).map(g => (
              <option key={g} value={g}>{CALORIE_GOAL_LABELS[g].title} ({CALORIE_GOAL_LABELS[g].subtitle})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Objetivo exacto en kcal — los presets van a saltos de 250/500 kcal y
          no permiten pautar una cifra concreta (ej. 1290 kcal). Sin esto la
          única forma de conseguirla era falsear el peso del paciente. */}
      <div className="mt-3 rounded-lg border border-border-light dark:border-border-dark p-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={useManual} onChange={e => setUseManual(e.target.checked)}
            className="size-4 accent-primary" />
          <span className="text-xs font-bold text-text-main dark:text-white">Fijar un objetivo exacto en kcal</span>
        </label>
        {useManual && (
          <div className="mt-2">
            <input
              type="number" inputMode="numeric" min={floor} step={10}
              value={manualText}
              onChange={e => setManualText(e.target.value)}
              placeholder={`Ej: ${floor + 90}`}
              title="Objetivo calórico exacto"
              className="w-full px-3 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-semibold text-text-main dark:text-white outline-none focus:border-primary transition-colors"
            />
            <p className={`text-[11px] mt-1.5 ${belowFloor ? 'text-amber-600 dark:text-amber-500 font-semibold' : 'text-text-sub dark:text-gray-400'}`}>
              {belowFloor
                ? `Por seguridad clínica no se baja de ${floor} kcal (${patientData.gender === Gender.Female ? 'mujer' : 'hombre'}); se aplicará ${floor}.`
                : `Sustituye al objetivo calórico de arriba. Mínimo permitido: ${floor} kcal.`}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-text-sub dark:text-gray-400">
          Objetivo actual: <span className="font-bold text-text-main dark:text-white">{metrics.macros.calories} kcal</span>
        </p>
        <button
          onClick={() => onRecalculate(activity, calorieGoal, nextManual)}
          disabled={!hasChanged || isRecalculating || (useManual && !manualIsValid)}
          className="px-4 py-2 rounded-lg text-xs font-black bg-primary text-background-dark hover:brightness-90 transition-all disabled:opacity-40 flex items-center gap-2">
          {isRecalculating && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
          Recalcular cantidades
        </button>
      </div>
    </div>
  );
};

// ─── Impresión "Dieta de Pareja" — subcomponentes ──────────────────────────────

/** Cabecera dual (paciente + pareja) reutilizada por los formatos "paralelo" y
 *  "consolidada" — clona el bloque CLINIC de la vista individual, añadiendo
 *  una segunda columna con nombre/calorías/macros/objetivo de la pareja. */
const CouplePrintHeader: React.FC<{
  metrics: CalculatedMetrics;
  patientName?: string;
  patientData?: PatientData;
  otherPersonDiet: SavedDiet;
}> = ({ metrics, patientName, patientData, otherPersonDiet }) => {
  const myGoal = patientData?.calorieGoal ? CALORIE_GOAL_LABELS[patientData.calorieGoal]?.title : undefined;
  const theirGoal = otherPersonDiet.patientData.calorieGoal ? CALORIE_GOAL_LABELS[otherPersonDiet.patientData.calorieGoal]?.title : undefined;
  return (
    <div className="flex justify-between items-start border-b-4 border-green-500 pb-3 mb-4">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tighter text-green-600">{CLINIC.appName}</h1>
        <p className="text-sm font-bold text-gray-700">{CLINIC.subtitle}</p>
        <p className="text-xs font-medium text-gray-500 mt-1">Fecha: {new Date().toLocaleDateString('es-ES')}</p>
      </div>
      <div className="flex gap-4">
        <div className="text-right border-l-2 border-gray-200 pl-4">
          <h2 className="text-base font-black">{patientName || 'Paciente'}</h2>
          {myGoal && <p className="text-[10px] text-gray-500">{myGoal}</p>}
          <p className="text-[10px] font-bold">{metrics.macros.calories} kcal</p>
          <p className="text-[9px] text-gray-500">P:{metrics.macros.protein}g · C:{metrics.macros.carbs}g · G:{metrics.macros.fats}g</p>
        </div>
        <div className="text-right border-l-2 border-gray-200 pl-4">
          <h2 className="text-base font-black">{otherPersonDiet.patientData.name || 'Pareja'}</h2>
          {theirGoal && <p className="text-[10px] text-gray-500">{theirGoal}</p>}
          <p className="text-[10px] font-bold">{otherPersonDiet.metrics.macros.calories} kcal</p>
          <p className="text-[9px] text-gray-500">P:{otherPersonDiet.metrics.macros.protein}g · C:{otherPersonDiet.metrics.macros.carbs}g · G:{otherPersonDiet.metrics.macros.fats}g</p>
        </div>
      </div>
    </div>
  );
};

/** Una fila (o bloque) con la comida completa de ambos lados — usada por el
 *  formato "paralelo" (siempre) y por "consolidada" cuando el nombre de la
 *  receta difiere entre ambos y no se puede fusionar sin fabricar datos. */
const ParallelMealRow: React.FC<{ slot: AlignedMealSlot; asBlock?: boolean }> = ({ slot, asBlock }) => {
  const side = (meal: typeof slot.principal) => meal ? (
    <>
      <div className="font-bold">{meal.name}</div>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {meal.ingredients?.map((ing, i) => (
          <span key={i} className="text-[8px] bg-gray-100 px-1 py-0.5 rounded border border-gray-200">{normalizeIngredient(ing)}</span>
        ))}
      </div>
    </>
  ) : <span className="text-gray-300">—</span>;

  if (asBlock) {
    return (
      <div className="break-inside-avoid mb-3">
        <div className="w-28 font-bold uppercase text-[9px] text-gray-400 pt-1">{slot.title}</div>
        <div className="grid grid-cols-2 gap-3 mt-1 text-[10px]">
          <div>{side(slot.principal)}</div>
          <div>{side(slot.partner)}</div>
        </div>
      </div>
    );
  }
  return (
    <tr className="break-inside-avoid border-b border-gray-100">
      <td className="font-bold uppercase text-[9px] text-gray-400 align-top pt-1">{slot.title}</td>
      <td className="align-top py-1 text-[10px]">{side(slot.principal)}</td>
      <td className="align-top py-1 text-[10px]">{side(slot.partner)}</td>
    </tr>
  );
};

/** Lista de la compra combinada (cantidades sumadas de ambos planes) — mismo
 *  bloque JSX que la vista individual, reutilizado sin cambios de estilo. */
const CoupleShoppingList: React.FC<{ list: ShoppingList; days: number }> = ({ list, days }) => (
  <div className="mt-10 print-page-break">
    <h5 className="font-black text-lg mb-4 uppercase text-green-700 border-b-2 border-green-500 pb-2 flex items-center gap-2">
      🛒 Lista de la Compra combinada ({days} días)
    </h5>
    <div className="grid grid-cols-3 gap-3">
      {list.map(cat => (
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
);

// ─── Componente principal ─────────────────────────────────────────────────────

const DietPlanDisplay: React.FC<Props> = ({
  metrics, plan, patientName, mealCount, fastingProtocol, patientData,
  isLoading, planVersions, dietId, onUpdatePlan, onRegenerate, onRegenerateDay, onSwapMeal, onRestoreVersion,
  lockedMeals, substitutions, onMealManuallyEdited, onUnlockMeal, otherPersonDiet, onApplyInstructions,
  onRecalculateTargets, recipes, onSaveAsRecipe,
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
  const [showEducation,  setShowEducation]  = useState(false); // mejora #13: módulo educativo
  const [showInstructions, setShowInstructions] = useState(false);
  const [diffVersion,    setDiffVersion]    = useState<{ version: PlanVersion; versionNumber: number } | null>(null);
  const [instructionsText, setInstructionsText] = useState(patientData?.planInstructions ?? '');
  const [isApplyingInstructions, setIsApplyingInstructions] = useState(false);
  const [selectedDiet,   setSelectedDiet]   = useState<DietType>(patientData?.dietType ?? DietType.Balanced);
  const [swappingKey,    setSwappingKey]    = useState<string | null>(null); // `${day}-${mealKey}`
  const [listHasChanges, setListHasChanges] = useState(false);   // feature 4: lista compra
  const [addingMeal,     setAddingMeal]     = useState(false);   // feature 1: spinner añadir toma
  const [showMealPicker, setShowMealPicker] = useState(false);   // feature 1: selector de toma
  const [isRecalculatingTargets, setIsRecalculatingTargets] = useState(false); // cambiar actividad/objetivo calórico
  // ── Impresión "Dieta de Pareja" ──────────────────────────────────────────────
  const [printMode, setPrintMode] = useState<'individual' | 'parallel' | 'consolidated' | null>(null);
  const [showPrintFormatPicker, setShowPrintFormatPicker] = useState(false);

  const shoppingList: ShoppingList = useMemo(() => generateShoppingList(localPlan), [localPlan]);

  // Impresión de pareja: solo se calculan estas derivadas cuando hay alguien
  // vinculado con un plan generado — imprimir un lado en blanco es mala UX.
  const hasPrintablePartner = !!otherPersonDiet && otherPersonDiet.plan.weeklyPlan.length > 0;
  const alignedCoupleDays = useMemo(
    () => hasPrintablePartner ? alignCoupleDays(localPlan, otherPersonDiet!.plan) : [],
    [localPlan, otherPersonDiet, hasPrintablePartner]
  );
  const coupleShoppingList: ShoppingList = useMemo(
    () => hasPrintablePartner ? generateShoppingList(localPlan, otherPersonDiet!.plan) : [],
    [localPlan, otherPersonDiet, hasPrintablePartner]
  );

  const requestPrint = (mode: 'individual' | 'parallel' | 'consolidated') => {
    setShowPrintFormatPicker(false);
    setPrintMode(mode);
  };

  useEffect(() => {
    if (printMode === null) return;
    window.print();
    const reset = () => setPrintMode(null);
    window.addEventListener('afterprint', reset, { once: true });
    return () => window.removeEventListener('afterprint', reset);
  }, [printMode]);

  // ── Editable shopping list ──────────────────────────────────────────────────
  interface EditItem { name: string; amounts: string[]; checked: boolean; }
  interface EditCat  { category: string; icon: string; color: string; items: EditItem[]; }
  const [editList,      setEditList]      = useState<EditCat[]>([]);
  const [addingToCat,   setAddingToCat]   = useState<string | null>(null);
  const [newItemName,   setNewItemName]   = useState('');
  const [selectedAisle, setSelectedAisle] = useState<string>('all');

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

  const toggleShopItem = (catName: string, itemIdx: number) => {
    setEditList(prev => prev.map(cat =>
      cat.category !== catName ? cat : {
        ...cat,
        items: cat.items.map((it, i) => i !== itemIdx ? it : { ...it, checked: !it.checked }),
      }
    ));
    setListHasChanges(true);
  };

  const removeShopItem = (catName: string, itemIdx: number) => {
    setEditList(prev =>
      prev.map(cat =>
        cat.category !== catName ? cat : { ...cat, items: cat.items.filter((_, i) => i !== itemIdx) }
      ).filter(cat => cat.items.length > 0)
    );
    setListHasChanges(true);
  };

  const addShopItem = (catName: string) => {
    const name = newItemName.trim();
    if (!name) return;
    setEditList(prev => prev.map(cat =>
      cat.category !== catName ? cat : {
        ...cat,
        items: [...cat.items, { name: name.charAt(0).toUpperCase() + name.slice(1), amounts: [], checked: false }]
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    ));
    setNewItemName('');
    setAddingToCat(null);
    setListHasChanges(true);
  };

  const handleShareWhatsAppShopping = () => {
    const text = formatShoppingListForShare(editList, {
      patientName: patientName ?? undefined,
      durationText: localPlan.durationText,
    });
    openWhatsApp(text);
  };

  const handleCopyShoppingList = async () => {
    const text = formatShoppingListForShare(editList, {
      patientName: patientName ?? undefined,
      durationText: localPlan.durationText,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast('Lista de la compra copiada con casillas [ ]', 'success');
    } catch {
      toast('No se pudo copiar automáticamente al portapapeles', 'error');
    }
  };

  const handleToggleAllShopItems = () => {
    const hasUnchecked = editList.some(cat => cat.items.some(it => !it.checked));
    setEditList(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map(it => ({ ...it, checked: hasUnchecked })),
    })));
    setListHasChanges(true);
  };

  const displayedCategories = useMemo(() => {
    if (selectedAisle === 'all') return editList;
    const aisleConfig = SUPERMARKET_AISLES.find(a => a.id === selectedAisle);
    if (!aisleConfig) return editList;
    return editList.filter(cat => aisleConfig.categoryNames.includes(cat.category));
  }, [editList, selectedAisle]);

  useEffect(() => {
    setLocalPlan(plan);
    // Preservar el día activo si sigue existiendo en el nuevo plan (p.ej. después de guardar).
    // Solo saltar al primer día cuando el día actual ya no existe (carga de una dieta diferente).
    const validDays = plan.weeklyPlan?.map(d => d.day) ?? [];
    setActiveDay(prev => validDays.includes(prev) ? prev : (plan.weeklyPlan?.[0]?.day ?? 1));
    setHasChanges(false);
    setActiveEdit(null);
  }, [plan]);

  const mealSections = getMealSections(mealCount, fastingProtocol);

  const activeDayPlan = localPlan.weeklyPlan?.find(d => d.day === activeDay);
  const dayTotals = activeDayPlan ? sumDayMacros(activeDayPlan.meals) : null;

  const recommendation = patientData ? getRecommendedDiet(metrics, patientData) : null;

  const handleSaveMeal = (mealKey: MealKey, updated: Meal) => {
    const updatedPlan: DietResponse = {
      ...localPlan,
      weeklyPlan: localPlan.weeklyPlan.map(d =>
        d.day === activeDay ? { ...d, meals: { ...d.meals, [mealKey]: updated } } : d
      ),
    };
    setLocalPlan(updatedPlan);
    setActiveEdit(null);
    setHasChanges(true);
    // Pareja Inteligente: una edición manual bloquea esta comida frente a
    // futuras resincronizaciones con el principal. Se pasa el plan ya
    // actualizado porque localPlan (estado de React) todavía no refleja
    // este cambio en este mismo tick.
    onMealManuallyEdited?.(activeDay, mealKey, updatedPlan);
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
      const breakfast = activeDayPlan.meals.breakfast;
      const dinner    = activeDayPlan.meals.dinner;
      const m = (meal?: Meal) => ({
        calories: meal?.calories ?? 0, protein: meal?.protein ?? 0,
        carbs:    meal?.carbs    ?? 0, fats:    meal?.fats    ?? 0,
      });
      const bMac = m(breakfast);
      const dMac = m(dinner);

      // ¿Hay de dónde restar? (desayuno y/o cena con macros)
      const donors = (bMac.calories > 0 ? 1 : 0) + (dMac.calories > 0 ? 1 : 0);

      let newMeal: Meal;

      if (donors === 0) {
        // Sin desayuno/cena con datos → comportamiento clásico (macros residuales del día)
        const used = sumDayMacros(activeDayPlan.meals) ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
        // Si las comidas existentes tienen calorías 0 (p.ej. dieta importada de PDF),
        // el residual sería el presupuesto completo, lo que daría un objetivo irreal.
        // En ese caso distribuimos el presupuesto diario equitativamente entre tomas.
        const hasRealMacros = used.calories > 0;
        const totalMeals = presentMealKeys.length + 1; // +1 = la toma que vamos a añadir
        const residual = hasRealMacros
          ? {
              calories: metrics.macros.calories - used.calories,
              protein:  metrics.macros.protein  - used.protein,
              carbs:    metrics.macros.carbs    - used.carbs,
              fats:     metrics.macros.fats     - used.fats,
            }
          : {
              // Reparto equitativo cuando no hay macros reales registradas
              calories: Math.round(metrics.macros.calories / totalMeals),
              protein:  Math.round(metrics.macros.protein  / totalMeals),
              carbs:    Math.round(metrics.macros.carbs    / totalMeals),
              fats:     Math.round(metrics.macros.fats     / totalMeals),
            };
        newMeal = await generateSingleMeal(mealKey, residual, patientData, metrics);
        setLocalPlan(prev => ({
          ...prev,
          weeklyPlan: prev.weeklyPlan.map(d =>
            d.day === activeDay ? { ...d, meals: { ...d.meals, [mealKey]: newMeal } } : d
          ),
        }));
      } else {
        // La toma nueva sale de restar a desayuno y cena → el total del día NO cambia.
        // Cogemos ~1/4 de (desayuno+cena) para la toma nueva, repartido a partes iguales.
        const newTarget = {
          calories: Math.round((bMac.calories + dMac.calories) / 4),
          protein:  Math.round((bMac.protein  + dMac.protein)  / 4),
          carbs:    Math.round((bMac.carbs    + dMac.carbs)    / 4),
          fats:     Math.round((bMac.fats     + dMac.fats)     / 4),
        };
        const perDonor = {
          calories: Math.round(newTarget.calories / donors),
          protein:  Math.round(newTarget.protein  / donors),
          carbs:    Math.round(newTarget.carbs    / donors),
          fats:     Math.round(newTarget.fats     / donors),
        };
        const reduce = (mac: ReturnType<typeof m>) => ({
          calories: Math.max(0, mac.calories - perDonor.calories),
          protein:  Math.max(0, mac.protein  - perDonor.protein),
          carbs:    Math.max(0, mac.carbs    - perDonor.carbs),
          fats:     Math.max(0, mac.fats     - perDonor.fats),
        });

        // Genera la toma nueva + re-porciona desayuno y cena (en paralelo).
        // Usamos allSettled para que si el rebalanceo falla, la toma nueva se añade igualmente.
        const [mealResult, bfResult, dinResult] = await Promise.allSettled([
          generateSingleMeal(mealKey, newTarget, patientData, metrics),
          breakfast && bMac.calories > 0 ? reportionMeal(breakfast, reduce(bMac), patientData) : Promise.resolve(breakfast),
          dinner    && dMac.calories > 0 ? reportionMeal(dinner,    reduce(dMac), patientData) : Promise.resolve(dinner),
        ]);

        // Si la toma nueva falló, relanzar el error
        if (mealResult.status === 'rejected') throw mealResult.reason;

        newMeal = mealResult.value;
        // Si el rebalanceo falla, mantener los originales (degradación elegante)
        const newBreakfast = bfResult.status  === 'fulfilled' ? bfResult.value  : breakfast;
        const newDinner    = dinResult.status === 'fulfilled' ? dinResult.value : dinner;

        setLocalPlan(prev => ({
          ...prev,
          weeklyPlan: prev.weeklyPlan.map(d => {
            if (d.day !== activeDay) return d;
            const meals = { ...d.meals, [mealKey]: newMeal };
            if (newBreakfast) meals.breakfast = newBreakfast;
            if (newDinner)    meals.dinner    = newDinner;
            return { ...d, meals };
          }),
        }));
      }

      setHasChanges(true);
      const rebalanced = donors > 0;
      toast(rebalanced ? 'Toma añadida y macros reajustados. Recuerda guardar.' : 'Toma añadida. Recuerda guardar.', 'success');
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

  // Intercambia dos tomas de sitio dentro del mismo día activo (ej. "cambiar
  // el almuerzo por la cena"). El horario de cada toma es propio de la
  // posición (ver mealSchedule.ts), así que basta con intercambiar el
  // contenido entre las dos claves — nada más que recalcular.
  const handleMoveMeal = (mealKeyA: MealKey, mealKeyB: MealKey) => {
    if (!activeDayPlan) return;
    const mealA = activeDayPlan.meals[mealKeyA];
    const mealB = activeDayPlan.meals[mealKeyB];
    if (!mealA || !mealB) return;
    const updatedPlan: DietResponse = {
      ...localPlan,
      weeklyPlan: localPlan.weeklyPlan.map(d =>
        d.day === activeDay ? { ...d, meals: { ...d.meals, [mealKeyA]: mealB, [mealKeyB]: mealA } } : d
      ),
    };
    setLocalPlan(updatedPlan);
    setHasChanges(true);
    onMealManuallyEdited?.(activeDay, mealKeyA, updatedPlan);
    onMealManuallyEdited?.(activeDay, mealKeyB, updatedPlan);
    toast('Tomas intercambiadas. Recuerda guardar los cambios.', 'success');
  };

  // Cambia el nivel de actividad y/o el objetivo calórico SIN cambiar las
  // recetas: recalcula TMB/GET/macros con los nuevos datos y reescala las
  // cantidades de ingredientes de cada día ya elegido para cuadrar con el
  // nuevo objetivo (mismo motor determinista que "Pareja Inteligente" —
  // scalePlanToTarget, sin llamadas a la IA).
  const handleRecalculateTargets = async (activity: ActivityLevel, calorieGoal: CalorieGoal, manualCalorieTarget?: number) => {
    if (!patientData) return;
    setIsRecalculatingTargets(true);
    try {
      const newPatientData: PatientData = { ...patientData, activity, calorieGoal, manualCalorieTarget };
      const newMetrics = computeMetrics(newPatientData);
      const { plan: rescaled, warnings } = scalePlanToTarget(localPlan, newMetrics);
      setLocalPlan(rescaled);
      setHasChanges(false);
      onRecalculateTargets?.(newPatientData, newMetrics, rescaled);
      warnings.forEach(w => toast(w.message, 'error'));
      toast(`Cantidades recalculadas para ${newMetrics.macros.calories} kcal.`, 'success');
    } finally {
      setIsRecalculatingTargets(false);
    }
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

  // ── compartir resumen por WhatsApp / email ──────────────────────────────────
  // No hay backend ni URL pública del plan, así que no se puede adjuntar el
  // PDF automáticamente (ni wa.me ni mailto: soportan adjuntos desde una
  // página web) — se comparte un resumen en texto y el PDF se adjunta a mano
  // con el botón "PDF / Imprimir".
  const buildShareSummary = () => [
    `${CLINIC.appName} — Plan nutricional`,
    patientName ? `Paciente: ${patientName}` : null,
    `Elaborado por: ${CLINIC.title}`,
    `Duración: ${plan.durationText}`,
    `Objetivo diario: ${Math.round(metrics.macros.calories)} kcal · ${Math.round(metrics.macros.protein)}g proteína · ${Math.round(metrics.macros.carbs)}g carbohidratos · ${Math.round(metrics.macros.fats)}g grasas`,
    '',
    CLINIC.disclaimer,
    '',
    '(Adjunta el PDF completo generado con "PDF / Imprimir".)',
  ].filter((l): l is string => l !== null).join('\n');

  const handleShareWhatsApp = () => {
    openWhatsApp(buildShareSummary());
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Tu plan nutricional — ${CLINIC.title}`);
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(buildShareSummary())}`;
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
      const updatedPlan: DietResponse = {
        ...localPlan,
        weeklyPlan: localPlan.weeklyPlan.map(d =>
          d.day === dayNumber ? { ...d, meals: { ...d.meals, [mealKey]: swapped } } : d
        ),
      };
      setLocalPlan(updatedPlan);
      setHasChanges(true);
      onMealManuallyEdited?.(dayNumber, mealKey, updatedPlan);
    } finally {
      setSwappingKey(null);
    }
  }, [localPlan, onSwapMeal, onMealManuallyEdited]);

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
              <button onClick={() => { setShowEducation(v => !v); setShowRegen(false); setShowVersions(false); }}
                className={`flex items-center gap-2 h-11 px-6 rounded-xl border text-sm font-bold transition-all ${showEducation ? 'bg-sky-500 text-white border-sky-500' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-sky-400'}`}>
                <span className="material-symbols-outlined text-[20px]">school</span>
                <span className="hidden sm:inline">Aprende</span>
              </button>
              {onRegenerateDay && activeDay !== 0 && (
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
              {onApplyInstructions && (
                <button onClick={() => { setShowInstructions(v => !v); setShowRegen(false); setShowVersions(false); }}
                  title="Añadir una pauta en lenguaje natural (ej: todos los desayunos con pan)"
                  className={`flex items-center gap-2 h-11 px-5 rounded-xl border text-sm font-bold transition-all relative ${showInstructions ? 'bg-amber-500 text-white border-amber-500' : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-amber-400'}`}>
                  <span className="material-symbols-outlined text-[20px]">tips_and_updates</span>
                  <span className="hidden sm:inline">Pautas</span>
                  {patientData?.planInstructions && (
                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 border border-white dark:border-background-dark" />
                  )}
                </button>
              )}
              {onRegenerate && (
                <button onClick={() => setShowRegen(v => !v)}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-primary transition-all">
                  <span className="material-symbols-outlined text-[20px] text-primary">refresh</span>
                  Rehacer plan
                </button>
              )}
              <button onClick={handleShareWhatsApp}
                title="Compartir resumen por WhatsApp (el PDF se adjunta a mano)"
                className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-green-500 transition-all">
                <span className="material-symbols-outlined text-[20px] text-green-500">chat</span>
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button onClick={handleShareEmail}
                title="Compartir resumen por email (el PDF se adjunta a mano)"
                className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-bold hover:border-sky-500 transition-all">
                <span className="material-symbols-outlined text-[20px] text-sky-500">mail</span>
                <span className="hidden sm:inline">Email</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => hasPrintablePartner ? setShowPrintFormatPicker(v => !v) : requestPrint('individual')}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  PDF / Imprimir
                </button>
                {showPrintFormatPicker && hasPrintablePartner && (
                  <div className="absolute z-20 right-0 mt-2 w-72 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-xl p-2">
                    <p className="text-[10px] font-black uppercase text-text-sub px-2 py-1.5">Elige el formato de impresión</p>
                    <button onClick={() => requestPrint('individual')}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-semibold text-text-main dark:text-white hover:bg-primary/10 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-primary">restaurant_menu</span>
                      Individual
                    </button>
                    <button onClick={() => requestPrint('parallel')}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-semibold text-text-main dark:text-white hover:bg-primary/10 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-primary">table_view</span>
                      Pareja en paralelo
                    </button>
                    <button onClick={() => requestPrint('consolidated')}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-semibold text-text-main dark:text-white hover:bg-primary/10 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
                      Pareja consolidada
                    </button>
                  </div>
                )}
              </div>
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

          {/* Pautas de la nutricionista */}
          {showInstructions && onApplyInstructions && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-amber-400/40 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">tips_and_updates</span>
                <h3 className="font-bold text-text-main dark:text-white">Pautas sobre este plan</h3>
              </div>
              <p className="text-xs text-text-sub dark:text-gray-400">
                Escribe una instrucción en lenguaje natural. Solo se ajustarán las comidas necesarias para
                cumplirla — el resto del plan y sus macros no se tocan. Ejemplos: "todos los desayunos con pan
                integral", "nada de pescado en las cenas", "más variedad de verduras".
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                Las alergias y alimentos excluidos del paciente siguen teniendo prioridad absoluta sobre esta pauta.
              </p>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={e => setInstructionsText(e.target.value)}
                placeholder="Ej: necesito que todos los desayunos tengan pan"
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none dark:text-white focus:border-amber-400 transition-colors text-sm"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowInstructions(false)}
                  className="h-11 px-5 rounded-lg border border-border-light dark:border-border-dark text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-text-sub">
                  Cancelar
                </button>
                <button type="button"
                  onClick={async () => {
                    setIsApplyingInstructions(true);
                    try {
                      await onApplyInstructions(instructionsText);
                      setShowInstructions(false);
                    } finally {
                      setIsApplyingInstructions(false);
                    }
                  }}
                  disabled={isApplyingInstructions || isLoading || !instructionsText.trim()}
                  className="h-11 px-6 rounded-lg bg-amber-500 text-white text-sm font-black hover:brightness-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className={`material-symbols-outlined text-[18px] ${isApplyingInstructions ? 'animate-spin' : ''}`}>
                    {isApplyingInstructions ? 'progress_activity' : 'tips_and_updates'}
                  </span>
                  Aplicar pautas
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              // OJO: el objetivo es macros.calories (TMB × actividad ± déficit/superávit
              // o el objetivo manual), NO metrics.tee (el gasto total bruto). Antes se
              // mostraba tee y por tanto la cifra mentía en cuanto había déficit: a una
              // paciente con GET 1703 y objetivo real 1500 le ponía "obj. 1703 kcal",
              // que es justo el número que la nutricionista lee para comprobar su pauta.
              { label: 'Calorías',  target: `${metrics.macros.calories}`, actual: dayTotals ? `${dayTotals.calories}` : null,             color: 'bg-primary',    unit: 'kcal' },
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

          {/* Objetivos adicionales derivados de condiciones clínicas (auditoría) */}
          {metrics.targets && (
            <div className="flex flex-wrap gap-3 -mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-sub dark:text-gray-400 bg-surface-light dark:bg-surface-dark px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-[14px] text-emerald-500">grass</span>
                Fibra mín. {metrics.targets.fiberG}g
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-sub dark:text-gray-400 bg-surface-light dark:bg-surface-dark px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-[14px] text-pink-500">icecream</span>
                Azúcar libre máx. {metrics.targets.addedSugarG}g
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-sub dark:text-gray-400 bg-surface-light dark:bg-surface-dark px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark">
                <span className="material-symbols-outlined text-[14px] text-blue-500">water_drop</span>
                Sodio máx. {metrics.targets.sodiumMg}mg
              </div>
            </div>
          )}

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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDiffVersion({ version: v, versionNumber: planVersions.length - i })}
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-sub dark:text-gray-300 hover:text-amber-500 hover:border-amber-400 transition-colors cursor-pointer"
                        title="Ver comparativa de platos y macros frente al plan actual"
                      >
                        <span className="material-symbols-outlined text-[15px]">compare</span>
                        <span>Comparar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { onRestoreVersion(v); setShowVersions(false); }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal de Comparativa de Versiones (Diff) */}
          {diffVersion && (
            <PlanDiffModal
              currentPlan={localPlan}
              version={diffVersion.version}
              versionNumber={diffVersion.versionNumber}
              onRestore={(v) => {
                onRestoreVersion?.(v);
                setDiffVersion(null);
                setShowVersions(false);
              }}
              onClose={() => setDiffVersion(null)}
            />
          )}

          {/* Shopping list panel */}
          {showShopping && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-emerald-400/50 dark:border-emerald-600/40 p-5 shadow-sm space-y-4">
              {/* Cabecera y acciones */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-border-light dark:border-border-dark">
                <div>
                  <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2 text-lg">
                    <span className="material-symbols-outlined text-emerald-500 text-[24px]">shopping_cart</span>
                    Lista de la Compra — {localPlan.weeklyPlan.length} días
                  </h3>
                  <p className="text-xs text-text-sub dark:text-gray-400 mt-0.5">
                    {editList.reduce((s, c) => s + c.items.filter(i => !i.checked).length, 0)} pendientes · {editList.reduce((s, c) => s + c.items.length, 0)} artículos en total
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* WhatsApp */}
                  <button
                    onClick={handleShareWhatsAppShopping}
                    className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    title="Enviar lista por WhatsApp con casillas [ ]"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    <span>WhatsApp</span>
                  </button>

                  {/* Copiar texto */}
                  <button
                    onClick={handleCopyShoppingList}
                    className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-main dark:text-white text-xs font-bold transition-all shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    title="Copiar lista al portapapeles con formato [ ]"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Copiar</span>
                  </button>

                  {/* Marcar / Desmarcar todos */}
                  <button
                    onClick={handleToggleAllShopItems}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-sub dark:text-gray-300 text-xs font-bold transition-all shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    title="Marcar o desmarcar todos los artículos"
                  >
                    <span className="material-symbols-outlined text-[16px]">done_all</span>
                    <span className="hidden sm:inline">Marcar todo</span>
                  </button>

                  {/* Guardar cambios */}
                  {listHasChanges && canPersistList && (
                    <button
                      onClick={saveShoppingList}
                      className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-all shadow-sm focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Guardar lista</span>
                    </button>
                  )}

                  {/* Cerrar */}
                  <button
                    onClick={() => setShowShopping(false)}
                    className="p-1.5 rounded-lg text-text-sub hover:text-text-main dark:hover:text-white transition-colors focus:ring-2 focus:ring-primary focus-visible:outline-none"
                    aria-label="Cerrar lista de la compra"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {/* Selector de Pasillos de Supermercado */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedAisle('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedAisle === 'all'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-sub dark:text-gray-300 hover:text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">storefront</span>
                  <span>Todos los pasillos</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {editList.reduce((s, c) => s + c.items.length, 0)}
                  </span>
                </button>

                {SUPERMARKET_AISLES.map(aisle => {
                  const aisleCats = editList.filter(c => aisle.categoryNames.includes(c.category));
                  const totalItems = aisleCats.reduce((s, c) => s + c.items.length, 0);
                  if (totalItems === 0) return null;
                  const isSelected = selectedAisle === aisle.id;
                  return (
                    <button
                      key={aisle.id}
                      onClick={() => setSelectedAisle(aisle.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-sub dark:text-gray-300 hover:text-text-main'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{aisle.icon}</span>
                      <span>{aisle.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                        {totalItems}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grid de Categorías filtradas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedCategories.map((cat) => (
                  <div key={cat.category} className="bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark p-3.5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border-light dark:border-border-dark">
                        <span className="material-symbols-outlined text-emerald-500 text-[18px]">{cat.icon}</span>
                        <p className="text-xs font-black uppercase text-text-main dark:text-white tracking-wide flex-1">{cat.category}</p>
                        <span className="text-[10px] font-bold text-text-sub bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                          {cat.items.filter(i => !i.checked).length}/{cat.items.length}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {cat.items.map((item, ii) => {
                          const matchingAllergens = findMatchingAllergens(item.name, patientData?.allergens ?? []);
                          return (
                          <li key={`${item.name}-${ii}`} className="group flex items-start gap-2 text-sm">
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleShopItem(cat.category, ii)}
                              role="checkbox"
                              aria-checked={item.checked}
                              aria-label={`${item.checked ? 'Desmarcar' : 'Marcar'} ${item.name} como comprado`}
                              className={`mt-0.5 shrink-0 size-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                item.checked
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'
                              }`}
                            >
                              {item.checked && <span className="material-symbols-outlined text-[10px]">check</span>}
                            </button>
                            {/* Name */}
                            <span className={`flex-1 leading-tight transition-all text-xs sm:text-sm ${item.checked ? 'line-through text-text-sub dark:text-gray-500' : 'text-text-main dark:text-gray-200'}`}>
                              {item.name}
                              {matchingAllergens.length > 0 && (
                                <span
                                  title={`Alérgeno declarado: ${matchingAllergens.map(a => ALLERGEN_LABELS[a]).join(', ')}`}
                                  className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-bold align-middle"
                                >
                                  <span className="material-symbols-outlined text-[11px]">warning</span>
                                  {matchingAllergens.map(a => ALLERGEN_LABELS[a]).join(', ')}
                                </span>
                              )}
                            </span>
                            {/* Amount */}
                            {item.amounts.length > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                {item.amounts.join(' + ')}
                              </span>
                            )}
                            {/* Remove */}
                            <button
                              onClick={() => removeShopItem(cat.category, ii)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5"
                              title="Eliminar artículo"
                              aria-label={`Eliminar ${item.name}`}
                            >
                              <span className="material-symbols-outlined text-[14px]">remove_circle</span>
                            </button>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                    {/* Add item */}
                    {addingToCat === cat.category ? (
                      <div className="flex gap-1 mt-3 pt-2 border-t border-border-light dark:border-border-dark">
                        <input
                          autoFocus
                          type="text"
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addShopItem(cat.category); if (e.key === 'Escape') { setAddingToCat(null); setNewItemName(''); } }}
                          placeholder="Nombre del artículo..."
                          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-primary outline-none bg-surface-light dark:bg-surface-dark dark:text-white"
                          aria-label="Nombre del nuevo artículo"
                        />
                        <button onClick={() => addShopItem(cat.category)} className="text-xs px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600">✓</button>
                        <button onClick={() => { setAddingToCat(null); setNewItemName(''); }} className="text-xs px-2 py-1.5 text-text-sub hover:text-text-main">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingToCat(cat.category)}
                        className="mt-3 pt-2 border-t border-border-light dark:border-border-dark w-full flex items-center gap-1 text-[11px] text-text-sub hover:text-emerald-500 transition-colors font-semibold"
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

          {/* Panel educativo (auditoría, mejora #13) — sin llamadas a IA, contenido estático */}
          {showEducation && (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-sky-300/60 dark:border-sky-700/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-500 text-[20px]">school</span>
                  ¿Por qué estas cantidades?
                </h3>
                <button onClick={() => setShowEducation(false)} className="text-text-sub hover:text-text-main transition-colors">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-2 mb-5 text-sm text-text-main dark:text-gray-300">
                <p>
                  Tu objetivo de <strong className="text-primary-accessible dark:text-primary">{metrics.macros.calories} kcal/día</strong> sale de tu gasto energético estimado ({metrics.tee} kcal)
                  {metrics.macros.calories < metrics.tee && ' con un déficit para perder peso'}
                  {metrics.macros.calories > metrics.tee && ' con un superávit para ganar peso/masa muscular'}
                  {metrics.macros.calories === metrics.tee && ' sin ajuste (mantenimiento)'}.
                </p>
                <p>
                  La <strong className="text-blue-500">proteína ({metrics.macros.protein}g)</strong> se calcula por kg de peso corporal según tu tipo de dieta — más alta si el objetivo es perder grasa manteniendo músculo, o si entrenas fuerza.
                  Los <strong className="text-yellow-600 dark:text-yellow-400">carbohidratos ({metrics.macros.carbs}g)</strong> y las <strong className="text-red-400">grasas ({metrics.macros.fats}g)</strong> reparten el resto de la energía según el patrón de tu dieta ({DIET_TYPE_LABELS[patientData?.dietType ?? DietType.Balanced]}).
                </p>
                <p className="text-xs text-text-sub dark:text-gray-400 italic">
                  Estas cantidades son una guía — no hace falta ser exacto al gramo cada día. Lo importante es acercarse a lo largo de la semana.
                </p>
              </div>

              <h4 className="text-xs font-black uppercase tracking-wide text-text-sub dark:text-gray-400 mb-2">Tabla de sustituciones (por ración equivalente)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
                  <p className="font-bold text-blue-500 mb-1.5">Proteína — 25-30g equivalen a:</p>
                  <ul className="space-y-0.5 text-text-sub dark:text-gray-400">
                    <li>• 100g pechuga de pollo/pavo</li>
                    <li>• 130g salmón o atún fresco</li>
                    <li>• 115g atún en agua (lata)</li>
                    <li>• 4 huevos medianos</li>
                    <li>• 200g tofu firme</li>
                    <li>• 150g legumbres cocidas + 50g queso fresco</li>
                  </ul>
                </div>
                <div className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
                  <p className="font-bold text-yellow-600 dark:text-yellow-400 mb-1.5">Carbohidratos — 30g equivalen a:</p>
                  <ul className="space-y-0.5 text-text-sub dark:text-gray-400">
                    <li>• 105g arroz/pasta cocidos</li>
                    <li>• 50g avena seca</li>
                    <li>• 65g pan integral</li>
                    <li>• 175g patata cocida</li>
                    <li>• 1 plátano grande + 1 manzana</li>
                    <li>• 150g legumbres cocidas</li>
                  </ul>
                </div>
                <div className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark p-3">
                  <p className="font-bold text-red-400 mb-1.5">Grasas — 10g equivalen a:</p>
                  <ul className="space-y-0.5 text-text-sub dark:text-gray-400">
                    <li>• 10ml AOVE (1 cda sopera)</li>
                    <li>• 18g nueces/almendras</li>
                    <li>• 70g aguacate (~½ unidad)</li>
                    <li>• 75g salmón</li>
                    <li>• 2 huevos (por la yema)</li>
                  </ul>
                </div>
              </div>
              <p className="text-[10px] text-text-sub dark:text-gray-500 mt-3 italic">
                Equivalencias aproximadas orientativas — no sustituyen una tabla de composición de alimentos ni el criterio profesional.
              </p>
            </div>
          )}

          {/* Day tabs */}
          <div className="flex overflow-x-auto pb-2 gap-2 border-b border-border-light dark:border-border-dark items-center">
            {patientData && (
              <button
                onClick={() => { setActiveDay(0); setActiveEdit(null); }}
                className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold rounded-xl text-sm transition-all flex items-center gap-1.5 ${
                  activeDay === 0
                    ? 'bg-primary text-background-dark shadow-lg shadow-primary/20'
                    : 'bg-transparent text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                <span className="material-symbols-outlined text-[18px]">person</span>
                Datos
              </button>
            )}
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

          {/* Datos del paciente */}
          {activeDay === 0 && patientData && <PatientDataPanel patientData={patientData} />}
          {activeDay === 0 && patientData && onRecalculateTargets && (
            <RecalculateTargetsPanel
              patientData={patientData}
              metrics={metrics}
              onRecalculate={handleRecalculateTargets}
              isRecalculating={isRecalculatingTargets}
            />
          )}

          {/* Meals */}
          {activeDay !== 0 && activeDayPlan?.meals && (() => {
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
                    moveOptions={presentSections.filter(s => s.key !== key).map(s => ({ key: s.key, title: s.title }))}
                    onMove={(targetKey) => handleMoveMeal(key, targetKey as MealKey)}
                    isLocked={lockedMeals?.includes(`${activeDay}-${key}`)}
                    onUnlock={onUnlockMeal ? () => onUnlockMeal(activeDay, key) : undefined}
                    mealSubstitutions={substitutions?.filter(s => s.day === activeDay && s.mealKey === key)}
                    equivalents={getMealEquivalents(activeDayPlan.meals[key]!, { allergens: patientData?.allergens, excludedFoods: patientData?.excludedFoods })}
                    onSaveEquivalents={(updated) => handleSaveMeal(key, updated)}
                    recipes={recipes}
                    onSaveAsRecipe={onSaveAsRecipe}
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

      {/* ── Vista impresión individual ── */}
      {printMode === 'individual' && (
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
            {patientData?.allergens && patientData.allergens.length > 0 && (
              <p className="text-xs font-bold text-red-600 mt-1">
                ⚠ Alérgenos: {patientData.allergens.map(a => ALLERGEN_LABELS[a]).join(', ')}
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
                                <span key={idx} className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{normalizeIngredient(ing)}</span>
                              ))}
                            </div>
                          )}
                          {(meal.instructions?.length ?? 0) > 0 && (
                            <ol className="mt-1.5 space-y-0.5 list-none">
                              {meal.instructions!.map((step, idx) => (
                                <li key={idx} className="text-[9px] text-gray-600 flex gap-1.5">
                                  <span className="font-bold text-green-600 shrink-0">{idx + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
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

        <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-500">
          {CLINIC.disclaimer}
        </div>
        <div className="mt-2 text-center text-[9px] text-gray-400 italic">
          Documento generado por {CLINIC.appName} AI para {CLINIC.name}.
        </div>
      </div>
      )}

      {/* ── Vista impresión "Pareja en paralelo" ── */}
      {printMode === 'parallel' && hasPrintablePartner && (
      <div className="hidden only-print bg-white text-black p-4 w-full">
        <CouplePrintHeader
          metrics={metrics} patientName={patientName} patientData={patientData}
          otherPersonDiet={otherPersonDiet!}
        />
        {alignedCoupleDays.map((day, dayIdx) => (
          <div key={day.day} className={`mb-4${dayIdx > 0 ? ' print-page-break' : ''}`}>
            <h4 className="font-black text-xl mb-3 text-white bg-black inline-block px-4 py-1 rounded-md">DÍA {day.day}</h4>
            <table className="w-full text-[10px] border-collapse table-fixed">
              <colgroup>
                <col className="w-24" />
                <col className="w-[38%]" />
                <col className="w-[38%]" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left pb-1">Toma</th>
                  <th className="text-left pb-1">{patientName || 'Paciente'}</th>
                  <th className="text-left pb-1">{otherPersonDiet!.patientData.name || 'Pareja'}</th>
                </tr>
              </thead>
              <tbody>
                {day.meals.map(slot => (
                  <ParallelMealRow key={slot.key} slot={slot} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <CoupleShoppingList list={coupleShoppingList} days={alignedCoupleDays.length} />
        <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-500">{CLINIC.disclaimer}</div>
      </div>
      )}

      {/* ── Vista impresión "Pareja consolidada" ── */}
      {printMode === 'consolidated' && hasPrintablePartner && (
      <div className="hidden only-print bg-white text-black p-4 w-full">
        <CouplePrintHeader
          metrics={metrics} patientName={patientName} patientData={patientData}
          otherPersonDiet={otherPersonDiet!}
        />
        {alignedCoupleDays.map((day, dayIdx) => (
          <div key={day.day} className={dayIdx > 0 ? 'print-page-break' : ''}>
            <h4 className="font-black text-xl mb-3 text-white bg-black inline-block px-4 py-1 rounded-md">DÍA {day.day}</h4>
            <div className="flex flex-col gap-2">
              {day.meals.map(slot => {
                const sameRecipe = !!slot.principal && !!slot.partner &&
                  slot.principal.name.trim().toLowerCase() === slot.partner.name.trim().toLowerCase();
                if (!sameRecipe) {
                  // Nombres distintos (edición manual, o receta completa distinta
                  // por alergia) — no se puede consolidar sin fabricar datos:
                  // se muestran ambas recetas completas, igual que en paralelo.
                  return <ParallelMealRow key={slot.key} slot={slot} asBlock />;
                }
                const paired = pairIngredients(slot.principal!.ingredients, slot.partner!.ingredients);
                return (
                  <div key={slot.key} className="break-inside-avoid">
                    <div className="w-28 font-bold uppercase text-[9px] text-gray-400 pt-1">{slot.title}</div>
                    <div className="text-sm font-bold">
                      {slot.principal!.name}
                      <span className="block text-[11px] font-normal text-gray-600 italic">{slot.principal!.description}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {paired.map((row, i) => (
                        <span key={i} className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {row.food} — {patientName || 'Paciente'}: {row.mine ? extractQuantityLabel(row.mine) : '—'} · {otherPersonDiet!.patientData.name || 'Pareja'}: {row.theirs ? extractQuantityLabel(row.theirs) : '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <CoupleShoppingList list={coupleShoppingList} days={alignedCoupleDays.length} />
        <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-500">{CLINIC.disclaimer}</div>
      </div>
      )}
    </div>
  );
};

export default DietPlanDisplay;
