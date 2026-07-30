import { DietResponse, Allergen, ALLERGEN_KEYWORDS } from '../types';

// ─── Alérgenos en la lista de la compra (MEJORA-001, iteración 001) ───────────
// Coincidencia simple por palabra clave (no NLP) — ver
// docs/loop/iteracion-001/MEJORA-001.md, no-alcance.
//
// Excepción (MEJORA-009, iteración 002, hallazgo M-001): "leche de X" para
// bebidas vegetales (almendra, avena, soja, coco, arroz) no contiene lácteo
// real — sin esta excepción, "leche de almendras" marcaría falsamente el
// alérgeno Leche. La "avena" bajo Gluten SÍ es correcta (Reglamento UE
// 1169/2011 Anexo II incluye la avena entre los cereales con gluten) y no
// se toca.
const PLANT_MILK_PATTERN = /\bleche\s+de\s+(almendras?|avena|soja|coco|arroz|anacardos?)\b/;

export function findMatchingAllergens(ingredientName: string, declaredAllergens: Allergen[]): Allergen[] {
  if (!declaredAllergens.length) return [];
  const lower = ingredientName.toLowerCase();
  const isPlantMilk = PLANT_MILK_PATTERN.test(lower);

  return declaredAllergens.filter(a => {
    if (a === Allergen.Leche && isPlantMilk) return false;
    return ALLERGEN_KEYWORDS[a].some(keyword => lower.includes(keyword));
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShoppingItem {
  name: string;
  amounts: string[]; // summed amounts per unit
}

export interface ShoppingCategory {
  category: string;
  icon: string;
  color: string;
  items: ShoppingItem[];
}

export type ShoppingList = ShoppingCategory[];

// ─── Category rules ───────────────────────────────────────────────────────────

type CategoryRule = {
  category: string;
  icon: string;
  color: string;
  keywords: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Carnes, aves y fiambres',
    icon: 'kebab_dining',
    color: 'red',
    keywords: [
      'pollo', 'pavo', 'ternera', 'cerdo', 'lomo', 'filete', 'pechuga', 'conejo',
      'jamón', 'fiambre', 'chorizo', 'bacon', 'mortadela', 'salchich', 'cordero',
      'buey', 'codorniz', 'carne pica',
    ],
  },
  {
    category: 'Pescado y marisco',
    icon: 'set_meal',
    color: 'blue',
    keywords: [
      'salmón', 'atún', 'merluza', 'bacalao', 'sardina', 'caballa', 'gambas',
      'calamar', 'mejillón', 'berberecho', 'pulpo', 'boquerón', 'anchoa', 'sepia',
      'rape', 'lubina', 'dorada', 'langostino', 'cangrejo', 'palitos de cangrejo',
    ],
  },
  {
    category: 'Huevos y lácteos',
    icon: 'egg',
    color: 'amber',
    keywords: [
      'huevo', 'yogur', 'leche', 'queso', 'requesón', 'kéfir', 'kefir',
      'mantequilla', 'nata', 'cuajada', 'cottage',
    ],
  },
  {
    category: 'Frutas',
    icon: 'nutrition',
    color: 'orange',
    keywords: [
      'manzana', 'plátano', 'naranja', 'pera', 'fresa', 'kiwi', 'melocotón',
      'uva', 'sandía', 'melón', 'mandarina', 'limón', 'arándano', 'frambuesa',
      'ciruela', 'cereza', 'albaricoque', 'higo', 'mango', 'piña', 'papaya',
      'granada', 'fruta',
    ],
  },
  {
    category: 'Verduras y hortalizas',
    icon: 'eco',
    color: 'green',
    keywords: [
      'espinaca', 'lechuga', 'tomate', 'pepino', 'zanahoria', 'cebolla', 'ajo',
      'pimiento', 'calabacín', 'berenjena', 'brócoli', 'coliflor', 'acelga',
      'apio', 'puerro', 'champiñón', 'seta', 'aguacate', 'espárrago',
      'remolacha', 'pepinillo', 'rúcula', 'canónigo', 'endibia',
      'alcachofa', 'col', 'nabo', 'verdura', 'ensalad',
    ],
  },
  {
    category: 'Legumbres',
    icon: 'grass',
    color: 'lime',
    keywords: [
      'lenteja', 'garbanzo', 'alubia', 'judía', 'guisante', 'soja', 'edamame',
      'hummus', 'legumbre',
    ],
  },
  {
    category: 'Cereales, pan y pasta',
    icon: 'bakery_dining',
    color: 'yellow',
    keywords: [
      'arroz', 'pasta', 'avena', 'pan', 'tortita', 'copos', 'quinoa', 'trigo',
      'cereal', 'espagueti', 'macarrón', 'fideos', 'cuscús', 'bulgur', 'mijo',
      'harina', 'tostada', 'biscote', 'cracker',
    ],
  },
  {
    category: 'Conservas y precocinados',
    icon: 'inventory_2',
    color: 'slate',
    keywords: [
      'en lata', 'en agua', 'en aceite', 'en tomate', 'en escabeche',
      'conserva', 'bote', 'precocin', 'bolsa de arroz', 'tetrabrik',
    ],
  },
  {
    category: 'Aceites, grasas y condimentos',
    icon: 'opacity',
    color: 'teal',
    keywords: [
      'aove', 'aceite', 'vinagre', 'mostaza', 'salsa', 'ketchup',
      'mayonesa', 'aliño', 'tamari', 'miel', 'mermelada',
      'especias', 'pimienta', 'orégano', 'cúrcuma', 'canela',
    ],
  },
  {
    category: 'Frutos secos y semillas',
    icon: 'spa',
    color: 'brown',
    keywords: [
      'nuez', 'nueces', 'almendra', 'anacardo', 'pistach', 'avellana',
      'semilla', 'chía', 'lino', 'sésamo', 'cáñamo', 'cacahuete', 'piñón',
      'fruto seco',
    ],
  },
  {
    category: 'Otros',
    icon: 'grocery',
    color: 'gray',
    keywords: [],
  },
];

// ─── Parsing helpers ──────────────────────────────────────────────────────────

const AMOUNT_RE = /^(\d[\d.,]*\s*(?:g|kg|ml|l|cl|dl|unidades?|latas?|botes?|sobres?|cdas?\.?|cucharad[as]*|cucharitas?|porciones?|tazas?|rebanadas?|lonchas?|rodajas?|piezas?|tarrinas?|bolsas?|vasos?|copas?)\b)\s*/i;
// Fallback para cantidades sin palabra de unidad explícita (ej. "2 huevos
// enteros", "1 diente de ajo") — sin esto, AMOUNT_RE no las reconoce y el
// número queda enterrado en el nombre en vez de sumarse entre días.
const BARE_COUNT_RE = /^(\d+(?:[.,]\d+)?)\s+(?=\S)/;

function parseIngredient(raw: string): { amount: string; name: string } {
  const m = raw.match(AMOUNT_RE);
  if (m) return { amount: m[1].trim(), name: raw.slice(m[0].length).trim() };
  const bare = raw.match(BARE_COUNT_RE);
  if (bare) return { amount: bare[1].trim(), name: raw.slice(bare[0].length).trim() };
  return { amount: '', name: raw.trim() };
}

// Nombre a mostrar en la lista: sin las anotaciones de macros que el
// verificador nutricional añade entre paréntesis (ej. "(34.5g P, 0g HC,
// 3.75g G)") — son datos internos, no algo que la nutricionista necesite
// ver al comprar.
function cleanDisplayName(name: string): string {
  return name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[\d.,]+\s*(?:g|kg|ml|l|cl)?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categorize(normalized: string): number {
  for (let i = 0; i < CATEGORY_RULES.length - 1; i++) {
    if (CATEGORY_RULES[i].keywords.some(kw => normalized.includes(kw))) {
      return i;
    }
  }
  return CATEGORY_RULES.length - 1;
}

// ─── Amount summing ────────────────────────────────────────────────────────────

/**
 * Suma cantidades por unidad sobre un array (admite duplicados).
 * Ejemplo: ["200g", "200g", "150g"] → ["550g"]
 * Unidades distintas se mantienen separadas: ["200g", "2 unidades"] → ["200g", "2 unidades"]
 */
function sumAmounts(amounts: string[]): string[] {
  const unitTotals = new Map<string, number>();
  const unknowns: string[] = [];

  for (const amt of amounts) {
    const m = amt.match(/^([\d]+(?:[.,]\d+)?)\s*([a-záéíóúüñ%]*)/i);
    if (m) {
      const num  = parseFloat(m[1].replace(',', '.'));
      const unit = m[2].toLowerCase().trim();
      if (!isNaN(num)) {
        unitTotals.set(unit, (unitTotals.get(unit) ?? 0) + num);
      } else {
        unknowns.push(amt);
      }
    } else {
      unknowns.push(amt);
    }
  }

  const result: string[] = [];
  for (const [unit, total] of unitTotals) {
    const rounded = Number.isInteger(total) ? total : Math.round(total * 10) / 10;
    result.push(unit ? `${rounded}${unit}` : `${rounded}`);
  }
  return [...result, ...unknowns];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Genera una lista de la compra a partir de uno o varios planes de dieta.
 * Pasar varios planes (p.ej. dieta de pareja) combina y suma las cantidades.
 *
 * Uso individual: generateShoppingList(plan)
 * Uso en pareja:  generateShoppingList(planA, planB)
 */
export function generateShoppingList(...plans: DietResponse[]): ShoppingList {
  // Usamos string[] (no Set) para conservar duplicados y sumar cantidades correctamente.
  // Si el mismo ingrediente aparece lunes y miércoles, se registra dos veces y se suma.
  const seen = new Map<string, { name: string; amounts: string[]; catIdx: number }>();

  for (const plan of plans) {
    for (const day of plan.weeklyPlan) {
      for (const meal of Object.values(day.meals)) {
        if (!meal?.ingredients) continue;
        for (const rawItem of meal.ingredients) {
          const raw = typeof rawItem === 'string' ? rawItem : String(rawItem ?? '');
          if (!raw.trim()) continue;
          const { amount, name } = parseIngredient(raw);
          if (!name) continue;
          const normalized = normalizeName(name);
          if (!normalized || normalized.length < 2) continue;

          if (!seen.has(normalized)) {
            const displayName = cleanDisplayName(name);
            seen.set(normalized, {
              name: displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase(),
              amounts: [],
              catIdx: categorize(normalized),
            });
          }
          // push (no add) para conservar duplicados → sumAmounts acumula correctamente
          if (amount) seen.get(normalized)!.amounts.push(amount.toLowerCase());
        }
      }
    }
  }

  const groups = new Map<number, ShoppingItem[]>();
  for (const [, entry] of seen) {
    if (!groups.has(entry.catIdx)) groups.set(entry.catIdx, []);
    groups.get(entry.catIdx)!.push({
      name:    entry.name,
      amounts: sumAmounts(entry.amounts),
    });
  }

  return CATEGORY_RULES
    .map((rule, idx) => ({
      category: rule.category,
      icon:     rule.icon,
      color:    rule.color,
      items:    (groups.get(idx) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }))
    .filter(cat => cat.items.length > 0);
}
