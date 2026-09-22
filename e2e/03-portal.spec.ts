import { test, expect } from './support/fixtures';
import { buildDiet, dietRow, portalTokenRow, SENSITIVE_NOTE } from './support/data';
import { loadEdgeFunction } from './support/edgeFunction';

/**
 * Flujo 3 — Portal del Paciente (/p/TOKEN, solo lectura).
 *
 * El saneamiento vive en el servidor (supabase/functions/portal-diet). Aquí
 * esa función se ejecuta con su código REAL (ver support/edgeFunction.ts)
 * contra una BD falsa sembrada con un paciente cargado de datos clínicos
 * reconocibles, y se inspecciona lo que llega al navegador.
 */

const diet = buildDiet();
const TOKEN = 'tok-e2e-7f3a9c21b4d8e605';
test.use({
  seed: {
    saved_diets: [dietRow(diet)],
    portal_tokens: [
      portalTokenRow(TOKEN, diet),
      portalTokenRow('tok-e2e-desactivado-000000', diet, { enabled: false }),
    ],
  },
});

// Campos de patientData que el portal puede recibir (lo que el paciente ve de
// sí mismo + lo que necesita el motor de equivalencias).
const ALLOWED_PATIENT_KEYS = ['name', 'mealCount', 'fastingProtocol', 'dietType', 'allergens', 'excludedFoods'];

// Valores del paciente sembrado que NUNCA deben salir del servidor.
const SENSITIVE_VALUES = [
  'NOTA-CLINICA-SECRETA-E2E', 'psiquiatría',   // clinicalNotes
  'hipertension', 'antecedente_tca',            // conditions
  '83.7', '31.4', '76.2',                        // peso, % graso, peso objetivo
  'clinicalNotes', 'conditions', 'bodyFatPercent', 'gdprConsent', 'targetWeight',
  '"weight"', '"height"', '"age"', '"gender"', '"activity"',
];

test('el portal muestra la dieta sin datos clínicos y solo habla con la Edge Function', async ({ page, supabaseRequests, portalResponses }) => {
  await page.goto(`/p/${TOKEN}`);

  // Se ve la dieta del paciente
  await expect(page.getByRole('heading', { level: 1, name: diet.patientData.name })).toBeVisible();
  const dishes = diet.plan.weeklyPlan.flatMap(d => Object.values(d.meals).map(m => m!.name));
  await expect(page.getByText(new RegExp(dishes.join('|'))).first()).toBeVisible();

  // Red: el navegador del paciente NUNCA usa la API REST (clave anónima con
  // acceso total) — solo la Edge Function, y sin credenciales.
  expect(supabaseRequests.length).toBeGreaterThan(0);
  for (const r of supabaseRequests) {
    expect(new URL(r.url).pathname, 'el portal no debe tocar /rest/v1').toMatch(/^\/functions\/v1\/portal-(diet|complete)$/);
    expect(r.headers['apikey']).toBeUndefined();
    expect(r.headers['authorization']).toBeUndefined();
  }

  // Payload: patientData solo con los campos permitidos, y ningún valor sensible
  expect(portalResponses.length).toBeGreaterThan(0);
  for (const payload of portalResponses as any[]) {
    for (const key of Object.keys(payload.patientData)) {
      expect(ALLOWED_PATIENT_KEYS, `campo no permitido en patientData: ${key}`).toContain(key);
    }
    const serialized = JSON.stringify(payload);
    for (const value of SENSITIVE_VALUES) {
      expect(serialized, `el payload del portal contiene "${value}"`).not.toContain(value);
    }
  }

  // Pantalla: tampoco se renderiza nada clínico
  const text = await page.locator('body').innerText();
  expect(text).not.toContain(SENSITIVE_NOTE);
  for (const v of ['83.7', '83,7', '31.4', '31,4', 'Hipertensión', 'IMC', 'TMB']) {
    expect(text, `la pantalla del portal muestra "${v}"`).not.toContain(v);
  }
});

test('un token desactivado o inexistente no devuelve ningún dato', async ({ page, portalResponses }) => {
  for (const token of ['tok-e2e-desactivado-000000', 'tok-e2e-no-existe-999999']) {
    await page.goto(`/p/${token}`);
    await expect(page.getByRole('heading', { name: 'Enlace no disponible' })).toBeVisible();
  }
  expect(portalResponses.length).toBeGreaterThan(0);
  for (const payload of portalResponses) {
    // Misma respuesta genérica para ambos casos — no da pistas de qué tokens existen.
    expect(payload).toEqual({ error: 'not_found' });
  }
});

test('el payload de portal-diet no incluye métricas clínicas (IMC, TMB, GET)', async ({ db }) => {
  // Regresión (2026-09-22): la función devolvía `metrics` completo — imc
  // (derivado de peso y altura), bmr y tee — aunque el portal solo usa macros.
  const server = await db.listen();
  try {
    const handler = await loadEdgeFunction('portal-diet', {
      SUPABASE_URL: server.url,
      SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',
    });
    const res = await handler(new Request(`http://edge.local/portal-diet?token=${TOKEN}`));
    expect(res.status).toBe(200);
    const payload = await res.json();

    expect(payload.metrics.macros).toEqual(diet.metrics.macros);   // lo que el portal sí necesita
    expect(Object.keys(payload.metrics)).not.toContain('imc');
    expect(Object.keys(payload.metrics)).not.toContain('bmr');
    expect(Object.keys(payload.metrics)).not.toContain('tee');
  } finally {
    await server.close();
  }
});
