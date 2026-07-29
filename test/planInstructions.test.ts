import { describe, it, expect } from 'vitest';
import { mergeInstructionChanges, findDaysOffTarget } from '../utils/planInstructions';
import type { Meal, DayPlan, DietResponse, CalculatedMetrics } from '../types';
import type { InstructionChange } from '../services/geminiService';

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  name: 'Avena con fruta',
  description: 'test',
  ingredients: ['60g avena', '1 plátano'],
  calories: 300, protein: 12, carbs: 50, fats: 6,
  ...overrides,
});

const day = (dayNum: number, overrides: Partial<DayPlan['meals']> = {}): DayPlan => ({
  day: dayNum,
  meals: {
    breakfast: meal(),
    lunch: meal({ name: 'Pollo con arroz', calories: 600, protein: 45, carbs: 60, fats: 15 }),
    dinner: meal({ name: 'Merluza con verduras', calories: 328, protein: 35, carbs: 20, fats: 12 }),
    ...overrides,
  },
});

const plan = (): DietResponse => ({
  weeklyPlan: [day(1), day(2), day(3)],
  generalGuidelines: ['Bebe agua'],
  durationText: '3 días',
});

const metrics = (calories = 1300): CalculatedMetrics => ({
  imc: 22, bmr: 1500, tee: calories,
  macros: { protein: 92, carbs: 130, fats: 33, calories },
});

describe('mergeInstructionChanges', () => {
  it('fusiona un único cambio de comida y conserva el resto del día intacto', () => {
    const changes: InstructionChange[] = [
      { day: 1, mealKey: 'breakfast', meal: meal({ name: 'Tostada con pan integral', calories: 310 }) },
    ];
    const { plan: result, applied, skipped } = mergeInstructionChanges(plan(), changes);
    expect(applied).toBe(1);
    expect(skipped).toEqual([]);
    expect(result.weeklyPlan[0].meals.breakfast!.name).toBe('Tostada con pan integral');
    // El resto del día 1 no se toca
    expect(result.weeklyPlan[0].meals.lunch).toEqual(plan().weeklyPlan[0].meals.lunch);
    // Otros días intactos
    expect(result.weeklyPlan[1]).toEqual(plan().weeklyPlan[1]);
    expect(result.weeklyPlan[2]).toEqual(plan().weeklyPlan[2]);
  });

  it('fusiona varios cambios en varios días', () => {
    const changes: InstructionChange[] = [
      { day: 1, mealKey: 'breakfast', meal: meal({ name: 'Pan con tomate' }) },
      { day: 2, mealKey: 'breakfast', meal: meal({ name: 'Pan con aguacate' }) },
      { day: 3, mealKey: 'dinner', meal: meal({ name: 'Pescado al horno' }) },
    ];
    const { plan: result, applied, skipped } = mergeInstructionChanges(plan(), changes);
    expect(applied).toBe(3);
    expect(skipped).toEqual([]);
    expect(result.weeklyPlan[0].meals.breakfast!.name).toBe('Pan con tomate');
    expect(result.weeklyPlan[1].meals.breakfast!.name).toBe('Pan con aguacate');
    expect(result.weeklyPlan[2].meals.dinner!.name).toBe('Pescado al horno');
  });

  it('descarta (skipped) un cambio con día inexistente', () => {
    const changes: InstructionChange[] = [
      { day: 99, mealKey: 'breakfast', meal: meal() },
    ];
    const { plan: result, applied, skipped } = mergeInstructionChanges(plan(), changes);
    expect(applied).toBe(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain('día 99');
    expect(result).toEqual(plan());
  });

  it('descarta (skipped) un mealKey inválido que no existe en ese día', () => {
    const changes: InstructionChange[] = [
      { day: 1, mealKey: 'afternoonSnack', meal: meal() }, // day(1) no tiene afternoonSnack
    ];
    const { plan: result, applied, skipped } = mergeInstructionChanges(plan(), changes);
    expect(applied).toBe(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toContain('afternoonSnack');
    expect(result.weeklyPlan[0]).toEqual(plan().weeklyPlan[0]);
  });

  it('un array de cambios vacío deja el plan idéntico', () => {
    const { plan: result, applied, skipped } = mergeInstructionChanges(plan(), []);
    expect(applied).toBe(0);
    expect(skipped).toEqual([]);
    expect(result).toEqual(plan());
  });
});

describe('findDaysOffTarget', () => {
  it('detecta los días cuyas calorías totales se desvían más del umbral', () => {
    // día 1: 300+600+400 = 1300 (dentro); calorías objetivo 1300
    const p = plan();
    // Desviamos el día 2 muy por encima del objetivo
    p.weeklyPlan[1] = day(2, { lunch: meal({ calories: 1200, protein: 45, carbs: 60, fats: 15 }) });
    const offTarget = findDaysOffTarget(p, metrics(1300), 10);
    expect(offTarget).toContain(2);
    expect(offTarget).not.toContain(1);
    expect(offTarget).not.toContain(3);
  });

  it('no reporta ningún día si todos están dentro de tolerancia', () => {
    const offTarget = findDaysOffTarget(plan(), metrics(1300), 10);
    expect(offTarget).toEqual([]);
  });
});
