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
    },
    server: {
      proxy: {
        // Redirige /api/* al servidor Express en puerto 3001
        '/api': {
          target:      'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
