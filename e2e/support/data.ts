import {
  ActivityLevel, Allergen, CalorieGoal, Condition, DietType, Duration, Gender,
  type CalculatedMetrics, type DietResponse, type PatientData,
} from '../../types';
import { computeMetrics } from '../../utils/calculations';
import { buildMenuDays } from './fakeAi';
import type { Row } from './fakeSupabase';

/**
 * Pacientes y dietas 100% sintéticos para sembrar la BD falsa. Los valores
 * sensibles son deliberadamente reconocibles (NOTA-CLINICA-SECRETA-E2E,
 * 83.7 kg…) para poder buscarlos literalmente en payloads y en pantalla.
 */

export const SENSITIVE_NOTE = 'NOTA-CLINICA-SECRETA-E2E: antecedente de atracones, derivada por psiquiatría';

export function buildPatient(overrides: Partial<PatientData> = {}): PatientData {
  return {
    name: 'Paciente Sintético E2E',
    clientId: 'client-e2e-principal',
    age: 47,
    gender: Gender.Male,
    weight: 83.7,
    height: 171,
    activity: ActivityLevel.Moderate,
    conditions: [Condition.Hypertension, Condition.EatingDisorderHistory],
    dietType: DietType.Balanced,
    duration: Duration.OneMonth,
    calorieGoal: CalorieGoal.Maintenance,
    mealCount: 5,
    weeks: 1,
    excludedFoods: 'coliflor',
    allergens: [Allergen.Crustaceos],
    clinicalNotes: SENSITIVE_NOTE,
    bodyFatPercent: 31.4,
    targetWeight: 76.2,
    gdprConsent: { granted: true, consentedAt: Date.UTC(2026, 8, 1) },
    ...overrides,
  };
}

export interface SeedDiet {
  id: string;
  timestamp: number;
  patientData: PatientData;
  metrics: CalculatedMetrics;
  plan: DietResponse;
}

export function buildDiet(overrides: Partial<PatientData> = {}, id = 'diet-e2e-principal'): SeedDiet {
  const patientData = buildPatient(overrides);
  return {
    id,
    timestamp: Date.UTC(2026, 8, 20, 10, 0),
    patientData,
    metrics: computeMetrics(patientData),
    plan: {
      weeklyPlan: buildMenuDays(1, 7),
      generalGuidelines: ['Bebe al menos 2 litros de agua al día.'],
      durationText: '1 semana',
    },
  };
}

/** Fila de `saved_diets` tal y como la guarda hooks/useAppData.ts. */
export function dietRow(d: SeedDiet): Row {
  return {
    id: d.id,
    timestamp: d.timestamp,
    patient_data: d.patientData,
    metrics: d.metrics,
    plan: d.plan,
    plan_versions: [],
    linked_to_id: null,
    linked_role: null,
    linked_synced_at: null,
    locked_meals: [],
    substitutions: [],
  };
}

export function portalTokenRow(token: string, d: SeedDiet, overrides: Row = {}): Row {
  return {
    token,
    client_id: d.patientData.clientId,
    client_name: d.patientData.name,
    enabled: true,
    show_equivalences: true,
    ...overrides,
  };
}
