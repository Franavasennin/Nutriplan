# Scorecard — DietMaster Pro

Puntuación viva y acumulativa. Cada celda enlaza a la evidencia que la respalda. Ver reglas anti-inflación en `LOOP-MAESTRO-100.md` §2.2.

## Nota global por iteración

| Iteración | Fecha | Nota global | Nutrición | Seg. alimentaria | Notas |
|---|---|---|---|---|---|
| 000 (baseline técnico) | 2026-07-09 | *pendiente de M1* | *pendiente* | *pendiente* | Solo se registró línea base técnica (tests/build), no auditoría completa. Ver `iteracion-000/BASELINE-TECNICO.md` |
| 001 (M1, antes de M8) | 2026-07-09 | 53.61 / 100 — banda Básico | 74 | 67 | Primera auditoría completa de las 16 categorías (histórico, superado por la fila de abajo). |
| **001 (M9/M10, tras M8)** | 2026-07-09 | **56.10 / 100** — banda Básico (40-59) | 75 | 79 | Tras ejecutar y re-auditar las 7 mejoras de la iteración. Δ +2.49 vs. cierre de M1. Ver `DELTA.md` y cálculo abajo. |

### Cálculo de la nota global tras M8/M9 (§2.1)

```
Nota global = Σ (nota_categoría × peso_categoría) / 100
= (12×75 + 10×79 + 9×48 + 8×58 + 8×60 + 8×71 + 7×62 + 6×40
   + 5×33 + 5×54 + 5×66 + 5×35 + 4×0 + 3×20 + 3×64 + 2×55) / 100
= 5610 / 100 = 56.10

Tope de seguridad (§2.1): Nutrición (75) y Seguridad alimentaria (79) < 80
  → activaría cap a 59, pero 56.10 ya está por debajo de 59 → el tope no
    cambia el resultado (56.10 se mantiene).
Tope de mínimos: no aplica (ninguna categoría ≥90).

NOTA GLOBAL OFICIAL ITERACIÓN 001 (post-M8) = 56.10 / 100
Δ vs. cierre de M1 (53.61) = +2.49 — cumple el objetivo de §3.5 (≥+2 en iteraciones 1-5)
```

**Lectura:** Seguridad alimentaria pasó de 67 a 79 (+12) al resolver los 2 bloqueantes (alérgenos, jerarquía exclusión/rotación), pero se queda deliberadamente por debajo de 80 porque persisten C2 (batería de IA sin ejecutar) y C4 (sin sign-off del Humano-DN) — el tope de seguridad de §2.1 sigue técnicamente "armado" aunque no llegue a morder. Accesibilidad subió de 38 a 54 (+16, cruza de banda) tras eliminar el hallazgo crítico de accesibilidad y el problema sistémico de contraste. Escalabilidad subió solo +5 (28→33) porque, aunque se resolvió la discrepancia de RLS, los problemas de fondo de escalabilidad real (paginación, índices, multi-tenant) no se tocaron.

## Detalle por categoría (tras M8/M9, iteración 001)

| # | Categoría | Peso | Nota | Δ | Evidencia | Última actualización |
|---|---|---|---|---|---|---|
| 1 | Nutrición | 12% | **75** | +1 | `iteracion-001/AUDITORIA-M9-nutricion-seguridad.md` | 2026-07-09 |
| 2 | Seguridad alimentaria | 10% | **79** | +12 | `iteracion-001/AUDITORIA-M9-nutricion-seguridad.md` | 2026-07-09 |
| 3 | Motor de recetas | 9% | 48 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado esta iteración) | 2026-07-09 |
| 4 | IA | 8% | 58 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado) | 2026-07-09 |
| 5 | UX | 8% | 60 | 0 | `iteracion-001/AUDITORIA-M9-ux-accesibilidad.md` — re-verificado en vivo, sin cambio de flujo esta iteración | 2026-07-09 |
| 6 | Personalización | 8% | 71 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado; el campo alérgenos no re-evaluado en esta categoría) | 2026-07-09 |
| 7 | Arquitectura | 7% | 62 | 0 | `iteracion-001/AUDITORIA-arquitectura.md` (no re-auditado; nota: se añadieron tests a `clinicalSafety.ts`, mejora real no certificada por no exceder el criterio de auto-certificación) | 2026-07-09 |
| 8 | Rendimiento | 6% | 40 | 0 | `iteracion-001/AUDITORIA-rendimiento.md` (no tocado) | 2026-07-09 |
| 9 | Escalabilidad | 5% | **33** | +5 | `iteracion-001/AUDITORIA-M9-escalabilidad.md` — RLS verificado activo en producción; A-1/A-2/A-3 (paginación/índices/multi-tenant) siguen abiertos | 2026-07-09 |
| 10 | Accesibilidad | 5% | **54** | +16 | `iteracion-001/AUDITORIA-M9-ux-accesibilidad.md` — hallazgo crítico `button-name` eliminado (verificado con axe antes/después), contraste sistémico resuelto | 2026-07-09 |
| 11 | UI | 5% | 66 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado) | 2026-07-09 |
| 12 | Retención | 5% | 35 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado) | 2026-07-09 |
| 13 | Monetización | 4% | 0 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado; decisión de negocio pendiente) | 2026-07-09 |
| 14 | Gamificación | 3% | 20 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado) | 2026-07-09 |
| 15 | Calidad del contenido | 3% | **64** | +4 | Disclaimer general añadido al PDF (MEJORA-007), verificado directamente por el orquestador (delta ≤5, sin necesidad de segunda verificación por §2.2) | 2026-07-09 |
| 16 | Competencia | 2% | 55 | 0 | `iteracion-001/AUDITORIA-orquestador.md` (no tocado) | 2026-07-09 |

**M9/M10 cerrado.** 3 categorías re-auditadas con verificación independiente (Nutrición/Seguridad alimentaria, Escalabilidad, UX/Accesibilidad — todas por un agente distinto al que implementó la mejora, según exige §2.2 para deltas >5). 1 categoría autocertificada por el orquestador (Calidad del contenido, delta ≤5). 10 categorías sin cambio, correctamente no re-auditadas por no haber sido tocadas.
