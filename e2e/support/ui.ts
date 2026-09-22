import type { Page, Locator } from '@playwright/test';

/** Selectores de UI compartidos por los specs (la app no tiene router ni data-testid). */

export const MEAL_TITLES = {
  breakfast: 'Desayuno',
  morningSnack: 'Media Mañana',
  lunch: 'Almuerzo',
  afternoonSnack: 'Merienda',
  dinner: 'Cena',
} as const;

/**
 * Tarjeta de una toma del día activo: el elemento más interno que contiene
 * su encabezado y su botón de swap (last() = el más profundo en el DOM).
 */
export function mealCard(page: Page, mealKey: keyof typeof MEAL_TITLES): Locator {
  return page.locator('div')
    .filter({ has: page.getByRole('heading', { name: MEAL_TITLES[mealKey], level: 4, exact: true }) })
    .filter({ has: page.getByTitle('Sugerir alternativa con IA') })
    .last();
}

/**
 * Marca un chip de alérgeno: el checkbox es sr-only dentro de un <label>
 * visible, así que se pulsa el label (como haría la usuaria) y se verifica
 * el estado accesible del checkbox.
 */
export async function checkChip(scope: Page | Locator, name: string): Promise<void> {
  await scope.locator('label').filter({ hasText: new RegExp(`^\\s*${name.replace(/[()]/g, '\\$&')}\\s*$`) }).click();
  await scope.getByRole('checkbox', { name, exact: true }).isChecked().then(checked => {
    if (!checked) throw new Error(`El chip "${name}" no quedó marcado`);
  });
}

/** Nombre del plato mostrado en una tarjeta de toma. */
export function dishName(card: Locator): Locator {
  return card.getByRole('heading', { level: 5 });
}

/** Abre desde el Dashboard el plan de un paciente ya guardado. */
export async function openSavedPlan(page: Page, patientName: string): Promise<void> {
  await page.goto('/');
  const card = page.locator('div')
    .filter({ has: page.getByRole('button', { name: `Opciones de ${patientName}` }) })
    .filter({ has: page.getByRole('button', { name: 'Ver Plan' }) })
    .last();
  await card.getByRole('button', { name: 'Ver Plan' }).click();
  await page.getByRole('heading', { name: `Plan Nutricional: ${patientName}` }).waitFor();
}
