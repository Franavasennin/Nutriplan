# MEJORA-008 — Subconjunto de la fuente de iconos + fix de CLS

**Iteración:** 002 · **Categoría:** Rendimiento · **Origen:** A-001 (hallazgo crítico de la auditoría de Rendimiento, iteración 001)

## Problema

La fuente "Material Symbols Outlined" se pedía completa (rango de variación `wght@100..700,0..1`, miles de glifos), pesando 1.1 MB (87% del peso total de página) — el mayor contribuyente individual a LCP/FCP. Evidencia: `iteracion-001/AUDITORIA-rendimiento.md` C-1.

## Solución aplicada

1. Extraídos los ~88 nombres de icono realmente usados en toda la app (`grep` de `material-symbols-outlined` + propiedades `icon:` en componentes y `types.ts`).
2. Cambiado el `<link>` de `index.html` para pedir la fuente vía el parámetro `icon_names` de Google Fonts, manteniendo el mismo `font-family` y las mismas clases CSS — **cero cambios en ningún componente**.
3. Verificado que la app usa la variación `FILL` (icono activo del menú, `.active-nav-icon`) — se mantuvo el rango `wght,FILL@100..700,0..1` en la URL subconjuntada para no romper ese efecto.
4. Al medir, se detectó un aumento de CLS (0.037→0.109) causado por el intercambio de fuente (texto de reserva → glifo de icono cambia el tamaño de la caja). Corregido cambiando `display=swap` a `display=block` específicamente para esta fuente (Manrope conserva `swap`) — estándar para fuentes de iconos, oculta brevemente el glifo en vez de mostrar texto de reserva que después cambia de tamaño.

## Resultado medido

| Métrica | Antes (iteración 001) | Después |
|---|---|---|
| Peso total de página | 1.288 KiB | **223 KiB** (−83%) |
| Peso de la fuente de iconos | 1.125.001 bytes | ~32.144 bytes (−97%) |
| CLS | 0.037 | 0.056-0.059 (con `display=block`; sin él llegaba a 0.109) |
| Score Lighthouse / LCP / TBT | 79 / 3.54s / 300ms | 72-78 / 3.4-3.6s / 340-510ms (alta varianza de entorno, sin movimiento claro) |

**Lectura honesta:** el peso de página baja un 83% de forma sólida y reproducible (3 mediciones), y el riesgo de CLS introducido por el cambio se corrigió. Pero el *score* de Lighthouse no se mueve de forma clara — el cuello de botella real para el score sigue siendo el chunk JS principal (504 kB, 58.8% sin usar en la carga inicial, hallazgo A-2 de la auditoría original, no tocado por esta mejora). Se reporta así para no inflar la nota de Rendimiento.

## Verificación visual

Confirmado en el navegador (Dashboard, formulario de nuevo cliente): todos los iconos renderizan correctamente, incluida la variación `FILL` del icono activo del menú de navegación. Sin regresión visual.

## Criterios de aceptación

- [x] Peso de la fuente de iconos reducido >90%.
- [x] Ningún icono roto o ausente en verificación visual (Dashboard, PatientForm).
- [x] CLS dentro de presupuesto (<0.1) tras el fix de `display`.
- [x] 127/127 tests OK, `tsc` limpio, build limpio.
- [ ] Movimiento claro del score de Lighthouse — NO logrado; el cuello de botella real es el bundle JS (A-2), pendiente de una mejora futura.

## Δ puntos estimado (conservador)

- Categoría: Rendimiento · Estimación: **+3 puntos** (autocertificado, ≤5, no requiere segunda verificación por §2.2) — reconoce la reducción sólida de peso y el fix de CLS, sin sobreestimar el impacto en el score compuesto de Lighthouse.
