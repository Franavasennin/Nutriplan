import { describe, it, expect } from 'vitest';
import { findEquivalents } from '../utils/equivalences';
import { Allergen } from '../types';

describe('findEquivalents', () => {
  it('identifica el alimento por alias y devuelve alternativas', () => {
    const res = findEquivalents('150g pollo');
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(3);
  });

  it('prioriza el mismo grupo antes de saltar a otro (pollo -> pavo antes que pescado)', () => {
    const res = findEquivalents('150g pechuga de pollo');
    const names = res.map(r => r.name);
    expect(names).toContain('pechuga de pavo');
    // pavo (misma categoría "ave") debe aparecer antes que cualquier pescado
    const pavoIdx = names.indexOf('pechuga de pavo');
    const pescadoIdx = names.findIndex(n => n.includes('merluza') || n.includes('salmón') || n.includes('atún'));
    if (pescadoIdx !== -1) expect(pavoIdx).toBeLessThan(pescadoIdx);
  });

  it('recalcula los gramos igualando el macro dominante (proteína)', () => {
    const res = findEquivalents('150g pechuga de pollo', {}, { limit: 5 });
    const merluza = res.find(r => r.name === 'merluza');
    // pollo: 23g P/100g -> 150g = 34.5g P. merluza: 17g P/100g -> gramos = 34.5/17*100 ≈ 203g
    expect(merluza).toBeDefined();
    expect(merluza!.label).toMatch(/^\d+g merluza$/);
    const grams = parseInt(merluza!.label);
    expect(grams).toBeGreaterThan(190);
    expect(grams).toBeLessThan(215);
  });

  it('respeta la tolerancia calórica configurable', () => {
    const strict = findEquivalents('150g pechuga de pollo', {}, { tolerancePct: 1, limit: 10 });
    const loose = findEquivalents('150g pechuga de pollo', {}, { tolerancePct: 50, limit: 10 });
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
  });

  it('filtra alternativas que contienen un alérgeno declarado', () => {
    const res = findEquivalents('150g pechuga de pollo', { allergens: [Allergen.Huevos] }, { limit: 10 });
    expect(res.some(r => r.name === 'huevo')).toBe(false);
  });

  it('filtra alternativas presentes en excludedFoods', () => {
    const res = findEquivalents('150g pechuga de pollo', { excludedFoods: 'pavo, marisco' }, { limit: 10 });
    expect(res.some(r => r.name.includes('pavo'))).toBe(false);
  });

  it('nunca ofrece el propio alimento como alternativa', () => {
    const res = findEquivalents('150g pechuga de pollo', {}, { limit: 10 });
    expect(res.some(r => r.name === 'pechuga de pollo')).toBe(false);
  });

  it('ingrediente sin cantidad parseable de forma fiable -> []', () => {
    expect(findEquivalents('sal al gusto')).toEqual([]);
    expect(findEquivalents('1 cucharada de aceite')).toEqual([]); // cucharada no es fiable
  });

  it('cantidades pequeñas (condimentos) -> []', () => {
    expect(findEquivalents('5g sal')).toEqual([]);
  });

  it('alimento no reconocido -> []', () => {
    expect(findEquivalents('150g alimento inexistente xyz')).toEqual([]);
  });

  it('maneja unidades ("huevo") convirtiendo a gramos y de vuelta', () => {
    // El huevo tiene mucha más densidad calórica por gramo de proteína que la
    // carne magra/pescado (grasa de la yema) — igualar solo proteína dentro
    // de una tolerancia estricta filtra casi todo; con tolerancia amplia debe
    // aparecer al menos una alternativa bien formada.
    const res = findEquivalents('2 huevos', {}, { limit: 5, tolerancePct: 60 });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every(r => /^\d+(,\d)?(g|ml) .+$/.test(r.label))).toBe(true);
  });
});
