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
  { name: 'pechuga de pollo', aliases: ['pollo', 'filete de pollo', 'pechuga de pollo a la plancha', 'pechuga fileteada'], group: 'ave', per100: { kcal: 110, protein: 23, carbs: 0, fats: 1.5 }, priority: 1 },
  { name: 'muslo de pollo', aliases: ['contramuslo de pollo', 'cuartos traseros de pollo'], group: 'ave', per100: { kcal: 175, protein: 20, carbs: 0, fats: 10 }, priority: 2 },
  { name: 'pechuga de pavo', aliases: ['pavo', 'filete de pavo'], group: 'ave', per100: { kcal: 105, protein: 24, carbs: 0, fats: 1 }, priority: 1 },
  { name: 'conejo', group: 'ave', per100: { kcal: 130, protein: 21, carbs: 0, fats: 5 }, priority: 3 },
  { name: 'codorniz', group: 'ave', per100: { kcal: 134, protein: 22, carbs: 0, fats: 5 }, priority: 4 },
  // Añadidos desde BasedatosWeb.xlsx (AESAN 2022, productos reales del
  // mercado español) — medianas por denominación legal, no un producto único.
  { name: 'jamoncitos de pollo', group: 'ave', per100: { kcal: 122, protein: 18.9, carbs: 0.2, fats: 5.2 }, priority: 5 },
  { name: 'alas de pollo', group: 'ave', per100: { kcal: 186, protein: 18, carbs: 0, fats: 12.2 }, priority: 6 },
  { name: 'hígado de pollo', group: 'ave', per100: { kcal: 132, protein: 16, carbs: 1, fats: 7.1 }, priority: 7 },

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
  { name: 'lenguado', aliases: ['limanda'], group: 'pescado_blanco', per100: { kcal: 86, protein: 17, carbs: 0, fats: 1.5 }, priority: 5 },
  { name: 'rape', group: 'pescado_blanco', per100: { kcal: 76, protein: 17, carbs: 0, fats: 0.7 }, priority: 6 },
  // Añadidos desde la tabla Novartis (tabla de composición que usaba la
  // nutricionista antes de este programa) — mismo criterio de peso en fresco.
  { name: 'gallo', group: 'pescado_blanco', per100: { kcal: 73, protein: 16, carbs: 0, fats: 1 }, priority: 7 },
  { name: 'congrio', group: 'pescado_blanco', per100: { kcal: 112, protein: 20, carbs: 0, fats: 3 }, priority: 8 },
  { name: 'mero', group: 'pescado_blanco', per100: { kcal: 118, protein: 16, carbs: 0, fats: 6 }, priority: 9 },
  { name: 'rodaballo', group: 'pescado_blanco', per100: { kcal: 102, protein: 16.1, carbs: 0, fats: 3.6 }, priority: 10 },
  { name: 'pescadilla', group: 'pescado_blanco', per100: { kcal: 72, protein: 16, carbs: 0, fats: 0.6 }, priority: 11 },
  { name: 'abadejo', aliases: ['bacaladilla'], group: 'pescado_blanco', per100: { kcal: 76, protein: 17.4, carbs: 0, fats: 0.7 }, priority: 12 },
  { name: 'raya', group: 'pescado_blanco', per100: { kcal: 79, protein: 17.1, carbs: 0, fats: 0.9 }, priority: 13 },
  { name: 'panga', group: 'pescado_blanco', per100: { kcal: 64, protein: 12.4, carbs: 0, fats: 1.2 }, priority: 14 },
  { name: 'tilapia', group: 'pescado_blanco', per100: { kcal: 69, protein: 15, carbs: 1, fats: 1 }, priority: 15 },

  // ── Pescado azul ──
  { name: 'salmón', aliases: ['salmón fresco', 'lomo de salmón'], group: 'pescado_azul', per100: { kcal: 208, protein: 20, carbs: 0, fats: 13 }, priority: 1 },
  { name: 'atún', aliases: ['atún fresco', 'lomo de atún'], group: 'pescado_azul', per100: { kcal: 130, protein: 25, carbs: 0, fats: 3 }, priority: 2 },
  { name: 'atún en agua', aliases: ['atún al natural', 'atún en lata'], group: 'pescado_azul', per100: { kcal: 116, protein: 26, carbs: 0, fats: 1 }, priority: 3 },
  { name: 'sardina', group: 'pescado_azul', per100: { kcal: 158, protein: 20, carbs: 0, fats: 9 }, priority: 4 },
  { name: 'caballa', group: 'pescado_azul', per100: { kcal: 205, protein: 19, carbs: 0, fats: 14 }, priority: 5 },
  { name: 'trucha', group: 'pescado_azul', per100: { kcal: 148, protein: 21, carbs: 0, fats: 6.6 }, priority: 6 },
  { name: 'boquerones', aliases: ['boquerón', 'anchoas'], group: 'pescado_azul', per100: { kcal: 131, protein: 20, carbs: 0, fats: 5 }, priority: 7 },
  { name: 'jurel', aliases: ['chicharro'], group: 'pescado_azul', per100: { kcal: 127, protein: 15.7, carbs: 0, fats: 6.8 }, priority: 8 },
  { name: 'palometa', group: 'pescado_azul', per100: { kcal: 125, protein: 20, carbs: 0, fats: 5 }, priority: 9 },
  { name: 'bonito', aliases: ['bonito del norte'], group: 'pescado_azul', per100: { kcal: 140, protein: 26, carbs: 0.7, fats: 4 }, priority: 10 },
  { name: 'pez espada', aliases: ['emperador'], group: 'pescado_azul', per100: { kcal: 116, protein: 18, carbs: 0.6, fats: 4.7 }, priority: 11 },

  // ── Marisco ──
  { name: 'gambas', aliases: ['langostinos'], group: 'marisco', per100: { kcal: 85, protein: 18, carbs: 0.9, fats: 1 }, priority: 1 },
  { name: 'calamar', aliases: ['sepia'], group: 'marisco', per100: { kcal: 92, protein: 15, carbs: 3, fats: 1.4 }, priority: 2 },
  { name: 'mejillones', group: 'marisco', per100: { kcal: 86, protein: 12, carbs: 3.7, fats: 2.2 }, priority: 3 },
  { name: 'pulpo', group: 'marisco', per100: { kcal: 82, protein: 15, carbs: 2.2, fats: 1 }, priority: 4 },
  { name: 'vieira', group: 'marisco', per100: { kcal: 84, protein: 19, carbs: 0, fats: 0.9 }, priority: 5 },
  { name: 'almejas', aliases: ['chirlas', 'coquinas'], group: 'marisco', per100: { kcal: 50, protein: 11, carbs: 0, fats: 0.9 }, priority: 6 },
  { name: 'cigala', group: 'marisco', per100: { kcal: 67, protein: 15, carbs: 0, fats: 0.8 }, priority: 7 },
  { name: 'langosta', aliases: ['bogavante'], group: 'marisco', per100: { kcal: 67, protein: 15, carbs: 0, fats: 0.8 }, priority: 8 },
  { name: 'centollo', group: 'marisco', per100: { kcal: 127, protein: 20.1, carbs: 0, fats: 5.2 }, priority: 9 },
  { name: 'ostras', group: 'marisco', per100: { kcal: 80, protein: 10, carbs: 6, fats: 1.8 }, priority: 10 },
  { name: 'pota', aliases: ['potón'], group: 'marisco', per100: { kcal: 50, protein: 10, carbs: 0.6, fats: 0.6 }, priority: 11 },

  // ── Huevo ──
  { name: 'huevo', aliases: ['huevos', 'huevo entero'], group: 'huevo', per100: { kcal: 155, protein: 13, carbs: 1.1, fats: 11 }, unit: 'unidad', gramsPerUnit: 55, priority: 1 },
  { name: 'clara de huevo', group: 'huevo', per100: { kcal: 52, protein: 11, carbs: 0.7, fats: 0.2 }, priority: 2 },
  { name: 'huevo de codorniz', aliases: ['huevos de codorniz'], group: 'huevo', per100: { kcal: 163, protein: 11.2, carbs: 0.4, fats: 13 }, priority: 3 },

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
  // Análogos cárnicos reales de mercado (BasedatosWeb.xlsx, AESAN 2022) --
  // hueco que no cubría ningún alimento anterior (tofu/tempeh/seitán son
  // ingredientes sin procesar, no productos ya formados tipo hamburguesa).
  { name: 'hamburguesa vegetal', aliases: ['burger vegetal', 'hamburguesa de soja'], group: 'proteina_vegetal', per100: { kcal: 191, protein: 12, carbs: 14, fats: 9 }, priority: 6 },
  { name: 'salchicha vegetal', group: 'proteina_vegetal', per100: { kcal: 250, protein: 17.5, carbs: 6.2, fats: 17 }, priority: 7 },
  { name: 'albóndigas vegetales', group: 'proteina_vegetal', per100: { kcal: 201, protein: 19.4, carbs: 8.2, fats: 10 }, priority: 8 },

  // ── Legumbre ──
  { name: 'lentejas', group: 'legumbre', per100: { kcal: 116, protein: 9, carbs: 20, fats: 0.4 }, priority: 1 },
  { name: 'garbanzos', group: 'legumbre', per100: { kcal: 121, protein: 8, carbs: 20, fats: 2.1 }, priority: 2 },
  { name: 'alubias', aliases: ['judías blancas'], group: 'legumbre', per100: { kcal: 114, protein: 8, carbs: 20, fats: 0.5 }, priority: 3 },
  { name: 'guisantes', group: 'legumbre', per100: { kcal: 81, protein: 5.4, carbs: 14, fats: 0.4 }, priority: 4 },
  // Habas frescas/congeladas (no secas) -- mismo criterio de peso que el
  // resto del grupo (BasedatosWeb.xlsx, AESAN 2022).
  { name: 'habas', group: 'legumbre', per100: { kcal: 70, protein: 5.8, carbs: 7.2, fats: 0.6 }, priority: 5 },

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
  { name: 'yuca', group: 'tuberculo', per100: { kcal: 163, protein: 1, carbs: 39.5, fats: 0.1 }, priority: 4 },

  // ── Fruta ──
  { name: 'plátano', group: 'fruta', per100: { kcal: 89, protein: 1.1, carbs: 23, fats: 0.3 }, priority: 1 },
  { name: 'manzana', group: 'fruta', per100: { kcal: 52, protein: 0.3, carbs: 14, fats: 0.2 }, priority: 2 },
  { name: 'pera', group: 'fruta', per100: { kcal: 57, protein: 0.4, carbs: 15, fats: 0.1 }, priority: 3 },
  { name: 'naranja', group: 'fruta', per100: { kcal: 47, protein: 0.9, carbs: 12, fats: 0.1 }, priority: 4 },
  { name: 'fresas', group: 'fruta', per100: { kcal: 32, protein: 0.7, carbs: 7.7, fats: 0.3 }, priority: 5 },
  { name: 'frutos rojos', group: 'fruta', per100: { kcal: 45, protein: 0.8, carbs: 10, fats: 0.4 }, priority: 6 },
  { name: 'kiwi', group: 'fruta', per100: { kcal: 61, protein: 1.1, carbs: 15, fats: 0.5 }, priority: 7 },
  { name: 'albaricoque', group: 'fruta', per100: { kcal: 44, protein: 0.8, carbs: 10, fats: 0.1 }, priority: 8 },
  { name: 'cerezas', group: 'fruta', per100: { kcal: 77, protein: 1.2, carbs: 17, fats: 0.5 }, priority: 9 },
  { name: 'ciruela', group: 'fruta', per100: { kcal: 44, protein: 0.8, carbs: 10, fats: 0.1 }, priority: 10 },
  { name: 'granada', group: 'fruta', per100: { kcal: 65, protein: 0.73, carbs: 14.8, fats: 0.33 }, priority: 11 },
  { name: 'higo', aliases: ['higos'], group: 'fruta', per100: { kcal: 80, protein: 1, carbs: 18, fats: 0.1 }, priority: 12 },
  { name: 'mandarina', group: 'fruta', per100: { kcal: 40, protein: 0.8, carbs: 9, fats: 0.1 }, priority: 13 },
  { name: 'mango', group: 'fruta', per100: { kcal: 64, protein: 0.5, carbs: 15.3, fats: 0.1 }, priority: 14 },
  { name: 'melocotón', group: 'fruta', per100: { kcal: 52, protein: 0.5, carbs: 12, fats: 0.1 }, priority: 15 },
  { name: 'melón', group: 'fruta', per100: { kcal: 31, protein: 0.8, carbs: 6.5, fats: 0.2 }, priority: 16 },
  { name: 'nectarina', group: 'fruta', per100: { kcal: 64, protein: 0.6, carbs: 17.1, fats: 0.1 }, priority: 17 },
  { name: 'papaya', group: 'fruta', per100: { kcal: 45, protein: 0.6, carbs: 10.3, fats: 0.2 }, priority: 18 },
  { name: 'piña', group: 'fruta', per100: { kcal: 51, protein: 0.5, carbs: 12, fats: 0.2 }, priority: 19 },
  { name: 'pomelo', group: 'fruta', per100: { kcal: 30, protein: 0.6, carbs: 6, fats: 0.3 }, priority: 20 },
  { name: 'sandía', group: 'fruta', per100: { kcal: 30, protein: 0.4, carbs: 6.7, fats: 0.2 }, priority: 21 },
  { name: 'uva', aliases: ['uvas'], group: 'fruta', per100: { kcal: 81, protein: 1, carbs: 17, fats: 1 }, priority: 22 },
  { name: 'kaki', aliases: ['caqui'], group: 'fruta', per100: { kcal: 77, protein: 0.7, carbs: 19.7, fats: 0.2 }, priority: 23 },

  // ── Verdura ──
  { name: 'brócoli', group: 'verdura', per100: { kcal: 34, protein: 2.8, carbs: 7, fats: 0.4 }, priority: 1 },
  { name: 'espinacas', group: 'verdura', per100: { kcal: 23, protein: 2.9, carbs: 3.6, fats: 0.4 }, priority: 2 },
  { name: 'calabacín', group: 'verdura', per100: { kcal: 17, protein: 1.2, carbs: 3.1, fats: 0.3 }, priority: 3 },
  { name: 'berenjena', group: 'verdura', per100: { kcal: 25, protein: 1, carbs: 6, fats: 0.2 }, priority: 4 },
  { name: 'tomate', group: 'verdura', per100: { kcal: 18, protein: 0.9, carbs: 3.9, fats: 0.2 }, priority: 5 },
  // Los valores por 100g son los del pimiento rojo (bastante más calórico que
  // el verde, ~20kcal) — nombre canónico específico para no ofrecer una
  // alternativa ambigua ("¿verde o rojo?"). Las variantes de texto de un plan
  // ya escrito ("pimiento", "pimiento verde") se siguen reconociendo vía alias.
  { name: 'pimiento rojo', aliases: ['pimiento', 'pimiento verde'], group: 'verdura', per100: { kcal: 31, protein: 1, carbs: 6, fats: 0.3 }, priority: 6 },
  { name: 'acelgas', group: 'verdura', per100: { kcal: 33, protein: 2, carbs: 5, fats: 0.6 }, priority: 7 },
  { name: 'alcachofas', group: 'verdura', per100: { kcal: 64, protein: 3.4, carbs: 12, fats: 0.3 }, priority: 8 },
  { name: 'apio', group: 'verdura', per100: { kcal: 20, protein: 1.3, carbs: 3.7, fats: 0.2 }, priority: 9 },
  { name: 'cebolla', group: 'verdura', per100: { kcal: 47, protein: 1.4, carbs: 10, fats: 0.2 }, priority: 10 },
  { name: 'endibias', group: 'verdura', per100: { kcal: 22, protein: 1.5, carbs: 4, fats: 0.1 }, priority: 11 },
  { name: 'escarola', group: 'verdura', per100: { kcal: 37, protein: 1.5, carbs: 4, fats: 0.3 }, priority: 12 },
  { name: 'espárragos', aliases: ['espárragos trigueros'], group: 'verdura', per100: { kcal: 26, protein: 2.2, carbs: 3.9, fats: 0.2 }, priority: 13 },
  { name: 'judías verdes', aliases: ['judía verde', 'habichuelas'], group: 'verdura', per100: { kcal: 39, protein: 2.4, carbs: 7, fats: 0.2 }, priority: 14 },
  { name: 'lechuga', group: 'verdura', per100: { kcal: 18, protein: 1.2, carbs: 2.9, fats: 0.2 }, priority: 15 },
  { name: 'puerro', aliases: ['puerros'], group: 'verdura', per100: { kcal: 42, protein: 2, carbs: 7.5, fats: 0.4 }, priority: 16 },
  { name: 'rábano', group: 'verdura', per100: { kcal: 20, protein: 1.2, carbs: 4.2, fats: 0.1 }, priority: 17 },
  { name: 'remolacha', group: 'verdura', per100: { kcal: 40, protein: 1.6, carbs: 8, fats: 0.1 }, priority: 18 },
  { name: 'zanahoria', group: 'verdura', per100: { kcal: 42, protein: 1.2, carbs: 9, fats: 0.3 }, priority: 19 },
  // Añadidos desde BasedatosWeb.xlsx (AESAN 2022) — mediana por alimento
  // genérico entre variantes de mercado (fresco/congelado/troceado).
  { name: 'canónigos', aliases: ['canónigo', 'canonges'], group: 'verdura', per100: { kcal: 27, protein: 2.2, carbs: 1.8, fats: 0.5 }, priority: 20 },
  { name: 'rúcula', group: 'verdura', per100: { kcal: 28, protein: 2.7, carbs: 1.3, fats: 0.6 }, priority: 21 },
  { name: 'champiñones', aliases: ['champiñón', 'setas', 'setas cultivadas'], group: 'verdura', per100: { kcal: 22, protein: 2.6, carbs: 4, fats: 0.3 }, priority: 22 },
  { name: 'col de bruselas', aliases: ['coles de bruselas'], group: 'verdura', per100: { kcal: 44, protein: 3.5, carbs: 4.2, fats: 0.5 }, priority: 23 },

  // ── Fruto seco ──
  { name: 'almendras', group: 'fruto_seco', per100: { kcal: 579, protein: 21, carbs: 22, fats: 50 }, priority: 1 },
  { name: 'nueces', group: 'fruto_seco', per100: { kcal: 654, protein: 15, carbs: 14, fats: 65 }, priority: 2 },
  { name: 'pistachos', group: 'fruto_seco', per100: { kcal: 560, protein: 20, carbs: 28, fats: 45 }, priority: 3 },
  { name: 'anacardos', group: 'fruto_seco', per100: { kcal: 553, protein: 18, carbs: 30, fats: 44 }, priority: 4 },
  { name: 'avellanas', group: 'fruto_seco', per100: { kcal: 628, protein: 15, carbs: 17, fats: 61 }, priority: 5 },
  { name: 'cacahuetes', group: 'fruto_seco', per100: { kcal: 567, protein: 26, carbs: 16, fats: 49 }, priority: 6 },
  { name: 'castañas', group: 'fruto_seco', per100: { kcal: 199, protein: 4, carbs: 40, fats: 2.6 }, priority: 7 },

  // ── Grasa ──
  { name: 'aceite de oliva virgen extra', aliases: ['aceite de oliva', 'aove'], group: 'grasa', per100: { kcal: 884, protein: 0, carbs: 0, fats: 100 }, unit: 'ml', priority: 1 },
  { name: 'aguacate', group: 'grasa', per100: { kcal: 160, protein: 2, carbs: 8.5, fats: 14.7 }, priority: 2 },
  { name: 'aceite de coco', group: 'grasa', per100: { kcal: 862, protein: 0, carbs: 0, fats: 99 }, unit: 'ml', priority: 3 },
  { name: 'mantequilla', group: 'grasa', per100: { kcal: 717, protein: 0.9, carbs: 0.1, fats: 81 }, priority: 4 },
  { name: 'aceite de girasol', group: 'grasa', per100: { kcal: 900, protein: 0, carbs: 0, fats: 100 }, unit: 'ml', priority: 5 },
  // Coco (pulpa) va en "grasa", no en "fruta": su macro dominante es la grasa
  // (misma razón que el aguacate), no el carbohidrato.
  { name: 'coco', group: 'grasa', per100: { kcal: 357, protein: 3.3, carbs: 15, fats: 32 }, priority: 6 },

  // ── Lácteo (no proteico, para completar) ──
  { name: 'leche desnatada', group: 'lacteo', per100: { kcal: 35, protein: 3.4, carbs: 5, fats: 0.1 }, unit: 'ml', priority: 1 },
  { name: 'leche semidesnatada', group: 'lacteo', per100: { kcal: 46, protein: 3.3, carbs: 4.8, fats: 1.6 }, unit: 'ml', priority: 2 },
  { name: 'queso parmesano', group: 'lacteo', per100: { kcal: 392, protein: 35, carbs: 3.2, fats: 26 }, priority: 3 },
  { name: 'mozzarella', group: 'lacteo', per100: { kcal: 280, protein: 22, carbs: 2, fats: 22 }, priority: 4 },
];
