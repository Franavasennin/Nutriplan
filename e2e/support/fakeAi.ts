import type { Meal, DayPlan } from '../../types';
import { computeMealMacrosFromIngredients } from '../../utils/nutritionVerification';
import { scaleIngredientText } from '../../utils/planScaling';

/**
 * IA simulada (Gemini y Mistral) para los E2E: nunca se gasta cuota real ni
 * se depende de lo que responda un modelo ese día.
 *
 * Responde según el prompt REAL que construye services/geminiService.ts, así
 * que si el prompt deja de tener la forma esperada el test lo nota:
 *  - "Genera un plan dietético de N días (días A al B)" → plan / rehacer día
 *  - "El paciente no quiere esta comida"                 → swap de comida
 *  - "PAUTA DE LA NUTRICIONISTA:"                         → pautas
 *
 * Los macros declarados de cada comida se calculan con el mismo verificador
 * que usa la app (utils/nutritionVerification.ts), para que el guardarraíl
 * determinista no tenga que reescalar nada y los tests sean estables.
 */

export type AiKind = 'plan' | 'swap' | 'instructions' | 'failed' | 'unknown';
export type AiProvider = 'gemini' | 'mistral';

export interface AiCall {
  provider: AiProvider;
  kind: AiKind;
  systemPrompt: string;
  userPrompt: string;
  /** Solo para kind 'plan': días pedidos en esta llamada. */
  days?: number[];
}

interface Dish { name: string; description: string; ingredients: string[] }

// Tres opciones por toma: rehacer un día desplaza el índice en 1, así que el
// día regenerado siempre sale con platos distintos a los originales.
const MENU: Record<string, Dish[]> = {
  breakfast: [
    { name: 'Avena con yogur griego y plátano', description: 'Bol templado de avena', ingredients: ['50g avena', '125g yogur griego', '100g plátano'] },
    { name: 'Tostada integral con pavo y tomate', description: 'Tostada salada', ingredients: ['60g pan integral', '60g pechuga de pavo', '80g tomate', '5ml aceite de oliva'] },
    { name: 'Revuelto de huevo con espinacas', description: 'Revuelto rápido', ingredients: ['120g huevo', '80g espinacas', '40g pan integral'] },
  ],
  morningSnack: [
    { name: 'Manzana con almendras', description: 'Fruta y frutos secos', ingredients: ['180g manzana', '15g almendras'] },
    { name: 'Yogur griego con kiwi', description: 'Lácteo con fruta', ingredients: ['125g yogur griego', '100g kiwi'] },
    { name: 'Pera con nueces', description: 'Fruta y frutos secos', ingredients: ['180g pera', '15g nueces'] },
  ],
  lunch: [
    { name: 'Pollo a la plancha con arroz integral y brócoli', description: 'Plato completo', ingredients: ['150g pechuga de pollo', '150g arroz integral', '150g brócoli', '10ml aceite de oliva'] },
    { name: 'Lentejas estofadas con zanahoria', description: 'Guiso de cuchara', ingredients: ['250g lentejas', '100g zanahoria', '80g pimiento rojo', '10ml aceite de oliva'] },
    { name: 'Merluza al horno con patata', description: 'Pescado blanco al horno', ingredients: ['180g merluza', '200g patata', '100g judías verdes', '10ml aceite de oliva'] },
  ],
  afternoonSnack: [
    { name: 'Queso fresco con fresas', description: 'Merienda ligera', ingredients: ['100g queso fresco', '150g fresas'] },
    { name: 'Plátano con yogur griego', description: 'Merienda dulce', ingredients: ['100g plátano', '125g yogur griego'] },
    { name: 'Tostada integral con aguacate', description: 'Merienda salada', ingredients: ['40g pan integral', '50g aguacate'] },
  ],
  dinner: [
    { name: 'Salmón con quinoa y calabacín', description: 'Pescado azul', ingredients: ['130g salmón', '120g quinoa', '150g calabacín', '5ml aceite de oliva'] },
    { name: 'Tortilla de espinacas con ensalada', description: 'Cena ligera', ingredients: ['120g huevo', '100g espinacas', '100g lechuga', '80g tomate', '5ml aceite de oliva'] },
    { name: 'Pavo a la plancha con verduras asadas', description: 'Cena proteica', ingredients: ['150g pechuga de pavo', '150g calabacín', '100g pimiento rojo', '100g patata', '10ml aceite de oliva'] },
  ],
};

export const SWAP_DISH: Dish = {
  name: 'Ensalada de garbanzos con atún',
  description: 'Alternativa fría y rápida',
  ingredients: ['200g garbanzos', '80g atún en agua', '80g tomate', '60g lechuga', '10ml aceite de oliva'],
};

