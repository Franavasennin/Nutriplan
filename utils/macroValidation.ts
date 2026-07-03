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

export function reconcileMealMacros(meal: Meal): Meal {
  if (meal.protein == null || meal.carbs == null || meal.fats == null) return meal;

  const derivedCalories = meal.protein * 4 + meal.carbs * 4 + meal.fats * 9;
  if (derivedCalories <= 0) return meal;

  if (meal.calories == null) {
    return { ...meal, calories: Math.round(derivedCalories) };
  }

  const diff = Math.abs(meal.calories - derivedCalories) / derivedCalories;
  if (diff > TOLERANCE) {
    // Las calorías declaradas no cuadran con los macros declarados — se
    // recalculan desde los macros (más fiable: la IA calibra primero
    // gramos de proteína/HC/grasa y las kcal son una simple suma derivada).
    return { ...meal, calories: Math.round(derivedCalories) };
  }
  return meal;
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
