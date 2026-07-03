import { describe, it, expect } from 'vitest';
import { ensureMicronutrientGuidelines, ensureTransitionGuideline } from '../services/geminiService';
import { DietType, CalorieGoal } from '../types';

describe('ensureMicronutrientGuidelines', () => {
  it('no toca dietas no veganas/vegetarianas', () => {
    const g = ['Hidratación 2L/día'];
    expect(ensureMicronutrientGuidelines(g, DietType.Balanced)).toEqual(g);
  });

  it('añade B12 obligatoria en vegana si no está presente', () => {
    const result = ensureMicronutrientGuidelines(['Hidratación 2L/día'], DietType.Vegan);
    expect(result.some(g => g.toLowerCase().includes('b12'))).toBe(true);
  });

  it('añade hierro/calcio/omega-3 en vegana si faltan', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegan);
    expect(result.some(g => g.toLowerCase().includes('hierro'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('calcio'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('omega'))).toBe(true);
  });

  it('no duplica B12 si la IA ya la mencionó', () => {
    const g = ['Suplementa vitamina B12 semanalmente', 'Hidratación 2L/día'];
    const result = ensureMicronutrientGuidelines(g, DietType.Vegan);
    const b12Count = result.filter(x => x.toLowerCase().includes('b12')).length;
    expect(b12Count).toBe(1);
  });

  it('vegetariana solo garantiza B12, no hierro/calcio/omega-3 (tiene lácteos/huevo)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegetarian);
    expect(result.some(g => g.toLowerCase().includes('b12'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('hierro'))).toBe(false);
  });
});

describe('ensureTransitionGuideline', () => {
  it('no añade nada en mantenimiento', () => {
    const g = ['Hidratación 2L/día'];
    expect(ensureTransitionGuideline(g, CalorieGoal.Maintenance)).toEqual(g);
  });

  it('no añade nada si calorieGoal es undefined (p.ej. dieta atleta)', () => {
    const g = ['Hidratación 2L/día'];
    expect(ensureTransitionGuideline(g, undefined)).toEqual(g);
  });

  it('añade pauta de transición en déficit', () => {
    const result = ensureTransitionGuideline([], CalorieGoal.DeficitFast);
    expect(result.some(g => /transici[oó]n/i.test(g))).toBe(true);
  });

  it('añade pauta de transición en superávit', () => {
    const result = ensureTransitionGuideline([], CalorieGoal.SurplusSlow);
    expect(result.some(g => /transici[oó]n/i.test(g))).toBe(true);
  });

  it('no duplica si la IA ya mencionó la transición', () => {
    const g = ['Al llegar al peso objetivo, planifica una transición gradual de 3 semanas.'];
    const result = ensureTransitionGuideline(g, CalorieGoal.DeficitSlow);
    expect(result).toHaveLength(1);
  });
});
