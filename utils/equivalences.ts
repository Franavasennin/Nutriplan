import { Allergen } from '../types';
import { FOOD_COMPOSITION, GROUP_FALLBACKS, FoodComposition, SwapGroup } from '../data/foodComposition';
import { QUANTITY_RE } from './planScaling';
import { extractFoodName } from './foodVocabulary';
import { findMatchingAllergens } from './shoppingList';

/**
 * Motor determinista de equivalencias nutricionales — "hoy me toca pollo y no
 * me apetece". Dado un ingrediente ("150g pechuga de pollo"), ofrece 2-3
 * alternativas con los gramos recalculados para mantener el macro dominante
 * de ese alimento (proteína/HC/grasa), dentro de una tolerancia calórica.
 * Solo visualización — el portal del paciente las muestra bajo el plato
 * prescrito, nunca las persiste ni las aplica.
 *
 * O(n) sobre ~140 entradas en memoria — instantáneo, sin red, sin IA.
 */

export interface EquivalentOption {
  /** Nombre canónico del alimento equivalente. */
  name: string;
  /** Línea ya formateada para mostrar: "180g merluza", "3 huevos". */
  label: string;
  /** Diferencia calórica frente al alimento original (puede ser negativa). */
  kcalDelta: number;
}

/** Clave de comparación: minúsculas y sin acentos (mismo criterio que foodVocabulary). */
function normalizeKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/** Macro que se iguala al buscar equivalentes — el que define ese grupo de alimentos. */
function dominantMacro(group: SwapGroup): 'protein' | 'carbs' | 'fats' {
  switch (group) {
    case 'cereal':
    case 'tuberculo':
    case 'fruta':
    case 'verdura':
      return 'carbs';
    case 'fruto_seco':
    case 'grasa':
      return 'fats';
    default:
      return 'protein';
  }
}

/** Busca la entrada de composición cuyo nombre/alias case con el texto — gana el match más largo. */
function findFoodEntry(foodName: string): FoodComposition | undefined {
  const key = normalizeKey(foodName);
  if (!key) return undefined;
  let best: FoodComposition | undefined;
  let bestLen = 0;
  for (const entry of FOOD_COMPOSITION) {
    for (const candidate of [entry.name, ...(entry.aliases ?? [])]) {
      const candidateKey = normalizeKey(candidate);
      if ((key === candidateKey || key.includes(candidateKey)) && candidateKey.length > bestLen) {
        best = entry;
        bestLen = candidateKey.length;
      }
    }
  }
  return best;
}

const GRAM_LIKE = /^(g|gr|gramos)$/i;
const ML_LIKE = /^ml$/i;
const KG_LIKE = /^kg$/i;
const LITRE_LIKE = /^l(itro[s]?)?$/i;
const UNIT_LIKE = /^unidad(es)?$/i;

/**
 * Gramos reales del ingrediente. Solo convierte unidades de masa/volumen
 * fiables (g/gr/gramos/kg/ml/l/litro) y "unidad(es)" si el alimento tiene
 * `gramsPerUnit` conocido. cucharada/taza no son fiables — devuelve null en
 * vez de inventar una conversión (mismo criterio que el resto del corpus).
 */
