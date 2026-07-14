import { describe, it, expect } from 'vitest';
import { scalePlanToTarget } from '../utils/planScaling';
import type { DietResponse, Meal, CalculatedMetrics } from '../types';

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  name: 'Avena con leche',
  description: 'test',
  ingredients: ['80g avena', '250 ml leche', '30g proteína en polvo', 'sal al gusto'],
  calories: 500, protein: 40, carbs: 60, fats: 10,
  ...overrides,
});

const basePlan = (overrides: Partial<DietResponse> = {}): DietResponse => ({
  durationText: '1 semana',
  generalGuidelines: [],
  weeklyPlan: [
    { day: 1, meals: { breakfast: meal(), lunch: meal({ name: 'Pollo con arroz', ingredients: ['150g pollo', '100g arroz'], calories: 600, protein: 50, carbs: 70, fats: 12 }) } },
  ],
  ...overrides,
});

const metrics = (macros: Partial<CalculatedMetrics['macros']> = {}): CalculatedMetrics => ({
  imc: 22, bmr: 1500, tee: 2000,
  macros: { protein: 90, carbs: 130, fats: 22, calories: 1100, ...macros },
});

describe('scalePlanToTarget', () => {
  it('no cambia platos, ingredientes-base ni número de comidas — solo cantidades/macros', () => {
    const { plan } = scalePlanToTarget(basePlan(), metrics());
    expect(plan.weeklyPlan[0].meals.breakfast?.name).toBe('Avena con leche');
    expect(plan.weeklyPlan[0].meals.lunch?.name).toBe('Pollo con arroz');
    expect(plan.weeklyPlan[0].meals.breakfast?.ingredients).toHaveLength(4);
    expect(Object.keys(plan.weeklyPlan[0].meals)).toEqual(['breakfast', 'lunch']);
  });

  it('escala macros proporcionalmente al objetivo de la pareja', () => {
    // base total día: protein 90, carbs 130, fats 22 → objetivo idéntico = factor 1
    const { plan } = scalePlanToTarget(basePlan(), metrics());
    expect(plan.weeklyPlan[0].meals.breakfast?.protein).toBe(40);
  });

  it('reduce cantidades cuando el objetivo de la pareja es menor', () => {
    // objetivo mitad de proteína/carbs/grasa del base (90/130/22 → 45/65/11)
    const { plan } = scalePlanToTarget(basePlan(), metrics({ protein: 45, carbs: 65, fats: 11 }));
    const breakfast = plan.weeklyPlan[0].meals.breakfast!;
    expect(breakfast.protein).toBe(20); // 40 * 0.5
    expect(breakfast.ingredients[0]).toBe('40g avena'); // 80 * 0.5
    expect(breakfast.ingredients[3]).toBe('sal al gusto'); // sin cantidad parseable: intacto
  });

  it('recalcula las calorías desde los macros nuevos, no las reescala con un factor propio', () => {
    const { plan } = scalePlanToTarget(basePlan(), metrics({ protein: 45, carbs: 65, fats: 11 }));
    const breakfast = plan.weeklyPlan[0].meals.breakfast!;
    expect(breakfast.calories).toBe(breakfast.protein! * 4 + breakfast.carbs! * 4 + breakfast.fats! * 9);
  });

  it('aplica el clamp de seguridad si el objetivo es absurdamente distinto', () => {
    const { plan, warnings } = scalePlanToTarget(basePlan(), metrics({ protein: 9000, carbs: 130, fats: 22 }));
    // factor bruto sería 100x, clamp lo limita a 3x
    expect(plan.weeklyPlan[0].meals.breakfast?.protein).toBe(120); // 40 * 3.0
    expect(warnings.some(w => w.code === 'clamped')).toBe(true);
  });

  it('deja intactas las comidas sin macros declarados y avisa', () => {
    const plan = basePlan({ weeklyPlan: [{ day: 1, meals: { breakfast: meal({ protein: undefined, carbs: undefined, fats: undefined }) } }] });
    const { plan: result, warnings } = scalePlanToTarget(plan, metrics());
    expect(result.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('80g avena');
    expect(warnings.some(w => w.code === 'no_macros')).toBe(true);
  });

  it('respeta las comidas bloqueadas: se conservan del plan actual de la pareja, no se recalculan', () => {
    const currentPartnerPlan = basePlan({
      weeklyPlan: [{
        day: 1,
        meals: {
          breakfast: meal({ name: 'Avena con leche (editada a mano)', ingredients: ['999g avena'] }),
          lunch: meal({ name: 'Pollo con arroz', ingredients: ['150g pollo', '100g arroz'], calories: 600, protein: 50, carbs: 70, fats: 12 }),
        },
      }],
    });
    const { plan } = scalePlanToTarget(basePlan(), metrics({ protein: 45, carbs: 65, fats: 11 }), {
      lockedMeals: ['1-breakfast'],
      currentPartnerPlan,
    });
    // breakfast bloqueado: se conserva tal cual del plan actual de la pareja
    expect(plan.weeklyPlan[0].meals.breakfast?.ingredients[0]).toBe('999g avena');
    // lunch no bloqueado: sí se recalcula
    expect(plan.weeklyPlan[0].meals.lunch?.protein).toBe(25); // 50 * 0.5
  });

  it('es idempotente: resincronizar dos veces desde el mismo plan base da el mismo resultado', () => {
    const target = metrics({ protein: 45, carbs: 65, fats: 11 });
    const first = scalePlanToTarget(basePlan(), target);
    const second = scalePlanToTarget(basePlan(), target); // siempre parte del basePlan fresco, no de "first"
    expect(second.plan).toEqual(first.plan);
  });

  it('plan sin días no rompe nada', () => {
    const { plan, warnings } = scalePlanToTarget(basePlan({ weeklyPlan: [] }), metrics());
    expect(plan.weeklyPlan).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
