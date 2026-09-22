import { test, expect } from './support/fixtures';
import type { Page } from '@playwright/test';
import { buildDiet, dietRow } from './support/data';
import { checkChip } from './support/ui';
import { computeMetrics } from '../utils/calculations';
import type { DayPlan, Meal, PatientData } from '../types';

/**
 * Flujo 4 — "Pareja Inteligente": vincular una segunda dieta a la del
 * principal y comprobar el escalado de macros.
 *
 * El escalado se verifica con aritmética independiente (NO llamando a
 * scalePlanToTarget, que sería circular): factor por macro = objetivo de la
 * pareja / media diaria del principal; cada comida se multiplica por ese
 * factor y las calorías se recalculan desde los macros escalados.
 */

const principal = buildDiet({ name: 'Andrés Sintético E2E', clientId: 'client-e2e-andres', allergens: [] });
test.use({ seed: { saved_diets: [dietRow(principal)] } });

type Row = Record<string, any>;
const MACROS = ['protein', 'carbs', 'fats'] as const;

async function addPartner(page: Page, opts: { name: string; age: string; weight: string; height: string; allergen?: string }) {
  await page.goto('/');
  await page.getByRole('button', { name: `Opciones de ${principal.patientData.name}` }).click();
  await page.getByRole('button', { name: /Añadir Pareja/ }).click();

  const modal = page.locator('form').filter({ has: page.getByRole('textbox', { name: 'Nombre' }) });
  await expect(page.getByRole('heading', { name: 'Añadir Pareja' })).toBeVisible();
  await expect(page.getByText(`exactamente los mismos platos que ${principal.patientData.name}`)).toBeVisible();

  await modal.getByRole('textbox', { name: 'Nombre' }).fill(opts.name);
  await modal.getByRole('spinbutton', { name: 'Edad' }).fill(opts.age);
  await modal.getByRole('spinbutton', { name: 'Peso (kg)' }).fill(opts.weight);
  await modal.getByRole('spinbutton', { name: 'Altura (cm)' }).fill(opts.height);
  await modal.getByRole('button', { name: 'Mujer', exact: true }).click();
  await modal.getByRole('button', { name: /Mantener/ }).click();
  if (opts.allergen) await checkChip(modal, opts.allergen);
  return modal;
}

function avgDailyMacros(days: DayPlan[]) {
  const totals = days.map(d => {
    const meals = Object.values(d.meals) as Meal[];
    return {
      protein: meals.reduce((s, m) => s + (m.protein ?? 0), 0),
      carbs: meals.reduce((s, m) => s + (m.carbs ?? 0), 0),
      fats: meals.reduce((s, m) => s + (m.fats ?? 0), 0),
      calories: meals.reduce((s, m) => s + (m.calories ?? 0), 0),
    };
  });
  const avg = (k: keyof typeof totals[number]) => totals.reduce((s, t) => s + t[k], 0) / totals.length;
  return { protein: avg('protein'), carbs: avg('carbs'), fats: avg('fats'), calories: avg('calories') };
}

const grams = (ingredient: string) => Number(ingredient.match(/^(\d+(?:,\d+)?)/)?.[1].replace(',', '.'));

