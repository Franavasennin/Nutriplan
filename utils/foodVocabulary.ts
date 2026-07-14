import { CustomFood } from '../types';
import { RECIPES } from '../data/recipes';
import { QUANTITY_RE } from './planScaling';

/**
 * Vocabulario de dominio (alimentos en español) para el autocompletado de los
 * campos de texto libre donde la nutricionista escribe alimentos. Módulo puro,
 * sin React: construye la lista de nombres y ofrece la lógica de sugerencia.
 *
 * Fuentes: una lista canónica curada + los nombres extraídos de los
 * ingredientes de RECIPES (data/recipes.ts) + los alimentos personalizados
 * que la propia nutricionista ha ido creando (custom_foods).
 */

// Lista canónica de alimentos base en español (nombres completos y limpios,
// no raíces). Sembrada a partir de CATEGORY_RULES (utils/shoppingList.ts) y de
// los alimentos recurrentes en el corpus de recetas.
export const CANONICAL_FOODS: string[] = [
  // Carnes, aves y fiambres
  'pollo', 'pechuga de pollo', 'muslo de pollo', 'pavo', 'pechuga de pavo',
  'ternera', 'cerdo', 'lomo de cerdo', 'cinta de lomo', 'solomillo', 'filete',
  'conejo', 'jamón serrano', 'jamón cocido', 'jamón ibérico', 'fiambre de pavo',
  'chorizo', 'bacon', 'beicon', 'mortadela', 'salchichas', 'cordero', 'buey',
  'codorniz', 'carne picada',
  // Pescado y marisco
  'salmón', 'atún', 'merluza', 'bacalao', 'sardina', 'caballa', 'gambas',
  'calamar', 'mejillones', 'berberechos', 'pulpo', 'boquerones', 'anchoas',
  'sepia', 'rape', 'lubina', 'dorada', 'langostinos', 'cangrejo',
  'palitos de cangrejo', 'trucha', 'lenguado',
  // Huevos y lácteos
  'huevo', 'huevos', 'clara de huevo', 'yogur natural', 'yogur griego',
  'yogur griego 0%', 'leche', 'leche desnatada', 'leche semidesnatada',
  'bebida de avena', 'bebida de soja', 'queso', 'queso fresco', 'queso cottage',
  'queso parmesano', 'mozzarella', 'requesón', 'ricotta', 'kéfir', 'mantequilla',
  'nata', 'cuajada',
  // Frutas
  'manzana', 'plátano', 'naranja', 'pera', 'fresa', 'fresas', 'kiwi',
  'melocotón', 'uvas', 'sandía', 'melón', 'mandarina', 'limón', 'lima',
  'arándanos', 'frambuesas', 'ciruela', 'cerezas', 'albaricoque', 'higos',
  'mango', 'piña', 'papaya', 'granada', 'frutos rojos', 'dátiles',
  // Verduras y hortalizas
  'espinacas', 'lechuga', 'cogollos de lechuga', 'tomate', 'tomates cherry',
  'pepino', 'zanahoria', 'cebolla', 'cebolla morada', 'ajo', 'pimiento',
  'pimiento rojo', 'pimiento verde', 'calabacín', 'berenjena', 'brócoli',
  'coliflor', 'acelgas', 'apio', 'puerro', 'champiñones', 'setas', 'aguacate',
  'espárragos', 'espárragos trigueros', 'remolacha', 'rúcula', 'canónigos',
  'endibias', 'alcachofa', 'col', 'coles de bruselas', 'nabo', 'calabaza',
  'ensalada', 'cilantro', 'perejil', 'albahaca',
  // Legumbres
  'lentejas', 'garbanzos', 'alubias', 'judías', 'judías verdes', 'guisantes',
  'soja', 'edamame', 'hummus', 'tofu', 'tempeh',
  // Cereales, pan y pasta
  'arroz', 'arroz integral', 'pasta', 'pasta integral', 'avena',
  'copos de avena', 'pan', 'pan integral', 'pan de centeno', 'tortitas de arroz',
  'quinoa', 'trigo', 'espaguetis', 'macarrones', 'fideos', 'cuscús', 'bulgur',
  'mijo', 'harina', 'harina de avena', 'harina de almendra', 'harina de coco',
  'tostada', 'pan rallado',
  // Aceites, grasas y condimentos
  'aceite de oliva virgen extra', 'aceite de oliva', 'aove', 'aceite de coco',
  'vinagre', 'vinagre de manzana', 'mostaza', 'salsa de soja', 'salsa de tomate',
  'tomate triturado', 'ketchup', 'mayonesa', 'tamari', 'miel', 'mermelada',
  'sal', 'pimienta', 'orégano', 'cúrcuma', 'canela', 'comino', 'pimentón',
  'curry', 'jengibre', 'eneldo', 'romero', 'tomillo', 'nuez moscada',
  // Frutos secos y semillas
  'nueces', 'almendras', 'anacardos', 'pistachos', 'avellanas', 'semillas',
  'semillas de chía', 'semillas de lino', 'sésamo', 'cáñamo', 'cacahuetes',
  'crema de cacahuete', 'piñones', 'coco rallado', 'leche de coco',
  // Otros / proteína deportiva
  'proteína en polvo', 'proteína de suero', 'chocolate negro', 'cacao en polvo',
  'levadura', 'gelatina', 'caldo de verduras', 'caldo de pollo',
];

