import { DietResponse, DayPlan, Meal, CalculatedMetrics } from '../types';
import { sumDayMacros, reconcileDietResponse } from './macroValidation';
import { scaleIngredientText } from './planScaling';
import { InstructionChange } from '../services/geminiService';

// ─── Sustituciones forzadas (deterministas) ────────────────────────────────────
// Bug real reportado por la nutricionista: pidió "sustituye toda la cebolla
// por cebollino" en varias pacientes y, por muchas veces que lo repitiera en
// "Pautas", la cebolla seguía apareciendo — porque applyPlanInstructions
// solo se lo PIDE a la IA, nada lo garantiza si el modelo no cumple al pie
// de la letra (mismo patrón de bug que ya se corrigió para las calorías con
// enforceMealMacroTarget). Para instrucciones de la forma "sustituye X por
// Y" / "no usar X ... sustituir por Y", esto lo garantiza a nivel de texto,
// sin depender de la IA: se ejecuta SIEMPRE después de aplicar los cambios,
// idempotente (si la IA ya cumplió, no encuentra nada que sustituir).
const SUBSTITUTION_TRIGGERS: RegExp[] = [
  /sustitu[a-záéíóúñ]*\s+(?:siempre\s+)?(?:toda\s+la\s+|todo\s+el\s+|la\s+|el\s+|los\s+|las\s+)?(?!siempre\b)([a-záéíóúñ]{3,30})\s+por\s+([a-záéíóúñ]{3,30})/gi,
  // "no usar/nunca/quita/detesta X ... sustituir por Y" — el hueco entre el
  // término prohibido y "sustituir por" es de longitud libre (hasta el
  // siguiente punto), porque en la práctica la frase real trae texto de por
  // medio: "no usar nunca cebolla EN NINGÚN PLATO, sustituir SIEMPRE por
  // cebollino" (caso real reportado — con un hueco corto y fijo, y sin
  // permitir el adverbio antes de "por", esto no se detectaba).
  /(?:no\s+usar|nunca\s+usar|quita|quitar|detesta[s]?)\s+(?:nunca\s+)?(?:el\s+|la\s+|los\s+|las\s+)?([a-záéíóúñ]{3,30})\b[^.]{0,80}?sustitu[a-záéíóúñ]*\s+(?:siempre\s+)?por\s+([a-záéíóúñ]{3,30})/gis,
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extrae pares (término prohibido, reemplazo) de un texto de instrucción libre. */
export function extractForcedSubstitutions(instructionText: string): { banned: string; replacement: string }[] {
  const pairs: { banned: string; replacement: string }[] = [];
  for (const re of SUBSTITUTION_TRIGGERS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(instructionText)) !== null) {
      pairs.push({ banned: m[1].toLowerCase(), replacement: m[2].toLowerCase() });
    }
  }
  const seen = new Set<string>();
  return pairs.filter(p => {
    const key = `${p.banned}=>${p.replacement}`;
    if (seen.has(key) || p.banned === p.replacement) return false;
    seen.add(key);
    return true;
  });
}

/** Reemplaza `banned` (con o sin plural) por `replacement`, respetando mayúscula inicial. */
function replaceWordPreservingCase(text: string, banned: string, replacement: string): { text: string; count: number } {
  const re = new RegExp(`\\b${escapeRegex(banned)}s?\\b`, 'gi');
  let count = 0;
  const newText = text.replace(re, (match) => {
    count++;
    const isPlural = /s$/i.test(match) && !/s$/i.test(banned);
    const base = isPlural ? `${replacement}s` : replacement;
    return match.charAt(0) === match.charAt(0).toUpperCase()
      ? base.charAt(0).toUpperCase() + base.slice(1)
      : base;
  });
  return { text: newText, count };
}

export interface ForcedSubstitution { banned: string; replacement: string; occurrences: number; }

