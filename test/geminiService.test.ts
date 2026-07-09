import { describe, it, expect } from 'vitest';
import { buildDietSystemPrompt, buildUserPrompt } from '../services/geminiService';
import { Gender, ActivityLevel, DietType, Duration, type PatientData, type CalculatedMetrics } from '../types';

const basePatient: PatientData = {
  age: 38,
  gender: Gender.Female,
  weight: 65,
  height: 162,
  activity: ActivityLevel.Light,
  conditions: [],
  dietType: DietType.Balanced,
  duration: Duration.OneMonth,
};

const baseMetrics: CalculatedMetrics = {
  imc: 24.8,
  bmr: 1350,
  tee: 1850,
  macros: { protein: 120, carbs: 180, fats: 60, calories: 1850 },
};

describe('buildDietSystemPrompt — jerarquía exclusión > rotación (MEJORA-002)', () => {
  it('incluye la Regla 0 de prioridad absoluta de exclusiones antes de la Regla 5 de rotación', () => {
    const prompt = buildDietSystemPrompt(['breakfast', 'lunch', 'dinner']);
    const idxRegla0 = prompt.indexOf('PRIORIDAD ABSOLUTA — EXCLUSIONES DEL PACIENTE');
    const idxRegla5 = prompt.indexOf('VARIEDAD MÁXIMA');

    expect(idxRegla0).toBeGreaterThan(-1);
    expect(idxRegla5).toBeGreaterThan(-1);
    expect(idxRegla0).toBeLessThan(idxRegla5);
  });

  it('la regla de rotación declara explícitamente su subordinación a la Regla 0', () => {
    const prompt = buildDietSystemPrompt(['breakfast', 'lunch', 'dinner']);
    expect(prompt).toContain('ESTA ROTACIÓN ESTÁ SUBORDINADA A LA REGLA 0');
  });
});

describe('buildUserPrompt — exclusiones con prioridad absoluta (MEJORA-002)', () => {
  it('marca las exclusiones del paciente como prioridad absoluta sobre la rotación', () => {
    const patient: PatientData = { ...basePatient, excludedFoods: 'marisco, huevo, frutos secos' };
    const prompt = buildUserPrompt(patient, baseMetrics, [], 1, 7);

    expect(prompt).toContain('EXCLUIR COMPLETAMENTE (prioridad absoluta sobre cualquier regla, incluida la rotación de proteínas): marisco, huevo, frutos secos');
  });

  it('no incluye la línea de exclusión si el paciente no tiene alimentos excluidos ni condiciones con exclusión obligatoria', () => {
    const prompt = buildUserPrompt(basePatient, baseMetrics, [], 1, 7);
    expect(prompt).not.toContain('EXCLUIR COMPLETAMENTE');
  });
});
