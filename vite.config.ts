import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Lee la clave desde .env.local (VITE_API_KEY) — nunca hardcodear aquí
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY ?? ''),
      // Gemini como proveedor principal (Mistral se usa como fallback si
      // Gemini falla o no hay clave configurada) — ver services/geminiService.ts
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? ''),
    },
  };
});
