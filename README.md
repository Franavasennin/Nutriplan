# NutriPlan Pro

Aplicación web para nutricionistas y dietistas: generación de planes de dieta personalizados con IA, gestión de pacientes y seguimiento de progreso.

## Qué hace

- Genera planes de dieta con IA (Google Gemini como proveedor principal, Mistral como fallback) ajustados a criterios clínicos, alergias y preferencias del paciente.
- Gestión de pacientes: fichas, criterios clínicos, dietas guardadas, progreso.
- Planes para parejas (dietas vinculadas con listas de la compra combinadas).
- Portal del paciente: enlace para que el paciente consulte su plan sin necesitar cuenta.
- Exportación de planes a PDF y lista de la compra.
- Verificación de seguridad nutricional y de alérgenos antes de mostrar cualquier plan generado por IA.
- PWA instalable, con sincronización vía Supabase.
- Suite de tests: unitarios (Vitest) y E2E (Playwright), incluyendo tests de aislamiento entre usuarios y seguridad clínica.

## Stack

- React + TypeScript + Vite
- Supabase (base de datos + autenticación)
- Google Gemini API / Mistral API (generación de planes)
- Tailwind CSS
- Vitest + Playwright

## Cómo ejecutarlo en local

```bash
npm install
cp .env.local.example .env.local   # rellenar con tus propias claves
npm run dev
```

## Tests

```bash
npm test           # unitarios (Vitest)
npm run test:e2e   # end-to-end (Playwright)
```

## Estado

Proyecto personal en desarrollo activo.
