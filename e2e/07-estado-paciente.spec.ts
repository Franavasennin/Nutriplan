import { test, expect } from './support/fixtures';
import { buildDiet, dietRow } from './support/data';

/**
 * Botón Activo/Inactivo de la tarjeta del Dashboard: el estado manual manda
 * sobre la regla automática de 30 días, se guarda en patient_data y los
 * filtros lo respetan.
 */

// Plan de hoy → por la regla automática, "Activo".
const diet = { ...buildDiet(), timestamp: Date.now() };
const NAME = diet.patientData.name!;
test.use({ seed: { saved_diets: [dietRow(diet)] } });

test('marcar un paciente como inactivo y volver a activarlo', async ({ page, db }) => {
  await page.goto('/');
  const status = () => db.table('saved_diets')[0].patient_data.status;

  // Badge → inactivo
  await page.getByRole('button', { name: `Marcar a ${NAME} como inactivo` }).click();
  await expect(page.getByRole('button', { name: `Marcar a ${NAME} como activo` })).toHaveText(/Inactivo/);
  await expect.poll(status).toBe('inactive');

  // Los filtros usan el estado manual
  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByRole('button', { name: `Opciones de ${NAME}` })).toBeHidden();
  await page.getByRole('button', { name: 'Inactivos', exact: true }).click();
  await expect(page.getByRole('button', { name: `Opciones de ${NAME}` })).toBeVisible();

  // Menú ⋮ → activo otra vez
  await page.getByRole('button', { name: `Opciones de ${NAME}` }).click();
  await page.getByRole('button', { name: /Marcar como activo/ }).click();
  await expect.poll(status).toBe('active');
  await page.getByRole('button', { name: 'Activos', exact: true }).click();
  await expect(page.getByRole('button', { name: `Marcar a ${NAME} como inactivo` })).toHaveText(/Activo/);

  // El resto de datos del paciente no se toca
  const { status: _s, ...rest } = db.table('saved_diets')[0].patient_data;
  const { status: _o, ...original } = diet.patientData;
  expect(rest).toEqual(original);
});
