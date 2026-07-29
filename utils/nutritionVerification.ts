import { Meal, DayPlan, DietResponse } from '../types';
import { FoodComposition } from '../data/foodComposition';
import { QUANTITY_RE, scaleIngredientText } from './planScaling';
import { extractFoodName } from './foodVocabulary';
import { findFoodEntry, extractGrams, isNegligible } from './foodLookup';

// Muchos ingredientes reales del proyecto usan unidades que QUANTITY_RE no
// reconoce ("rebanadas", "lonchas", "unidad" sin más) pero traen el peso real
// entre paréntesis al final: "2 rebanadas pan integral (60g)", "1 huevo duro
// (50g)". Sin este fallback esos ingredientes se descartaban ENTERAMENTE
// (ni gramos ni macros), infravalorando el total real de la comida — bug
// real detectado en el contraste retrospectivo contra las 746 comidas de
// producción (66% de falsos "deviation" antes de este fix).
const PAREN_GRAMS_RE = /\((\d+(?:[.,]\d+)?)\s*(g|gr|gramos|ml)\)/i;

// Recuento sin unidad explícita ("1 huevo", "2 plátanos") cuando el alimento
// tiene `gramsPerUnit` conocido — mismo criterio ya usado en
// utils/equivalences.ts:findEquivalents para este caso exacto.
const BARE_COUNT_RE = /^(\d+(?:[.,]\d+)?)\s+/;

/** Gramos/ml reales de un ingrediente: QUANTITY_RE, paréntesis final, o recuento simple, en ese orden. */
function resolveGrams(ingredient: string, origin: FoodComposition | undefined): number | null {
  const match = ingredient.match(QUANTITY_RE);
  if (match && origin) {
    const grams = extractGrams(match[1], match[2], origin);
    if (grams != null) return grams;
  }
  const parenMatch = ingredient.match(PAREN_GRAMS_RE);
  if (parenMatch) {
    const amt = parseFloat(parenMatch[1].replace(',', '.'));
    if (Number.isFinite(amt) && amt > 0) return amt;
  }
  if (origin?.unit === 'unidad' && origin.gramsPerUnit) {
    const bareMatch = ingredient.match(BARE_COUNT_RE);
    if (bareMatch) {
      const count = parseFloat(bareMatch[1].replace(',', '.'));
      if (Number.isFinite(count) && count > 0) return count * origin.gramsPerUnit;
    }
  }
  return null;
}

/**
 * Verificador nutricional determinista — cierra el hueco documentado en
 * utils/macroValidation.ts:31-34 ("NO valida que los ingredientes realmente
 * aporten esos macros"). `reconcileMealMacros` solo comprueba que las kcal
 * declaradas cuadren aritméticamente con los P/HC/G declarados; nunca
 * cuestiona si esos gramos de proteína son realmente los que aportan los
 * ingredientes listados. Este módulo sí lo hace, usando la tabla real de
 * `data/foodComposition.ts` (150 alimentos, ya usada por el motor de
 * equivalencias del portal) — sin llamadas de IA, coste cero.
 */

/**
 * Macros recalculados desde el TEXTO de los ingredientes de una comida,
 * ingrediente a ingrediente: "150g pechuga de pollo" -> nombre "pechuga de
 * pollo" -> entrada de la tabla -> gramos reales -> per100 * gramos / 100.
 *
 * `coverage` es la proporción de gramos IDENTIFICADOS sobre el total de
 * gramos con cantidad parseable (excluyendo los ingredientes despreciables,
 * que no cuentan ni a favor ni en contra). Con coverage bajo los macros
 * calculados no son representativos de la comida entera — el llamador debe
 * tratarlo como "sin datos suficientes", no como una comida sospechosa.
 */
export interface ComputedMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  coverage: number;
  matched: string[];
  unmatched: string[];
  negligible: string[];
}

export function computeMealMacrosFromIngredients(meal: Meal): ComputedMacros {
  let calories = 0, protein = 0, carbs = 0, fats = 0;
  let matchedGrams = 0, totalGrams = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];
  const negligible: string[] = [];

  for (const ingredient of meal.ingredients ?? []) {
    const foodName = extractFoodName(ingredient);
    if (!foodName) continue;

    if (isNegligible(foodName)) {
      negligible.push(ingredient);
      continue;
    }

    const origin = findFoodEntry(foodName);
    const grams = resolveGrams(ingredient, origin);

    if (!origin) {
      // Cantidad conocida, alimento no reconocido — SÍ cuenta como hueco de
      // cobertura: no podemos verificar esta comida con confianza si no
      // sabemos qué son sus ingredientes principales.
      if (grams != null) totalGrams += grams;
      unmatched.push(ingredient);
      continue;
    }

    if (grams == null) continue; // cucharada/taza sin conversión fiable ni gramaje entre paréntesis — se ignora, no penaliza

    totalGrams += grams;
    matchedGrams += grams;
    matched.push(ingredient);
    calories += origin.per100.kcal * grams / 100;
    protein  += origin.per100.protein * grams / 100;
    carbs    += origin.per100.carbs * grams / 100;
    fats     += origin.per100.fats * grams / 100;
  }

  const coverage = totalGrams > 0 ? matchedGrams / totalGrams : 0;

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
    coverage,
    matched, unmatched, negligible,
  };
}

