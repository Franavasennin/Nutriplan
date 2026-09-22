import { test, expect, FAKE_SUPABASE_URL } from './support/fixtures';

/**
 * Salvaguarda previa a todos los flujos: el servidor de los E2E NO debe
 * llevar dentro la configuración de producción de .env.local. Si Vite dejara
 * de priorizar las variables del proceso, este test fallaría antes de que
 * ningún otro flujo pudiera escribir en el Supabase real.
 */
test('el bundle de los E2E usa el backend y las claves falsas, nunca las de .env.local', async ({ page, supabaseRequests }) => {
  await page.goto('/');

  // import.meta.env (Supabase) se incrusta en el módulo servido…
  const supabaseClient = await page.evaluate(() => fetch('/services/supabaseClient.ts').then(r => r.text()));
  expect(supabaseClient).toContain(FAKE_SUPABASE_URL);
  expect(supabaseClient).not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/);

  // …mientras que los `define` de vite.config.ts (claves de IA) se inyectan en
  // dev como globales en tiempo de ejecución: se comprueba el valor efectivo.
  const aiKeys = await page.evaluate(() => {
    const env = (globalThis as any).process?.env ?? {};
    return { mistral: env.API_KEY, gemini: env.GEMINI_API_KEY };
  });
  expect(aiKeys).toEqual({ mistral: 'e2e-mistral-key', gemini: 'e2e-gemini-key' });

  // Y la app, al arrancar, carga sus datos del backend falso.
  await expect.poll(() => supabaseRequests.filter(r => r.url.includes('/rest/v1/saved_diets')).length).toBeGreaterThan(0);
  for (const r of supabaseRequests) expect(r.headers['apikey']).toBe('e2e-anon-key');
});
