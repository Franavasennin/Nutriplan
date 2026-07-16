/**
 * Reglas de sustitución fijas y lista de intercambio de fruta de Ester Correa
 * (recomendacionmes.docx, documento que ya enviaba a sus pacientes antes de
 * este programa). A diferencia del motor genérico de utils/equivalences.ts
 * (que iguala el macro dominante y aplica una tolerancia calórica/de ración),
 * estas son decisiones clínicas suyas ya tomadas — se respetan tal cual, sin
 * recalcular ni filtrar por tolerancia. utils/equivalences.ts las consulta
 * antes de calcular nada por su cuenta.
 */

export interface FixedSubstitutionRule {
  /** Alimento origen (debe casar con data/foodComposition.ts por nombre/alias). */
  from: string;
  /** Alimento sustituto (debe existir en data/foodComposition.ts). */
  to: string;
  /** Ajuste de gramos frente al original — 0 = misma cantidad, -20 = 20g menos. */
  gramsAdjustment: number;
}

export const FIXED_SUBSTITUTION_RULES: FixedSubstitutionRule[] = [
  { from: 'patata', to: 'boniato', gramsAdjustment: -20 },
  { from: 'quinoa', to: 'arroz', gramsAdjustment: -20 },
  { from: 'yogur griego', to: 'requesón', gramsAdjustment: 0 },
  { from: 'yogur griego', to: 'queso batido', gramsAdjustment: 0 },
  { from: 'yogur griego', to: 'queso fresco', gramsAdjustment: 0 }, // "queso burgos" (alias)
  { from: 'avena', to: 'muesli', gramsAdjustment: 0 },
  { from: 'granola', to: 'muesli', gramsAdjustment: 0 },
  // NOTA: "proteína en polvo -> queso batido" (documento original) se
  // descarta deliberadamente — el documento no especifica el ajuste de
  // cantidad, y aplicarla en la misma cantidad de gramos sería engañoso
  // (30g de proteína en polvo son ~114kcal; 30g de queso batido son ~14kcal,
  // una diferencia demasiado grande para presentarla como "igual cantidad").
];

/**
 * Grupos de intercambio de fruta: raciones que la nutricionista considera
 * equivalentes entre sí ("1 ración de fruta"), independientemente de la
 * desviación calórica exacta entre ellas. Solo se aplica cuando la cantidad
 * real del ingrediente ronda la ración de esta lista (ver equivalences.ts).
 */
export interface FixedFruitPortion {
  name: string;
  grams: number;
  label: string;
}

export const FIXED_FRUIT_PORTIONS: FixedFruitPortion[] = [
  { name: 'naranja', grams: 150, label: '1 naranja' },
  { name: 'melocotón', grams: 150, label: '1 melocotón' },
  { name: 'pera', grams: 180, label: '1 pera' },
  { name: 'manzana', grams: 180, label: '1 manzana' },
  { name: 'plátano', grams: 120, label: '1 plátano mediano' },
  { name: 'piña', grams: 150, label: '2 rodajas de piña' },
  { name: 'mandarina', grams: 160, label: '2 mandarinas' },
  { name: 'kiwi', grams: 140, label: '2 kiwis' },
  { name: 'ciruela', grams: 120, label: '2 ciruelas' },
  { name: 'higo', grams: 100, label: '2 higos' },
  { name: 'albaricoque', grams: 120, label: '3 albaricoques' },
  { name: 'fresas', grams: 200, label: '200g fresas' },
  { name: 'frutos rojos', grams: 200, label: '200g frambuesas/arándanos' },
  { name: 'melón', grams: 200, label: '200g melón' },
  { name: 'sandía', grams: 200, label: '200g sandía' },
  { name: 'cerezas', grams: 100, label: '100g cerezas' },
  { name: 'uva', grams: 100, label: '100g uvas' },
];

/**
 * Criterio de verduras de la nutricionista: cuáles considera "sin límite"
 * (se pueden comer con total libertad) y cuáles "con moderación" (máximo
 * VEGETABLE_MODERATE_MAX_GRAMS al día). Puramente informativo -- no altera
 * ningún cálculo del motor de equivalencias, solo se muestra como guía en el
 * portal del paciente.
 */
export type VegetablePortionCriterion = 'sin_limite' | 'con_moderacion';

export interface VegetablePortionGuidance {
  name: string;
  criterion: VegetablePortionCriterion;
}

export const VEGETABLE_MODERATE_MAX_GRAMS = 200;

export const VEGETABLE_PORTION_GUIDANCE: VegetablePortionGuidance[] = [
  // Sin límite
  { name: 'acedera', criterion: 'sin_limite' },
  { name: 'acelga', criterion: 'sin_limite' },
  { name: 'apio', criterion: 'sin_limite' },
  { name: 'apio nabo', criterion: 'sin_limite' },
  { name: 'berros', criterion: 'sin_limite' },
  { name: 'brécol', criterion: 'sin_limite' },
  { name: 'brócoli', criterion: 'sin_limite' },
  { name: 'brotes de soja', criterion: 'sin_limite' },
  { name: 'calabacín', criterion: 'sin_limite' },
  { name: 'cardo', criterion: 'sin_limite' },
  { name: 'cebollino', criterion: 'sin_limite' },
  { name: 'champiñones', criterion: 'sin_limite' },
  { name: 'setas', criterion: 'sin_limite' },
  { name: 'coliflor', criterion: 'sin_limite' },
  { name: 'endivias', criterion: 'sin_limite' },
  { name: 'escarola', criterion: 'sin_limite' },
  { name: 'hinojo', criterion: 'sin_limite' },
  { name: 'lechuga', criterion: 'sin_limite' },
  { name: 'níscalo', criterion: 'sin_limite' },
  { name: 'pepinillo', criterion: 'sin_limite' },
  { name: 'pepino', criterion: 'sin_limite' },
  { name: 'pimiento verde', criterion: 'sin_limite' },
  { name: 'rábano', criterion: 'sin_limite' },
  // Con moderación (máximo 200g/día)
  { name: 'berenjena', criterion: 'con_moderacion' },
  { name: 'boletus', criterion: 'con_moderacion' },
  { name: 'borraja', criterion: 'con_moderacion' },
  { name: 'calabaza', criterion: 'con_moderacion' },
  { name: 'col blanca', criterion: 'con_moderacion' },
  { name: 'col de bruselas', criterion: 'con_moderacion' },
  { name: 'col lombarda', criterion: 'con_moderacion' },
  { name: 'col repollo', criterion: 'con_moderacion' },
  { name: 'col rizada', criterion: 'con_moderacion' },
  { name: 'colinabo', criterion: 'con_moderacion' },
  { name: 'espárragos', criterion: 'con_moderacion' },
  { name: 'judías verdes', criterion: 'con_moderacion' },
  { name: 'nabo', criterion: 'con_moderacion' },
  { name: 'pimiento rojo', criterion: 'con_moderacion' },
  { name: 'puerro', criterion: 'con_moderacion' },
  { name: 'remolacha', criterion: 'con_moderacion' },
  { name: 'rúcula', criterion: 'con_moderacion' },
  { name: 'tomate', criterion: 'con_moderacion' },
];