function extractGrams(rawAmount: string, unit: string, origin: FoodComposition): number | null {
  const amount = parseFloat(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (UNIT_LIKE.test(unit)) return origin.gramsPerUnit ? amount * origin.gramsPerUnit : null;
  if (KG_LIKE.test(unit)) return amount * 1000;
  if (LITRE_LIKE.test(unit)) return amount * 1000;
  if (GRAM_LIKE.test(unit) || ML_LIKE.test(unit)) return amount;
  return null;
}

function parseExcludedFoods(excludedFoods?: string): string[] {
  if (!excludedFoods) return [];
  return excludedFoods.split(',').map(normalizeKey).filter(Boolean);
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function formatLabel(food: FoodComposition, grams: number): string {
  if (food.unit === 'unidad' && food.gramsPerUnit) {
    const units = Math.round((grams / food.gramsPerUnit) * 2) / 2; // redondeo a media unidad
    const plural = food.aliases?.find(a => a.toLowerCase() !== food.name.toLowerCase() && a.endsWith('s'));
    const displayName = units === 1 ? food.name : (plural ?? `${food.name}s`);
    return `${formatNumber(units)} ${displayName}`;
  }
  const rounded = Math.round(grams / 5) * 5;
  return `${rounded}${food.unit === 'ml' ? 'ml' : 'g'} ${food.name}`;
}

export interface EquivalenceConstraints {
  allergens?: Allergen[];
  excludedFoods?: string;
}

export interface EquivalenceOptions {
  /** Nº máximo de alternativas a devolver. Default 3. */
  limit?: number;
  /**
   * Desviación calórica máxima permitida frente al alimento original, en %.
   * Igualar los 4 macros a la vez entre alimentos distintos es matemáticamente
   * imposible — se iguala el macro dominante del grupo (proteína/HC/grasa) y
   * se acota la desviación calórica total con esta tolerancia. Default 10%.
   */
  tolerancePct?: number;
}

/**
 * Encuentra alternativas nutricionalmente equivalentes a un ingrediente.
 * Sin match, sin cantidad parseable de forma fiable, o cantidad < 30g
 * (especias/aliños) -> [] (nunca fabrica una equivalencia).
 */
export function findEquivalents(
  ingredientLine: string,
  constraints: EquivalenceConstraints = {},
  opts: EquivalenceOptions = {}
): EquivalentOption[] {
  const limit = opts.limit ?? 3;
  const tolerancePct = opts.tolerancePct ?? 10;

  const foodName = extractFoodName(ingredientLine);
  if (!foodName) return [];
  const origin = findFoodEntry(foodName);
  if (!origin) return [];

  const match = ingredientLine.match(QUANTITY_RE);
  let originGrams: number | null;
  if (match) {
    originGrams = extractGrams(match[1], match[2], origin);
  } else if (origin.unit === 'unidad' && origin.gramsPerUnit) {
    // Sin unidad explícita ("2 huevos", "3 plátanos") — QUANTITY_RE exige un
    // token de unidad literal ("unidad(es)"). Si el alimento identificado se
    // mide por unidad, un número seguido directamente del nombre cuenta como
    // "N unidades" (mismo fallback que extractFoodName usa para el nombre).
    const bare = ingredientLine.trim().match(/^(\d+(?:[.,]\d+)?)\s+/);
    const bareAmount = bare ? parseFloat(bare[1].replace(',', '.')) : NaN;
    originGrams = Number.isFinite(bareAmount) && bareAmount > 0 ? bareAmount * origin.gramsPerUnit : null;
  } else {
    originGrams = null;
  }
  if (originGrams == null || originGrams < 30) return [];

  const macro = dominantMacro(origin.group);
  const originKcal = (origin.per100.kcal * originGrams) / 100;
  const excludedNames = parseExcludedFoods(constraints.excludedFoods);

  const groupsToTry: SwapGroup[] = [origin.group, ...GROUP_FALLBACKS[origin.group]];
  const originKey = normalizeKey(origin.name);

  // Candidatos que superan todos los filtros (alérgenos/excluidos/tolerancia),
  // agrupados por categoría y ya ordenados por prioridad dentro de cada una.
  const perGroup: EquivalentOption[][] = groupsToTry.map(group => {
    const passing: EquivalentOption[] = [];
    const candidates = FOOD_COMPOSITION
      .filter(f => f.group === group)
      .sort((a, b) => a.priority - b.priority);

    for (const cand of candidates) {
      const key = normalizeKey(cand.name);
      if (key === originKey) continue;
      if (cand.per100[macro] <= 0) continue; // no se puede igualar ese macro

      const namesToCheck = [cand.name, ...(cand.aliases ?? [])];
      if (
        constraints.allergens?.length &&
        namesToCheck.some(n => findMatchingAllergens(n, constraints.allergens!).length > 0)
      ) continue;
      if (
        excludedNames.length &&
        namesToCheck.some(n => {
          const nk = normalizeKey(n);
          return excludedNames.some(ex => nk.includes(ex) || ex.includes(nk));
        })
      ) continue;

      const newGrams = (originGrams * origin.per100[macro]) / cand.per100[macro];
      const newKcal = (cand.per100.kcal * newGrams) / 100;
      const kcalDeltaPct = originKcal > 0 ? (Math.abs(newKcal - originKcal) / originKcal) * 100 : 0;
      if (kcalDeltaPct > tolerancePct) continue;

      passing.push({
        name: cand.name,
        label: formatLabel(cand, newGrams),
        kcalDelta: Math.round(newKcal - originKcal),
      });
    }
    return passing;
  });

  // Reparto por categoría (round-robin): como mucho una alternativa de cada
  // grupo por vuelta, en vez de agotar la categoría más cercana antes de
  // probar la siguiente. Para un alimento muy magro (p.ej. pechuga de pollo),
  // "pescado blanco" por sí solo ya tiene suficientes candidatos dentro de la
  // tolerancia calórica como para llenar el límite entero sin llegar nunca a
  // mirar "huevo" o "vegetal" — esto reparte entre todas las categorías que
  // tengan al menos una opción válida, para que la variedad sea real.
  const results: EquivalentOption[] = [];
  for (let round = 0; results.length < limit; round++) {
    let addedThisRound = false;
    for (const group of perGroup) {
      if (round >= group.length) continue;
      results.push(group[round]);
      addedThisRound = true;
      if (results.length >= limit) break;
    }
    if (!addedThisRound) break;
  }

  return results;
}
