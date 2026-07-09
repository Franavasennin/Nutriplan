# Iteración 000 — Línea base técnica (M0)

**Fecha:** 2026-07-09
**Propósito:** registrar el estado técnico verificable antes de la primera auditoría completa (M1 de la iteración 001). No es una auditoría de las 16 categorías — solo la evidencia mecánica que exige el punto 2 del checklist de pre-vuelo (§11).

## Estado del repositorio

- Commit base: `cd7eb58` (incluye el fix de normalización de ingredientes objeto + datos de paciente en Seguimiento, commiteado como parte de la preparación M0).
- Rama de trabajo: `loop/iteracion-001`.

## Tests (Vitest)

```
Test Files  5 passed (5)
Tests       104 passed (104)
Duration    3.19s
```

## Type-check (`tsc --noEmit`)

Sin errores (exit code 0).

## Build (`vite build`)

```
✓ 1773 modules transformed
dist/assets/index-*.css            63.46 kB │ gzip:  10.64 kB
dist/assets/FoodDatabase-*.js        7.52 kB │ gzip:   2.21 kB
dist/assets/SavedDietsList-*.js      9.89 kB │ gzip:   2.75 kB
dist/assets/CouplesDietView-*.js    12.02 kB │ gzip:   3.41 kB
dist/assets/RecipeSearch-*.js       14.34 kB │ gzip:   3.84 kB
dist/assets/Dashboard-*.js          25.75 kB │ gzip:   5.10 kB
dist/assets/ProgressTracker-*.js    39.81 kB │ gzip:  10.09 kB
dist/assets/PatientForm-*.js        43.35 kB │ gzip:   7.90 kB
dist/assets/DietPlanDisplay-*.js    51.62 kB │ gzip:  13.87 kB
dist/assets/recipes-*.js            51.89 kB │ gzip:  12.90 kB
dist/assets/index-*.js             504.10 kB │ gzip: 149.35 kB   ⚠ >500 kB warning
✓ built in 6.70s
```

**Hallazgo registrado:** el chunk principal supera el umbral de aviso de Vite (500 kB). Trasladado a `BACKLOG.md` como O-001 para que M1 lo evalúe formalmente dentro de la categoría Rendimiento.

## Qué NO cubre esta línea base

Lighthouse, axe-core, evals de IA, revisión de esquema Supabase (advisors), E2E de flujos, y las 16 categorías de auditoría — todo eso es responsabilidad de M1 en la iteración 001, no de esta preparación.
