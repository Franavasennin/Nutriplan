import { describe, it, expect } from 'vitest';
import { getClinicalTargets } from '../utils/clinicalTargets';
import { Condition } from '../types';

describe('getClinicalTargets', () => {
  it('sodio por defecto: 2000mg sin hipertensión', () => {
    const t = getClinicalTargets({ conditions: [] }, 2000);
    expect(t.sodiumMgMax).toBe(2000);
  });

  it('hipertensión → sodio más estricto (1500mg)', () => {
    const t = getClinicalTargets({ conditions: [Condition.Hypertension] }, 2000);
    expect(t.sodiumMgMax).toBe(1500);
  });

  it('fibra escala con las calorías (14g/1000kcal)', () => {
    const t = getClinicalTargets({ conditions: [] }, 2000);
    expect(t.fiberGMin).toBe(28);
  });

  it('fibra nunca baja de 25g aunque las calorías sean muy bajas', () => {
    const t = getClinicalTargets({ conditions: [] }, 1500);
    expect(t.fiberGMin).toBeGreaterThanOrEqual(25);
  });

  it('azúcares libres ≤ 10% de la energía total', () => {
    const t = getClinicalTargets({ conditions: [] }, 2000);
    expect(t.addedSugarGMax).toBe(50); // 2000*0.10/4 = 50g
  });

  it('celiaquía → excluye gluten obligatoriamente', () => {
    const t = getClinicalTargets({ conditions: [Condition.Celiac] }, 2000);
    expect(t.mandatoryExclusions.some(e => e.includes('gluten'))).toBe(true);
  });

  it('intolerancia a la lactosa → excluye lácteos con lactosa', () => {
    const t = getClinicalTargets({ conditions: [Condition.LactoseIntolerance] }, 2000);
    expect(t.mandatoryExclusions.some(e => e.toLowerCase().includes('lactosa'))).toBe(true);
  });

  it('sin condiciones relevantes → sin exclusiones obligatorias', () => {
    const t = getClinicalTargets({ conditions: [Condition.Hypertension] }, 2000);
    expect(t.mandatoryExclusions).toHaveLength(0);
  });

  // ── P-002.B (hallazgo A-3): condiciones que antes iban solo como texto libre ──

  it('hipertrigliceridemia → azúcares libres al 5% (no 10%) y alcohol excluido', () => {
    const t = getClinicalTargets({ conditions: [Condition.Hypertriglyceridemia] }, 2000);
    expect(t.addedSugarGMax).toBe(25); // 2000*0.05/4 = 25g (antes 50g)
    expect(t.mandatoryExclusions.some(e => e.includes('alcohol'))).toBe(true);
    expect(t.clinicalNotes.some(n => n.includes('HIPERTRIGLICERIDEMIA'))).toBe(true);
  });

  it('hipotiroidismo → directiva de levotiroxina sin excluir crucíferas', () => {
    const t = getClinicalTargets({ conditions: [Condition.Hypothyroidism] }, 2000);
    expect(t.clinicalNotes.some(n => n.includes('levotiroxina'))).toBe(true);
    expect(t.mandatoryExclusions).toHaveLength(0); // no se excluyen alimentos
  });

  it('hipertiroidismo → excluye algas (yodo) y directiva ósea', () => {
    const t = getClinicalTargets({ conditions: [Condition.Hyperthyroidism] }, 2000);
    expect(t.mandatoryExclusions.some(e => e.includes('algas'))).toBe(true);
    expect(t.clinicalNotes.some(n => n.includes('HIPERTIROIDISMO'))).toBe(true);
  });

  it('DM1 → directiva de recuento de HC consistente y regla 15/15', () => {
    const t = getClinicalTargets({ conditions: [Condition.DiabetesType1] }, 2000);
    expect(t.clinicalNotes.some(n => n.includes('DIABETES TIPO 1'))).toBe(true);
    expect(t.clinicalNotes.some(n => n.includes('15/15'))).toBe(true);
  });

  it('obesidad → directiva de saciedad y calorías líquidas', () => {
    const t = getClinicalTargets({ conditions: [Condition.Obesity] }, 2000);
    expect(t.clinicalNotes.some(n => n.includes('OBESIDAD'))).toBe(true);
  });

  it('ERC → sodio se mantiene en 2000 (KDIGO 2021 <2g/día) con directiva de potasio/fósforo', () => {
    const t = getClinicalTargets({ conditions: [Condition.RenalDisease] }, 2000);
    expect(t.sodiumMgMax).toBe(2000); // M-3: 2000 ya cumple KDIGO, no procede endurecer
    expect(t.clinicalNotes.some(n => n.includes('potasio'))).toBe(true);
  });

  it('ERC + hipertensión → gana la restricción más estricta (1500)', () => {
    const t = getClinicalTargets({ conditions: [Condition.RenalDisease, Condition.Hypertension] }, 2000);
    expect(t.sodiumMgMax).toBe(1500);
  });

  it('embarazo → exclusiones de seguridad alimentaria AESAN (crudos, no pasteurizados, mercurio, alcohol)', () => {
    const t = getClinicalTargets({ conditions: [], isPregnant: true }, 2000);
    expect(t.mandatoryExclusions.some(e => e.includes('sushi'))).toBe(true);
    expect(t.mandatoryExclusions.some(e => e.includes('pasteurizados'))).toBe(true);
    expect(t.mandatoryExclusions.some(e => e.includes('mercurio'))).toBe(true);
    expect(t.mandatoryExclusions.some(e => e.includes('alcohol'))).toBe(true);
  });

  it('sin embarazo → sin exclusiones de embarazo', () => {
    const t = getClinicalTargets({ conditions: [] }, 2000);
    expect(t.mandatoryExclusions).toHaveLength(0);
    expect(t.clinicalNotes).toHaveLength(0);
  });
});
