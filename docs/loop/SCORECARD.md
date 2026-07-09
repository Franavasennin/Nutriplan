# Scorecard — DietMaster Pro

Puntuación viva y acumulativa. Cada celda enlaza a la evidencia que la respalda. Ver reglas anti-inflación en `LOOP-MAESTRO-100.md` §2.2.

## Nota global por iteración

| Iteración | Fecha | Nota global | Nutrición | Seg. alimentaria | Notas |
|---|---|---|---|---|---|
| 000 (baseline técnico) | 2026-07-09 | *pendiente de M1* | *pendiente* | *pendiente* | Solo se registró línea base técnica (tests/build), no auditoría completa. Ver `iteracion-000/BASELINE-TECNICO.md` |
| 001 (M1, antes de M8) | 2026-07-09 | 53.61 / 100 — banda Básico | 74 | 67 | Primera auditoría completa de las 16 categorías (histórico). |
| 001 (M9/M10, tras M8) | 2026-07-09 | 56.10 / 100 — banda Básico (40-59) | 75 | 79 | 7 mejoras ejecutadas y re-auditadas. Δ +2.49 vs. cierre de M1 (histórico, pesos originales — superado por la fila de abajo). |
| 002 (M9/M10) | 2026-07-09 | 59.04 / 100 — banda Básico (40-59) | 75 | 83 | Pesos reponderados (Monetización 4%→0%, M12) + 3 mejoras. Ver `DELTA-002.md` (histórico, superado por la fila de abajo). |
| **003 (M9/M10)** | 2026-07-09 | **60.49 / 100** — banda Funcional (60-74) 🎉 | 75 | 86 | 5 mejoras autónomas + 1 bug preexistente descubierto y corregido (el buscador local de recetas mostraba siempre "0 recetas"). Δ +1.45, todo mejora real (sin cambios de pesos). **Primera vez en banda Funcional.** Ver `iteracion-003/DELTA-003.md`. |

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

**M9/M10 de la iteración 001 cerrado.** 3 categorías re-auditadas con verificación independiente (Nutrición/Seguridad alimentaria, Escalabilidad, UX/Accesibilidad — todas por un agente distinto al que implementó la mejora, según exige §2.2 para deltas >5). 1 categoría autocertificada por el orquestador (Calidad del contenido, delta ≤5). 10 categorías sin cambio, correctamente no re-auditadas por no haber sido tocadas.

---

## Iteración 002 — pesos reponderados + 3 mejoras (2026-07-09)

**Decisión de gobernanza (M12):** Monetización 4% → 0% (excluida), redistribuido proporcionalmente entre las 15 categorías restantes (factor ×25/24). Ver `LOOP-MAESTRO-100.md` §1.2.

### Efecto separado: repeso vs. mejoras reales

```
Paso 1 — Solo el repeso (mismas notas del cierre de iteración 001, pesos nuevos):
Nota = (12.5×75 + 10.4167×79 + 9.375×48 + 8.3333×58 + 8.3333×60 + 8.3333×71
        + 7.2917×62 + 6.25×40 + 5.2083×33 + 5.2083×54 + 5.2083×66 + 5.2083×35
        + 3.125×20 + 3.125×64 + 2.0833×55) / 100
= 5843.75 / 100 = 58.44

Δ solo por repeso = 58.44 - 56.10 = +2.34 (no es mejora real de producto,
es un efecto contable de excluir una categoría que no aplica al modelo
de negocio actual)

Paso 2 — Más las 3 mejoras de esta iteración:
- MEJORA-008 (Rendimiento): 40 → 43 (+3, autocertificado)
- MEJORA-009+010 (Seguridad alimentaria): 79 → 83 (+4, autocertificado —
  MEJORA-010 el verificador post-generación; MEJORA-009 el fix de falso
  positivo es de impacto marginal, no se le atribuye Δ propio)

Nota = (12.5×75 + 10.4167×83 + 9.375×48 + 8.3333×58 + 8.3333×60 + 8.3333×71
        + 7.2917×62 + 6.25×43 + 5.2083×33 + 5.2083×54 + 5.2083×66 + 5.2083×35
        + 3.125×20 + 3.125×64 + 2.0833×55) / 100
= 5904.16 / 100 = 59.04

Tope de seguridad (§2.1): Seguridad alimentaria (83) ya está ≥80 → no
  activa el cap. Nutrición (75) sigue <80, pero el cap solo se dispara si
  Nutrición Y Seguridad están ambas <80 simultáneamente — ya no aplica.
Tope de mínimos: no aplica (ninguna categoría ≥90).

NOTA GLOBAL OFICIAL ITERACIÓN 002 = 59.04 / 100
Δ real de producto (excluyendo el efecto contable del repeso) = +0.60
```

