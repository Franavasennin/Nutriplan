import { Meal, DayPlan, DietResponse } from '../types';

/**
 * Validación determinista de los macros que devuelve la IA (auditoría —
 * mejora crítica #2).
 *
 * El LLM ESTIMA los valores nutricionales de cada comida; no los calcula
 * contra una base de datos de composición de alimentos. El error más común
 * y detectable sin necesidad de una base de datos externa es la
 * INCONSISTENCIA ARITMÉTICA interna: que las calorías declaradas no
 * correspondan a los propios macros declarados (proteína·4 + HC·4 + grasa·9).
 *
 * Esta función NO valida que los ingredientes realmente aporten esos macros
 * (para eso haría falta una base de datos tipo BEDCA/USDA, fuera de alcance
 * actual) — pero SÍ corrige el caso, muy real, de que la IA escriba números
 * que no cuadran entre sí.
 */

const TOLERANCE = 0.12; // 12% de margen — evita "corregir" redondeos normales

/**
 * La IA a veces devuelve un ingrediente como objeto ({food, amount}) en vez
 * del string plano pedido en el prompt ("150g pollo"). Si se deja pasar tal
 * cual, React revienta al renderizarlo como children y `generateShoppingList`
 * revienta al llamar `.trim()` sobre un objeto. Se normaliza aquí, en el
 * único punto por el que pasan todas las respuestas de IA.
 */
export function normalizeIngredient(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const amount = obj.amount ?? obj.cantidad ?? obj.quantity ?? '';
    const food = obj.food ?? obj.name ?? obj.alimento ?? obj.ingredient ?? '';
    const combined = [amount, food].filter(Boolean).join(' ').trim();
    if (combined) return combined;
  }
  return String(item ?? '').trim();
}

function normalizeIngredients(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map(normalizeIngredient).filter(Boolean);
}

export function reconcileMealMacros(meal: Meal): Meal {
  const normalized: Meal = Array.isArray(meal.ingredients)
    ? { ...meal, ingredients: normalizeIngredients(meal.ingredients) }
    : meal;

  if (normalized.protein == null || normalized.carbs == null || normalized.fats == null) return normalized;

  const derivedCalories = normalized.protein * 4 + normalized.carbs * 4 + normalized.fats * 9;
  if (derivedCalories <= 0) return normalized;

  if (normalized.calories == null) {
    return { ...normalized, calories: Math.round(derivedCalories) };
  }

  const diff = Math.abs(normalized.calories - derivedCalories) / derivedCalories;
  if (diff > TOLERANCE) {
    // Las calorías declaradas no cuadran con los macros declarados — se
    // recalculan desde los macros (más fiable: la IA calibra primero
    // gramos de proteína/HC/grasa y las kcal son una simple suma derivada).
    return { ...normalized, calories: Math.round(derivedCalories) };
  }
  return normalized;
}

export function reconcileDayPlan(day: DayPlan): DayPlan {
  const meals = { ...day.meals };
  (Object.keys(meals) as (keyof typeof meals)[]).forEach(key => {
    const meal = meals[key];
    if (meal) meals[key] = reconcileMealMacros(meal);
  });
  return { ...day, meals };
}

export function reconcileDietResponse(plan: DietResponse): DietResponse {
  return { ...plan, weeklyPlan: plan.weeklyPlan.map(reconcileDayPlan) };
}
