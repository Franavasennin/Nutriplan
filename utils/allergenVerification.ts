import { DietResponse, PatientData, Allergen, ALLERGEN_LABELS } from '../types';
import { findMatchingAllergens } from './shoppingList';

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

export function verifyPlanAgainstAllergens(plan: DietResponse, patient: PatientData): AllergenViolation[] {
  const declared = patient.allergens ?? [];
  if (!declared.length) return [];

  const violations: AllergenViolation[] = [];
  for (const day of plan.weeklyPlan ?? []) {
    for (const meal of Object.values(day.meals ?? {})) {
      if (!meal?.ingredients) continue;
      for (const raw of meal.ingredients) {
        const ingredient = typeof raw === 'string' ? raw : String(raw ?? '');
        const matches = findMatchingAllergens(ingredient, declared);
        if (matches.length > 0) {
          violations.push({ day: day.day, mealName: meal.name, ingredient, allergens: matches });
        }
      }
    }
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
