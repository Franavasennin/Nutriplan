import { PatientData, Condition, CalorieGoal, FastingProtocol, AthleteGoal, DietType } from '../types';

/**
 * Reglas de seguridad clínica (auditoría nutricional).
 *
 * Perfiles considerados vulnerables — sin restricción calórica ni ayuno
 * automáticos salvo criterio explícito de un profesional:
 *   - Menores de 18 años
 *   - Embarazo / lactancia
 *   - Antecedente de trastorno de la conducta alimentaria (TCA)
 *
 * Perfil con restricción específica (no bloqueo general):
 *   - Enfermedad renal / ERC → cap de proteína (KDOQI, ~0.8 g/kg en ERC no
 *     dialítica) independientemente del tipo de dieta elegido.
 */

export const RENAL_PROTEIN_CAP_G_PER_KG = 0.8;

export interface ClinicalSafetyFlags {
  isMinor: boolean;
  isPregnantOrLactating: boolean;
  hasEatingDisorderHistory: boolean;
  hasRenalDisease: boolean;
  /** Cualquier condición que exige desactivar déficit/superávit y ayuno automáticos. */
  isVulnerable: boolean;
  /** Motivos legibles para mostrar en la UI. */
  reasons: string[];
}

export function getClinicalSafetyFlags(data: Pick<PatientData, 'age' | 'conditions' | 'isPregnant' | 'isLactating'>): ClinicalSafetyFlags {
  const isMinor = (data.age ?? 0) < 18;
  const isPregnantOrLactating = !!data.isPregnant || !!data.isLactating;
  const hasEatingDisorderHistory = !!data.conditions?.includes(Condition.EatingDisorderHistory);
  const hasRenalDisease = !!data.conditions?.includes(Condition.RenalDisease);

  const isVulnerable = isMinor || isPregnantOrLactating || hasEatingDisorderHistory;

  const reasons: string[] = [];
  if (isMinor) reasons.push('Paciente menor de 18 años');
  if (data.isPregnant) reasons.push('Embarazo');
  if (data.isLactating) reasons.push('Lactancia');
  if (hasEatingDisorderHistory) reasons.push('Antecedente de trastorno de la conducta alimentaria');
  if (hasRenalDisease) reasons.push('Enfermedad renal / ERC (proteína limitada)');

  return { isMinor, isPregnantOrLactating, hasEatingDisorderHistory, hasRenalDisease, isVulnerable, reasons };
}

/**
 * Aplica las restricciones de seguridad a los datos del paciente ANTES de
 * calcular macros o generar el plan. Es la barrera de defensa en profundidad:
 * actúa aunque el formulario no la haya aplicado (por ejemplo, datos cargados
 * desde un backup, un CSV importado o un cliente editado).
 *
 * - Perfil vulnerable → fuerza mantenimiento calórico y desactiva el ayuno.
 * - Objetivo Atleta "Definición" (déficit) en perfil vulnerable → se reconduce
 *   a "Rendimiento" (mantenimiento).
 * - Protocolos DAP4/DAP5 (protocolo médico restrictivo) en menores → se
 *   reconducen a dieta equilibrada; requieren indicación médica específica.
 */
export function enforceClinicalSafety(data: PatientData): PatientData {
  const flags = getClinicalSafetyFlags(data);
  if (!flags.isVulnerable) return data;

  let safeData: PatientData = {
    ...data,
    calorieGoal: CalorieGoal.Maintenance,
    fastingProtocol: FastingProtocol.None,
  };

  if (safeData.dietType === DietType.Athlete && safeData.athleteGoal === AthleteGoal.Definition) {
    safeData = { ...safeData, athleteGoal: AthleteGoal.Performance };
  }

  if (flags.isMinor && (safeData.dietType === DietType.ProteinDAP4 || safeData.dietType === DietType.ProteinDAP5)) {
    safeData = { ...safeData, dietType: DietType.Balanced };
  }

  return safeData;
}
