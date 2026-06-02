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
        'background-light': '#f6f8f6',
        'background-dark': '#102216',
        'surface-light': '#ffffff',
        'surface-dark': '#1a2e22',
        'text-main': '#111813',
        'text-sub': '#61896f',
        'border-light': '#dbe6df',
        'border-dark': '#2a4032',
      },
      fontFamily: {
        'display': ['Manrope', 'sans-serif'],
        'sans': ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [
    forms,
  ],
};