// Desayunos con pan distintos cada día, como pide la Regla 5 de la pauta.
export const BREAD_BREAKFASTS: Dish[] = [
  { name: 'Tostada integral con huevo y tomate', description: 'Desayuno salado con pan', ingredients: ['60g pan integral', '100g huevo', '80g tomate'] },
  { name: 'Pan integral con queso fresco y fresas', description: 'Desayuno dulce con pan', ingredients: ['60g pan integral', '80g queso fresco', '120g fresas'] },
  { name: 'Pan integral con pavo y aguacate', description: 'Desayuno salado con pan', ingredients: ['60g pan integral', '50g pechuga de pavo', '40g aguacate'] },
];

const STEPS = ['Prepara y pesa los ingredientes.', 'Cocina o monta el plato según se indica.', 'Sirve y consume en el momento.'];

export function dishToMeal(dish: Dish): Meal {
  const base: Meal = { ...dish, instructions: STEPS };
  const m = computeMealMacrosFromIngredients(base);
  return {
    ...base,
    calories: Math.round(m.calories),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fats: Math.round(m.fats),
  };
}

export const MEAL_KEYS_5 = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'];

/** Días `from..to` del menú simulado; `variant` desplaza los platos de cada toma. */
export function buildMenuDays(from: number, to: number, keys: string[] = MEAL_KEYS_5, variant = 0): DayPlan[] {
  const days: DayPlan[] = [];
  for (let day = from; day <= to; day++) {
    const meals: DayPlan['meals'] = {};
    for (const key of keys) {
      const pool = MENU[key] ?? MENU.lunch;
      (meals as Record<string, Meal>)[key] = dishToMeal(pool[(day - 1 + variant) % pool.length]);
    }
    days.push({ day, meals });
  }
  return days;
}

/** Reescala las cantidades del plato para acercarlo a unas kcal objetivo. */
function dishAtCalories(dish: Dish, targetKcal: number | undefined): Meal {
  const base = dishToMeal(dish);
  if (!targetKcal || !base.calories) return base;
  const factor = targetKcal / base.calories;
  return dishToMeal({ ...dish, ingredients: dish.ingredients.map(i => scaleIngredientText(i, factor)) });
}

export class FakeAi {
  readonly calls: AiCall[] = [];
  /** Estado HTTP que devuelve Gemini (200 = normal) — para probar el fallback a Mistral. */
  geminiStatus = 200;
  private planCalls = 0;

  /** Genera el texto JSON que "devolvería el modelo" para este prompt. */
  respond(provider: AiProvider, systemPrompt: string, userPrompt: string): string {
    const planMatch = userPrompt.match(/Genera un plan dietético de (\d+) días \(días (\d+) al (\d+)\)/);
    if (planMatch) {
      const from = Number(planMatch[2]);
      const to = Number(planMatch[3]);
      const keysText = userPrompt.match(/\(claves: ([^)]+)\)/)?.[1];
      const keys = keysText ? keysText.split(',').map(k => k.trim()) : MEAL_KEYS_5;
      // "Rehacer día" (1 solo día) nunca devuelve el mismo menú que la
      // generación inicial (variante 0, también la de los planes sembrados).
      const variant = from === to ? this.planCalls++ + 1 : this.planCalls++;
      const days = buildMenuDays(from, to, keys, variant);
      this.calls.push({ provider, kind: 'plan', systemPrompt, userPrompt, days: days.map(d => d.day) });
      return JSON.stringify({
        weeklyPlan: days,
        generalGuidelines: ['Bebe al menos 2 litros de agua al día.', 'Prioriza alimentos frescos y de temporada.'],
        durationText: '1 semana',
      });
    }

    if (userPrompt.startsWith('El paciente no quiere esta comida')) {
      this.calls.push({ provider, kind: 'swap', systemPrompt, userPrompt });
      const kcal = Number(userPrompt.match(/~(\d+) kcal/)?.[1]);
      return JSON.stringify(dishAtCalories(SWAP_DISH, kcal || undefined));
    }

    if (userPrompt.startsWith('PAUTA DE LA NUTRICIONISTA:')) {
      this.calls.push({ provider, kind: 'instructions', systemPrompt, userPrompt });
      const pauta = userPrompt.split('\n')[0].toLowerCase();
      if (!(pauta.includes('pan') && pauta.includes('desayuno'))) return JSON.stringify({ changes: [] });
      const planJson = userPrompt.match(/PLAN ACTUAL[^\n]*\n(.+)\n/)?.[1] ?? '[]';
      const days = JSON.parse(planJson) as { day: number; meals: { mealKey: string; calories?: number }[] }[];
      const changes = days.flatMap((d, i) => {
        const breakfast = d.meals.find(m => m.mealKey === 'breakfast');
        if (!breakfast) return [];
        const dish = BREAD_BREAKFASTS[i % BREAD_BREAKFASTS.length];
        return [{ day: d.day, mealKey: 'breakfast', meal: dishAtCalories(dish, breakfast.calories) }];
      });
      return JSON.stringify({ changes });
    }

    this.calls.push({ provider, kind: 'unknown', systemPrompt, userPrompt });
    throw new Error(`[fakeAi] prompt no reconocido: ${userPrompt.slice(0, 120)}`);
  }

  callsOf(kind: AiKind): AiCall[] {
    return this.calls.filter(c => c.kind === kind);
  }
}
