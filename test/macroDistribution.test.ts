import { describe, it, expect } from 'vitest';
import { calculateMacros } from '../utils/calculations';
import { DietType } from '../types';

/**
 * P-002.C (criterio C1 de Nutrición, auditoría 001): fija con tests el reparto
 * de macros de cada tipo de dieta para un paciente de referencia, y comprueba
 * el encaje con las guías donde el tipo de dieta declara seguirlas.
 *
 * Contraste completo con guías (EFSA DRV, NAM/IOM AMDR, SENC, ISSN/ACSM,
 * ESPEN) en docs/loop/iteracion-003/EVIDENCIA-C1-macros-vs-guias.md — este
 * fichero es el ancla reproducible de ese documento: si alguien cambia
 * MACRO_DEFS, estos tests fallan y obligan a rehacer el contraste.
 *
 * Paciente de referencia: 70 kg de peso de referencia, GET 2000 kcal, sin
 * condiciones ni objetivo calórico (mantenimiento, sin ajustes).
 */

const REF_KG  = 70;
const REF_TEE = 2000;

const pct = (m: { protein: number; carbs: number; fats: number; calories: number }) => ({
  p:  (m.protein * 4) / m.calories * 100,
  f:  (m.fats    * 9) / m.calories * 100,
  c:  (m.carbs   * 4) / m.calories * 100,
});

describe('reparto de macros por tipo de dieta — valores exactos (paciente de referencia 70kg/2000kcal)', () => {
  // Gramos exactos: cualquier cambio en MACRO_DEFS rompe estos tests y obliga
  // a actualizar el documento de contraste con guías (evidencia C1).
  const EXPECTED: Partial<Record<DietType, { protein: number; fats: number; carbs: number }>> = {
    [DietType.Balanced]:      { protein:  98, fats: 59, carbs: 269 },
    [DietType.Mediterranean]: { protein:  91, fats: 76, carbs: 237 },
    [DietType.LowCarb]:       { protein: 126, fats: 96, carbs: 157 },
    [DietType.Keto]:          { protein: 105, fats: 144, carbs: 71 },
    [DietType.Vegetarian]:    { protein:  98, fats: 59, carbs: 269 },
    [DietType.Vegan]:         { protein: 105, fats: 53, carbs: 277 },
    [DietType.Paleo]:         { protein: 119, fats: 81, carbs: 198 },
    [DietType.Protein]:       { protein: 140, fats: 61, carbs: 223 },
    [DietType.Precooked]:     { protein:  98, fats: 59, carbs: 269 },
  };

  for (const [dietType, expected] of Object.entries(EXPECTED)) {
    it(`${dietType}: P ${expected!.protein}g / G ${expected!.fats}g / HC ${expected!.carbs}g`, () => {
      const m = calculateMacros(REF_TEE, dietType as DietType, REF_KG);
      expect(m.protein).toBe(expected!.protein);
      expect(m.fats).toBe(expected!.fats);
      expect(m.carbs).toBe(expected!.carbs);
      expect(m.calories).toBe(REF_TEE);
    });
  }
});

describe('encaje con guías (EFSA DRV / NAM-IOM AMDR) — ver EVIDENCIA-C1-macros-vs-guias.md', () => {
  it('proteína ≥ PRI de EFSA (0.83 g/kg) en TODOS los tipos de dieta', () => {
    for (const dt of Object.values(DietType)) {
      const m = calculateMacros(REF_TEE, dt, REF_KG);
      expect(m.protein / REF_KG, `${dt}: ${(m.protein / REF_KG).toFixed(2)} g/kg`).toBeGreaterThanOrEqual(0.83);
    }
  });

  it('proteína ≤ 2.0 g/kg en tipos no-atleta (techo conservador ESPEN/ISSN sin supervisión deportiva)', () => {
    const nonAthlete = Object.values(DietType).filter(d => d !== DietType.Athlete);
    for (const dt of nonAthlete) {
      const m = calculateMacros(REF_TEE, dt, REF_KG);
      expect(m.protein / REF_KG, `${dt}`).toBeLessThanOrEqual(2.0);
    }
  });

  it('dietas de patrón general (equilibrada/mediterránea/vegetariana/vegana/sin cocina) cumplen AMDR: P 10-35% / G 20-35% / HC 45-65%', () => {
    const general = [DietType.Balanced, DietType.Mediterranean, DietType.Vegetarian, DietType.Vegan, DietType.Precooked];
    for (const dt of general) {
      const { p, f, c } = pct(calculateMacros(REF_TEE, dt, REF_KG));
      expect(p, `${dt} %P=${p.toFixed(1)}`).toBeGreaterThanOrEqual(10);
      expect(p, `${dt} %P=${p.toFixed(1)}`).toBeLessThanOrEqual(35);
      expect(f, `${dt} %G=${f.toFixed(1)}`).toBeGreaterThanOrEqual(20);
      expect(f, `${dt} %G=${f.toFixed(1)}`).toBeLessThanOrEqual(35);
      expect(c, `${dt} %HC=${c.toFixed(1)}`).toBeGreaterThanOrEqual(45);
      expect(c, `${dt} %HC=${c.toFixed(1)}`).toBeLessThanOrEqual(65);
    }
  });

  it('las dietas terapéuticas bajas en HC se desvían del rango EFSA de forma INTENCIONADA (documentado)', () => {
    // La desviación es la definición del tipo de dieta, no un bug: patrones
    // bajos en HC reconocidos como opción válida (ADA Standards of Care).
    // El documento de evidencia la registra y queda pendiente de sign-off DN.
    const lowCarbTypes = [DietType.LowCarb, DietType.Keto, DietType.Paleo, DietType.Protein];
    for (const dt of lowCarbTypes) {
      const { c } = pct(calculateMacros(REF_TEE, dt, REF_KG));
      expect(c, `${dt} %HC=${c.toFixed(1)}`).toBeLessThan(45);
    }
  });

  it('DISCREPANCIA CONOCIDA (flag para la DN): la dieta cetogénica produce ~71g HC (14% E), por encima del umbral cetogénico típico (20-50 g/día)', () => {
    // Se fija el comportamiento ACTUAL a propósito: corregirlo es una decisión
    // clínica (más grasa aún) que requiere el criterio de la DN, no un fix
    // autónomo. Si este test falla, alguien cambió la definición — actualizar
    // EVIDENCIA-C1-macros-vs-guias.md y pedir el sign-off correspondiente.
    const m = calculateMacros(REF_TEE, DietType.Keto, REF_KG);
    expect(m.carbs).toBe(71);
    expect(m.carbs).toBeGreaterThan(50); // documenta que NO baja del umbral cetogénico hoy
  });
});
