import { DietResponse, DayPlan, Meal, CalculatedMetrics } from '../types';
import { sumDayMacros, reconcileDietResponse } from './macroValidation';

/**
 * Motor de escalado determinista para "Pareja Inteligente" — sustituye a la
 * llamada de IA que existía antes (adaptPlanToPartner en geminiService.ts):
 * NUNCA cambia platos/recetas/horarios, solo reescala cantidades y macros
 * matemáticamente contra un objetivo ya calculado con el mismo motor que
 * cualquier paciente (calculateMacros — ver utils/calculations.ts).
 *
 * Ventajas sobre el enfoque de IA: instantáneo (sin llamadas de red), sin
 * coste de API, y el objetivo diario de macros se cumple con exactitud
 * matemática. Limitación honesta y documentada: la cantidad reescalada de
 * cada INGREDIENTE individual es una aproximación proporcional (la app no
 * tiene una base de datos nutricional por alimento) — el objetivo diario
 * de calorías/proteína/grasa/HC es exacto, la ración de cada ingrediente
 * es una estimación razonable, no una reformulación nutricional real.
 */

const MEAL_KEYS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'] as const;

// Clamp de seguridad: evita cantidades absurdas cuando el objetivo de la
// pareja es muy distinto al del principal (p.ej. atleta vs. paciente en
// déficit fuerte). Fuera de rango se avisa en `warnings`, no se falla.
const MIN_FACTOR = 0.35;
const MAX_FACTOR = 3.0;

// Reconoce "<número><unidad opcional> <resto>" al inicio del ingrediente,
// p.ej. "80g avena", "250 ml leche", "2 unidades de huevo". Si no hay match,
// el ingrediente se deja intacto — nunca se rompe ni se inventa texto.
// Exportado: utils/couplePrint.ts la reutiliza para emparejar ingredientes
// por nombre de alimento en el formato de impresión "Pareja consolidada".
export const QUANTITY_RE = /^(\d+(?:[.,]\d+)?)\s*(g|gr|gramos|ml|kg|l|litro[s]?|unidad(?:es)?|cucharada[s]?|taza[s]?)\b(.*)$/i;

export interface ScaleWarning {
  code: 'clamped' | 'no_macros';
  message: string;
}

export interface ScalePlanResult {
  plan: DietResponse;
  warnings: ScaleWarning[];
}

function clampFactor(raw: number, macroLabel: string, warnings: ScaleWarning[]): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  if (raw < MIN_FACTOR || raw > MAX_FACTOR) {
    const clamped = Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, raw));
    warnings.push({
      code: 'clamped',
      message: `El objetivo de ${macroLabel} de la pareja es muy distinto al del principal — las cantidades se han limitado a un rango razonable (antes de limitar: ${raw.toFixed(2)}x). Revisa el plan manualmente.`,
    });
    return clamped;
  }
  return raw;
}

/** Escala el texto de un ingrediente reescribiendo solo la cantidad inicial (si es parseable). */
function scaleIngredientText(ingredient: string, factor: number): string {
  const match = ingredient.match(QUANTITY_RE);
  if (!match) return ingredient; // sin cantidad parseable: se deja intacto
  const [, rawAmount, unit, rest] = match;
  const amount = parseFloat(rawAmount.replace(',', '.'));
  if (!Number.isFinite(amount)) return ingredient;
  const scaled = amount * factor;
  // Redondeo sensible: gramos/ml enteros, unidades a 0.5 más cercano.
  const isUnitCount = /^unidad/i.test(unit);
  const newAmount = isUnitCount ? Math.round(scaled * 2) / 2 : Math.round(scaled);
  const formattedAmount = String(newAmount).replace('.', ',');
  return `${formattedAmount}${unit}${rest}`;
}