// Ajustado con datos reales (medición sobre 1.668 líneas de ingrediente
// distintas de las 31 dietas en producción, 2026-07-29): ~73.5% de match por
// substring simple sin ponderar por gramos ni excluir líneas sin cantidad
// parseable — el cálculo real (ponderado, con negligibles fuera) es igual o
// mejor. 0.70 deja margen de seguridad sin ser tan laxo que acepte comidas
// mal identificadas.
const COVERAGE_MIN = 0.70;
// Más laxa que el ±8% de "Pautas de la nutricionista" (utils/planInstructions.ts)
// porque aquí se acumula error de estimación de la propia tabla de
// composición además del de la IA — no es razonable exigir la misma precisión.
const TOLERANCE_PCT = 15;

export type VerificationStatus = 'ok' | 'deviation' | 'insufficient_data';

export interface MealVerification {
  status: VerificationStatus;
  declared: { calories: number; protein: number; carbs: number; fats: number };
  computed: ComputedMacros;
  diffPct: number;
  suggestedFactor?: number;
}

/**
 * Compara los macros DECLARADOS por la IA con los que se derivan de sus
 * propios ingredientes. `insufficient_data` es la respuesta honesta cuando no
 * hay suficiente cobertura para juzgar — nunca se corrige a ciegas.
 */
export function verifyMealAgainstComposition(meal: Meal): MealVerification {
  const computed = computeMealMacrosFromIngredients(meal);
  const declared = {
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbs ?? 0,
    fats: meal.fats ?? 0,
  };

  if (computed.coverage < COVERAGE_MIN || declared.calories <= 0 || computed.calories <= 0) {
    return { status: 'insufficient_data', declared, computed, diffPct: 0 };
  }

  const diffPct = Math.abs(declared.calories - computed.calories) / computed.calories * 100;
  if (diffPct <= TOLERANCE_PCT) {
    return { status: 'ok', declared, computed, diffPct };
  }

  return {
    status: 'deviation',
    declared, computed, diffPct,
    suggestedFactor: declared.calories / computed.calories,
  };
}

// Fuera de este rango, la comida está tan mal identificada/calibrada que
// reescalar produciría un plato absurdo (p.ej. "195g pollo" donde se quiso
// poner una guarnición) — mejor avisar y dejar que decida la nutricionista.
const MIN_CORRECTION_FACTOR = 0.4;
const MAX_CORRECTION_FACTOR = 2.5;

/**
 * Reescala las cantidades de los ingredientes RECONOCIDOS de una comida
 * "deviation" para que sus macros cuadren con los YA DECLARADOS (que están
 * calibrados al objetivo clínico del paciente) — mismo criterio que
 * `enforceMealMacroTarget` en utils/planInstructions.ts, pero aquí el
 * objetivo es "lo que la IA prometió", no "la comida que sustituye".
 * Los ingredientes `negligible` (especias, sal...) no se tocan.
 */
export function correctMealToDeclaredMacros(
  meal: Meal,
  verification: MealVerification
): { meal: Meal; corrected: boolean; factor?: number } {
  if (verification.status !== 'deviation' || verification.suggestedFactor == null) {
    return { meal, corrected: false };
  }

  const factor = verification.suggestedFactor;
  if (factor < MIN_CORRECTION_FACTOR || factor > MAX_CORRECTION_FACTOR) {
    return { meal, corrected: false };
  }

  const negligibleSet = new Set(verification.computed.negligible);
  const ingredients = meal.ingredients.map(ingredient =>
    negligibleSet.has(ingredient) ? ingredient : scaleIngredientText(ingredient, factor)
  );

  return { meal: { ...meal, ingredients }, corrected: true, factor };
}

/**
 * Punto de entrada único: verifica una comida y, si hace falta y es seguro,
 * la corrige. Pensado para enganchar en TODOS los puntos de salida de la IA
 * en services/geminiService.ts sin repetir la llamada a verify+correct en
 * cada uno. Silencioso a propósito en `insufficient_data` (no hay datos para
 * juzgar) y cuando el factor cae fuera del clamp (se avisa, no se fuerza).
 */
export function verifyAndCorrectMeal(meal: Meal): { meal: Meal; note?: string } {
  const verification = verifyMealAgainstComposition(meal);
  if (verification.status !== 'deviation') return { meal };

  const { meal: corrected, corrected: applied } = correctMealToDeclaredMacros(meal, verification);
  if (!applied) return { meal };

  return {
    meal: corrected,
    note: `Se ajustaron las cantidades de "${meal.name}" para que cuadren con sus macros (desviación real del ${Math.round(verification.diffPct)}%).`,
  };
}

export function verifyAndCorrectDayPlan(day: DayPlan): { day: DayPlan; notes: string[] } {
  const notes: string[] = [];
  const meals = { ...day.meals };
  (Object.keys(meals) as (keyof typeof meals)[]).forEach(key => {
    const meal = meals[key];
    if (!meal) return;
    const { meal: checked, note } = verifyAndCorrectMeal(meal);
    meals[key] = checked;
    if (note) notes.push(note);
  });
  return { day: { ...day, meals }, notes };
}

export function verifyAndCorrectDietResponse(plan: DietResponse): { plan: DietResponse; notes: string[] } {
  const notes: string[] = [];
  const weeklyPlan = plan.weeklyPlan.map(day => {
    const { day: checked, notes: dayNotes } = verifyAndCorrectDayPlan(day);
    notes.push(...dayNotes);
    return checked;
  });
  return { plan: { ...plan, weeklyPlan }, notes };
}
