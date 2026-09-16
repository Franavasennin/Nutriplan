import { Meal, Recipe } from '../types';
import { scaleIngredientText } from './planScaling';

// Mismo clamp de seguridad que planScaling.ts (Pareja Inteligente): evita
// cantidades absurdas cuando la receta elegida está muy lejos en macros de
// la comida que sustituye (ej. cambiar un batido de 300kcal por un plato de
// 900kcal declarados).
const MIN_FACTOR = 0.35;
const MAX_FACTOR = 3.0;

function clampFactor(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw));
}

export interface AdaptedRecipeResult {
  meal: Meal;
  /** Presente si no se pudo ajustar (receta o comida objetivo sin macros
   *  fiables) — la receta se insertó tal cual, sin reescalar cantidades. */
  warning?: string;
}

/**
 * Convierte una receta de RECETAS AI en una Meal ajustada a los macros
 * (proteína/HC/grasa) de la comida que sustituye. Mismo criterio
 * determinista que el motor de "Pareja Inteligente" (planScaling.ts
 * scaleMeal): reescala cantidades y macros proporcionalmente, nunca
 * reinventa la receta ni cambia el plato.
 */
export function adaptRecipeToMealTarget(
  recipe: Recipe,
  target: { protein?: number; carbs?: number; fats?: number }
): AdaptedRecipeResult {
  const baseMeal: Meal = {
    name: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fats: recipe.fats,
  };

  if (
    target.protein == null || target.carbs == null || target.fats == null ||
    recipe.protein <= 0 || recipe.carbs <= 0 || recipe.fats <= 0
  ) {
    return {
      meal: baseMeal,
      warning: 'La comida original o la receta no tienen macros completos — se insertó tal cual, sin ajustar cantidades.',
    };
  }

  const proteinFactor = clampFactor(target.protein / recipe.protein);
  const carbsFactor = clampFactor(target.carbs / recipe.carbs);
  const fatsFactor = clampFactor(target.fats / recipe.fats);

  const newProtein = recipe.protein * proteinFactor;
  const newCarbs = recipe.carbs * carbsFactor;
  const newFats = recipe.fats * fatsFactor;
  // Igual que scaleMeal: las calorías se RECALCULAN desde los nuevos macros,
  // nunca con un cuarto factor independiente.
  const newCalories = newProtein * 4 + newCarbs * 4 + newFats * 9;
  const oldCalories = recipe.protein * 4 + recipe.carbs * 4 + recipe.fats * 9;
  const quantityFactor = oldCalories > 0 ? newCalories / oldCalories : 1;

  return {
    meal: {
      ...baseMeal,
      ingredients: recipe.ingredients.map(i => scaleIngredientText(i, quantityFactor)),
      protein: Math.round(newProtein),
      carbs: Math.round(newCarbs),
      fats: Math.round(newFats),
      calories: Math.round(newCalories),
    },
  };
}
