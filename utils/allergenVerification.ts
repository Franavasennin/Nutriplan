import { DietResponse, DayPlan, Meal, PatientData, Recipe, Allergen, ALLERGEN_LABELS } from '../types';
import { findMatchingAllergens } from './shoppingList';

/**
 * Alérgenos de una receta del corpus (MEJORA-013, iteración 003, hallazgo
 * A-008): si la receta declara `allergens` explícitos (validados por la
 * DN), esos mandan; si no, se derivan heurísticamente de los ingredientes
 * con el mismo matching por palabra clave del resto del sistema. La UI debe
 * etiquetar la derivación heurística como "detección automática" — no es
 * verdad clínica validada.
 */
export function getRecipeAllergens(recipe: Recipe): { allergens: Allergen[]; derived: boolean } {
  if (recipe.allergens && recipe.allergens.length > 0) {
    return { allergens: recipe.allergens, derived: false };
  }
  const all = Object.values(Allergen);
  const found = new Set<Allergen>();
  for (const ingredient of recipe.ingredients ?? []) {
    for (const a of findMatchingAllergens(ingredient, all)) found.add(a);
  }
  return { allergens: [...found], derived: true };
}

/**
 * Verificador determinista post-generación (MEJORA-010, iteración 002,
 * hallazgo M-002 de la re-auditoría M9): comprueba si el plan que acaba de
 * generar la IA contiene algún ingrediente que coincida con un alérgeno
 * declarado del paciente. No bloquea ni modifica el plan (el nutricionista
 * decide qué hacer) — es una red de seguridad adicional para el caso de que
 * el modelo no respete la Regla 0 (prioridad absoluta) del prompt.
 */
export interface AllergenViolation {
  day: number;
  mealName: string;
  ingredient: string;
  allergens: Allergen[];
}

/**
 * Variante por-comida (MEJORA-011, iteración 003): para los puntos donde la
 * IA genera una sola comida (swap, añadir toma). `day` = 0 cuando el día no
 * aplica o no se conoce.
 */
export function verifyMealAgainstAllergens(meal: Meal, patient: PatientData, day = 0): AllergenViolation[] {
  const declared = patient.allergens ?? [];
  if (!declared.length || !meal?.ingredients) return [];

  const violations: AllergenViolation[] = [];
  for (const raw of meal.ingredients) {
    const ingredient = typeof raw === 'string' ? raw : String(raw ?? '');
    const matches = findMatchingAllergens(ingredient, declared);
    if (matches.length > 0) {
      violations.push({ day, mealName: meal.name, ingredient, allergens: matches });
    }
  }
  return violations;
}

/** Variante por-día (MEJORA-011): para la regeneración de un día suelto. */
export function verifyDayAgainstAllergens(day: DayPlan, patient: PatientData): AllergenViolation[] {
  const violations: AllergenViolation[] = [];
  for (const meal of Object.values(day.meals ?? {})) {
    if (!meal) continue;
    violations.push(...verifyMealAgainstAllergens(meal, patient, day.day));
  }
  return violations;
}

export function verifyPlanAgainstAllergens(plan: DietResponse, patient: PatientData): AllergenViolation[] {
  const declared = patient.allergens ?? [];
  if (!declared.length) return [];

  const violations: AllergenViolation[] = [];
  for (const day of plan.weeklyPlan ?? []) {
    violations.push(...verifyDayAgainstAllergens(day, patient));
  }
  return violations;
}

/** Mensaje de aviso legible para mostrar en un toast/banner al nutricionista. */
export function formatAllergenViolationsMessage(violations: AllergenViolation[]): string {
  const preview = violations.slice(0, 3).map(v =>
    `Día ${v.day} (${v.mealName}): "${v.ingredient}" → ${v.allergens.map(a => ALLERGEN_LABELS[a]).join(', ')}`
  ).join(' · ');
  const suffix = violations.length > 3 ? ` (+${violations.length - 3} más)` : '';
  return `⚠️ Revisa el plan: posible(s) alérgeno(s) declarado(s) detectado(s). ${preview}${suffix}`;
}
