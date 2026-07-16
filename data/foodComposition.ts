/**
 * Base de composición nutricional por alimento (valores por 100 g/ml, o por
 * unidad cuando aplica) — semilla BEDCA/USDA, mismo criterio de honestidad que
 * el resto del corpus (data/recipes.ts): no son valores de laboratorio, son
 * estimaciones razonables para recalcular cantidades equivalentes.
 *
 * Diseño data-driven: añadir un alimento nuevo es añadir UNA entrada aquí, no
 * escribir una regla de sustitución nueva. utils/equivalences.ts consume esta
 * tabla + GROUP_FALLBACKS sin conocer ningún alimento por su nombre.
 */

export type SwapGroup =
  | 'ave' | 'carne_roja_magra' | 'cerdo_magro' | 'pescado_blanco' | 'pescado_azul'
  | 'marisco' | 'huevo' | 'lacteo_proteico' | 'proteina_vegetal' | 'legumbre'
  | 'cereal' | 'tuberculo' | 'fruta' | 'verdura' | 'fruto_seco' | 'grasa' | 'lacteo';

export interface FoodComposition {
  /** Forma canónica del nombre (casa con utils/foodVocabulary.ts). */
  name: string;
  /** Variantes por las que también se puede identificar el alimento. */
  aliases?: string[];
  group: SwapGroup;
  /** Macros por 100g/100ml (o por unidad si unit === 'unidad'). */
  per100: { kcal: number; protein: number; carbs: number; fats: number };
  unit?: 'g' | 'ml' | 'unidad';
  /** Solo si unit === 'unidad': gramos aproximados de una unidad. */
  gramsPerUnit?: number;
  /** Orden dentro del grupo — 1 = primera opción ofrecida. */
  priority: number;
}

// Prioridad entre grupos: a qué grupos se puede saltar si no hay suficientes
// candidatos en el propio grupo, y en qué orden. Implementa "pollo → pavo →
// conejo → ternera antes que pescado/huevos/vegetal".
export const GROUP_FALLBACKS: Record<SwapGroup, SwapGroup[]> = {
  ave:                ['cerdo_magro', 'carne_roja_magra', 'pescado_blanco', 'marisco', 'huevo', 'proteina_vegetal'],
  carne_roja_magra:   ['ave', 'cerdo_magro', 'pescado_azul', 'marisco', 'huevo', 'proteina_vegetal'],
  cerdo_magro:        ['ave', 'carne_roja_magra', 'pescado_blanco', 'marisco', 'huevo', 'proteina_vegetal'],
  pescado_blanco:     ['pescado_azul', 'ave', 'marisco', 'huevo', 'proteina_vegetal'],
  pescado_azul:       ['pescado_blanco', 'ave', 'marisco', 'huevo', 'proteina_vegetal'],
  marisco:            ['pescado_blanco', 'pescado_azul', 'ave', 'huevo'],
  huevo:              ['lacteo_proteico', 'ave', 'proteina_vegetal', 'pescado_blanco'],
  lacteo_proteico:    ['huevo', 'proteina_vegetal'],
  proteina_vegetal:   ['legumbre', 'huevo', 'lacteo_proteico', 'ave'],
  legumbre:           ['proteina_vegetal', 'cereal'],
  cereal:             ['tuberculo', 'legumbre'],
  tuberculo:          ['cereal', 'legumbre'],
  fruta:              ['verdura'],
  verdura:            ['fruta'],
  fruto_seco:         ['grasa'],
  grasa:              ['fruto_seco'],
  lacteo:             ['lacteo_proteico'],
};