function scaleMeal(meal: Meal, macroFactors: { protein: number; carbs: number; fats: number }, warnings: ScaleWarning[]): Meal {
  if (meal.protein == null || meal.carbs == null || meal.fats == null) {
    warnings.push({ code: 'no_macros', message: `"${meal.name}" no tiene macros declarados — se deja sin escalar.` });
    return meal;
  }

  const newProtein = meal.protein * macroFactors.protein;
  const newCarbs = meal.carbs * macroFactors.carbs;
  const newFats = meal.fats * macroFactors.fats;
  // Las calorías se RECALCULAN desde los nuevos macros (mismo criterio que
  // reconcileMealMacros), nunca se reescalan con un cuarto factor
  // independiente — evita que el drift se acumule entre resincronizaciones.
  const newCalories = newProtein * 4 + newCarbs * 4 + newFats * 9;
  const oldCalories = meal.protein * 4 + meal.carbs * 4 + meal.fats * 9;
  // Factor calórico de ESTA comida (no el global) para reescalar sus
  // ingredientes — más fiel a la composición real de cada plato.
  const quantityFactor = oldCalories > 0 ? newCalories / oldCalories : 1;

  return {
    ...meal,
    protein: Math.round(newProtein),
    carbs: Math.round(newCarbs),
    fats: Math.round(newFats),
    calories: Math.round(newCalories),
    ingredients: meal.ingredients.map(i => scaleIngredientText(i, quantityFactor)),
  };
}

function scaleDay(
  day: DayPlan,
  macroFactors: { protein: number; carbs: number; fats: number },
  lockedMealKeys: Set<string>,
  currentPartnerDay: DayPlan | undefined,
  warnings: ScaleWarning[]
): DayPlan {
  const meals: DayPlan['meals'] = {};
  for (const key of MEAL_KEYS) {
    const meal = day.meals[key];
    if (!meal) continue;
    const lockKey = `${day.day}-${key}`;
    if (lockedMealKeys.has(lockKey) && currentPartnerDay?.meals[key]) {
      // Comida bloqueada manualmente: se conserva la versión ACTUAL de la
      // pareja, no se toca aunque el principal haya cambiado esa comida.
      meals[key] = currentPartnerDay.meals[key];
    } else {
      meals[key] = scaleMeal(meal, macroFactors, warnings);
    }
  }
  return { ...day, meals };
}

export interface ScaleOptions {
  /** Claves "<day>-<mealKey>" que no deben tocarse — se conservan de currentPartnerPlan. */
  lockedMeals?: string[];
  /** Plan actual de la pareja, de donde se rescatan las comidas bloqueadas. */
  currentPartnerPlan?: DietResponse;
}

/**
 * Reescala `basePlan` (SIEMPRE la estructura fresca del principal, nunca un
 * plan ya escalado) hacia `targetMetrics.macros` de la pareja. Idempotente:
 * llamarla dos veces seguidas con el mismo basePlan/target da el mismo
 * resultado, porque nunca parte de su propia salida anterior.
 */
export function scalePlanToTarget(
  basePlan: DietResponse,
  targetMetrics: CalculatedMetrics,
  options: ScaleOptions = {}
): ScalePlanResult {
  const warnings: ScaleWarning[] = [];
  const lockedMealKeys = new Set(options.lockedMeals ?? []);

  if (basePlan.weeklyPlan.length === 0) {
    return { plan: basePlan, warnings };
  }

  // Factor de escala por macro, calculado UNA VEZ a nivel de plan: se
  // promedian los totales diarios de todos los días con datos (más estable
  // que usar solo el primer día si algún día viene incompleto).
  const dayTotals = basePlan.weeklyPlan
    .map(d => sumDayMacros(d.meals))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  if (dayTotals.length === 0) {
    warnings.push({ code: 'no_macros', message: 'El plan del principal no tiene macros declarados en ningún día — no se puede escalar.' });
    return { plan: basePlan, warnings };
  }

  const avg = {
    protein: dayTotals.reduce((s, t) => s + t.protein, 0) / dayTotals.length,
    carbs:   dayTotals.reduce((s, t) => s + t.carbs,   0) / dayTotals.length,
    fats:    dayTotals.reduce((s, t) => s + t.fats,    0) / dayTotals.length,
  };

  const macroFactors = {
    protein: clampFactor(targetMetrics.macros.protein / (avg.protein || 1), 'proteína', warnings),
    carbs:   clampFactor(targetMetrics.macros.carbs   / (avg.carbs   || 1), 'carbohidratos', warnings),
    fats:    clampFactor(targetMetrics.macros.fats    / (avg.fats    || 1), 'grasas', warnings),
  };

  const partnerDayByNumber = new Map(
    (options.currentPartnerPlan?.weeklyPlan ?? []).map(d => [d.day, d])
  );

  const weeklyPlan = basePlan.weeklyPlan.map(day =>
    scaleDay(day, macroFactors, lockedMealKeys, partnerDayByNumber.get(day.day), warnings)
  );

  const scaled = reconcileDietResponse({ ...basePlan, weeklyPlan });
  return { plan: scaled, warnings };
}
