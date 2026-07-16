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
