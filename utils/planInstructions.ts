import { DietResponse, DayPlan, Meal, CalculatedMetrics } from '../types';
import { sumDayMacros, reconcileDietResponse } from './macroValidation';
import { scaleIngredientText } from './planScaling';
import { InstructionChange } from '../services/geminiService';

// Tolerancia de calorías por comida antes de forzar el reescalado — misma
// cifra que la Regla 2 documentada en el prompt de applyPlanInstructions.
const MEAL_CALORIE_TOLERANCE_PCT = 8;

/**
 * Corrige determinísticamente la comida que devuelve la IA cuando se desvía
 * del objetivo (las calorías de LA COMIDA ORIGINAL que sustituye).
 *
 * Bug real reportado por la nutricionista: pidió "pan en los desayunos" y el
 * desayuno resultante llevaba MÁS calorías que el original en vez de
 * cuadrar — el prompt le pedía a la IA que recalculara las cantidades, pero
 * nada lo garantizaba si la IA no cumplía esa instrucción al pie de la letra.
 * Ahora, si la comida devuelta se desvía más de `MEAL_CALORIE_TOLERANCE_PCT`,
 * se reescala TODO el plato (ingredientes + macros) proporcionalmente hasta
 * cuadrar con el objetivo — igual que hace `planScaling.ts` para Pareja
 * Inteligente, pero por comida en vez de por plan entero. Esto conserva la
 * composición que decidió la IA (el pan sigue estando) y solo ajusta el
 * tamaño de la ración, sin depender de que el modelo calibre bien los gramos.
 */
export function enforceMealMacroTarget(meal: Meal, originalMeal: Meal): Meal {
  if (meal.protein == null || meal.carbs == null || meal.fats == null) return meal;
  if (originalMeal.protein == null || originalMeal.carbs == null || originalMeal.fats == null) return meal;

  const derivedCalories = meal.protein * 4 + meal.carbs * 4 + meal.fats * 9;
  const targetCalories = originalMeal.protein * 4 + originalMeal.carbs * 4 + originalMeal.fats * 9;
  if (derivedCalories <= 0 || targetCalories <= 0) return meal;

  const diffPct = Math.abs(derivedCalories - targetCalories) / targetCalories * 100;
  if (diffPct <= MEAL_CALORIE_TOLERANCE_PCT) return meal;

  const factor = targetCalories / derivedCalories;
  const newProtein = meal.protein * factor;
  const newCarbs = meal.carbs * factor;
  const newFats = meal.fats * factor;
  const newCalories = newProtein * 4 + newCarbs * 4 + newFats * 9;

  return {
    ...meal,
    protein: Math.round(newProtein),
    carbs: Math.round(newCarbs),
    fats: Math.round(newFats),
    calories: Math.round(newCalories),
    ingredients: meal.ingredients.map(i => scaleIngredientText(i, factor)),
  };
}

/**
 * Fusión determinista de los cambios propuestos por `applyPlanInstructions`
 * (services/geminiService.ts) sobre el plan ya existente. La IA solo PROPONE
 * qué comidas cambiar — esta función es la única que decide qué se sobrescribe
 * de verdad, para que el resto del plan quede intacto byte a byte y el
 * comportamiento sea auditable/testeable sin depender del modelo.
 *
 * Los cambios con `day` inexistente o `mealKey` que no exista YA en ese día
 * del plan real se descartan (reportados en `skipped`) — validación contra el
 * plan real, no contra `patientData.mealCount` (que falta en algunas dietas
 * antiguas, ver hallazgo del plan aprobado).
 */
export function mergeInstructionChanges(
  plan: DietResponse,
  changes: InstructionChange[]
): { plan: DietResponse; applied: number; skipped: string[] } {
  const skipped: string[] = [];
  let applied = 0;
  const realDays = new Set(plan.weeklyPlan.map(d => d.day));

  const weeklyPlan: DayPlan[] = plan.weeklyPlan.map(day => {
    const relevantChanges = changes.filter(c => c.day === day.day);
    if (relevantChanges.length === 0) return day;

    let meals = day.meals;
    let mutated = false;

    for (const change of relevantChanges) {
      const mealKey = change.mealKey as keyof DayPlan['meals'];
      const originalMeal = day.meals[mealKey];
      if (!(mealKey in day.meals) || originalMeal == null) {
        skipped.push(`día ${change.day} / ${change.mealKey} (no existe en el plan actual)`);
        continue;
      }
      if (!mutated) {
        meals = { ...day.meals };
        mutated = true;
      }
      meals[mealKey] = enforceMealMacroTarget(change.meal, originalMeal);
      applied++;
    }

    return mutated ? { ...day, meals } : day;
  });

  // Días mencionados en `changes` que no existen en el plan
  for (const c of changes) {
    if (!realDays.has(c.day)) {
      skipped.push(`día ${c.day} / ${c.mealKey} (el día no existe en el plan)`);
    }
  }

  return { plan: reconcileDietResponse({ ...plan, weeklyPlan }), applied, skipped };
}

/**
 * Detecta días cuyos macros totales se desvían del objetivo diario más allá
 * de `tolerancePct`. NO corrige nada — solo avisa, para que la nutricionista
 * decida (deliberadamente no se usa `scalePlanToTarget` aquí: reescalaría
 * también las comidas que ella no quería tocar).
 */
export function findDaysOffTarget(
  plan: DietResponse,
  metrics: CalculatedMetrics,
  tolerancePct = 10
): number[] {
  const target = metrics.macros.calories;
  if (!target) return [];

  const offTarget: number[] = [];
  for (const day of plan.weeklyPlan) {
    const totals = sumDayMacros(day.meals);
    if (!totals) continue;
    const diffPct = Math.abs(totals.calories - target) / target * 100;
    if (diffPct > tolerancePct) offTarget.push(day.day);
  }
  return offTarget;
}
