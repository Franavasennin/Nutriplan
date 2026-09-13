import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#13ec5b',
        'primary-hover': '#0fd650',
        // Variante de #13ec5b oscurecida para uso como TEXTO (no fondos ni
        // iconos) — el verde de marca original tiene ratio 1.59:1 sobre
        // blanco (falla WCAG AA 4.5:1). Auditoría iteración 001, MEJORA-005.
        'primary-accessible': '#0e7a3a',
        'background-light': '#f6f8f6',
        'background-dark': '#102216',
        'surface-light': '#ffffff',
        'surface-dark': '#1a2e22',
        'text-main': '#111813',
        // Oscurecido de #61896f (ratio 3.95:1, falla AA) a 5.95:1 sobre
        // blanco. Auditoría iteración 001, MEJORA-005.
        'text-sub': '#4a6b57',
        'border-light': '#dbe6df',
        'border-dark': '#2a4032',
      },
      fontFamily: {
        'display': ['Manrope', 'sans-serif'],
        'sans': ['Manrope', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        // Usada en modales/overlays (backdrop + panel). Duración corta a
        // propósito (150-300ms es el rango recomendado para micro-interacciones);
        // desactivada globalmente bajo prefers-reduced-motion en index.css.
        'fade-in': 'fade-in 200ms ease-out',
      },
    },
  },
  plugins: [
    forms,
  ],
};
