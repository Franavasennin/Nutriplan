import { describe, it, expect } from 'vitest';
import { computePlanDiff } from '../utils/planDiff';
import { DietResponse } from '../types';

describe('computePlanDiff', () => {
  const basePlan: DietResponse = {
    durationText: '7 días',
    generalGuidelines: [],
    weeklyPlan: [
      {
        day: 1,
        meals: {
          breakfast: {
            name: 'Avena con manzana',
            description: 'Desayuno rico en fibra',
            ingredients: ['50g avena', '1 manzana', '200ml leche'],
            calories: 350,
            protein: 12,
            carbs: 55,
            fats: 6,
          },
          lunch: {
            name: 'Pechuga de pollo con arroz',
            description: 'Comida equilibrada',
            ingredients: ['150g pechuga de pollo', '80g arroz', '100g ensalada'],
            calories: 550,
            protein: 42,
            carbs: 65,
            fats: 10,
          },
        },
      },
    ],
  };

  it('detecta cuando dos planes son idénticos', () => {
    const diff = computePlanDiff(basePlan, JSON.parse(JSON.stringify(basePlan)));
    expect(diff.hasChanges).toBe(false);
    expect(diff.totalChangedMeals).toBe(0);
  });

  it('detecta cambio de comida y calcula deltas de macros', () => {
    const updatedPlan: DietResponse = JSON.parse(JSON.stringify(basePlan));
    updatedPlan.weeklyPlan[0].meals.breakfast = {
      name: 'Tostada con jamón y tomate',
      description: 'Desayuno salado',
      ingredients: ['60g pan integral', '40g jamón ibérico', '1 tomate rallado'],
      calories: 280, // -70
      protein: 16,  // +4
      carbs: 35,    // -20
      fats: 8,      // +2
    };

    const diff = computePlanDiff(basePlan, updatedPlan);
    expect(diff.hasChanges).toBe(true);
    expect(diff.totalChangedMeals).toBe(1);

    const day1 = diff.days.find(d => d.day === 1);
    expect(day1).toBeDefined();
    expect(day1!.hasChanges).toBe(true);

    const bfDiff = day1!.mealDiffs.find(m => m.mealKey === 'breakfast');
    expect(bfDiff).toBeDefined();
    expect(bfDiff!.type).toBe('changed');
    expect(bfDiff!.diffSummary?.nameChanged).toBe(true);
    expect(bfDiff!.diffSummary?.calorieDelta).toBe(-70);
    expect(bfDiff!.diffSummary?.proteinDelta).toBe(4);
  });

  it('detecta tomas añadidas o eliminadas', () => {
    const updatedPlan: DietResponse = JSON.parse(JSON.stringify(basePlan));
    delete updatedPlan.weeklyPlan[0].meals.lunch;
    updatedPlan.weeklyPlan[0].meals.dinner = {
      name: 'Tortilla francesa con ensalada',
      description: 'Cena ligera',
      ingredients: ['2 huevos', 'ensalada mixta'],
      calories: 250,
      protein: 16,
      carbs: 5,
      fats: 18,
    };

    const diff = computePlanDiff(basePlan, updatedPlan);
    expect(diff.hasChanges).toBe(true);
    expect(diff.totalChangedMeals).toBe(2);

    const day1 = diff.days[0];
    const lunchDiff = day1.mealDiffs.find(m => m.mealKey === 'lunch');
    const dinnerDiff = day1.mealDiffs.find(m => m.mealKey === 'dinner');

    expect(lunchDiff?.type).toBe('removed');
    expect(dinnerDiff?.type).toBe('added');
  });
});
