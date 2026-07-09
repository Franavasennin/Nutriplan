# Scorecard — DietMaster Pro

Puntuación viva y acumulativa. Cada celda enlaza a la evidencia que la respalda. Ver reglas anti-inflación en `LOOP-MAESTRO-100.md` §2.2.

## Nota global por iteración

| Iteración | Fecha | Nota global | Nutrición | Seg. alimentaria | Notas |
|---|---|---|---|---|---|
| 000 (baseline técnico) | 2026-07-09 | *pendiente de M1* | *pendiente* | *pendiente* | Solo se registró línea base técnica (tests/build), no auditoría completa. Ver `iteracion-000/BASELINE-TECNICO.md` |
| 001 (M1 parcial) | 2026-07-09 | **INCOMPLETA — 12/16 categorías (76% del peso)** | 74 | 67 | 3 subagentes (Rendimiento, Escalabilidad, UX/Accesibilidad) fallaron por límite de sesión de la API a mitad de tarea. Nota global no calculable hasta cerrar las 4 categorías restantes (24% del peso: Rendimiento 6%, Escalabilidad 5%, UX 8%, Accesibilidad 5%). |

**Nota preliminar sobre el tope de seguridad (§2.1):** Nutrición (74) y Seguridad alimentaria (67) están ambas por debajo de 80 → si se cerrara la iteración hoy, la nota global quedaría **capada a 59** hasta resolver los 2 hallazgos bloqueantes de Seguridad alimentaria (sistema de 14 alérgenos inexistente + conflicto exclusión↔rotación de proteínas). Ver `iteracion-001/AUDITORIA-nutricion-seguridad.md`.

## Detalle por categoría (iteración 001, M1 — primera auditoría real)

| # | Categoría | Peso | Nota | Evidencia | Última actualización |
|---|---|---|---|---|---|
| 1 | Nutrición | 12% | **74** | `iteracion-001/AUDITORIA-nutricion-seguridad.md` | 2026-07-09 |
| 2 | Seguridad alimentaria | 10% | **67** | `iteracion-001/AUDITORIA-nutricion-seguridad.md` | 2026-07-09 |
| 3 | Motor de recetas | 9% | **48** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 4 | IA | 8% | **58** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 5 | UX | 8% | ⬜ pendiente | agente falló (límite de sesión) | — |
| 6 | Personalización | 8% | **71** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 7 | Arquitectura | 7% | **62** | `iteracion-001/AUDITORIA-arquitectura.md` | 2026-07-09 |
| 8 | Rendimiento | 6% | ⬜ pendiente | agente falló (límite de sesión) | — |
| 9 | Escalabilidad | 5% | **28** | `iteracion-001/AUDITORIA-escalabilidad.md` — ⚠️ hallazgo CRÍTICO: RLS deshabilitado en 4/5 tablas, contradice la nota del proyecto | 2026-07-09 |
| 10 | Accesibilidad | 5% | ⬜ pendiente | agente falló (límite de sesión) | — |
| 11 | UI | 5% | **66** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 12 | Retención | 5% | **35** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 13 | Monetización | 4% | **0** | `iteracion-001/AUDITORIA-orquestador.md` (ver nota: posible repeso/exclusión pendiente de decisión Humano-PO) | 2026-07-09 |
| 14 | Gamificación | 3% | **20** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 15 | Calidad del contenido | 3% | **60** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |
| 16 | Competencia | 2% | **55** | `iteracion-001/AUDITORIA-orquestador.md` | 2026-07-09 |

**Nota global:** no calculable hasta que UX, Rendimiento, Escalabilidad y Accesibilidad tengan nota (§2.1 fórmula exige las 16 categorías). Media ponderada provisional de las 12 categorías cerradas (informativa, no oficial): **~55/100**, ya afectada por el tope de seguridad potencial.