/**
 * Extrae el nombre del alimento de una línea de ingrediente, quitando la
 * cantidad inicial (reutilizando QUANTITY_RE) y los paréntesis finales.
 * "150g pechuga de pollo (sin piel)" -> "pechuga de pollo".
 * Si no hay un nombre limpio (queda vacío o empieza por dígito), devuelve "".
 */
export function extractFoodName(ingredient: string): string {
  let text = ingredient.trim();
  // Quitar paréntesis finales: "(100g)", "(Mercadona)", "(sin piel)".
  text = text.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  // Quitar prefijo de cantidad+unidad ("80g", "250 ml"…) si lo hay.
  const m = text.match(QUANTITY_RE);
  if (m) {
    text = m[3].trim();
  } else {
    // Quitar un número suelto inicial ("1 plátano" -> "plátano").
    text = text.replace(/^\d+(?:[.,]\d+)?\s+/, '').trim();
  }
  // Quitar "de "/"del " inicial que a veces queda tras la unidad.
  text = text.replace(/^(de|del)\s+/i, '').trim();
  if (!text || /^\d/.test(text)) return '';
  return text.toLowerCase();
}

/** Clave de comparación: minúsculas y sin acentos, para dedup y búsqueda. */
function foldKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/**
 * Construye el vocabulario completo: lista canónica + nombres de RECIPES +
 * alimentos personalizados. Deduplica sin distinguir mayúsculas ni acentos
 * (se conserva la primera forma vista, con acentos) y ordena alfabéticamente.
 */
export function buildVocabulary(customFoods: CustomFood[] = []): string[] {
  const byKey = new Map<string, string>();
  const add = (raw: string) => {
    const name = raw.trim();
    if (!name || name.length < 2) return;
    const key = foldKey(name);
    if (key && !byKey.has(key)) byKey.set(key, name);
  };

  CANONICAL_FOODS.forEach(add);
  for (const recipe of RECIPES) {
    for (const ing of recipe.ingredients) {
      add(extractFoodName(ing));
    }
  }
  for (const food of customFoods) {
    if (food?.name) add(food.name);
  }

  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Sugerencias para un término: insensible a mayúsculas y acentos. Prioriza los
 * que EMPIEZAN por el término sobre los que solo lo CONTIENEN. Capado a `limit`.
 * Término vacío -> sin sugerencias.
 */
export function suggestFoods(vocab: string[], query: string, limit = 8): string[] {
  const q = foldKey(query);
  if (!q) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of vocab) {
    const key = foldKey(name);
    if (key === q) continue; // ya escrito exacto: no sugerir lo mismo
    if (key.startsWith(q)) starts.push(name);
    else if (key.includes(q)) contains.push(name);
  }
  return [...starts, ...contains].slice(0, limit);
}
