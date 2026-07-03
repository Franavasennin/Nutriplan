import { describe, it, expect } from 'vitest';
import { reconcileMealMacros, reconcileDayPlan, reconcileDietResponse } from '../utils/macroValidation';
import type { Meal, DayPlan, DietResponse } from '../types';

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  name: 'Pechuga con arroz',
  description: 'test',
  ingredients: ['150g pechuga de pollo', '100g arroz cocido'],
  calories: 300, protein: 30, carbs: 30, fats: 5,
  ...overrides,
});

describe('reconcileMealMacros', () => {
  it('no toca una comida cuyas kcal ya cuadran con los macros', () => {
    // 30*4 + 30*4 + 5*9 = 120+120+45 = 285 → declara 300, diff = 15/285 ≈ 5.3% (dentro de tolerancia)
    const m = meal({ calories: 300 });
    const result = reconcileMealMacros(m);
    expect(result.calories).toBe(300);
  });

  it('corrige las kcal cuando difieren >12% de lo que implican los macros', () => {
    // macros implican 285 kcal, pero la IA declaró 900 (inconsistencia grave)
    const m = meal({ calories: 900, protein: 30, carbs: 30, fats: 5 });
    const result = reconcileMealMacros(m);
    expect(result.calories).toBe(285);
  });

  it('rellena las kcal si vienen ausentes', () => {
    const m = meal({ calories: undefined, protein: 20, carbs: 20, fats: 10 });
    const result = reconcileMealMacros(m);
    expect(result.calories).toBe(20 * 4 + 20 * 4 + 10 * 9);
  });

  it('no toca la comida si faltan macros (no se puede derivar)', () => {
    const m = meal({ protein: undefined, calories: 999 });
    const result = reconcileMealMacros(m);
    expect(result.calories).toBe(999);
  });

  it('no muta el objeto original', () => {
    const m = meal({ calories: 900 });
    reconcileMealMacros(m);
    expect(m.calories).toBe(900);
  });
});

describe('reconcileDayPlan', () => {
  it('reconcilia todas las tomas presentes en el día', () => {
    const day: DayPlan = {
      day: 1,
      meals: {
        breakfast: meal({ calories: 900 }),
        lunch: meal({ calories: 300 }),
      },
    };
    const result = reconcileDayPlan(day);
    expect(result.meals.breakfast?.calories).toBe(285);
    expect(result.meals.lunch?.calories).toBe(300);
  });
});

describe('reconcileDietResponse', () => {
  it('reconcilia todos los días del plan', () => {
    const plan: DietResponse = {
      durationText: '1 semana',
      generalGuidelines: [],
      weeklyPlan: [
        { day: 1, meals: { breakfast: meal({ calories: 900 }) } },
        { day: 2, meals: { dinner: meal({ calories: 300 }) } },
      ],
    };
    const result = reconcileDietResponse(plan);
    expect(result.weeklyPlan[0].meals.breakfast?.calories).toBe(285);
    expect(result.weeklyPlan[1].meals.dinner?.calories).toBe(300);
  });
});
