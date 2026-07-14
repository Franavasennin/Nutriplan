import { describe, it, expect } from 'vitest';
import { alignCoupleDays, pairIngredients, extractQuantityLabel, MEAL_PRINT_ORDER } from '../utils/couplePrint';
import type { DietResponse, Meal } from '../types';

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  name: 'Avena con leche',
  description: 'test',
  ingredients: ['80g avena', '250 ml leche'],
  calories: 500, protein: 40, carbs: 60, fats: 10,
  ...overrides,
});

const plan = (overrides: Partial<DietResponse> = {}): DietResponse => ({
  durationText: '1 semana',
  generalGuidelines: [],
  weeklyPlan: [{ day: 1, meals: { breakfast: meal(), lunch: meal({ name: 'Pollo con arroz' }) } }],
  ...overrides,
});

describe('alignCoupleDays', () => {
  it('alinea comidas presentes en ambos lados por día y por slot', () => {
    const left = plan();
    const right = plan({ weeklyPlan: [{ day: 1, meals: { breakfast: meal({ ingredients: ['60g avena', '200 ml leche'] }) } }] });
    const aligned = alignCoupleDays(left, right);
    expect(aligned).toHaveLength(1);
    const breakfastSlot = aligned[0].meals.find(m => m.key === 'breakfast');
    const lunchSlot = aligned[0].meals.find(m => m.key === 'lunch');
    expect(breakfastSlot?.principal).toBeDefined();
    expect(breakfastSlot?.partner).toBeDefined();
    expect(lunchSlot?.principal).toBeDefined();
    expect(lunchSlot?.partner).toBeUndefined(); // solo existe en el lado izquierdo
  });

  it('usa la unión de días — un día que solo existe en un lado no se pierde', () => {
    const left = plan({ weeklyPlan: [{ day: 1, meals: { breakfast: meal() } }, { day: 2, meals: { breakfast: meal() } }] });
    const right = plan({ weeklyPlan: [{ day: 1, meals: { breakfast: meal() } }] });
    const aligned = alignCoupleDays(left, right);
    expect(aligned.map(d => d.day)).toEqual([1, 2]);
    expect(aligned[1].meals[0].partner).toBeUndefined();
  });

  it('respeta el orden MEAL_PRINT_ORDER y omite slots ausentes en ambos lados', () => {
    const left = plan({ weeklyPlan: [{ day: 1, meals: { dinner: meal(), breakfast: meal() } }] });
    const right = plan({ weeklyPlan: [{ day: 1, meals: {} }] });
    const aligned = alignCoupleDays(left, right);
    expect(aligned[0].meals.map(m => m.key)).toEqual(['breakfast', 'dinner']);
  });
});

describe('pairIngredients', () => {
  it('empareja el mismo alimento por nombre, ignorando la cantidad', () => {
    const paired = pairIngredients(['80g avena', '250 ml leche'], ['60g avena', '200 ml leche']);
    expect(paired).toHaveLength(2);
    expect(paired[0]).toMatchObject({ mine: '80g avena', theirs: '60g avena' });
    expect(paired[1]).toMatchObject({ mine: '250 ml leche', theirs: '200 ml leche' });
  });

  it('preserva el orden de "mine" y añade los ítems sin match de "theirs" al final', () => {
    const paired = pairIngredients(['80g avena'], ['80g avena', '10g nueces']);
    expect(paired).toHaveLength(2);
    expect(paired[0]).toMatchObject({ mine: '80g avena', theirs: '80g avena' });
    expect(paired[1].mine).toBeUndefined();
    expect(paired[1].theirs).toBe('10g nueces');
  });

  it('ingrediente sin cantidad parseable se usa como clave completa, sin perderse', () => {
    const paired = pairIngredients(['sal al gusto'], ['sal al gusto']);
    expect(paired).toHaveLength(1);
    expect(paired[0].mine).toBe('sal al gusto');
    expect(paired[0].theirs).toBe('sal al gusto');
  });

  it('ingrediente presente solo en un lado no se fabrica en el otro', () => {
    const paired = pairIngredients(['80g avena', '30g proteína'], ['60g avena']);
    expect(paired).toHaveLength(2);
    expect(paired.find(r => r.mine === '30g proteína')?.theirs).toBeUndefined();
  });
});

describe('extractQuantityLabel', () => {
  it('extrae solo cantidad+unidad de un ingrediente parseable', () => {
    expect(extractQuantityLabel('80g avena')).toBe('80g');
    expect(extractQuantityLabel('250 ml leche')).toBe('250ml');
  });

  it('devuelve el string completo si no hay cantidad parseable', () => {
    expect(extractQuantityLabel('sal al gusto')).toBe('sal al gusto');
  });
});

describe('MEAL_PRINT_ORDER', () => {
  it('cubre las 5 tomas en el orden esperado', () => {
    expect(MEAL_PRINT_ORDER.map(m => m.key)).toEqual(['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner']);
  });
});
