import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inyectamos la API Key de forma segura en el objeto process.env para que la app la reconozca
    'process.env.API_KEY': JSON.stringify("REDACTED_GEMINI_API_KEY"),
  },
});