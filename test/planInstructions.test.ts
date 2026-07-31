import { describe, it, expect } from 'vitest';
import { mergeInstructionChanges, findDaysOffTarget, enforceMealMacroTarget, extractForcedSubstitutions, applyForcedSubstitutions } from '../utils/planInstructions';
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

describe('enforceMealMacroTarget', () => {
  it('reescala una comida que la IA infló por encima de la tolerancia (bug real reportado)', () => {
    // Desayuno original: 300 kcal (12P/50C/6G). La IA añade pan y sube a ~450 kcal
    // sin reducir nada más -- exactamente el bug reportado ("incrementó las kcal
    // en vez de cuadrarlas").
    const original = meal({ name: 'Avena con fruta', calories: 300, protein: 12, carbs: 50, fats: 6 });
    const inflated = meal({
      name: 'Avena con fruta y pan integral',
      ingredients: ['60g avena', '1 plátano', '2 rebanadas de pan integral (60g)'],
      protein: 15, carbs: 78, fats: 8, // deriva a 15*4+78*4+8*9 = 60+312+72 = 444 kcal
    });
    const result = enforceMealMacroTarget(inflated, original);
    const derivedCalories = result.protein! * 4 + result.carbs! * 4 + result.fats! * 9;
    // Debe cuadrar con el objetivo original (300 kcal), no quedarse en ~444
    expect(Math.abs(derivedCalories - 300)).toBeLessThanOrEqual(5);
    expect(result.name).toBe('Avena con fruta y pan integral'); // conserva el plato con pan
    expect(result.ingredients).toContain(
      result.ingredients.find(i => i.includes('pan integral'))
    ); // el pan sigue en la lista, solo cambia la cantidad si aplica
  });

  it('no toca una comida ya dentro de tolerancia', () => {
    const original = meal({ calories: 300, protein: 12, carbs: 50, fats: 6 });
    const closeEnough = meal({ protein: 13, carbs: 52, fats: 6 }); // ~314 kcal, <8% de diff
    const result = enforceMealMacroTarget(closeEnough, original);
    expect(result).toEqual(closeEnough);
  });

  it('no toca la comida si faltan macros (no se puede calcular el factor)', () => {
    const original = meal({ protein: undefined });
    const returned = meal({ calories: 900 });
    const result = enforceMealMacroTarget(returned, original);
    expect(result).toEqual(returned);
  });

  it('mergeInstructionChanges aplica el guard de macros automáticamente', () => {
    const p = plan(); // día 1 breakfast: 300 kcal (12P/50C/6G)
    const changes: InstructionChange[] = [
      { day: 1, mealKey: 'breakfast', meal: meal({
        name: 'Avena con fruta y pan integral',
        protein: 15, carbs: 78, fats: 8, // ~444 kcal sin cuadrar
      }) },
    ];
    const { plan: result } = mergeInstructionChanges(p, changes);
    const merged = result.weeklyPlan[0].meals.breakfast!;
    const derivedCalories = merged.protein! * 4 + merged.carbs! * 4 + merged.fats! * 9;
    expect(Math.abs(derivedCalories - 300)).toBeLessThanOrEqual(5);
    expect(merged.name).toBe('Avena con fruta y pan integral');
  });
});

describe('extractForcedSubstitutions', () => {
  it('detecta "sustituye X por Y"', () => {
    const pairs = extractForcedSubstitutions('sustituye toda la cebolla por cebollino');
    expect(pairs).toEqual([{ banned: 'cebolla', replacement: 'cebollino' }]);
  });

  it('detecta "no usar X ... sustituir por Y" (orden invertido, caso real reportado)', () => {
    const pairs = extractForcedSubstitutions('no usar nunca cebolla, sustituir por cebollino');
    expect(pairs).toEqual([{ banned: 'cebolla', replacement: 'cebollino' }]);
  });

  it('devuelve vacío si no hay patrón de sustitución', () => {
    expect(extractForcedSubstitutions('las cenas deben ser sencillas y rápidas')).toEqual([]);
  });
});

describe('applyForcedSubstitutions', () => {
  it('sustituye el término prohibido en nombre, descripción e ingredientes de TODO el plan', () => {
    const p: DietResponse = {
      weeklyPlan: [
        day(1, { lunch: meal({ name: 'Pollo con cebolla', description: 'con cebolla caramelizada', ingredients: ['150g pollo', '50g cebolla picada'] }) }),
      ],
      generalGuidelines: [],
      durationText: '1 día',
    };
    const { plan: result, substitutions } = applyForcedSubstitutions(p, 'sustituye toda la cebolla por cebollino');
    const lunch = result.weeklyPlan[0].meals.lunch!;
    expect(lunch.name).toBe('Pollo con cebollino');
    expect(lunch.description).toBe('con cebollino caramelizada');
    expect(lunch.ingredients).toEqual(['150g pollo', '50g cebollino picada']);
    expect(substitutions).toEqual([{ banned: 'cebolla', replacement: 'cebollino', occurrences: 3 }]);
  });

  it('es garantizado incluso si la IA ignoró la instrucción (no depende de "changes")', () => {
    // Reproduce el bug real: la instrucción se repite pero la cebolla sigue ahí.
    const p = plan(); // ninguna comida menciona cebolla ni cebollino
    const withOnion: DietResponse = {
      ...p,
      weeklyPlan: p.weeklyPlan.map(d => ({
        ...d,
        meals: { ...d.meals, dinner: meal({ name: 'Cena con cebolla', ingredients: ['1 cebolla'] }) },
      })),
    };
    const { plan: result } = applyForcedSubstitutions(withOnion, 'no usar nunca cebolla, sustituir por cebollino');
    for (const d of result.weeklyPlan) {
      expect(d.meals.dinner!.name).toBe('Cena con cebollino');
      expect(d.meals.dinner!.ingredients).toEqual(['1 cebollino']);
    }
  });

  it('no toca nada si el texto no contiene un patrón de sustitución', () => {
    const p = plan();
    const { plan: result, substitutions } = applyForcedSubstitutions(p, 'las cenas deben ser sencillas');
    expect(result).toEqual(p);
    expect(substitutions).toEqual([]);
  });

  it('sin instructionText, no hace nada', () => {
    const p = plan();
    const { plan: result, substitutions } = applyForcedSubstitutions(p, undefined);
    expect(result).toBe(p);
    expect(substitutions).toEqual([]);
  });
});
