import { describe, it, expect } from 'vitest';
import { adaptRecipeToMealTarget } from '../utils/recipeToMeal';
import type { Recipe } from '../types';

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'test-1',
  title: 'Pollo con arroz',
  description: 'Pechuga de pollo con arroz blanco',
  prepTime: 20,
  calories: 500,
  protein: 40,
  carbs: 60,
  fats: 10,
  ingredients: ['150g pollo', '100g arroz'],
  instructions: ['Cocina el pollo', 'Cocina el arroz'],
  tags: ['almuerzo'],
  ...overrides,
});

describe('adaptRecipeToMealTarget', () => {
  it('no cambia el plato ni el número de ingredientes, solo cantidades/macros', () => {
    const { meal } = adaptRecipeToMealTarget(recipe(), { protein: 80, carbs: 120, fats: 20 });
    expect(meal.name).toBe('Pollo con arroz');
    expect(meal.ingredients).toHaveLength(2);
  });

  it('factor 1 (mismos macros objetivo que la receta) deja las cantidades intactas', () => {
    const { meal, warning } = adaptRecipeToMealTarget(recipe(), { protein: 40, carbs: 60, fats: 10 });
    expect(warning).toBeUndefined();
    expect(meal.protein).toBe(40);
    expect(meal.carbs).toBe(60);
    expect(meal.fats).toBe(10);
    expect(meal.ingredients).toEqual(['150g pollo', '100g arroz']);
  });

  it('escala cantidades proporcionalmente al doblar el objetivo de macros', () => {
    const { meal } = adaptRecipeToMealTarget(recipe(), { protein: 80, carbs: 120, fats: 20 });
    expect(meal.protein).toBe(80);
    expect(meal.carbs).toBe(120);
    expect(meal.fats).toBe(20);
    // calorías recalculadas desde los nuevos macros, no reescaladas aparte
    expect(meal.calories).toBe(80 * 4 + 120 * 4 + 20 * 9);
    expect(meal.ingredients).toEqual(['300g pollo', '200g arroz']);
  });

  it('clampa el factor si el objetivo está muy lejos de la receta (no genera cantidades absurdas)', () => {
    const { meal } = adaptRecipeToMealTarget(recipe(), { protein: 400, carbs: 600, fats: 100 });
    // factor real sería 10x — clampado a 3x (MAX_FACTOR)
    expect(meal.protein).toBe(120);
    expect(meal.ingredients).toEqual(['450g pollo', '300g arroz']);
  });

  it('inserta la receta tal cual y avisa si la comida objetivo no tiene macros', () => {
    const { meal, warning } = adaptRecipeToMealTarget(recipe(), {});
    expect(warning).toBeDefined();
    expect(meal.protein).toBe(40);
    expect(meal.ingredients).toEqual(['150g pollo', '100g arroz']);
  });

  it('inserta la receta tal cual y avisa si la receta no tiene macros fiables (0)', () => {
    const { meal, warning } = adaptRecipeToMealTarget(recipe({ protein: 0 }), { protein: 80, carbs: 120, fats: 20 });
    expect(warning).toBeDefined();
    expect(meal.ingredients).toEqual(['150g pollo', '100g arroz']);
  });

  it('conserva las instrucciones de la receta', () => {
    const { meal } = adaptRecipeToMealTarget(recipe(), { protein: 80, carbs: 120, fats: 20 });
    expect(meal.instructions).toEqual(['Cocina el pollo', 'Cocina el arroz']);
  });
});