/**
 * Aplica de forma determinista los pares "sustituye X por Y" detectados en
 * `instructionText` a TODO el plan (nombre, descripción, ingredientes y
 * preparación de cada comida) — garantiza el cambio incluso si la IA lo
 * ignoró. No toca macros/calorías (solo texto), así que no hace falta
 * reescalar nada.
 */
export function applyForcedSubstitutions(
  plan: DietResponse,
  instructionText: string | undefined
): { plan: DietResponse; substitutions: ForcedSubstitution[] } {
  if (!instructionText) return { plan, substitutions: [] };
  const pairs = extractForcedSubstitutions(instructionText);
  if (pairs.length === 0) return { plan, substitutions: [] };

  const totals = new Map<string, ForcedSubstitution>();

  const weeklyPlan = plan.weeklyPlan.map(day => {
    const meals = { ...day.meals };
    let dayMutated = false;

    for (const key of Object.keys(meals) as (keyof DayPlan['meals'])[]) {
      const meal = meals[key];
      if (!meal) continue;
      let mealMutated = false;
      let { name, description, ingredients, instructions } = meal;

      for (const { banned, replacement } of pairs) {
        const rName = replaceWordPreservingCase(name ?? '', banned, replacement);
        const rDesc = replaceWordPreservingCase(description ?? '', banned, replacement);
        const rIngredients = (ingredients ?? []).map(i => replaceWordPreservingCase(i, banned, replacement));
        const rInstructions = (instructions ?? []).map(i => replaceWordPreservingCase(i, banned, replacement));
        const occurrences = rName.count + rDesc.count
          + rIngredients.reduce((s, r) => s + r.count, 0)
          + rInstructions.reduce((s, r) => s + r.count, 0);

        if (occurrences > 0) {
          mealMutated = true;
          name = rName.text;
          description = rDesc.text;
          ingredients = rIngredients.map(r => r.text);
          instructions = rInstructions.map(r => r.text);
          const totalsKey = `${banned}=>${replacement}`;
          const prev = totals.get(totalsKey) ?? { banned, replacement, occurrences: 0 };
          prev.occurrences += occurrences;
          totals.set(totalsKey, prev);
        }
      }

      if (mealMutated) {
        meals[key] = { ...meal, name, description, ingredients, instructions };
        dayMutated = true;
      }
    }

    return dayMutated ? { ...day, meals } : day;
  });

  return { plan: { ...plan, weeklyPlan }, substitutions: [...totals.values()] };
}

// Tolerancia de calorías por comida antes de forzar el reescalado — misma
// cifra que la Regla 2 documentada en el prompt de applyPlanInstructions.
const MEAL_CALORIE_TOLERANCE_PCT = 8;

/**
 * Corrige determinísticamente la comida que devuelve la IA cuando se desvía
 * del objetivo (las calorías de LA COMIDA ORIGINAL que sustituye).
 *
 * Bug real reportado por la nutricionista: pidió "pan en los desayunos" y el
 * desayuno resultante llevaba MÁS calorías que el original en vez de
 * cuadrar — el prompt le pedía a la IA que recalculara las cantidades, pero
 * nada lo garantizaba si la IA no cumplía esa instrucción al pie de la letra.
 * Ahora, si la comida devuelta se desvía más de `MEAL_CALORIE_TOLERANCE_PCT`,
 * se reescala TODO el plato (ingredientes + macros) proporcionalmente hasta
 * cuadrar con el objetivo — igual que hace `planScaling.ts` para Pareja
 * Inteligente, pero por comida en vez de por plan entero. Esto conserva la
 * composición que decidió la IA (el pan sigue estando) y solo ajusta el
 * tamaño de la ración, sin depender de que el modelo calibre bien los gramos.
 */
