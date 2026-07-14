import { describe, it, expect } from 'vitest';
import { applyAllergenSubstitutions } from '../utils/allergenSubstitution';
import { Allergen } from '../types';
import type { DietResponse, Meal } from '../types';

const meal = (ingredients: string[], overrides: Partial<Meal> = {}): Meal => ({
  name: 'Test',
  description: 'test',
  ingredients,
  calories: 400, protein: 30, carbs: 40, fats: 10,
  ...overrides,
});

const plan = (ingredients: string[]): DietResponse => ({
  durationText: '1 semana',
  generalGuidelines: [],
  weeklyPlan: [{ day: 1, meals: { breakfast: meal(ingredients) } }],
});

describe('applyAllergenSubstitutions', () => {
  it('sin alérgenos declarados, no toca nada', () => {
    const { plan: result, substitutions } = applyAllergenSubstitutions(plan(['250 ml leche']), []);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('250 ml leche');
    expect(substitutions).toHaveLength(0);
  });

  it('sustituye leche por leche de avena cuando hay alergia a la leche', () => {
    const { plan: result, substitutions } = applyAllergenSubstitutions(plan(['250 ml leche']), [Allergen.Leche]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('250 ml leche de avena');
    expect(substitutions).toHaveLength(1);
    expect(substitutions[0]).toMatchObject({ day: 1, mealKey: 'breakfast', allergen: Allergen.Leche });
  });

  it('no re-sustituye un ingrediente que ya es la alternativa (evita bucle)', () => {
    const { plan: result, substitutions } = applyAllergenSubstitutions(plan(['250 ml leche de avena']), [Allergen.Leche]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('250 ml leche de avena');
    expect(substitutions).toHaveLength(0);
  });

  it('sustituye huevo por tofu revuelto (alergia a huevos)', () => {
    const { plan: result } = applyAllergenSubstitutions(plan(['2 huevos']), [Allergen.Huevos]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('2 tofu revuelto');
  });

  it('deja constancia en warnings cuando el alérgeno no tiene regla de sustitución (Sulfitos)', () => {
    const { plan: result, warnings, substitutions } = applyAllergenSubstitutions(plan(['vino con sulfitos']), [Allergen.Sulfitos]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('vino con sulfitos');
    expect(substitutions).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('ingredientes sin alérgeno declarado no se tocan', () => {
    const { plan: result, substitutions } = applyAllergenSubstitutions(plan(['150g pechuga de pollo']), [Allergen.Leche]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('150g pechuga de pollo');
    expect(substitutions).toHaveLength(0);
  });

  it('preserva la cantidad ya reescalada al sustituir el nombre del alimento', () => {
    const { plan: result } = applyAllergenSubstitutions(plan(['125 ml leche']), [Allergen.Leche]);
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('125 ml leche de avena');
  });
});
