import { test, expect } from './support/fixtures';
import { checkChip, dishName, mealCard } from './support/ui';
import { computeMetrics } from '../utils/calculations';
import type { Meal, PatientData } from '../types';

/**
 * Flujo 1 — Registro de paciente (PatientForm) → generación del plan semanal
 * con IA → visualización del plan.
 */

const CLINICAL_NOTE = 'NOTA-E2E-NO-DEBE-IR-A-LA-IA: seguimiento semanal por ansiedad con la comida';

test('registrar paciente, generar plan con IA y ver los 7 días', async ({ page, ai, db }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nuevo Cliente/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Registro de Nuevo Cliente' })).toBeVisible();

  // ── 1. Información personal ──
  await page.getByLabel('Nombre Completo').fill('Lucía Sintética E2E');
  await page.getByRole('spinbutton', { name: 'Edad' }).fill('34');
  await page.getByRole('textbox', { name: /Notas clínicas/ }).fill(CLINICAL_NOTE);
  await page.getByRole('checkbox', { name: /consentimiento para el tratamiento/ }).check();

  // ── 2. Actividad y dieta ──
  await page.getByRole('combobox', { name: /Nivel de Actividad/ }).selectOption({ label: 'Ligero' });
  await page.getByRole('combobox', { name: /Tipo de Dieta/ }).selectOption({ label: 'Mediterránea' });
  await page.getByRole('button', { name: /Déficit Lento/ }).click();
  await checkChip(page, 'Crustáceos');
  await page.getByRole('combobox', { name: 'Número de comidas al día' }).selectOption({ label: '5 comidas (+ media mañana)' });

  // ── 3. Condiciones clínicas ──
  await page.getByRole('checkbox', { name: 'Hipertensión', exact: true }).check();

  // ── 4. Composición ──
  await page.getByRole('button', { name: 'Mujer', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Peso (kg)', exact: true }).fill('68.5');
  await page.getByRole('spinbutton', { name: 'Altura (cm)' }).fill('164');

  await page.getByRole('button', { name: /Generar Perfil/ }).click();

  // ── Resultado en pantalla ──
  await expect(page.getByRole('heading', { name: 'Plan Nutricional: Lucía Sintética E2E' })).toBeVisible();
  await expect(page.getByText('Plan nutricional generado con éxito.')).toBeVisible();
  for (let d = 1; d <= 7; d++) {
    await expect(page.getByRole('button', { name: `Día ${d}`, exact: true })).toBeVisible();
  }
  for (const key of ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'] as const) {
    await expect(dishName(mealCard(page, key))).not.toBeEmpty();
  }
  await expect(dishName(mealCard(page, 'lunch'))).toHaveText('Pollo a la plancha con arroz integral y brócoli');
  await page.getByRole('button', { name: 'Día 2', exact: true }).click();
  await expect(dishName(mealCard(page, 'lunch'))).toHaveText('Lentejas estofadas con zanahoria');

  // ── Una sola llamada a la IA, con los 7 días y las 5 tomas ──
  const planCalls = ai.callsOf('plan');
  expect(planCalls).toHaveLength(1);
  expect(planCalls[0].provider).toBe('gemini');
  expect(planCalls[0].days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  const prompt = planCalls[0].userPrompt;
  expect(prompt).toContain('claves: breakfast, morningSnack, lunch, afternoonSnack, dinner');
  expect(prompt).toContain('Crustáceos');            // alérgeno → exclusión obligatoria
  expect(prompt).toContain('hipertension');           // condición clínica
  // La UI promete "Estas notas no se envían a la IA": se comprueba de verdad.
  expect(prompt + planCalls[0].systemPrompt).not.toContain('NOTA-E2E-NO-DEBE-IR-A-LA-IA');

  // ── Persistencia: una fila nueva en saved_diets con el plan completo ──
  const rows = db.table('saved_diets');
  expect(rows).toHaveLength(1);
  const saved = rows[0];
  const pd = saved.patient_data as PatientData;
  expect(pd).toMatchObject({ name: 'Lucía Sintética E2E', age: 34, weight: 68.5, height: 164, mealCount: 5 });
  expect(pd.clientId).toBeTruthy();
  expect(pd.gdprConsent?.granted).toBe(true);
  expect(saved.plan.weeklyPlan).toHaveLength(7);
  for (const day of saved.plan.weeklyPlan) {
    expect(Object.keys(day.meals).sort()).toEqual(['afternoonSnack', 'breakfast', 'dinner', 'lunch', 'morningSnack']);
  }

  // ── Métricas: las guardadas son las del motor clínico, y la UI las muestra ──
  const expected = computeMetrics(pd);
  expect(saved.metrics.macros).toEqual(expected.macros);
  await expect(page.getByText(`obj. ${expected.macros.calories}kcal`)).toBeVisible();

  // Guardarraíl determinista: cada día queda a ±10% del objetivo calórico.
  for (const day of saved.plan.weeklyPlan) {
    const kcal = (Object.values(day.meals) as Meal[]).reduce((s, m) => s + (m.calories ?? 0), 0);
    expect(Math.abs(kcal - expected.macros.calories) / expected.macros.calories).toBeLessThanOrEqual(0.1);
  }
});

test('el formulario no llama a la IA si los datos son inválidos', async ({ page, ai, db }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nuevo Cliente/ }).first().click();
  await page.getByRole('spinbutton', { name: 'Peso (kg)', exact: true }).fill('5');
  await page.getByRole('button', { name: /Generar Perfil/ }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Peso debe estar entre 20 y 300 kg' })).toBeVisible();
  expect(ai.calls).toHaveLength(0);
  expect(db.table('saved_diets')).toHaveLength(0);
});