export function enforceMealMacroTarget(meal: Meal, originalMeal: Meal): Meal {
  if (meal.protein == null || meal.carbs == null || meal.fats == null) return meal;
  if (originalMeal.protein == null || originalMeal.carbs == null || originalMeal.fats == null) return meal;

  const derivedCalories = meal.protein * 4 + meal.carbs * 4 + meal.fats * 9;
  const targetCalories = originalMeal.protein * 4 + originalMeal.carbs * 4 + originalMeal.fats * 9;
  if (derivedCalories <= 0 || targetCalories <= 0) return meal;

  const diffPct = Math.abs(derivedCalories - targetCalories) / targetCalories * 100;
  if (diffPct <= MEAL_CALORIE_TOLERANCE_PCT) return meal;

  const factor = targetCalories / derivedCalories;
  const newProtein = meal.protein * factor;
  const newCarbs = meal.carbs * factor;
  const newFats = meal.fats * factor;
  const newCalories = newProtein * 4 + newCarbs * 4 + newFats * 9;

  return {
    ...meal,
    protein: Math.round(newProtein),
    carbs: Math.round(newCarbs),
    fats: Math.round(newFats),
    calories: Math.round(newCalories),
    ingredients: meal.ingredients.map(i => scaleIngredientText(i, factor)),
  };
}

/**
 * Fusión determinista de los cambios propuestos por `applyPlanInstructions`
 * (services/geminiService.ts) sobre el plan ya existente. La IA solo PROPONE
 * qué comidas cambiar — esta función es la única que decide qué se sobrescribe
 * de verdad, para que el resto del plan quede intacto byte a byte y el
 * comportamiento sea auditable/testeable sin depender del modelo.
 *
 * Los cambios con `day` inexistente o `mealKey` que no exista YA en ese día
 * del plan real se descartan (reportados en `skipped`) — validación contra el
 * plan real, no contra `patientData.mealCount` (que falta en algunas dietas
 * antiguas, ver hallazgo del plan aprobado).
 */
export function mergeInstructionChanges(
  plan: DietResponse,
  changes: InstructionChange[]
): { plan: DietResponse; applied: number; skipped: string[] } {
  const skipped: string[] = [];
  let applied = 0;
  const realDays = new Set(plan.weeklyPlan.map(d => d.day));

  const weeklyPlan: DayPlan[] = plan.weeklyPlan.map(day => {
    const relevantChanges = changes.filter(c => c.day === day.day);
    if (relevantChanges.length === 0) return day;

    let meals = day.meals;
    let mutated = false;

    for (const change of relevantChanges) {
      const mealKey = change.mealKey as keyof DayPlan['meals'];
      const originalMeal = day.meals[mealKey];
      if (!(mealKey in day.meals) || originalMeal == null) {
        skipped.push(`día ${change.day} / ${change.mealKey} (no existe en el plan actual)`);
        continue;
      }
      if (!mutated) {
        meals = { ...day.meals };
        mutated = true;
      }
      meals[mealKey] = enforceMealMacroTarget(change.meal, originalMeal);
      applied++;
    }

    return mutated ? { ...day, meals } : day;
  });

  // Días mencionados en `changes` que no existen en el plan
  for (const c of changes) {
    if (!realDays.has(c.day)) {
      skipped.push(`día ${c.day} / ${c.mealKey} (el día no existe en el plan)`);
    }
  }

  return { plan: reconcileDietResponse({ ...plan, weeklyPlan }), applied, skipped };
}

/**
 * Detecta días cuyos macros totales se desvían del objetivo diario más allá
 * de `tolerancePct`. NO corrige nada — solo avisa, para que la nutricionista
 * decida (deliberadamente no se usa `scalePlanToTarget` aquí: reescalaría
 * también las comidas que ella no quería tocar).
 */
export function findDaysOffTarget(
  plan: DietResponse,
  metrics: CalculatedMetrics,
  tolerancePct = 10
): number[] {
  const target = metrics.macros.calories;
  if (!target) return [];

  const offTarget: number[] = [];
  for (const day of plan.weeklyPlan) {
    const totals = sumDayMacros(day.meals);
    if (!totals) continue;
    const diffPct = Math.abs(totals.calories - target) / target * 100;
    if (diffPct > tolerancePct) offTarget.push(day.day);
  }
  return offTarget;
}
