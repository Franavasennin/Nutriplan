import { DietResponse, Meal } from '../types';
import { QUANTITY_RE } from './planScaling';
import { normalizeIngredient } from './macroValidation';

/**
 * Helpers puros para el modo de impresión "Dieta de Pareja" (formatos
 * "paralelo" y "consolidada" en components/DietPlanDisplay.tsx). No dependen
 * de React — solo transforman dos DietResponse en estructuras listas para
 * renderizar sin duplicar información innecesariamente.
 */

export type MealKey = 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner';

// Única fuente de verdad para el orden/etiquetas de las tomas en las vistas
// de impresión (individual, paralela y consolidada) — antes vivía como un
// array recreado en cada render dentro del bucle de la vista individual.
export const MEAL_PRINT_ORDER: { key: MealKey; title: string }[] = [
  { key: 'breakfast',      title: 'Desayuno'     },
  { key: 'morningSnack',   title: 'Media Mañana' },
  { key: 'lunch',          title: 'Almuerzo'     },
  { key: 'afternoonSnack', title: 'Merienda'     },
  { key: 'dinner',         title: 'Cena'         },
];

export interface AlignedMealSlot {
  key: MealKey;
  title: string;
  principal?: Meal;
  partner?: Meal;
}

export interface AlignedDay {
  day: number;
  meals: AlignedMealSlot[];
}

/**
 * Alinea weeklyPlan de dos planes por número de día (unión de días presentes
 * en cualquiera de los dos, no zip posicional — así no se pierde un día que
 * solo exista en un lado tras una edición manual que desincronizó los
 * arrays) y por slot de comida. leftPlan/rightPlan son solo "columna
 * izquierda/derecha" para imprimir, no implican quién es el principal según
 * SavedDiet.linkedRole.
 */
export function alignCoupleDays(leftPlan: DietResponse, rightPlan: DietResponse): AlignedDay[] {
  const leftByDay  = new Map(leftPlan.weeklyPlan.map(d => [d.day, d]));
  const rightByDay = new Map(rightPlan.weeklyPlan.map(d => [d.day, d]));
  const allDayNumbers = [...new Set([...leftByDay.keys(), ...rightByDay.keys()])].sort((a, b) => a - b);

  return allDayNumbers.map(dayNum => {
    const leftDay  = leftByDay.get(dayNum);
    const rightDay = rightByDay.get(dayNum);
    const meals = MEAL_PRINT_ORDER
      .map(({ key, title }) => ({
        key, title,
        principal: leftDay?.meals[key],
        partner:   rightDay?.meals[key],
      }))
      .filter(slot => slot.principal || slot.partner);
    return { day: dayNum, meals };
  });
}

/** Extrae el "alimento" (texto tras cantidad+unidad) de un ingrediente ya
 *  normalizado a string. Si QUANTITY_RE no matchea (sin cantidad parseable,
 *  p.ej. "sal al gusto"), usa el string completo como clave — nunca se
 *  pierde un ingrediente por no parsear. */
function extractFoodKey(ingredientText: string): string {
  const match = ingredientText.match(QUANTITY_RE);
  const foodPart = match ? match[3] : ingredientText;
  return foodPart
    .toLowerCase()
    .trim()
    .replace(/^(de|del|la|el|los|las)\s+/, '')
    .replace(/\s+/g, ' ');
}

/** Devuelve solo la cantidad+unidad inicial ("80g") para el formato
 *  consolidado; si no hay cantidad parseable, devuelve el string completo. */
export function extractQuantityLabel(ingredientText: string): string {
  const match = ingredientText.match(QUANTITY_RE);
  return match ? `${match[1]}${match[2]}` : ingredientText;
}

export interface PairedIngredientRow {
  /** Clave normalizada de alimento — solo para keying, nunca se muestra tal cual. */
  food: string;
  /** String de ingrediente original completo del lado izquierdo, p.ej. "80g avena". */
  mine?: string;
  /** String de ingrediente original completo del lado derecho. */
  theirs?: string;
}

/**
 * Empareja los ingredientes de dos listas (mismo slot de comida, mismo día)
 * por nombre de alimento normalizado, para el formato "Pareja consolidada" —
 * evita repetir la receta completa cuando solo cambian las cantidades.
 * Preserva el orden de "mine"; los ítems de "theirs" sin match se añaden al
 * final en su orden original.
 */
export function pairIngredients(mineIngredients: string[], theirsIngredients: string[]): PairedIngredientRow[] {
  const mine   = mineIngredients.map(normalizeIngredient).filter(Boolean);
  const theirs = theirsIngredients.map(normalizeIngredient).filter(Boolean);

  const theirsByKey = new Map<string, string>();
  for (const t of theirs) {
    const key = extractFoodKey(t);
    if (!theirsByKey.has(key)) theirsByKey.set(key, t);
  }

  const consumedKeys = new Set<string>();
  const rows: PairedIngredientRow[] = mine.map(m => {
    const key = extractFoodKey(m);
    const theirsMatch = theirsByKey.get(key);
    if (theirsMatch) consumedKeys.add(key);
    return { food: key, mine: m, theirs: theirsMatch };
  });

  const appendedKeys = new Set<string>();
  for (const t of theirs) {
    const key = extractFoodKey(t);
    if (consumedKeys.has(key) || appendedKeys.has(key)) continue;
    rows.push({ food: key, theirs: t });
    appendedKeys.add(key);
  }

  return rows;
}
