import { describe, it, expect } from 'vitest';
import { buildDietSystemPrompt, buildUserPrompt } from '../services/geminiService';
import { Gender, ActivityLevel, DietType, Duration, Condition, FastingProtocol, Allergen, type PatientData, type CalculatedMetrics } from '../types';

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

describe('buildUserPrompt — MEJORA-006: DM1 bloquea ayuno intermitente (iteración 001)', () => {
  it('no incluye protocolo de ayuno para un paciente DM1 aunque tenga fastingProtocol configurado (Sintético-09)', () => {
    const patient: PatientData = {
      ...basePatient,
      conditions: [Condition.DiabetesType1],
      fastingProtocol: FastingProtocol.IF16_8,
    };
    const prompt = buildUserPrompt(patient, baseMetrics, [], 1, 7);
    expect(prompt).not.toContain('Protocolo de ayuno');
  });

  it('sí incluye protocolo de ayuno para un paciente sano con fastingProtocol configurado (Sintético-19)', () => {
    const patient: PatientData = { ...basePatient, fastingProtocol: FastingProtocol.IF16_8 };
    const prompt = buildUserPrompt(patient, baseMetrics, [], 1, 7);
    expect(prompt).toContain('Protocolo de ayuno');
  });
});

describe('buildUserPrompt — MEJORA-001: alérgenos estructurados (iteración 001)', () => {
  it('un paciente con alérgenos declarados genera una sección de exclusión en el prompt (Sintético-07)', () => {
    const patient: PatientData = {
      ...basePatient,
      allergens: [Allergen.Crustaceos, Allergen.Huevos, Allergen.FrutosCascara],
    };
    const prompt = buildUserPrompt(patient, baseMetrics, [], 1, 7);

    expect(prompt).toContain('EXCLUIR COMPLETAMENTE');
    expect(prompt).toContain('Crustáceos');
    expect(prompt).toContain('Huevos');
    expect(prompt).toContain('Frutos de cáscara');
  });

  it('fusiona alérgenos estructurados con excludedFoods de texto libre en la misma sección', () => {
    const patient: PatientData = {
      ...basePatient,
      excludedFoods: 'aceitunas',
      allergens: [Allergen.Leche],
    };
    const prompt = buildUserPrompt(patient, baseMetrics, [], 1, 7);
    const exclusionLine = prompt.split('\n').find(l => l.includes('EXCLUIR COMPLETAMENTE'));

    expect(exclusionLine).toContain('aceitunas');
    expect(exclusionLine).toContain('Leche');
  });
});
