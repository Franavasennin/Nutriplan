import { PatientData, Condition } from '../types';

/**
 * Objetivos nutricionales derivados de las condiciones clínicas del paciente
 * (auditoría — mejoras #5 y #6).
 *
 * Antes, las condiciones clínicas (hipertensión, celiaquía, intolerancia a
 * la lactosa...) solo se pasaban como texto libre a la IA, que podía o no
 * tenerlas en cuenta. Ahora se traducen a objetivos NUMÉRICOS deterministas
 * (sodio, fibra, azúcares libres) y a EXCLUSIONES OBLIGATORIAS que se
 * imponen en el prompt independientemente de lo que decida el modelo.
 */

export interface ClinicalTargets {
  /** Sodio máximo (mg/día). OMS: <2000 mg. AHA/ESC en HTA: ~1500 mg. */
  sodiumMgMax: number;
  /** Fibra mínima (g/día). EFSA/OMS: ~14 g / 1000 kcal, suelo de 25 g. */
  fiberGMin: number;
  /** Azúcares libres máximos (g/día). OMS: <10% de la energía total. */
  addedSugarGMax: number;
  /** Alimentos que deben excluirse SIEMPRE por la condición clínica, no solo si el LLM lo interpreta así. */
  mandatoryExclusions: string[];
}

const DEFAULT_SODIUM_MG = 2000; // OMS: <2 g sodio/día (~5 g sal)
const HTN_SODIUM_MG     = 1500; // Hipertensión: más estricto (AHA/ESC)
const FIBER_G_PER_1000KCAL = 14;
const FIBER_G_FLOOR = 25;
const ADDED_SUGAR_ENERGY_FRACTION = 0.10; // OMS: <10% de la energía total

export function getClinicalTargets(
  data: Pick<PatientData, 'conditions'>,
  dailyCalories: number
): ClinicalTargets {
  const conditions = data.conditions ?? [];

  const sodiumMgMax = conditions.includes(Condition.Hypertension) ? HTN_SODIUM_MG : DEFAULT_SODIUM_MG;

  const fiberGMin = Math.max(FIBER_G_FLOOR, Math.round((dailyCalories / 1000) * FIBER_G_PER_1000KCAL));

  const addedSugarGMax = Math.round((dailyCalories * ADDED_SUGAR_ENERGY_FRACTION) / 4);

  const mandatoryExclusions: string[] = [];
  if (conditions.includes(Condition.Celiac)) {
    mandatoryExclusions.push(
      'gluten', 'trigo', 'cebada', 'centeno',
      'pan/pasta/harinas convencionales (usar solo versiones certificadas sin gluten)'
    );
  }
  if (conditions.includes(Condition.LactoseIntolerance)) {
    mandatoryExclusions.push(
      'leche y lácteos con lactosa (permitir productos sin lactosa o fermentados bajos en lactosa: yogur, queso curado)'
    );
  }

  return { sodiumMgMax, fiberGMin, addedSugarGMax, mandatoryExclusions };
}
