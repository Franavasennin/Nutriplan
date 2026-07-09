# Scorecard — DietMaster Pro

Puntuación viva y acumulativa. Cada celda enlaza a la evidencia que la respalda. Ver reglas anti-inflación en `LOOP-MAESTRO-100.md` §2.2.

## Nota global por iteración

| Iteración | Fecha | Nota global | Nutrición | Seg. alimentaria | Notas |
|---|---|---|---|---|---|
| 000 (baseline técnico) | 2026-07-09 | *pendiente de M1* | *pendiente* | *pendiente* | Solo se registró línea base técnica (tests/build), no auditoría completa. Ver `iteracion-000/BASELINE-TECNICO.md` |
| **001 (M1 completo)** | 2026-07-09 | **53.61 / 100** — banda Básico (40-59) | 74 | 67 | Primera auditoría completa de las 16 categorías. Ver cálculo abajo. |

### Cálculo de la nota global (§2.1)

```
Nota global = Σ (nota_categoría × peso_categoría) / 100
= (12×74 + 10×67 + 9×48 + 8×58 + 8×60 + 8×71 + 7×62 + 6×40
   + 5×28 + 5×38 + 5×66 + 5×35 + 4×0 + 3×20 + 3×60 + 2×55) / 100
= 5361 / 100 = 53.61

Tope de seguridad (§2.1): Nutrición (74) y Seguridad alimentaria (67) < 80
  → activaría cap a 59, pero 53.61 ya está por debajo de 59 → el tope no
    cambia el resultado (53.61 se mantiene).
Tope de mínimos: no aplica (ninguna categoría ≥90).

NOTA GLOBAL OFICIAL ITERACIÓN 001 = 53.61 / 100
```

**Lectura:** el tope de seguridad no tuvo que "morder" porque la media ponderada ya refleja con crudeza que Seguridad alimentaria (67), Escalabilidad (28), Rendimiento (40), Accesibilidad (38), Retención (35), Gamificación (20) y Monetización (0) arrastran la nota muy por debajo de lo que Nutrición (74) o Personalización (71) sugerirían por sí solas. Esto es exactamente el efecto que el diseño de §2.1 busca: impedir que una app "bonita" en pocas categorías se declare buena en conjunto.

## Detalle por categoría (iteración 001, M1 — primera auditoría real)

| # | Categoría | Peso | Nota | Evidencia | Última actualización |
|---|---|---|---|---|---|
| 1 | Nutrición | 12% | **74** | `iteracion-001/AUDITORIA-nutricion-seguridad.md` | 2026-07-09 |
| 2 | Seguridad alimentaria | 10% | **67** | `iteracion-001/AUDITORIA-nutricion-seguridad.md` | 2026-07-09 |
| 3 | Motor de recetas | 9% | **48** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 4 | IA | 8% | **58** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 5 | UX | 8% | **60** | `iteracion-001/AUDITORIA-ux-accesibilidad.md` — verificado en vivo (Playwright+axe real, 7 vistas navegadas) | 2026-07-09 |
| 6 | Personalización | 8% | **71** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 7 | Arquitectura | 7% | **62** | `iteracion-001/AUDITORIA-arquitectura.md` | 2026-07-09 |
| 8 | Rendimiento | 6% | **40** | `iteracion-001/AUDITORIA-rendimiento.md` — hallazgo crítico: fuente de iconos de 1.1MB domina el peso de página | 2026-07-09 |
| 9 | Escalabilidad | 5% | 28 (M1) | `iteracion-001/AUDITORIA-escalabilidad.md` — hallazgo C-1/C-2 (RLS) **resuelto en M8**: verificación de solo lectura confirmó RLS activo en producción; solo se corrigió el script local desactualizado. Nota pendiente de recalcular en M9 (persisten A-1/A-2/A-3 sin resolver: paginación, índices, multi-tenant) | 2026-07-09 |
| 10 | Accesibilidad | 5% | **38** | `iteracion-001/AUDITORIA-ux-accesibilidad.md` — ⚠️ hallazgo CRÍTICO: 46 checkboxes sin nombre accesible en lista de la compra | 2026-07-09 |
| 11 | UI | 5% | **66** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 12 | Retención | 5% | **35** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 13 | Monetización | 4% | **0** | `iteracion-001/AUDITORIA-orquestador.md` (ver nota: posible repeso/exclusión pendiente de decisión Humano-PO) | 2026-07-09 |
| 14 | Gamificación | 3% | **20** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 15 | Calidad del contenido | 3% | **60** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 16 | Competencia | 2% | **55** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |

**M1 cerrado — 16/16 categorías.** Ver cálculo oficial de la nota global arriba (§ inicio del documento).
