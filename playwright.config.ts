import { defineConfig, devices } from '@playwright/test';

/**
 * E2E con Playwright — ver e2e/support/fixtures.ts para el aislamiento de red.
 *
 * El servidor de los E2E es SIEMPRE uno propio (puerto 5199, nunca se
 * reutiliza el `npm run dev` de 5173): arranca con URL/claves falsas en el
 * entorno del proceso, que Vite prioriza sobre .env.local — así el bundle de
 * los tests no contiene ni la URL del Supabase de producción ni las claves
 * reales de IA.
 */

const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // El Service Worker de la PWA podría atender peticiones sin pasar por
    // page.route — se bloquea para que el aislamiento sea total.
    serviceWorkers: 'block',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.e2e.test',
      VITE_SUPABASE_KEY: 'e2e-anon-key',
      VITE_API_KEY: 'e2e-mistral-key',
      VITE_GEMINI_API_KEY: 'e2e-gemini-key',
    },
  },
});
