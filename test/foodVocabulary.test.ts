import { describe, it, expect } from 'vitest';
import { extractFoodName, buildVocabulary, suggestFoods, CANONICAL_FOODS } from '../utils/foodVocabulary';
import type { CustomFood } from '../types';

describe('extractFoodName', () => {
  it('quita el prefijo de cantidad+unidad', () => {
    expect(extractFoodName('150g pechuga de pollo')).toBe('pechuga de pollo');
    expect(extractFoodName('250 ml leche')).toBe('leche');
  });

  it('quita los paréntesis finales', () => {
    expect(extractFoodName('150g pechuga de pollo (sin piel)')).toBe('pechuga de pollo');
    expect(extractFoodName('yogur griego 0% (Mercadona)')).toBe('yogur griego 0%');
  });

  it('quita un número suelto inicial sin unidad', () => {
    expect(extractFoodName('1 plátano mediano')).toBe('plátano mediano');
  });

  it('devuelve "" si no queda un nombre limpio', () => {
    expect(extractFoodName('80g')).toBe('');
    expect(extractFoodName('   ')).toBe('');
  });
});

describe('buildVocabulary', () => {
  it('incluye la lista canónica', () => {
    const vocab = buildVocabulary();
    expect(vocab).toContain('pechuga de pollo');
    expect(vocab).toContain('aceite de oliva virgen extra');
    expect(vocab.length).toBeGreaterThan(CANONICAL_FOODS.length - 10);
  });

  it('deduplica sin distinguir mayúsculas ni acentos', () => {
    const foods: CustomFood[] = [
      { id: '1', name: 'Pechuga De Pollo', calories: 0, protein: 0, carbs: 0, fats: 0, portionSize: '100g' },
    ];
    const vocab = buildVocabulary(foods);
    const matches = vocab.filter(v => v.toLowerCase() === 'pechuga de pollo');
    expect(matches).toHaveLength(1); // no duplica pese a la diferencia de mayúsculas
  });

  it('incorpora los alimentos personalizados nuevos', () => {
    const foods: CustomFood[] = [
      { id: '1', name: 'Barrita Proteica XYZ', calories: 0, protein: 0, carbs: 0, fats: 0, portionSize: '1 unidad' },
    ];
    expect(buildVocabulary(foods)).toContain('Barrita Proteica XYZ');
  });
});

describe('suggestFoods', () => {
  const vocab = buildVocabulary();

  it('término vacío no sugiere nada', () => {
    expect(suggestFoods(vocab, '')).toEqual([]);
    expect(suggestFoods(vocab, '   ')).toEqual([]);
  });

  it('prioriza los que empiezan por el término', () => {
    const res = suggestFoods(vocab, 'pech');
    expect(res[0].toLowerCase().startsWith('pech')).toBe(true);
    expect(res.some(r => r.toLowerCase().includes('pechuga de pollo'))).toBe(true);
  });

  it('es insensible a acentos', () => {
    const conAcento = suggestFoods(vocab, 'plátano');
    const sinAcento = suggestFoods(vocab, 'platano');
    expect(sinAcento).toEqual(conAcento);
    expect(sinAcento.some(r => r.toLowerCase().includes('plátano'))).toBe(true);
  });

  it('respeta el límite', () => {
    expect(suggestFoods(vocab, 'a', 5).length).toBeLessThanOrEqual(5);
  });

  it('no sugiere el término ya escrito exacto', () => {
    const res = suggestFoods(vocab, 'avena');
    expect(res.map(r => r.toLowerCase())).not.toContain('avena');
  });
});
