import { FOOD_COMPOSITION, FoodComposition } from '../data/foodComposition';

/**
 * Lookup compartido contra `data/foodComposition.ts` — extraído de
 * `utils/equivalences.ts` (donde vivían como funciones privadas) para que
 * `utils/nutritionVerification.ts` (verificador nutricional determinista) lo
 * reutilice sin duplicar la lógica de parseo/matching. Sin cambio de
 * comportamiento respecto al código original.
 */

/** Clave de comparación: minúsculas y sin acentos (mismo criterio que foodVocabulary). */
export function normalizeKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/** Busca la entrada de composición cuyo nombre/alias case con el texto — gana el match más largo. */
export function findFoodEntry(foodName: string): FoodComposition | undefined {
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
export function extractGrams(rawAmount: string, unit: string, origin: FoodComposition): number | null {
  const amount = parseFloat(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (UNIT_LIKE.test(unit)) return origin.gramsPerUnit ? amount * origin.gramsPerUnit : null;
  if (KG_LIKE.test(unit)) return amount * 1000;
  if (LITRE_LIKE.test(unit)) return amount * 1000;
  if (GRAM_LIKE.test(unit) || ML_LIKE.test(unit)) return amount;
  return null;
}

/**
 * Alimentos de aporte calórico despreciable: especias, hierbas, sal, vinagre,
 * café/infusiones sin azúcar. El verificador nutricional los excluye de la
 * cobertura (ni cuentan como "reconocidos" ni como "fallo") porque su cantidad
 * real (una pizca, al gusto) no es parseable de forma fiable y su aporte
 * calórico es insignificante frente al resto de la comida.
 */
export const NEGLIGIBLE_FOODS: string[] = [
  'sal', 'sal marina', 'pimienta', 'pimienta negra', 'especias', 'perejil',
  'perejil fresco', 'canela', 'canela en polvo', 'ajo en polvo', 'orégano',
  'comino', 'pimentón', 'pimenton', 'laurel', 'tomillo', 'romero', 'albahaca',
  'vinagre', 'vinagre de manzana', 'zumo de limón', 'zumo de medio limón',
  'limón', 'café', 'café solo', 'infusión', 'infusion', 'té', 'te verde',
  'agua', 'caldo', 'edulcorante', 'estevia',
];

/**
 * true si el nombre de alimento (ya extraído, sin cantidad) es despreciable
 * calóricamente. Usa límites de palabra (no un `includes` a pelo): términos
 * cortos como "té" o "sal" harían falsos positivos por substring dentro de
 * "proteína" o "salmón" si se comparasen sin límites.
 */
export function isNegligible(foodName: string): boolean {
  const key = normalizeKey(foodName);
  if (!key) return false;
  return NEGLIGIBLE_FOODS.some(n => {
    const term = normalizeKey(n);
    if (!term) return false;
    return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(key);
  });
}