export const FOOD_COMPOSITION: FoodComposition[] = [
  // ── Aves ──
  { name: 'pechuga de pollo', aliases: ['pollo', 'filete de pollo', 'pechuga de pollo a la plancha'], group: 'ave', per100: { kcal: 110, protein: 23, carbs: 0, fats: 1.5 }, priority: 1 },
  { name: 'muslo de pollo', aliases: ['contramuslo de pollo'], group: 'ave', per100: { kcal: 175, protein: 20, carbs: 0, fats: 10 }, priority: 2 },
  { name: 'pechuga de pavo', aliases: ['pavo', 'filete de pavo'], group: 'ave', per100: { kcal: 105, protein: 24, carbs: 0, fats: 1 }, priority: 1 },
  { name: 'conejo', group: 'ave', per100: { kcal: 130, protein: 21, carbs: 0, fats: 5 }, priority: 3 },
  { name: 'codorniz', group: 'ave', per100: { kcal: 134, protein: 22, carbs: 0, fats: 5 }, priority: 4 },

  // ── Carne roja magra ──
  { name: 'ternera', aliases: ['filete de ternera', 'solomillo de ternera'], group: 'carne_roja_magra', per100: { kcal: 145, protein: 21, carbs: 0, fats: 6.5 }, priority: 1 },
  { name: 'buey', group: 'carne_roja_magra', per100: { kcal: 155, protein: 21, carbs: 0, fats: 7.5 }, priority: 2 },
  { name: 'carne picada', aliases: ['carne picada de ternera'], group: 'carne_roja_magra', per100: { kcal: 172, protein: 20, carbs: 0, fats: 10 }, priority: 3 },
  { name: 'cordero', group: 'carne_roja_magra', per100: { kcal: 200, protein: 20, carbs: 0, fats: 13 }, priority: 4 },

  // ── Cerdo magro ──
  { name: 'lomo de cerdo', aliases: ['cinta de lomo', 'solomillo de cerdo'], group: 'cerdo_magro', per100: { kcal: 145, protein: 22, carbs: 0, fats: 6 }, priority: 1 },
  { name: 'jamón cocido', aliases: ['fiambre de pavo'], group: 'cerdo_magro', per100: { kcal: 110, protein: 18, carbs: 1, fats: 4 }, priority: 2 },
  { name: 'jamón serrano', aliases: ['jamón ibérico'], group: 'cerdo_magro', per100: { kcal: 195, protein: 30, carbs: 0, fats: 8 }, priority: 3 },

  // ── Pescado blanco ──
  { name: 'merluza', group: 'pescado_blanco', per100: { kcal: 86, protein: 17, carbs: 0, fats: 2 }, priority: 1 },
  { name: 'bacalao', group: 'pescado_blanco', per100: { kcal: 82, protein: 18, carbs: 0, fats: 0.7 }, priority: 2 },
  { name: 'lubina', group: 'pescado_blanco', per100: { kcal: 97, protein: 18, carbs: 0, fats: 2.5 }, priority: 3 },
  { name: 'dorada', group: 'pescado_blanco', per100: { kcal: 100, protein: 19, carbs: 0, fats: 2.7 }, priority: 4 },
  { name: 'lenguado', group: 'pescado_blanco', per100: { kcal: 86, protein: 17, carbs: 0, fats: 1.5 }, priority: 5 },
  { name: 'rape', group: 'pescado_blanco', per100: { kcal: 76, protein: 17, carbs: 0, fats: 0.7 }, priority: 6 },

  // ── Pescado azul ──
  { name: 'salmón', aliases: ['salmón fresco', 'lomo de salmón'], group: 'pescado_azul', per100: { kcal: 208, protein: 20, carbs: 0, fats: 13 }, priority: 1 },
  { name: 'atún', aliases: ['atún fresco', 'lomo de atún'], group: 'pescado_azul', per100: { kcal: 130, protein: 25, carbs: 0, fats: 3 }, priority: 2 },
  { name: 'atún en agua', aliases: ['atún al natural', 'atún en lata'], group: 'pescado_azul', per100: { kcal: 116, protein: 26, carbs: 0, fats: 1 }, priority: 3 },
  { name: 'sardina', group: 'pescado_azul', per100: { kcal: 158, protein: 20, carbs: 0, fats: 9 }, priority: 4 },
  { name: 'caballa', group: 'pescado_azul', per100: { kcal: 205, protein: 19, carbs: 0, fats: 14 }, priority: 5 },
  { name: 'trucha', group: 'pescado_azul', per100: { kcal: 148, protein: 21, carbs: 0, fats: 6.6 }, priority: 6 },
  { name: 'boquerones', aliases: ['boquerón', 'anchoas'], group: 'pescado_azul', per100: { kcal: 131, protein: 20, carbs: 0, fats: 5 }, priority: 7 },

  // ── Marisco ──
  { name: 'gambas', aliases: ['langostinos'], group: 'marisco', per100: { kcal: 85, protein: 18, carbs: 0.9, fats: 1 }, priority: 1 },
  { name: 'calamar', aliases: ['sepia'], group: 'marisco', per100: { kcal: 92, protein: 15, carbs: 3, fats: 1.4 }, priority: 2 },
  { name: 'mejillones', group: 'marisco', per100: { kcal: 86, protein: 12, carbs: 3.7, fats: 2.2 }, priority: 3 },
  { name: 'pulpo', group: 'marisco', per100: { kcal: 82, protein: 15, carbs: 2.2, fats: 1 }, priority: 4 },

  // ── Huevo ──
  { name: 'huevo', aliases: ['huevos', 'huevo entero'], group: 'huevo', per100: { kcal: 155, protein: 13, carbs: 1.1, fats: 11 }, unit: 'unidad', gramsPerUnit: 55, priority: 1 },
  { name: 'clara de huevo', group: 'huevo', per100: { kcal: 52, protein: 11, carbs: 0.7, fats: 0.2 }, priority: 2 },

  // ── Lácteo proteico ──
  { name: 'yogur griego', aliases: ['yogur griego 0%', 'yogur griego natural'], group: 'lacteo_proteico', per100: { kcal: 59, protein: 10, carbs: 3.6, fats: 0.4 }, priority: 1 },
  { name: 'requesón', group: 'lacteo_proteico', per100: { kcal: 98, protein: 11, carbs: 3.4, fats: 4.3 }, priority: 2 },
  { name: 'queso cottage', group: 'lacteo_proteico', per100: { kcal: 98, protein: 11, carbs: 3.4, fats: 4.3 }, priority: 3 },
  { name: 'queso fresco', group: 'lacteo_proteico', per100: { kcal: 174, protein: 13, carbs: 3.5, fats: 12 }, priority: 4 },

  // ── Proteína vegetal ──
  { name: 'tofu', group: 'proteina_vegetal', per100: { kcal: 76, protein: 8, carbs: 1.9, fats: 4.8 }, priority: 1 },
  { name: 'tempeh', group: 'proteina_vegetal', per100: { kcal: 190, protein: 19, carbs: 9, fats: 11 }, priority: 2 },
  { name: 'seitán', aliases: ['seitan'], group: 'proteina_vegetal', per100: { kcal: 120, protein: 25, carbs: 4, fats: 1.9 }, priority: 3 },
  { name: 'edamame', group: 'proteina_vegetal', per100: { kcal: 122, protein: 11, carbs: 8, fats: 5 }, priority: 4 },
  { name: 'proteína de suero', aliases: ['proteína en polvo'], group: 'proteina_vegetal', per100: { kcal: 380, protein: 80, carbs: 8, fats: 6 }, priority: 5 },

  // ── Legumbre ──
  { name: 'lentejas', group: 'legumbre', per100: { kcal: 116, protein: 9, carbs: 20, fats: 0.4 }, priority: 1 },
  { name: 'garbanzos', group: 'legumbre', per100: { kcal: 121, protein: 8, carbs: 20, fats: 2.1 }, priority: 2 },
  { name: 'alubias', aliases: ['judías blancas'], group: 'legumbre', per100: { kcal: 114, protein: 8, carbs: 20, fats: 0.5 }, priority: 3 },
  { name: 'guisantes', group: 'legumbre', per100: { kcal: 81, protein: 5.4, carbs: 14, fats: 0.4 }, priority: 4 },

  // ── Cereal ──
  { name: 'arroz', aliases: ['arroz blanco'], group: 'cereal', per100: { kcal: 130, protein: 2.7, carbs: 28, fats: 0.3 }, priority: 1 },
  { name: 'arroz integral', group: 'cereal', per100: { kcal: 123, protein: 2.6, carbs: 26, fats: 1 }, priority: 2 },
  { name: 'pasta', aliases: ['pasta cocida'], group: 'cereal', per100: { kcal: 131, protein: 5, carbs: 25, fats: 1.1 }, priority: 3 },
  { name: 'pasta integral', group: 'cereal', per100: { kcal: 124, protein: 5.3, carbs: 25, fats: 1.1 }, priority: 4 },
  { name: 'quinoa', group: 'cereal', per100: { kcal: 120, protein: 4.4, carbs: 21, fats: 1.9 }, priority: 5 },
  { name: 'avena', aliases: ['copos de avena'], group: 'cereal', per100: { kcal: 389, protein: 17, carbs: 66, fats: 7 }, priority: 6 },
  { name: 'pan integral', group: 'cereal', per100: { kcal: 247, protein: 10, carbs: 41, fats: 3.4 }, priority: 7 },
  { name: 'cuscús', group: 'cereal', per100: { kcal: 112, protein: 3.8, carbs: 23, fats: 0.2 }, priority: 8 },

  // ── Tubérculo ──
  { name: 'patata', aliases: ['patatas'], group: 'tuberculo', per100: { kcal: 77, protein: 2, carbs: 17, fats: 0.1 }, priority: 1 },
  { name: 'boniato', aliases: ['batata'], group: 'tuberculo', per100: { kcal: 86, protein: 1.6, carbs: 20, fats: 0.1 }, priority: 2 },
  { name: 'coliflor', group: 'tuberculo', per100: { kcal: 25, protein: 2, carbs: 5, fats: 0.3 }, priority: 3 },

  // ── Fruta ──
  { name: 'plátano', group: 'fruta', per100: { kcal: 89, protein: 1.1, carbs: 23, fats: 0.3 }, priority: 1 },
  { name: 'manzana', group: 'fruta', per100: { kcal: 52, protein: 0.3, carbs: 14, fats: 0.2 }, priority: 2 },
  { name: 'pera', group: 'fruta', per100: { kcal: 57, protein: 0.4, carbs: 15, fats: 0.1 }, priority: 3 },
  { name: 'naranja', group: 'fruta', per100: { kcal: 47, protein: 0.9, carbs: 12, fats: 0.1 }, priority: 4 },
  { name: 'fresas', group: 'fruta', per100: { kcal: 32, protein: 0.7, carbs: 7.7, fats: 0.3 }, priority: 5 },
  { name: 'frutos rojos', group: 'fruta', per100: { kcal: 45, protein: 0.8, carbs: 10, fats: 0.4 }, priority: 6 },
  { name: 'kiwi', group: 'fruta', per100: { kcal: 61, protein: 1.1, carbs: 15, fats: 0.5 }, priority: 7 },

  // ── Verdura ──
  { name: 'brócoli', group: 'verdura', per100: { kcal: 34, protein: 2.8, carbs: 7, fats: 0.4 }, priority: 1 },
  { name: 'espinacas', group: 'verdura', per100: { kcal: 23, protein: 2.9, carbs: 3.6, fats: 0.4 }, priority: 2 },
  { name: 'calabacín', group: 'verdura', per100: { kcal: 17, protein: 1.2, carbs: 3.1, fats: 0.3 }, priority: 3 },
  { name: 'berenjena', group: 'verdura', per100: { kcal: 25, protein: 1, carbs: 6, fats: 0.2 }, priority: 4 },
  { name: 'tomate', group: 'verdura', per100: { kcal: 18, protein: 0.9, carbs: 3.9, fats: 0.2 }, priority: 5 },
  { name: 'pimiento', aliases: ['pimiento rojo', 'pimiento verde'], group: 'verdura', per100: { kcal: 31, protein: 1, carbs: 6, fats: 0.3 }, priority: 6 },

  // ── Fruto seco ──
  { name: 'almendras', group: 'fruto_seco', per100: { kcal: 579, protein: 21, carbs: 22, fats: 50 }, priority: 1 },
  { name: 'nueces', group: 'fruto_seco', per100: { kcal: 654, protein: 15, carbs: 14, fats: 65 }, priority: 2 },
  { name: 'pistachos', group: 'fruto_seco', per100: { kcal: 560, protein: 20, carbs: 28, fats: 45 }, priority: 3 },
  { name: 'anacardos', group: 'fruto_seco', per100: { kcal: 553, protein: 18, carbs: 30, fats: 44 }, priority: 4 },
  { name: 'avellanas', group: 'fruto_seco', per100: { kcal: 628, protein: 15, carbs: 17, fats: 61 }, priority: 5 },
  { name: 'cacahuetes', group: 'fruto_seco', per100: { kcal: 567, protein: 26, carbs: 16, fats: 49 }, priority: 6 },

  // ── Grasa ──
  { name: 'aceite de oliva virgen extra', aliases: ['aceite de oliva', 'aove'], group: 'grasa', per100: { kcal: 884, protein: 0, carbs: 0, fats: 100 }, unit: 'ml', priority: 1 },
  { name: 'aguacate', group: 'grasa', per100: { kcal: 160, protein: 2, carbs: 8.5, fats: 14.7 }, priority: 2 },
  { name: 'aceite de coco', group: 'grasa', per100: { kcal: 862, protein: 0, carbs: 0, fats: 99 }, unit: 'ml', priority: 3 },
  { name: 'mantequilla', group: 'grasa', per100: { kcal: 717, protein: 0.9, carbs: 0.1, fats: 81 }, priority: 4 },

  // ── Lácteo (no proteico, para completar) ──
  { name: 'leche desnatada', group: 'lacteo', per100: { kcal: 35, protein: 3.4, carbs: 5, fats: 0.1 }, unit: 'ml', priority: 1 },
  { name: 'leche semidesnatada', group: 'lacteo', per100: { kcal: 46, protein: 3.3, carbs: 4.8, fats: 1.6 }, unit: 'ml', priority: 2 },
  { name: 'queso parmesano', group: 'lacteo', per100: { kcal: 392, protein: 35, carbs: 3.2, fats: 26 }, priority: 3 },
  { name: 'mozzarella', group: 'lacteo', per100: { kcal: 280, protein: 22, carbs: 2, fats: 22 }, priority: 4 },
];
