import { test, expect } from './support/fixtures';
import type { Page } from '@playwright/test';
import { buildDiet, dietRow } from './support/data';
import { BREAD_BREAKFASTS } from './support/fakeAi';
import { dishName, mealCard, openSavedPlan } from './support/ui';
import type { Meal } from '../types';

/**
 * Flujo 5 — Guardar y aplicar una "Pauta" de la nutricionista sobre un plan ya
 * generado: solo cambian las comidas afectadas, con los macros de la comida
 * original, y la pauta queda guardada para regeneraciones futuras.
 */

const diet = buildDiet();
const NAME = diet.patientData.name!;
const PAUTA = 'Necesito que todos los desayunos tengan pan integral';
test.use({ seed: { saved_diets: [dietRow(diet)] } });

const row = (db: { table: (n: string) => any[] }) => db.table('saved_diets')[0];
const energy = (m: Meal) => m.protein! * 4 + m.carbs! * 4 + m.fats! * 9;

async function applyPauta(page: Page, text: string) {
  await page.getByRole('button', { name: /Pautas/ }).click();
  await expect(page.getByRole('heading', { name: 'Pautas sobre este plan' })).toBeVisible();
  const box = page.getByPlaceholder('Ej: necesito que todos los desayunos tengan pan');
  await expect(page.getByRole('button', { name: /Aplicar pautas/ })).toBeDisabled();   // vacío → deshabilitado
  await box.fill(text);
  await page.getByRole('button', { name: /Aplicar pautas/ }).click();
}

test('aplicar una pauta cambia solo los desayunos, conserva sus macros y se guarda', async ({ page, ai, db }) => {
  await openSavedPlan(page, NAME);
  await applyPauta(page, PAUTA);
  await expect(page.getByText('Pauta aplicada: 7 comidas ajustadas.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pautas sobre este plan' })).toBeHidden();

  // ── La IA recibió la pauta, el plan real con sus macros, y las exclusiones ──
  const calls = ai.callsOf('instructions');
  expect(calls).toHaveLength(1);
  expect(calls[0].userPrompt).toContain(`PAUTA DE LA NUTRICIONISTA: ${PAUTA}`);
  expect(calls[0].userPrompt).toContain(diet.plan.weeklyPlan[0].meals.breakfast!.name);
  expect(calls[0].systemPrompt).toMatch(/EXCLUIR COMPLETAMENTE[^\n]*Crustáceos/);
  expect(calls[0].userPrompt + calls[0].systemPrompt).not.toContain('NOTA-CLINICA-SECRETA-E2E');

  // ── Pantalla: el desayuno del día 1 y del día 2 ya son los nuevos ──
  await expect(dishName(mealCard(page, 'breakfast'))).toHaveText(BREAD_BREAKFASTS[0].name);
  await expect(dishName(mealCard(page, 'lunch'))).toHaveText(diet.plan.weeklyPlan[0].meals.lunch!.name);
  await page.getByRole('button', { name: 'Día 2', exact: true }).click();
  await expect(dishName(mealCard(page, 'breakfast'))).toHaveText(BREAD_BREAKFASTS[1].name);

  // ── BD ──
  await expect.poll(() => row(db).patient_data.planInstructions).toBe(PAUTA);
  const saved = row(db);
  saved.plan.weeklyPlan.forEach((day: any, i: number) => {
    const orig = diet.plan.weeklyPlan[i];
    const breakfast: Meal = day.meals.breakfast;
    // Desayuno nuevo, con pan, distinto cada día (Regla 5 del prompt)
    expect(breakfast.name).toBe(BREAD_BREAKFASTS[i % BREAD_BREAKFASTS.length].name);
    expect(breakfast.ingredients.join(' ')).toMatch(/pan integral/);
    // Mismos macros que el desayuno que sustituye (±8%, enforceMealMacroTarget)
    const delta = Math.abs(energy(breakfast) - energy(orig.meals.breakfast!)) / energy(orig.meals.breakfast!);
    expect(delta, `día ${day.day}: kcal del desayuno`).toBeLessThanOrEqual(0.08);
    // Todo lo demás, byte a byte igual
    for (const [key, meal] of Object.entries(orig.meals)) {
      if (key !== 'breakfast') expect(day.meals[key], `día ${day.day} ${key} no debía cambiar`).toEqual(meal);
    }
  });
  expect(saved.plan.generalGuidelines).toEqual(diet.plan.generalGuidelines);

  // Historial de versiones: la versión anterior queda guardada para deshacer
  expect(saved.plan_versions).toHaveLength(1);
  expect(saved.plan_versions[0].plan).toEqual(diet.plan);
});

async function rehacerDia2(page: Page) {
  await page.getByRole('button', { name: 'Día 2', exact: true }).click();
  await page.getByRole('button', { name: /Rehacer día 2/ }).click();
  await page.getByRole('dialog', { name: '¿Rehacer el día 2?' }).getByRole('button', { name: 'Rehacer' }).click();
  await expect(page.getByText('Día 2 regenerado.')).toBeVisible();
}

const PERSISTED_PAUTA_MARK = 'PAUTA DE LA NUTRICIONISTA (prioridad MENOR que las exclusiones/alérgenos anteriores';

test('la pauta guardada se aplica al rehacer un día tras reabrir el plan', async ({ page, ai, db }) => {
  await openSavedPlan(page, NAME);
  await applyPauta(page, PAUTA);
  await expect(page.getByText('Pauta aplicada: 7 comidas ajustadas.')).toBeVisible();
  await expect.poll(() => row(db).patient_data.planInstructions).toBe(PAUTA);

  await openSavedPlan(page, NAME);   // recarga la app y abre el plan desde el Dashboard
  await rehacerDia2(page);
  const regen = ai.callsOf('plan');
  expect(regen).toHaveLength(1);
  expect(regen[0].userPrompt).toContain(PERSISTED_PAUTA_MARK);
  expect(regen[0].userPrompt).toContain(PAUTA);
});

test('la pauta recién aplicada se respeta al rehacer un día en la misma sesión', async ({ page, ai }) => {
  // Regresión (2026-09-22): handleApplyInstructions persistía la pauta pero
  // no actualizaba el `patientData` de App, y "Rehacer día" la ignoraba
  // hasta reabrir el plan.
  await openSavedPlan(page, NAME);
  await applyPauta(page, PAUTA);
  await expect(page.getByText('Pauta aplicada: 7 comidas ajustadas.')).toBeVisible();

  await rehacerDia2(page);
  const regen = ai.callsOf('plan');
  expect(regen).toHaveLength(1);
  expect(regen[0].userPrompt).toContain(PERSISTED_PAUTA_MARK);
});

test('una pauta que no requiere cambios deja el plan intacto', async ({ page, ai, db }) => {
  await openSavedPlan(page, NAME);
  await applyPauta(page, 'Más variedad de verduras en las cenas');
  await expect(page.getByText('La pauta no requería cambios en este plan.')).toBeVisible();

  expect(ai.callsOf('instructions')).toHaveLength(1);
  await expect.poll(() => row(db).patient_data.planInstructions).toBe('Más variedad de verduras en las cenas');
  expect(row(db).plan).toEqual(diet.plan);
});
