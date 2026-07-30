import { describe, it, expect } from 'vitest';
import { generateShoppingList, findMatchingAllergens } from '../utils/shoppingList';
import { Allergen, type DietResponse } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlan(ingredientsByDay: string[][]): DietResponse {
  return {
    weeklyPlan: ingredientsByDay.map((ingredients, i) => ({
      day: i + 1,
      meals: {
        lunch: {
          name: 'Test meal',
          description: '',
          ingredients,
        },
      },
    })),
    generalGuidelines: [],
    durationText: '7 días',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateShoppingList', () => {
  it('devuelve array vacío si no hay ingredientes', () => {
    const plan = makePlan([[[].join('')]]);
    expect(generateShoppingList(makePlan([[]]))).toEqual([]);
  });

  it('cada categoría devuelta tiene al menos 1 ítem', () => {
    const plan = makePlan([['200g pechuga de pollo', '100g arroz', '2 huevos']]);
    const list = generateShoppingList(plan);
    list.forEach(cat => expect(cat.items.length).toBeGreaterThan(0));
  });

  it('clasifica pollo en Carnes, aves y fiambres', () => {
    const list = generateShoppingList(makePlan([['150g pechuga de pollo']]));
    const cat = list.find(c => c.category === 'Carnes, aves y fiambres');
    expect(cat).toBeDefined();
    expect(cat!.items.some(i => i.name.toLowerCase().includes('pollo'))).toBe(true);
  });

  it('clasifica atún en Pescado y marisco', () => {
    const list = generateShoppingList(makePlan([['1 lata de atún en agua']]));
    const cat = list.find(c => c.category === 'Pescado y marisco');
    expect(cat).toBeDefined();
    expect(cat!.items.length).toBeGreaterThan(0);
  });

  it('clasifica huevo en Huevos y lácteos', () => {
    const list = generateShoppingList(makePlan([['2 huevos']]));
    expect(list.find(c => c.category === 'Huevos y lácteos')).toBeDefined();
  });

  it('clasifica manzana en Frutas', () => {
    const list = generateShoppingList(makePlan([['1 manzana']]));
    expect(list.find(c => c.category === 'Frutas')).toBeDefined();
  });

  it('clasifica espinacas en Verduras y hortalizas', () => {
    const list = generateShoppingList(makePlan([['100g espinacas frescas']]));
    expect(list.find(c => c.category === 'Verduras y hortalizas')).toBeDefined();
  });

  it('clasifica lentejas en Legumbres', () => {
    const list = generateShoppingList(makePlan([['200g lentejas cocidas']]));
    expect(list.find(c => c.category === 'Legumbres')).toBeDefined();
  });

  it('clasifica arroz en Cereales, pan y pasta', () => {
    const list = generateShoppingList(makePlan([['80g arroz integral']]));
    expect(list.find(c => c.category === 'Cereales, pan y pasta')).toBeDefined();
  });

  it('clasifica aceite en Aceites, grasas y condimentos', () => {
    const list = generateShoppingList(makePlan([['1 cda. aceite de oliva']]));
    expect(list.find(c => c.category === 'Aceites, grasas y condimentos')).toBeDefined();
  });

  it('clasifica nueces en Frutos secos y semillas', () => {
    const list = generateShoppingList(makePlan([['30g nueces']]));
    expect(list.find(c => c.category === 'Frutos secos y semillas')).toBeDefined();
  });

  it('deduplica el mismo ingrediente a través de varios días', () => {
    const plan = makePlan([
      ['150g pechuga de pollo'],
      ['200g pechuga de pollo'],
      ['100g pechuga de pollo'],
    ]);
    const list = generateShoppingList(plan);
    const meat = list.find(c => c.category === 'Carnes, aves y fiambres');
    expect(meat).toBeDefined();
    const item = meat!.items.find(i => i.name.toLowerCase().includes('pollo'));
    expect(item).toBeDefined();
    // amounts from each day are collected
    expect(item!.amounts.length).toBeGreaterThan(0);
  });

  it('no incluye categorías con 0 ítems', () => {
    const list = generateShoppingList(makePlan([['150g pechuga de pollo']]));
    list.forEach(cat => expect(cat.items.length).toBeGreaterThan(0));
  });

  it('cada categoría tiene icon y color', () => {
    const list = generateShoppingList(makePlan([['2 huevos', '80g arroz']]));
    list.forEach(cat => {
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
    });
  });

  it('ítems dentro de una categoría ordenados alfabéticamente', () => {
    const list = generateShoppingList(makePlan([['1 plátano', '1 manzana', '1 naranja']]));
    const fruits = list.find(c => c.category === 'Frutas');
    if (fruits && fruits.items.length > 1) {
      const names = fruits.items.map(i => i.name.toLowerCase());
      const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'));
      expect(names).toEqual(sorted);
    }
  });

  it('ingredientes vacíos o en blanco se ignoran', () => {
    const list = generateShoppingList(makePlan([['', '   ', '100g tomate']]));
    list.forEach(cat =>
      cat.items.forEach(item => expect(item.name.trim()).not.toBe(''))
    );
  });

  it('no muestra las anotaciones de macros del verificador nutricional en el nombre', () => {
    const list = generateShoppingList(makePlan([['150g pechuga de pollo a la plancha (34.5g P, 0g HC, 3.75g G)']]));
    const cat = list.find(c => c.category === 'Carnes, aves y fiambres');
    const item = cat!.items.find(i => i.name.toLowerCase().includes('pollo'));
    expect(item!.name).toBe('Pechuga de pollo a la plancha');
  });

  it('reconoce y suma cantidades sin palabra de unidad explícita (ej. "2 huevos")', () => {
    const plan = makePlan([
      ['2 huevos enteros (100g)'],
      ['2 huevos enteros (100g)'],
    ]);
    const list = generateShoppingList(plan);
    const cat = list.find(c => c.category === 'Huevos y lácteos');
    const item = cat!.items.find(i => i.name.toLowerCase().includes('huevos enteros'));
    expect(item).toBeDefined();
    expect(item!.amounts).toEqual(['4']);
  });

  it('procesa múltiples comidas en el mismo día', () => {
    const plan: DietResponse = {
      weeklyPlan: [{
        day: 1,
        meals: {
          breakfast: { name: 'Desayuno', description: '', ingredients: ['2 huevos'] },
          lunch:     { name: 'Comida',   description: '', ingredients: ['80g arroz'] },
          dinner:    { name: 'Cena',     description: '', ingredients: ['150g salmón'] },
        },
      }],
      generalGuidelines: [],
      durationText: '1 día',
    };
    const list = generateShoppingList(plan);
    expect(list.length).toBeGreaterThanOrEqual(3);
  });
});

