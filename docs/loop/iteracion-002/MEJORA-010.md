# MEJORA-010 — Verificador determinista post-generación de alérgenos

**Iteración:** 002 · **Categoría:** Seguridad alimentaria · **Origen:** M-002 (hallazgo de la re-auditoría M9, riesgo residual reconocido en MEJORA-001)

## Problema

La exclusión de un alérgeno declarado en el plato generado por la IA dependía enteramente del LLM (Regla 0 del prompt, MEJORA-002). No existía ninguna verificación determinista, a nivel de código, que confirmara que el plan generado respeta de verdad los alérgenos del paciente — solo un aviso pasivo en la lista de la compra. Evidencia: `iteracion-001/DELTA.md`, hallazgo M-002.

## Solución aplicada

1. `utils/allergenVerification.ts` (nuevo): `verifyPlanAgainstAllergens(plan, patient)` recorre todos los días/comidas/ingredientes del plan recién generado y usa `findMatchingAllergens` (ya existente, MEJORA-001/009) para detectar coincidencias con los alérgenos declarados.
2. `App.tsx` (`handleFormSubmit`): tras `generateDietPlan`, se ejecuta la verificación; si hay violaciones, se muestra un `toast` de error con el detalle (día, comida, ingrediente, alérgeno) para que la nutricionista lo vea inmediatamente y decida (editar la toma, regenerar el día, etc.).
3. No bloquea ni modifica el plan automáticamente — es una alerta, no una corrección silenciosa, coherente con que las decisiones clínicas las toma la nutricionista.

## No-alcance

- No se aplicó a los demás puntos de generación (`handleCoupleSubmit`, `regenerateSingleDay`, `generateSingleMeal`, `adaptPlanToPartner`) — queda como extensión futura en el backlog para cobertura completa.
- No corrige automáticamente el plan (no sustituye el ingrediente) — decisión deliberada para no tomar una decisión clínica de sustitución sin criterio profesional.

## Criterios de aceptación (medibles)

- [x] Test unitario: un plan con marisco cuando el paciente excluye crustáceos genera exactamente 1 violación con día/comida/ingrediente/alérgeno correctos.
- [x] Test unitario: un plan que respeta los alérgenos no genera ninguna violación.
- [x] Test unitario: sin alérgenos declarados, no hay falsos positivos aunque el ingrediente "parezca" sospechoso.
- [x] Test unitario: coherente con la excepción de leche vegetal (MEJORA-009) — no se disparan avisos duplicados o contradictorios.
- [x] Mensaje de aviso legible, con truncado a 3 + contador si hay más.

## Δ puntos estimado

- Categoría: Seguridad alimentaria · Ataca directamente el riesgo residual reconocido en la re-auditoría M9 (C1/C2) · Estimación: +4 puntos (autocertificado, ≤5, no requiere segunda verificación por §2.2)

## Plan de prueba

`test/allergenVerification.test.ts` — 7 tests nuevos (detección simple, sin falsos positivos, sin alérgenos declarados, compatibilidad con MEJORA-009, múltiples días, formato de mensaje con truncado).

## Plan de rollback

Revertir el commit; nuevo fichero + import/2 líneas en `App.tsx`, sin migración de datos.
