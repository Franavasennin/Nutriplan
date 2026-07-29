import { describe, it, expect } from 'vitest';
import {
  computeMealMacrosFromIngredients,
  verifyMealAgainstComposition,
  correctMealToDeclaredMacros,
} from '../utils/nutritionVerification';
import type { Meal } from '../types';

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  name: 'test',
  description: 'test',
  ingredients: [],
  ...overrides,
});

describe('computeMealMacrosFromIngredients', () => {
  it('reconoce ingredientes comunes con cantidad en gramos', () => {
    const m = meal({ ingredients: ['150g pechuga de pollo', '100g arroz blanco'] });
    const result = computeMealMacrosFromIngredients(m);
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
    expect(result.coverage).toBe(1);
    expect(result.protein).toBeGreaterThan(0);
  });

  it('excluye ingredientes despreciables (especias/sal) de la cobertura', () => {
    const m2 = meal({ ingredients: ['150g pechuga de pollo', '1g sal marina', '1g canela en polvo'] });
    const result2 = computeMealMacrosFromIngredients(m2);
    expect(result2.negligible.length).toBeGreaterThan(0);
    expect(result2.unmatched).toHaveLength(0);
    expect(result2.coverage).toBe(1); // 150g pollo es el único gramaje que cuenta
  });

  it('marca como unmatched un alimento con cantidad pero no reconocido', () => {
    const m = meal({ ingredients: ['30g barrita de proteína BAREBEL'] });
    const result = computeMealMacrosFromIngredients(m);
    expect(result.unmatched).toHaveLength(1);
    expect(result.coverage).toBe(0);
  });

  it('ignora ingredientes sin cantidad parseable de forma fiable (cucharada/taza)', () => {
    const m = meal({ ingredients: ['1 cucharada AOVE', '150g pechuga de pollo'] });
    const result = computeMealMacrosFromIngredients(m);
    // AOVE con cucharada no da gramos fiables -> ni matched ni unmatched
    expect(result.matched).toHaveLength(1);
    expect(result.coverage).toBe(1);
  });
});

describe('verifyMealAgainstComposition', () => {
  it('devuelve "ok" cuando lo declarado cuadra con los ingredientes reales', () => {
    // Tabla real: pechuga de pollo = 110 kcal / 23g P por 100g -> 150g = 165 kcal / 34.5g P
    const m = meal({
      ingredients: ['150g pechuga de pollo'],
      calories: 170, protein: 34, carbs: 0, fats: 2,
    });
    const result = verifyMealAgainstComposition(m);
    expect(result.status).toBe('ok');
  });

  it('detecta una desviación real (el bug reportado: la IA declara muchas más kcal de las que dan los ingredientes)', () => {
    // 50g pechuga de pollo real = 55 kcal (110*0.5); la IA declara 90 (+63%)
    const m = meal({
      ingredients: ['50g pechuga de pollo'],
      calories: 90, protein: 20, carbs: 0, fats: 3,
    });
    const result = verifyMealAgainstComposition(m);
    expect(result.status).toBe('deviation');
    expect(result.suggestedFactor).toBeDefined();
    expect(result.suggestedFactor!).toBeGreaterThan(1); // hace falta MÁS cantidad, no menos
  });

  it('devuelve "insufficient_data" si la cobertura es baja, sin acusar de nada', () => {
    const m = meal({
      ingredients: ['30g producto de marca desconocida XYZ'],
      calories: 500, protein: 50, carbs: 10, fats: 20,
    });
    const result = verifyMealAgainstComposition(m);
    expect(result.status).toBe('insufficient_data');
  });

  it('devuelve "insufficient_data" para una comida solo de especias (nunca división por cero)', () => {
    const m = meal({
      ingredients: ['1g sal marina', '1g pimienta negra'],
      calories: 5, protein: 0, carbs: 1, fats: 0,
    });
    expect(() => verifyMealAgainstComposition(m)).not.toThrow();
    const result = verifyMealAgainstComposition(m);
    expect(result.status).toBe('insufficient_data');
  });
});

describe('correctMealToDeclaredMacros', () => {
  it('reescala las cantidades para cuadrar con lo declarado cuando hay deviation', () => {
    const m = meal({
      ingredients: ['50g pechuga de pollo'],
      calories: 90, protein: 20, carbs: 0, fats: 3,
    });
    const verification = verifyMealAgainstComposition(m);
    const { meal: corrected, corrected: wasCorrected } = correctMealToDeclaredMacros(m, verification);
    expect(wasCorrected).toBe(true);
    // El factor debe aumentar la cantidad de pollo (declarado > real)
    const grams = parseInt(corrected.ingredients[0], 10);
    expect(grams).toBeGreaterThan(50);
  });

  it('no corrige una comida "ok"', () => {
    const m = meal({
      ingredients: ['150g pechuga de pollo'],
      calories: 170, protein: 34, carbs: 0, fats: 2,
    });
    const verification = verifyMealAgainstComposition(m);
    const { corrected } = correctMealToDeclaredMacros(m, verification);
    expect(corrected).toBe(false);
  });

  it('no corrige si el factor cae fuera del clamp [0.4, 2.5] -- degrada a aviso', () => {
    // Declara mucho más de lo que dan los ingredientes reales -> factor absurdo
    const m = meal({
      ingredients: ['50g pechuga de pollo'],
      calories: 2000, protein: 400, carbs: 0, fats: 10,
    });
    const verification = verifyMealAgainstComposition(m);
    expect(verification.status).toBe('deviation');
    const { corrected } = correctMealToDeclaredMacros(m, verification);
    expect(corrected).toBe(false);
  });

  it('no toca los ingredientes negligible al reescalar', () => {
    const m = meal({
      ingredients: ['50g pechuga de pollo', '1g sal marina'],
      calories: 90, protein: 20, carbs: 0, fats: 3,
    });
    const verification = verifyMealAgainstComposition(m);
    const { meal: corrected } = correctMealToDeclaredMacros(m, verification);
    expect(corrected.ingredients[1]).toBe('1g sal marina');
  });
});
