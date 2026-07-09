# PLAN — M5 Plan de implementación — Iteración 001

**Fecha:** 2026-07-09 · **7 mejoras seleccionadas en M3** (`SELECCION.md`).

## 1. Orden de ejecución y dependencias

Las mejoras que tocan `services/geminiService.ts` se secuencian para evitar conflictos de merge; el resto son independientes entre sí.

| Orden | Mejora | Ficheros tocados | Depende de |
|---|---|---|---|
| 1 | MEJORA-002 (jerarquía exclusión>rotación) | `services/geminiService.ts` | — |
| 2 | MEJORA-001 (alérgenos) | `types.ts`, `PatientForm.tsx`, `geminiService.ts`, `DietPlanDisplay.tsx`, `pdfService`/impresión | MEJORA-002 (misma zona del prompt, se aplica sobre la jerarquía ya corregida) |
| 3 | MEJORA-006 (BMI extremo + DM1 ayuno) | `clinicalSafety.ts`, `geminiService.ts`, `PatientForm.tsx` | — (puede ir en paralelo a 1-2, pero se secuencia por tocar el mismo fichero `geminiService.ts`) |
| 4 | MEJORA-004 (a11y checkboxes) | `DietPlanDisplay.tsx` | — (independiente) |
| 5 | MEJORA-005 (contraste AA) | `tailwind.config.js`, `Dashboard.tsx` | — (independiente) |
| 6 | MEJORA-007 (disclaimer PDF) | `DietPlanDisplay.tsx`, `config/clinic.ts` | — (independiente, pero después de 004 para minimizar conflictos en el mismo fichero) |
| 7 | MEJORA-003 (RLS Supabase) | `docs/supabase/*.sql`, `public/supabase_setup.sql` | **Bloqueada por aprobación humana explícita** — puede prepararse en paralelo desde el inicio, pero su aplicación real espera confirmación |

## 2. Plan de pruebas consolidado

- Antes de empezar: `npm test -- --run` y `npx tsc --noEmit` en verde (ya lo están, línea base M0).
- Después de cada mejora 1-6: re-ejecutar la suite completa + los tests nuevos específicos de esa mejora (detallados en cada `MEJORA-NNN.md`).
- Después de MEJORA-004/005: re-ejecutar `npx axe` contra las vistas afectadas.
- Al final de las 6 mejoras de código (excluida MEJORA-003): `npm run build` limpio, `npm test -- --run` con el recuento de tests aumentado (mínimo +5 tests nuevos: alérgenos, jerarquía de prompt, BMI extremo, DM1 ayuno, y los 4 casos de regresión de `clinicalSafety.ts`).
- MEJORA-003 se valida por separado con la consulta SQL de verificación, no con la suite de tests de la app.

## 3. Puntos de verificación intermedios

1. **Tras MEJORA-002+001** (cambios de prompt): revisar manualmente el prompt completo generado para Sintético-07 antes de continuar — es el cambio de mayor riesgo clínico de la iteración.
2. **Tras MEJORA-006**: confirmar que los 4 casos de vulnerabilidad ya existentes (embarazo, lactancia, TCA, menor) no tienen regresión antes de dar por cerrada la mejora.
3. **Antes de M6 post-implementación**: suite completa verde + `tsc --noEmit` limpio + build sin errores.

## 4. Plan de rollback global

Cada mejora es un commit independiente y atómico (regla de M8 del diseño). Si una mejora falla su validación post-implementación (M6), se revierte solo ese commit sin afectar a las demás. MEJORA-003 tiene su propio rollback SQL documentado en su ficha.
