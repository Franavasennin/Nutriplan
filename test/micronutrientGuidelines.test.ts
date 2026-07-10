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

  // ── P-002.A (hallazgo A-2): embarazo y lactancia ───────────────────────────

  it('embarazo garantiza folato, hierro, yodo, DHA y vitamina D aunque la dieta no sea vegana', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Balanced, { isPregnant: true });
    expect(result.some(g => /folato|fólico/i.test(g))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('hierro'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('yodo'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('dha'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('vitamina d'))).toBe(true);
  });

  it('embarazo advierte del mercurio en grandes depredadores (AESAN)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Balanced, { isPregnant: true });
    expect(result.some(g => g.toLowerCase().includes('mercurio'))).toBe(true);
  });

  it('lactancia garantiza yodo, DHA e hidratación', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Balanced, { isLactating: true });
    expect(result.some(g => g.toLowerCase().includes('yodo'))).toBe(true);
    expect(result.some(g => g.toLowerCase().includes('dha'))).toBe(true);
    expect(result.some(g => /hidrat|agua/i.test(g))).toBe(true);
  });

  it('no duplica yodo si la IA ya lo mencionó (embarazo)', () => {
    const g = ['Usa sal yodada a diario para cubrir el yodo.'];
    const result = ensureMicronutrientGuidelines(g, DietType.Balanced, { isPregnant: true });
    expect(result.filter(x => x.toLowerCase().includes('yodo'))).toHaveLength(1);
  });

  it('embarazo + vegana combina ambas garantías (B12 y folato)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegan, { isPregnant: true });
    expect(result.some(g => g.toLowerCase().includes('b12'))).toBe(true);
    expect(result.some(g => /folato|fólico/i.test(g))).toBe(true);
  });

  it('sin flags y dieta omnívora sigue sin tocar nada (retrocompatible)', () => {
    const g = ['Hidratación 2L/día'];
    expect(ensureMicronutrientGuidelines(g, DietType.Balanced, {})).toEqual(g);
  });

  // ── Fixes de la revisión healthcare (iteración 003) ────────────────────────

  it('embarazo vegano: DHA recomienda aceite de microalgas, no pescado (revisión #2)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegan, { isPregnant: true });
    const dhaLine = result.find(g => g.includes('DHA') && g.includes('EMBARAZO'));
    expect(dhaLine).toContain('microalgas');
    expect(dhaLine).not.toContain('pescado azul');
  });

  it('embarazo vegano: hierro aparece una sola vez (dedup entre bloques, revisión #2)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegan, { isPregnant: true });
    expect(result.filter(g => g.toLowerCase().includes('hierro'))).toHaveLength(1);
  });

  it('la nota vegana de omega-3 especifica aceite de microalgas y excluye algas marinas/espirulina (revisión #1)', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegan);
    const omegaLine = result.find(g => g.includes('Omega-3'));
    expect(omegaLine).toContain('MICROALGAS');
    expect(omegaLine).toContain('no algas marinas');
  });

  it('lactancia vegetariana: DHA con microalgas, no pescado', () => {
    const result = ensureMicronutrientGuidelines([], DietType.Vegetarian, { isLactating: true });
    const dhaLine = result.find(g => g.includes('DHA') && g.includes('LACTANCIA'));
    expect(dhaLine).toContain('microalgas');
    expect(dhaLine).not.toContain('pescado azul');
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
