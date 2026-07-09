import { DietResponse, Allergen, ALLERGEN_KEYWORDS } from '../types';

// ─── Alérgenos en la lista de la compra (MEJORA-001, iteración 001) ───────────
// Coincidencia simple por palabra clave (no NLP) — ver
// docs/loop/iteracion-001/MEJORA-001.md, no-alcance.
export function findMatchingAllergens(ingredientName: string, declaredAllergens: Allergen[]): Allergen[] {
  if (!declaredAllergens.length) return [];
  const lower = ingredientName.toLowerCase();
  return declaredAllergens.filter(a => ALLERGEN_KEYWORDS[a].some(keyword => lower.includes(keyword)));
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

function parseIngredient(raw: string): { amount: string; name: string } {
  const m = raw.match(AMOUNT_RE);
  if (m) return { amount: m[1].trim(), name: raw.slice(m[0].length).trim() };
  return { amount: '', name: raw.trim() };
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
            seen.set(normalized, {
              name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
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
