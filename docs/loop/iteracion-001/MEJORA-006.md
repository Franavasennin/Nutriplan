# MEJORA-006 — Cribado por BMI extremo + bloqueo de ayuno en DM1

**Iteración:** 001 · **Categoría:** Seguridad alimentaria / Nutrición · **Origen:** A-005 (alto)

## Problema

- `utils/clinicalSafety.ts:30-46` (`isVulnerable`) no contempla BMI extremadamente bajo (<17) como criterio de vulnerabilidad — un paciente con infrapeso severo podría recibir un objetivo de déficit sin bloqueo. Expuesto por Sintético-04 (BMI ~15.6).
- `services/geminiService.ts:547-555` (`blockFasting`) no incluye DM1 (diabetes tipo 1) entre las condiciones que bloquean el ayuno intermitente, pese al riesgo de hipoglucemia/cetoacidosis. Expuesto (latente) por Sintético-09.

Evidencia: `iteracion-001/AUDITORIA-nutricion-seguridad.md` A-1/A-4.

## Solución propuesta

1. En `utils/clinicalSafety.ts`, añadir un cálculo de BMI dentro de `isVulnerable`/`getClinicalSafetyFlags` y marcar como vulnerable (bloqueo de déficit) cualquier paciente con BMI < 17, con un mensaje explicativo distinto al de TCA (para no confundir causas).
2. En `services/geminiService.ts:547-555`, añadir `Condition.DiabetesType1` a la condición que activa `blockFasting`.
3. Añadir el aviso correspondiente en `PatientForm.tsx` (banner ya existente de perfil vulnerable, extendido a este nuevo caso).

## No-alcance

- No se resuelve M-2 (DAP en vulnerables no-menores) ni M-3 (sodio renal) — quedan para una iteración futura si se priorizan.
- No se cambia el umbral de vulnerabilidad de TCA existente.

## Criterios de aceptación (medibles)

- [ ] Test unitario: paciente sintético con BMI <17 y objetivo de déficit configurado → `calculateMacros`/`enforceClinicalSafety` lo reconduce a mantenimiento, igual que hace hoy con embarazo/lactancia/TCA.
- [ ] Test unitario: paciente DM1 con `fastingProtocol` distinto de `none` → el prompt generado no incluye instrucciones de ventana de ayuno (o incluye aviso de bloqueo).
- [ ] `test/calculations.test.ts` y/o nuevo fichero de test para `clinicalSafety.ts` pasan sin regresión sobre los casos existentes (embarazo, lactancia, TCA, menor).

## Δ puntos estimado

- Categoría: Seguridad alimentaria · Criterio §8: C2 · Estimación: +6 puntos (Confianza: 0.9 — cambio acotado y de bajo riesgo de regresión, cubre 2 huecos concretos de la auditoría)

## Plan de prueba

- Añadir `test/clinicalSafety.test.ts` (no existía, hallazgo M-1 de Arquitectura) cubriendo como mínimo: BMI extremo bajo, DM1+ayuno, y los 4 casos ya existentes (embarazo, lactancia, TCA, menor) para evitar regresión.

## Plan de rollback

Revertir el commit; cambios contenidos en `clinicalSafety.ts` y `geminiService.ts`, sin migración de datos.

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