test('vincular una pareja: mismos platos, macros escalados a su objetivo', async ({ page, db }) => {
  const modal = await addPartner(page, { name: 'Marta Sintética E2E', age: '38', weight: '61.5', height: '163' });

  // El objetivo que muestra el modal es el del motor clínico para sus datos
  const shownKcal = Number(await modal.locator('p', { hasText: /^\d+$/ }).first().textContent());
  await modal.getByRole('button', { name: /Generar/ }).click();
  await expect(page.getByText(/Dieta de pareja generada/)).toBeVisible();

  // ── Fila nueva vinculada al principal ──
  await expect.poll(() => db.table('saved_diets').length).toBe(2);
  const partner = db.table('saved_diets').find((r: Row) => r.id !== principal.id)!;
  expect(partner.linked_to_id).toBe(principal.id);
  expect(partner.linked_role).toBe('partner');
  const pd = partner.patient_data as PatientData;
  expect(pd).toMatchObject({ name: 'Marta Sintética E2E', age: 38, weight: 61.5, height: 163, gender: 'mujer' });
  // Hereda la estructura del principal (es lo que garantiza "mismos platos")
  expect(pd).toMatchObject({
    dietType: principal.patientData.dietType,
    mealCount: principal.patientData.mealCount,
    weeks: principal.patientData.weeks,
  });

  // ── Objetivo de la pareja = motor clínico sobre SUS datos ──
  const target = computeMetrics(pd).macros;
  expect(partner.metrics.macros).toEqual(target);
  expect(shownKcal).toBe(target.calories);
  expect(target.calories).toBeLessThan(principal.metrics.macros.calories);

  // ── Escalado ──
  const base = avgDailyMacros(principal.plan.weeklyPlan);
  const factor = Object.fromEntries(MACROS.map(k => [k, target[k] / base[k]])) as Record<typeof MACROS[number], number>;
  for (const k of MACROS) {
    expect(factor[k], `factor de ${k} dentro del clamp de seguridad`).toBeGreaterThanOrEqual(0.35);
    expect(factor[k]).toBeLessThanOrEqual(3);
  }

  const partnerDays: DayPlan[] = partner.plan.weeklyPlan;
  expect(partnerDays).toHaveLength(principal.plan.weeklyPlan.length);
  partnerDays.forEach((day, i) => {
    const baseDay = principal.plan.weeklyPlan[i];
    expect(Object.keys(day.meals).sort()).toEqual(Object.keys(baseDay.meals).sort());
    for (const [key, meal] of Object.entries(day.meals) as [string, Meal][]) {
      const orig = (baseDay.meals as Record<string, Meal>)[key];
      const where = `día ${day.day} ${key}`;
      expect(meal.name, `${where}: mismo plato`).toBe(orig.name);
      // Cada macro de la comida = macro original × factor del plan (±1 g por redondeo)
      for (const k of MACROS) {
        expect(Math.abs(meal[k]! - orig[k]! * factor[k]), `${where}: ${k}`).toBeLessThanOrEqual(1);
      }
      // Calorías recalculadas desde los macros, no con un cuarto factor. Se
      // calculan antes de redondear cada macro a gramo entero, así que el
      // desfase máximo legítimo es 0.5·4 + 0.5·4 + 0.5·9 = 8.5 kcal.
      expect(Math.abs(meal.calories! - (meal.protein! * 4 + meal.carbs! * 4 + meal.fats! * 9)), `${where}: kcal`).toBeLessThanOrEqual(8.5);
      // Cantidades: mismos ingredientes, reescalados por el factor energético
      // de ESA comida (energía de sus macros escalados / energía original),
      // redondeados a gramo entero.
      const energy = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
      const qtyFactor = energy(orig.protein! * factor.protein, orig.carbs! * factor.carbs, orig.fats! * factor.fats)
        / energy(orig.protein!, orig.carbs!, orig.fats!);
      meal.ingredients.forEach((ing, j) => {
        expect(ing.replace(/^[\d,]+/, ''), `${where}: mismo ingrediente`).toBe(orig.ingredients[j].replace(/^[\d,]+/, ''));
        expect(Math.abs(grams(ing) - grams(orig.ingredients[j]) * qtyFactor), `${where}: cantidad de "${ing}"`)
          .toBeLessThanOrEqual(1);
      });
    }
  });

  // En media, la pareja queda en SU objetivo diario (no en el del principal)
  const got = avgDailyMacros(partnerDays);
  for (const k of MACROS) expect(Math.abs(got[k] - target[k]), `media diaria de ${k}`).toBeLessThanOrEqual(3);
  expect(Math.abs(got.calories - target.calories) / target.calories).toBeLessThanOrEqual(0.02);

  // El plan del principal no se toca
  const principalRow = db.table('saved_diets').find((r: Row) => r.id === principal.id)!;
  expect(principalRow.plan).toEqual(principal.plan);
  expect(principalRow.linked_to_id).toBeNull();
});

test('pareja con alergia: sustitución determinista del alérgeno sin tocar al principal', async ({ page, db }) => {
  const modal = await addPartner(page, { name: 'Irene Sintética E2E', age: '29', weight: '57', height: '160', allergen: 'Huevos' });
  await modal.getByRole('button', { name: /Generar/ }).click();
  await expect(page.getByText(/Dieta de pareja generada/)).toBeVisible();

  await expect.poll(() => db.table('saved_diets').length).toBe(2);
  const partner = db.table('saved_diets').find((r: Row) => r.id !== principal.id)!;
  expect(partner.patient_data.allergens).toEqual(['huevos']);

  const principalHasEgg = principal.plan.weeklyPlan.some(d => Object.values(d.meals).some(m => m!.ingredients.some(i => /\bhuevo/i.test(i))));
  expect(principalHasEgg, 'el menú sembrado debe tener huevo para que el test tenga sentido').toBe(true);

  const partnerIngredients: string[] = partner.plan.weeklyPlan.flatMap((d: DayPlan) => Object.values(d.meals).flatMap(m => m!.ingredients));
  expect(partnerIngredients.filter(i => /\bhuevos?\b/i.test(i))).toEqual([]);
  expect(partnerIngredients.some(i => /tofu revuelto/i.test(i))).toBe(true);
  expect(partner.substitutions.length).toBeGreaterThan(0);

  const principalRow = db.table('saved_diets').find((r: Row) => r.id === principal.id)!;
  expect(principalRow.plan).toEqual(principal.plan);
});
