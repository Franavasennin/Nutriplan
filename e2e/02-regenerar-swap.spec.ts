import { test, expect } from './support/fixtures';
import { buildDiet, dietRow } from './support/data';
import { SWAP_DISH } from './support/fakeAi';
import { dishName, mealCard, openSavedPlan } from './support/ui';
import type { Meal } from '../types';

/**
 * Flujo 2 — Regenerar un día individual y hacer swap de una comida, sobre un
 * plan ya guardado. En ambos casos lo crítico es que SOLO cambia lo pedido.
 */

const diet = buildDiet();
const NAME = diet.patientData.name!;
test.use({ seed: { saved_diets: [dietRow(diet)] } });

const savedPlan = (db: { table: (n: string) => any[] }) => db.table('saved_diets')[0].plan;

test('rehacer un día (con confirmación) solo cambia ese día', async ({ page, ai, db }) => {
  await openSavedPlan(page, NAME);
  await page.getByRole('button', { name: 'Día 3', exact: true }).click();
  const before = await dishName(mealCard(page, 'lunch')).textContent();

  // Cancelar el diálogo no llama a la IA ni toca nada
  await page.getByRole('button', { name: /Rehacer día 3/ }).click();
  const dialog = page.getByRole('dialog', { name: '¿Rehacer el día 3?' });
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  expect(ai.calls).toHaveLength(0);

  // Confirmar
  await page.getByRole('button', { name: /Rehacer día 3/ }).click();
  await dialog.getByRole('button', { name: 'Rehacer' }).click();
  await expect(page.getByText('Día 3 regenerado.')).toBeVisible();

  // La IA recibió una petición de UN solo día, el 3
  const calls = ai.callsOf('plan');
  expect(calls).toHaveLength(1);
  expect(calls[0].days).toEqual([3]);
  expect(calls[0].userPrompt).toContain('días 3 al 3');

  // En pantalla, el día 3 muestra platos nuevos
  await expect(dishName(mealCard(page, 'lunch'))).not.toHaveText(before!);

  // En BD: el día 3 cambió; los otros 6 días quedan byte a byte iguales
  await expect.poll(() => JSON.stringify(savedPlan(db).weeklyPlan[2])).not.toBe(JSON.stringify(diet.plan.weeklyPlan[2]));
  const plan = savedPlan(db);
  expect(plan.weeklyPlan).toHaveLength(7);
  plan.weeklyPlan.forEach((day: any, i: number) => {
    if (day.day === 3) return;
    expect(day, `el día ${day.day} no debía cambiar`).toEqual(diet.plan.weeklyPlan[i]);
  });
  // Y el día regenerado cuadra con el objetivo del paciente (±10%)
  const kcal = (Object.values(plan.weeklyPlan[2].meals) as Meal[]).reduce((s, m) => s + (m.calories ?? 0), 0);
  expect(Math.abs(kcal - diet.metrics.macros.calories) / diet.metrics.macros.calories).toBeLessThanOrEqual(0.1);
});

test('swap de una comida: la IA propone, se guarda y el resto del día no cambia', async ({ page, ai, db }) => {
  await openSavedPlan(page, NAME);
  await page.getByRole('button', { name: 'Día 2', exact: true }).click();
  const lunch = mealCard(page, 'lunch');
  const original = diet.plan.weeklyPlan[1].meals.lunch!;
  await expect(dishName(lunch)).toHaveText(original.name);

  await lunch.getByTitle('Sugerir alternativa con IA').click();
  await expect(dishName(mealCard(page, 'lunch'))).toHaveText(SWAP_DISH.name);

  // El prompt pide una alternativa a ESTA comida, con el objetivo por toma
  const swaps = ai.callsOf('swap');
  expect(swaps).toHaveLength(1);
  expect(swaps[0].userPrompt).toContain(`de almuerzo`);
  expect(swaps[0].userPrompt).toContain(`- Nombre: ${original.name}`);
  expect(swaps[0].userPrompt).toContain(`~${Math.round(diet.metrics.macros.calories / 5)} kcal`);
  expect(swaps[0].userPrompt).toContain('coliflor');   // exclusión del paciente
  expect(swaps[0].userPrompt).not.toContain('NOTA-CLINICA-SECRETA-E2E');

  // El swap no se persiste hasta "Guardar cambios"
  expect(savedPlan(db).weeklyPlan[1].meals.lunch.name).toBe(original.name);
  await page.getByRole('button', { name: /Guardar cambios/ }).click();

  await expect.poll(() => savedPlan(db).weeklyPlan[1].meals.lunch.name).toBe(SWAP_DISH.name);
  const plan = savedPlan(db);
  const swapped = plan.weeklyPlan[1].meals.lunch;
  expect(swapped.ingredients.join(' ')).toContain('garbanzos');
  expect(swapped.calories).toBeGreaterThan(0);
  // Resto del día 2 y resto del plan intactos
  for (const [key, meal] of Object.entries(diet.plan.weeklyPlan[1].meals)) {
    if (key !== 'lunch') expect(plan.weeklyPlan[1].meals[key]).toEqual(meal);
  }
  plan.weeklyPlan.forEach((day: any, i: number) => {
    if (day.day !== 2) expect(day).toEqual(diet.plan.weeklyPlan[i]);
  });
});
