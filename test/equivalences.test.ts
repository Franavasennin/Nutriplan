import { describe, it, expect } from 'vitest';
import { findEquivalents, getMealEquivalents } from '../utils/equivalences';
import { Allergen, Meal } from '../types';

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

  describe('reglas fijas de la nutricionista (recomendacionmes.docx)', () => {
    it('patata -> boniato restando 20g, antes que el cálculo genérico', () => {
      const res = findEquivalents('200g patata', {}, { limit: 3 });
      expect(res[0].name).toBe('boniato');
      expect(res[0].label).toBe('180g boniato');
    });

    it('yogur griego -> requesón/queso batido/queso fresco, misma cantidad', () => {
      const res = findEquivalents('150g yogur griego', {}, { limit: 3 });
      const names = res.map(r => r.name);
      expect(names).toEqual(['requesón', 'queso batido', 'queso fresco']);
      expect(res.every(r => r.label === '150g ' + r.name)).toBe(true);
    });

    it('quinoa -> arroz restando 20g', () => {
      const res = findEquivalents('100g quinoa', {}, { limit: 3 });
      expect(res[0].name).toBe('arroz');
      expect(res[0].label).toBe('80g arroz');
    });

    it('avena/granola -> muesli, misma cantidad', () => {
      const avena = findEquivalents('40g avena', {}, { limit: 3 });
      expect(avena[0]).toEqual({ name: 'muesli', label: '40g muesli', kcalDelta: -9 });
    });

    it('una regla fija nunca ofrece un alimento excluido/alergénico', () => {
      const res = findEquivalents('150g yogur griego', { excludedFoods: 'requesón' }, { limit: 3 });
      expect(res.some(r => r.name === 'requesón')).toBe(false);
    });
  });

  describe('lista de intercambio de fruta de la nutricionista', () => {
    it('se aplica cuando la cantidad ronda "1 ración" de su lista', () => {
      const res = findEquivalents('150g naranja', {}, { limit: 5 });
      const names = res.map(r => r.name);
      expect(names).toContain('melocotón');
      expect(names).toContain('manzana');
      const melocoton = res.find(r => r.name === 'melocotón')!;
      expect(melocoton.label).toBe('1 melocotón');
    });

    it('no se aplica si la cantidad real está muy lejos de "1 ración" -> cae al cálculo genérico', () => {
      const res = findEquivalents('500g naranja', {}, { limit: 5 });
      // Con 500g (>1.4x de la ración de referencia, 150g) el resultado debe
      // venir del motor genérico: etiquetas con gramos recalculados, no las
      // raciones fijas de la lista ("1 melocotón", "2 kiwis"...).
      expect(res.length).toBeGreaterThan(0);
      expect(res.every(r => /^\d+g /.test(r.label))).toBe(true);
    });
  });
});

describe('getMealEquivalents', () => {
  const meal = (overrides: Partial<Meal> = {}): Meal => ({
    name: 'Pollo con arroz',
    description: '',
    ingredients: ['150g pechuga de pollo', '100g arroz blanco'],
    ...overrides,
  });

  it('usa el cálculo automático cuando no hay override', () => {
    const lines = getMealEquivalents(meal());
    const pollo = lines.find(l => l.ing === '150g pechuga de pollo');
    expect(pollo).toBeDefined();
    expect(pollo!.isCustom).toBe(false);
    expect(pollo!.options.length).toBeGreaterThan(0);
  });

  it('usa el override de la nutricionista en vez del cálculo automático cuando existe', () => {
    const m = meal({ equivalentOverrides: { '150g pechuga de pollo': ['180g merluza', '3 huevos'] } });
    const lines = getMealEquivalents(m);
    const pollo = lines.find(l => l.ing === '150g pechuga de pollo');
    expect(pollo).toBeDefined();
    expect(pollo!.isCustom).toBe(true);
    expect(pollo!.options.map(o => o.label)).toEqual(['180g merluza', '3 huevos']);
  });

  it('un override vacío oculta las equivalencias de ese ingrediente (no cae al cálculo automático)', () => {
    const m = meal({ equivalentOverrides: { '150g pechuga de pollo': [] } });
    const lines = getMealEquivalents(m);
    expect(lines.find(l => l.ing === '150g pechuga de pollo')).toBeUndefined();
  });

  it('los ingredientes sin override siguen usando el cálculo automático', () => {
    const m = meal({ equivalentOverrides: { '150g pechuga de pollo': ['180g merluza'] } });
    const lines = getMealEquivalents(m);
    const arroz = lines.find(l => l.ing === '100g arroz blanco');
    expect(arroz?.isCustom).toBe(false);
  });
});
