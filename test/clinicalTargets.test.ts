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
});
