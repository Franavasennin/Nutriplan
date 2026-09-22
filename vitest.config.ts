import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Los E2E (*.spec.ts) son de Playwright — ver playwright.config.ts.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
