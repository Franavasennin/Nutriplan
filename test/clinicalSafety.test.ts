import { describe, it, expect } from 'vitest';
import {
  getClinicalSafetyFlags,
  enforceClinicalSafety,
  SEVERE_UNDERWEIGHT_BMI_THRESHOLD,
} from '../utils/clinicalSafety';
import {
  Gender,
  ActivityLevel,
  DietType,
  Duration,
  Condition,
  CalorieGoal,
  FastingProtocol,
  AthleteGoal,
  type PatientData,
} from '../types';

const basePatient: PatientData = {
  age: 30,
  gender: Gender.Female,
  weight: 65,
  height: 165,
  activity: ActivityLevel.Moderate,
  conditions: [Condition.None],
  dietType: DietType.Balanced,
  duration: Duration.OneMonth,
};

describe('getClinicalSafetyFlags — casos de vulnerabilidad ya existentes (regresión)', () => {
  it('marca como vulnerable a un menor de edad', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, age: 16 });
    expect(flags.isMinor).toBe(true);
    expect(flags.isVulnerable).toBe(true);
  });

  it('marca como vulnerable el embarazo', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, isPregnant: true });
    expect(flags.isPregnantOrLactating).toBe(true);
    expect(flags.isVulnerable).toBe(true);
  });

  it('marca como vulnerable la lactancia', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, isLactating: true });
    expect(flags.isPregnantOrLactating).toBe(true);
    expect(flags.isVulnerable).toBe(true);
  });

  it('marca como vulnerable el antecedente de TCA', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, conditions: [Condition.EatingDisorderHistory] });
    expect(flags.hasEatingDisorderHistory).toBe(true);
    expect(flags.isVulnerable).toBe(true);
  });

  it('no marca como vulnerable a un adulto sano sin condiciones', () => {
    const flags = getClinicalSafetyFlags(basePatient);
    expect(flags.isVulnerable).toBe(false);
  });
});

describe('getClinicalSafetyFlags — MEJORA-006: IMC extremo bajo (iteración 001)', () => {
  it('marca como vulnerable un IMC por debajo del umbral (Sintético-04: 42kg/164cm ≈ 15.6)', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, weight: 42, height: 164 });
    const bmi = 42 / (1.64 * 1.64);
    expect(bmi).toBeLessThan(SEVERE_UNDERWEIGHT_BMI_THRESHOLD);
    expect(flags.hasSevereUnderweight).toBe(true);
    expect(flags.isVulnerable).toBe(true);
  });

  it('no marca infrapeso severo con IMC normal', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, weight: 65, height: 165 });
    expect(flags.hasSevereUnderweight).toBe(false);
  });
});

describe('getClinicalSafetyFlags — MEJORA-006: Diabetes tipo 1 (iteración 001)', () => {
  it('detecta DM1 mediante hasDiabetesType1 sin marcarlo como isVulnerable (no bloquea déficit, solo ayuno)', () => {
    const flags = getClinicalSafetyFlags({ ...basePatient, conditions: [Condition.DiabetesType1] });
    expect(flags.hasDiabetesType1).toBe(true);
    expect(flags.isVulnerable).toBe(false);
  });
});

describe('enforceClinicalSafety — reconduce objetivos en perfiles vulnerables (regresión + nuevo caso BMI)', () => {
  it('fuerza mantenimiento y sin ayuno para un paciente con IMC extremo bajo', () => {
    const patient: PatientData = {
      ...basePatient,
      weight: 42,
      height: 164,
      calorieGoal: CalorieGoal.DeficitFast,
      fastingProtocol: FastingProtocol.IF16_8,
    };
    const safe = enforceClinicalSafety(patient);
    expect(safe.calorieGoal).toBe(CalorieGoal.Maintenance);
    expect(safe.fastingProtocol).toBe(FastingProtocol.None);
  });

  it('sigue reconduciendo atleta-definición a rendimiento en perfiles vulnerables (regresión)', () => {
    const patient: PatientData = {
      ...basePatient,
      age: 16,
      dietType: DietType.Athlete,
      athleteGoal: AthleteGoal.Definition,
    };
    const safe = enforceClinicalSafety(patient);
    expect(safe.athleteGoal).toBe(AthleteGoal.Performance);
  });

  it('no modifica un paciente adulto sano sin factores de vulnerabilidad (regresión)', () => {
    const patient: PatientData = { ...basePatient, calorieGoal: CalorieGoal.DeficitSlow };
    const safe = enforceClinicalSafety(patient);
    expect(safe).toEqual(patient);
  });
});