**Lectura importante:** de los +2.94 puntos totales de esta iteración, +2.34 vienen de una decisión de gobernanza (excluir Monetización), no de mejorar el producto. La mejora real de producto es +0.60 — modesto, porque las 3 mejoras (fuente de iconos, fix de alérgenos, verificador post-generación) son de bajo esfuerzo/alto valor de seguridad pero no mueven mucho la aguja de puntos brutos. **Seguridad alimentaria cruza el umbral de 80 por primera vez**, lo que desactiva el tope de seguridad de §2.1 (aunque Nutrición siga por debajo, el cap requiere que ambas lo estén).

## Detalle por categoría (tras iteración 002)

| # | Categoría | Peso nuevo | Nota | Δ esta iteración | Evidencia |
|---|---|---|---|---|---|
| 1 | Nutrición | 12.50% | 75 | 0 | Sin cambios |
| 2 | Seguridad alimentaria | 10.42% | **83** | +4 | `iteracion-002/MEJORA-010.md` — verificador post-generación |
| 3 | Motor de recetas | 9.38% | 48 | 0 | Sin cambios |
| 4 | IA | 8.33% | 58 | 0 | Sin cambios |
| 5 | UX | 8.33% | 60 | 0 | Sin cambios |
| 6 | Personalización | 8.33% | 71 | 0 | Sin cambios |
| 7 | Arquitectura | 7.29% | 62 | 0 | Sin cambios |
| 8 | Rendimiento | 6.25% | **43** | +3 | `iteracion-002/MEJORA-008.md` — fuente de iconos 1.1MB→32KB, CLS corregido |
| 9 | Escalabilidad | 5.21% | 33 | 0 | Sin cambios (A-007 pendiente para futura iteración) |
| 10 | Accesibilidad | 5.21% | 54 | 0 | Sin cambios |
| 11 | UI | 5.21% | 66 | 0 | Sin cambios |
| 12 | Retención | 5.21% | 35 | 0 | Sin cambios |
| 13 | Monetización | 0% ⚠️ | — | — | Excluida del cálculo (decisión M12) |
| 14 | Gamificación | 3.13% | 20 | 0 | Sin cambios |
| 15 | Calidad del contenido | 3.13% | 64 | 0 | Sin cambios |
| 16 | Competencia | 2.08% | 55 | 0 | Sin cambios |

**Iteración 002 cerrada.** 2 categorías tocadas (Rendimiento, Seguridad alimentaria), ambas con delta autocertificado ≤5 (no requirió despachar subagentes de re-auditoría). 13 categorías sin cambio.

---

## Iteración 003 — 5 mejoras autónomas (2026-07-09)

Notas actualizadas (deltas ≤5, autocertificados con evidencia — ver `iteracion-003/DELTA-003.md` para el detalle y el cálculo completo):

| Categoría | 002 | 003 | Δ | Mejora |
|---|---|---|---|---|
| Seguridad alimentaria | 83 | **86** | +3 | MEJORA-011: verificador de alérgenos en todos los puntos de generación |
| Arquitectura | 62 | **66** | +4 | MEJORA-012: cobertura instrumentada — núcleo clínico 95.36% (cumple C4 ≥90%) |
| Motor de recetas | 48 | **53** | +5 | MEJORA-013: alérgenos derivados + fix del buscador local (bug preexistente: siempre "0 recetas") |
| Accesibilidad | 54 | **58** | +4 | MEJORA-014: ARIA en ConfirmDialog + aria-current/aria-label en navegación |
| UX | 60 | **62** | +2 | MEJORA-015: estado vacío de bienvenida en Dashboard |

Resto de categorías sin cambio. **Nota global: 60.49 — cruza a banda "Funcional" (60-74) por primera vez.** 145/145 tests, 0 regresiones.
