import { Allergen, DietResponse, DayPlan, Meal, AppliedSubstitution } from '../types';
import { findMatchingAllergens } from './shoppingList';

/**
 * Sustitución determinista de alimentos por alergia — "Pareja Inteligente".
 * Reutiliza el detector de alérgenos ya existente (findMatchingAllergens,
 * utils/shoppingList.ts) y un mapa fijo de equivalencias conservadoras (misma
 * "familia" de alimento: proteína→proteína equivalente), sin llamar a la IA.
 *
 * Alérgenos sin sustituto genérico razonable (p.ej. Sulfitos, Altramuces) no
 * tienen reglas — se deja constancia en `warnings` para revisión manual en
 * vez de forzar una sustitución dudosa.
 */

interface SubstitutionRule {
  pattern: RegExp;
  replacement: string;
}

// Reglas conservadoras por alérgeno. Cada regla solo sustituye el NOMBRE del
// alimento (no la cantidad, que ya viene reescalada por planScaling.ts).
const SUBSTITUTION_RULES: Partial<Record<Allergen, SubstitutionRule[]>> = {
  [Allergen.Leche]: [
    { pattern: /leche(?!\s+de\s+(avena|soja|almendra|coco))/i, replacement: 'leche de avena' },
    { pattern: /yogur(?!\s+de\s+(soja|coco))/i, replacement: 'yogur de soja' },
    { pattern: /\bqueso\b(?!\s+vegano)/i, replacement: 'queso vegano' },
    { pattern: /\bnata\b/i, replacement: 'nata de avena' },
  ],
  [Allergen.Gluten]: [
    { pattern: /\bpan\b(?!\s+sin gluten)/i, replacement: 'pan sin gluten' },
    { pattern: /\bpasta\b(?!\s+de maíz)/i, replacement: 'pasta de maíz' },
    { pattern: /\bavena\b(?!\s+certificada)/i, replacement: 'avena certificada sin gluten' },
    { pattern: /\bharina\b(?!\s+de arroz)/i, replacement: 'harina de arroz' },
  ],
  [Allergen.Huevos]: [
    { pattern: /\bhuevo[s]?\b(?!\s+revuelto de tofu)/i, replacement: 'tofu revuelto' },
    { pattern: /\btortilla\b/i, replacement: 'tortilla de garbanzo (harina de garbanzo + agua)' },
  ],
  [Allergen.Pescado]: [
    { pattern: /\bsalmón\b/i, replacement: 'pechuga de pollo' },
    { pattern: /\batún\b/i, replacement: 'pechuga de pavo' },
    { pattern: /\bmerluza\b/i, replacement: 'pechuga de pollo' },
    { pattern: /\bpescado\b/i, replacement: 'pollo' },
  ],
  [Allergen.Crustaceos]: [
    { pattern: /\bgambas?\b/i, replacement: 'tofu salteado' },
    { pattern: /\blangostinos?\b/i, replacement: 'tofu salteado' },
    { pattern: /\bmarisco\b/i, replacement: 'pollo' },
  ],
  [Allergen.Moluscos]: [
    { pattern: /\bmejillones?\b/i, replacement: 'tofu salteado' },
    { pattern: /\bcalamares?\b/i, replacement: 'seitán' },
  ],
  [Allergen.Cacahuetes]: [
    { pattern: /\bcacahuete[s]?\b/i, replacement: 'semillas de girasol' },
    { pattern: /\bmantequilla de cacahuete\b/i, replacement: 'crema de almendra' },
  ],
  [Allergen.FrutosCascara]: [
    { pattern: /\bnueces?\b/i, replacement: 'semillas de calabaza' },
    { pattern: /\balmendras?\b/i, replacement: 'semillas de girasol' },
    { pattern: /\bavellanas?\b/i, replacement: 'semillas de calabaza' },
    { pattern: /\bfrutos secos\b/i, replacement: 'semillas (girasol/calabaza)' },
  ],
  [Allergen.Soja]: [
    { pattern: /\btofu\b/i, replacement: 'pollo' },
    { pattern: /\bsoja\b/i, replacement: 'garbanzos' },
    { pattern: /\bbebida de soja\b/i, replacement: 'bebida de avena' },
  ],
  [Allergen.Sesamo]: [
    { pattern: /\bsésamo\b/i, replacement: 'semillas de lino' },
    { pattern: /\btahini\b/i, replacement: 'crema de almendra' },
  ],
  [Allergen.Mostaza]: [
    { pattern: /\bmostaza\b/i, replacement: 'vinagreta de limón' },
  ],
  [Allergen.Apio]: [
    { pattern: /\bapio\b/i, replacement: 'hinojo' },
  ],
  // Sulfitos y Altramuces: sin regla genérica razonable (aparecen en muchos
  // productos procesados de forma poco predecible) — se deja para revisión
  // manual vía `warnings`, nunca se fuerza una sustitución dudosa.
};

export interface SubstitutionResult {
  plan: DietResponse;
  substitutions: AppliedSubstitution[];
  warnings: string[];
}

function substituteMeal(
  meal: Meal,
  day: number,
  mealKey: string,
  allergens: Allergen[],
  substitutions: AppliedSubstitution[],
  warnings: string[]
): Meal {
  const newIngredients = meal.ingredients.map(ingredient => {
    const matched = findMatchingAllergens(ingredient, allergens);
    if (matched.length === 0) return ingredient;

    for (const allergen of matched) {
      const rules = SUBSTITUTION_RULES[allergen];
      if (!rules) {
        warnings.push(`"${ingredient}" contiene ${allergen} sin regla de sustitución conocida — revisar manualmente (día ${day}, ${mealKey}).`);
        continue;
      }
      const rule = rules.find(r => r.pattern.test(ingredient));
      if (!rule) {
        warnings.push(`"${ingredient}" contiene ${allergen} sin coincidencia de sustitución específica — revisar manualmente (día ${day}, ${mealKey}).`);
        continue;
      }
      const replaced = ingredient.replace(rule.pattern, rule.replacement);
      substitutions.push({ day, mealKey, original: ingredient, replaced, allergen });
      return replaced;
    }
    return ingredient;
  });

  return { ...meal, ingredients: newIngredients };
}

/**
 * Aplica sustituciones de alimentos incompatibles con los alérgenos de la
 * pareja, SOBRE un plan ya reescalado en cantidades (planScaling.ts). El
 * orden importa: reescalar cantidad primero, sustituir nombre después, para
 * no interferir con el parseo de cantidades.
 */
export function applyAllergenSubstitutions(plan: DietResponse, allergens: Allergen[]): SubstitutionResult {
  const substitutions: AppliedSubstitution[] = [];
  const warnings: string[] = [];

  if (!allergens.length) {
    return { plan, substitutions, warnings };
  }

  const weeklyPlan: DayPlan[] = plan.weeklyPlan.map(day => {
    const meals: DayPlan['meals'] = {};
    (Object.keys(day.meals) as (keyof DayPlan['meals'])[]).forEach(key => {
      const meal = day.meals[key];
      if (meal) meals[key] = substituteMeal(meal, day.day, key, allergens, substitutions, warnings);
    });
    return { ...day, meals };
  });

  return { plan: { ...plan, weeklyPlan }, substitutions, warnings };
}
