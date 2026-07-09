# SELECCIÓN — M3 Priorización — Iteración 001

**Fecha:** 2026-07-09 · **Método:** §3.3 — `Prioridad = (Impacto × Confianza) / Esfuerzo`, con vetos automáticos para bloqueantes de Nutrición/Seguridad alimentaria (§3.3a).

## 1. Bloqueantes (veto automático — entran sin pasar por la fórmula)

| ID | Descripción | Por qué salta la fórmula |
|---|---|---|
| B-001 | Sistema de 14 alérgenos UE (estructura mínima: campo `allergens` en `Recipe`/`PatientData`, propagación a lista de la compra y PDF) | Bloqueante de Seguridad alimentaria (§3.3a) |
| B-002 | Jerarquía exclusión-paciente > rotación obligatoria de proteínas en el prompt de IA | Bloqueante de Seguridad alimentaria (§3.3a) |
| P-001 | Verificar y, si procede, re-habilitar RLS en las 4 tablas de datos de salud en el proyecto Supabase real | Bloqueante de Escalabilidad/Seguridad — **requiere confirmación humana explícita antes de tocar producción** (ver Riesgos y Plan) |
| B-003 | Nombre accesible en los 46 checkboxes de la lista de la compra (`aria-label`/`aria-checked`/`role="checkbox"`) | Bloqueante de Accesibilidad (§3.3a, hallazgo crítico verificado en vivo) |

## 2. Cálculo de prioridad para los hallazgos ALTOS (candidatos a completar la iteración)

| ID | Impacto (1-10) | Confianza (0.5-1.0) | Esfuerzo (1-10) | Prioridad | Seleccionado |
|---|---|---|---|---|---|
| A-002 (contraste AA, 2 tokens de color) | 7 | 1.0 | 2 | **3.50** | ✅ Sí |
| A-005 (BMI extremo + DM1 sin bloqueo ayuno) | 6 | 0.9 | 3 | **1.80** | ✅ Sí |
| A-010 (disclaimer general en PDF) | 4 | 1.0 | 1 | **4.00** | ✅ Sí (esfuerzo mínimo, se añade sin desplazar nada) |
| A-001 (fuente 1.1MB → lucide-react) | 9 | 0.8 | 7 | 1.03 | ⬜ No — iteración 002 (esfuerzo alto: migrar 14 ficheros) |
| A-006 (tsconfig estricto + tests clinicalSafety) | 7 | 0.7 | 8 | 0.61 | ⬜ No — dividir en dos iteraciones futuras (tests primero, strict después) |
| A-003/A-004 (micronutrientes/objetivos deterministas por condición) | 8 | 0.6 | 7 | 0.69 | ⬜ No — requiere sign-off DN previo (Ester Correa), no listo para implementar aún |
| A-007 (paginación/índices Supabase) | 6 | 0.7 | 6 | 0.70 | ⬜ No — iteración 002 |
| A-008 (campos alérgenos/nivel en `Recipe`) | 6 | 0.8 | 4 | 1.20 | ⬜ No — se solapa con B-001, se aborda junto a él si el alcance lo permite, si no pasa a 002 |
| A-009 (evals de IA) | 7 | 0.6 | 6 | 0.70 | ⬜ No — iteración 002 |

## 3. Selección final — Iteración 001, ejecución (M8): 7 mejoras

1. **MEJORA-001** — Sistema mínimo de alérgenos (B-001)
2. **MEJORA-002** — Jerarquía exclusión > rotación en el prompt (B-002)
3. **MEJORA-003** — Verificación y remediación de RLS en Supabase (P-001) — **requiere aprobación humana antes de aplicar en producción**
4. **MEJORA-004** — Accesibilidad de checkboxes de la lista de la compra (B-003)
5. **MEJORA-005** — Contraste AA de tokens de color (A-002)
6. **MEJORA-006** — Cribado de seguridad por BMI extremo + bloqueo de ayuno en DM1 (A-005)
7. **MEJORA-007** — Disclaimer general en el documento imprimible del plan (A-010)

**Presupuesto estimado:** ~10-13 h-IA (dentro del rango 8-16h de §3.6). Dentro del límite de 5-8 mejoras.

**Conforme Humano-PO:** pendiente de confirmación de Fran antes de pasar a M8 (ejecución) — especialmente MEJORA-003, que toca infraestructura de producción.