describe('findMatchingAllergens (MEJORA-001, iteración 001)', () => {
  it('detecta marisco/moluscos en un ingrediente de la lista de la compra (Sintético-07)', () => {
    const matches = findMatchingAllergens('200g gambas', [Allergen.Crustaceos, Allergen.Huevos, Allergen.FrutosCascara]);
    expect(matches).toEqual([Allergen.Crustaceos]);
  });

  it('detecta huevo aunque el paciente tenga varios alérgenos declarados', () => {
    const matches = findMatchingAllergens('2 huevos', [Allergen.Crustaceos, Allergen.Huevos, Allergen.FrutosCascara]);
    expect(matches).toEqual([Allergen.Huevos]);
  });

  it('no marca nada si el ingrediente no coincide con ningún alérgeno declarado', () => {
    const matches = findMatchingAllergens('150g pechuga de pollo', [Allergen.Crustaceos, Allergen.Huevos]);
    expect(matches).toEqual([]);
  });

  it('devuelve array vacío si el paciente no declaró alérgenos', () => {
    const matches = findMatchingAllergens('200g gambas', []);
    expect(matches).toEqual([]);
  });
});

describe('findMatchingAllergens — excepción de leche vegetal (MEJORA-009, iteración 002)', () => {
  it('NO marca Leche para "leche de almendras" (falso positivo corregido)', () => {
    const matches = findMatchingAllergens('200ml leche de almendras', [Allergen.Leche]);
    expect(matches).toEqual([]);
  });

  it('NO marca Leche para "leche de avena"', () => {
    const matches = findMatchingAllergens('1L leche de avena', [Allergen.Leche]);
    expect(matches).toEqual([]);
  });

  it('sigue marcando Leche para leche real (vaca)', () => {
    const matches = findMatchingAllergens('1L leche entera', [Allergen.Leche]);
    expect(matches).toEqual([Allergen.Leche]);
  });

  it('sigue marcando Gluten en avena (correcto según Reglamento UE 1169/2011)', () => {
    const matches = findMatchingAllergens('100g avena', [Allergen.Gluten]);
    expect(matches).toEqual([Allergen.Gluten]);
  });
});
