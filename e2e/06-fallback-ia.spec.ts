import { test, expect } from './support/fixtures';
import { buildDiet, dietRow } from './support/data';
import { openSavedPlan } from './support/ui';

/**
 * Extra — Gemini es el proveedor principal y Mistral el respaldo automático
 * (services/geminiService.ts, groqRequest). Si Gemini falla, la nutricionista
 * no debe notar nada: la misma petición se repite contra Mistral.
 */

const diet = buildDiet();
test.use({ seed: { saved_diets: [dietRow(diet)] } });

test('si Gemini falla, la petición se resuelve con Mistral sin error para la usuaria', async ({ page, ai, db }) => {
  ai.geminiStatus = 503;
  await openSavedPlan(page, diet.patientData.name!);

  await page.getByRole('button', { name: /Rehacer día 1/ }).click();
  await page.getByRole('dialog', { name: '¿Rehacer el día 1?' }).getByRole('button', { name: 'Rehacer' }).click();
  await expect(page.getByText('Día 1 regenerado.')).toBeVisible();

  // Orden de proveedores: primero Gemini (falla), después Mistral con el MISMO prompt
  expect(ai.calls.map(c => `${c.provider}:${c.kind}`)).toEqual(['gemini:failed', 'mistral:plan']);
  expect(ai.calls[1].userPrompt).toBe(ai.calls[0].userPrompt);

  await expect.poll(() => JSON.stringify(db.table('saved_diets')[0].plan.weeklyPlan[0]))
    .not.toBe(JSON.stringify(diet.plan.weeklyPlan[0]));
});
