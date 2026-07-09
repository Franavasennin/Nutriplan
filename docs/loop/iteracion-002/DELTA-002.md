# DELTA — M10 Recalcular puntuación — Iteración 002

**Fecha:** 2026-07-09 · Compara el cierre de la iteración 001 (56.10, pesos originales) con el cierre de la iteración 002 (59.04, pesos reponderados).

## Nota global

| | Nota | Nota (a pesos nuevos, para comparar de forma justa) |
|---|---|---|
| Cierre iteración 001 | 56.10 (pesos originales) | 58.44 (mismas notas, pesos nuevos) |
| Cierre iteración 002 | — | **59.04** |
| **Δ real de producto** | | **+0.60** |
| Δ contable por repeso de Monetización | | +2.34 |
| **Δ total mostrado en SCORECARD.md** | | +2.94 |

## Categorías que cambiaron

| Categoría | Antes | Ahora | Δ | Qué cambió | Evidencia |
|---|---|---|---|---|---|
| Rendimiento | 40 | 43 | +3 | Fuente de iconos 1.1MB→32KB (subconjunto `icon_names`), CLS corregido de 0.109 a 0.056 con `display=block`. Score de Lighthouse NO mejoró de forma clara (cuello de botella real: bundle JS, no tocado) | `MEJORA-008.md` |
| Seguridad alimentaria | 79 | 83 | +4 | Verificador determinista post-generación de alérgenos (`utils/allergenVerification.ts`) + fix de falso positivo en matching de leche vegetal | `MEJORA-010.md`, `MEJORA-009` (sin ficha formal, fix menor) |

**Categorías sin cambio:** las 13 restantes (Nutrición, Motor de recetas, IA, UX, Personalización, Arquitectura, Escalabilidad, Accesibilidad, UI, Retención, Gamificación, Calidad del contenido, Competencia).

## Regla anti-inflación (§2.2)

Ambos deltas de esta iteración (+3, +4) están dentro del umbral de autocertificación (≤5) — no se requirió despachar subagentes de re-auditoría independiente. Evidencia citada directamente: mediciones de Lighthouse (3 corridas, ver `lighthouse-mobile-fontblock*.json`) para Rendimiento; tests unitarios (`allergenVerification.test.ts`, `shoppingList.test.ts`) para Seguridad alimentaria.

## Efecto del repeso de Monetización (M12)

Separado explícitamente en `SCORECARD.md` para que no se confunda con progreso real: excluir Monetización (que estaba en 0/100, arrastrando la media) sube la nota global en +2.34 sin que el producto haya mejorado en nada. Es una decisión de gobernanza legítima (la app es herramienta interna, no tiene sentido perseguir ese criterio), pero debe leerse como tal — no como una mejora de producto.

## Regresiones

Ninguna. 138/138 tests OK (subieron de 127 a 138: +11 tests nuevos en esta iteración).

## Camino hacia el 100

A ritmo de +0.60/iteración de mejora real de producto, llegar a un global alto requeriría muchas iteraciones más — el score compuesto pesa fuerte las categorías aún bajas (Monetización ya fuera, pero Gamificación 20, Retención 35, Escalabilidad 33, Rendimiento 43, Motor de recetas 48 siguen arrastrando mucho). Las palancas de mayor impacto pendientes: A-007 (paginación/índices Escalabilidad), evals de IA (requiere autorización de coste), sign-off del Humano-DN (desbloquea el techo de Nutrición/Seguridad alimentaria), y features grandes de Competencia (app de paciente, telemedicina) que no son ajustes de código sino nuevas construcciones sustanciales.
