import { describe, it, expect } from 'vitest';
import { verifyPlanAgainstAllergens, verifyDayAgainstAllergens, verifyMealAgainstAllergens, getRecipeAllergens, formatAllergenViolationsMessage } from '../utils/allergenVerification';
import { Gender, ActivityLevel, DietType, Duration, Allergen, type PatientData, type DietResponse, type Recipe } from '../types';

const basePatient: PatientData = {
  age: 38,
  gender: Gender.Female,
  weight: 65,
  height: 162,
  activity: ActivityLevel.Light,
  conditions: [],
  dietType: DietType.Balanced,
  duration: Duration.OneMonth,
};

function makePlan(day1Ingredients: string[]): DietResponse {
  return {
    weeklyPlan: [{
      day: 1,
      meals: {
        lunch: { name: 'Comida', description: '', ingredients: day1Ingredients },
      },
    }],
    generalGuidelines: [],
    durationText: '1 día',
  };
}

describe('verifyPlanAgainstAllergens — MEJORA-010 (iteración 002)', () => {
  it('detecta un ingrediente que viola un alérgeno declarado (Sintético-07: marisco excluido, IA lo incluyó de todas formas)', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Crustaceos] };
    const plan = makePlan(['200g arroz', '150g gambas', '10ml AOVE']);

    const violations = verifyPlanAgainstAllergens(plan, patient);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ day: 1, mealName: 'Comida', ingredient: '150g gambas', allergens: [Allergen.Crustaceos] });
  });

  it('no reporta nada si el plan respeta los alérgenos declarados', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Crustaceos] };
    const plan = makePlan(['200g arroz', '150g pechuga de pollo', '10ml AOVE']);

    expect(verifyPlanAgainstAllergens(plan, patient)).toEqual([]);
  });

  it('devuelve vacío si el paciente no declaró alérgenos, aunque el plan tenga ingredientes "sospechosos"', () => {
    const patient: PatientData = { ...basePatient, allergens: [] };
    const plan = makePlan(['150g gambas']);

    expect(verifyPlanAgainstAllergens(plan, patient)).toEqual([]);
  });

  it('no marca falso positivo de leche vegetal (MEJORA-009) dentro del mismo verificador', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Leche] };
    const plan = makePlan(['200ml leche de almendras']);

    expect(verifyPlanAgainstAllergens(plan, patient)).toEqual([]);
  });

  it('detecta múltiples violaciones en distintos días', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Huevos] };
    const plan: DietResponse = {
      weeklyPlan: [
        { day: 1, meals: { breakfast: { name: 'Desayuno', description: '', ingredients: ['2 huevos'] } } },
        { day: 2, meals: { lunch: { name: 'Comida', description: '', ingredients: ['1 huevo cocido'] } } },
      ],
      generalGuidelines: [],
      durationText: '2 días',
    };

    const violations = verifyPlanAgainstAllergens(plan, patient);
    expect(violations).toHaveLength(2);
    expect(violations.map(v => v.day)).toEqual([1, 2]);
  });
});

describe('verifyMealAgainstAllergens — MEJORA-011 (iteración 003, swap/añadir toma)', () => {
  it('detecta un alérgeno en una comida suelta con el día indicado', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Pescado] };
    const meal = { name: 'Cena', description: '', ingredients: ['200g salmón', '100g brócoli'] };

    const violations = verifyMealAgainstAllergens(meal, patient, 3);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ day: 3, mealName: 'Cena', ingredient: '200g salmón', allergens: [Allergen.Pescado] });
  });

  it('devuelve vacío para una comida limpia o sin alérgenos declarados', () => {
    const meal = { name: 'Cena', description: '', ingredients: ['200g salmón'] };
    expect(verifyMealAgainstAllergens(meal, { ...basePatient, allergens: [Allergen.Huevos] }, 1)).toEqual([]);
    expect(verifyMealAgainstAllergens(meal, { ...basePatient, allergens: [] }, 1)).toEqual([]);
  });
});

describe('verifyDayAgainstAllergens — MEJORA-011 (iteración 003, regenerar día)', () => {
  it('detecta violaciones en varias comidas del mismo día', () => {
    const patient: PatientData = { ...basePatient, allergens: [Allergen.Huevos] };
    const day = {
      day: 5,
      meals: {
        breakfast: { name: 'Desayuno', description: '', ingredients: ['2 huevos'] },
        lunch:     { name: 'Comida',   description: '', ingredients: ['150g pollo'] },
        dinner:    { name: 'Cena',     description: '', ingredients: ['tortilla de 1 huevo'] },
      },
    };

    const violations = verifyDayAgainstAllergens(day, patient);

    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.day === 5)).toBe(true);
    expect(violations.map(v => v.mealName)).toEqual(['Desayuno', 'Cena']);
  });
});

describe('getRecipeAllergens — MEJORA-013 (iteración 003, corpus de recetas)', () => {
  const baseRecipe: Recipe = {
    id: 'test-1',
    title: 'Receta de prueba',
    description: '',
    prepTime: 20,
    calories: 400,
    protein: 30,
    carbs: 40,
    fats: 12,
    ingredients: ['200g gambas', '80g arroz', '10ml AOVE'],
    instructions: [],
    tags: [],
  };

  it('deriva alérgenos heurísticamente de los ingredientes cuando la receta no los declara', () => {
    const { allergens, derived } = getRecipeAllergens(baseRecipe);
    expect(derived).toBe(true);
    expect(allergens).toContain(Allergen.Crustaceos);
  });

  it('los alérgenos declarados explícitamente tienen prioridad sobre la heurística', () => {
    const recipe: Recipe = { ...baseRecipe, allergens: [Allergen.Sulfitos] };
    const { allergens, derived } = getRecipeAllergens(recipe);
    expect(derived).toBe(false);
    expect(allergens).toEqual([Allergen.Sulfitos]);
  });

  it('devuelve vacío (derivado) para una receta sin ingredientes con alérgenos', () => {
    const recipe: Recipe = { ...baseRecipe, ingredients: ['150g pechuga de pollo', '100g brócoli'] };
    const { allergens, derived } = getRecipeAllergens(recipe);
    expect(derived).toBe(true);
    expect(allergens).toEqual([]);
  });

  it('respeta la excepción de leche vegetal en la derivación', () => {
    const recipe: Recipe = { ...baseRecipe, ingredients: ['200ml leche de almendras'] };
    const { allergens } = getRecipeAllergens(recipe);
    expect(allergens).not.toContain(Allergen.Leche);
    // "almendras" sí debe marcar frutos de cáscara — la excepción es solo para Leche
    expect(allergens).toContain(Allergen.FrutosCascara);
  });
});

describe('formatAllergenViolationsMessage', () => {
  it('genera un mensaje legible con día, comida, ingrediente y alérgeno', () => {
    const msg = formatAllergenViolationsMessage([
      { day: 1, mealName: 'Comida', ingredient: '150g gambas', allergens: [Allergen.Crustaceos] },
    ]);
    expect(msg).toContain('Día 1');
    expect(msg).toContain('Comida');
    expect(msg).toContain('gambas');
    expect(msg).toContain('Crustáceos');
  });

  it('trunca a 3 y añade contador de restantes si hay más violaciones', () => {
    const violations = Array.from({ length: 5 }, (_, i) => ({
      day: i + 1, mealName: 'Comida', ingredient: 'huevo', allergens: [Allergen.Huevos],
    }));
    const msg = formatAllergenViolationsMessage(violations);
    expect(msg).toContain('+2 más');
  });
});
