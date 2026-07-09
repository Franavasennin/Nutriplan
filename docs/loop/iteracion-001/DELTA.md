# DELTA — M10 Recalcular puntuación — Iteración 001

**Fecha:** 2026-07-09 · Compara la auditoría M1 (inicial) con la re-auditoría M9 (tras M8, las 7 mejoras implementadas).

## Nota global

| | Nota | Banda |
|---|---|---|
| M1 (antes de M8) | 53.61 / 100 | Básico |
| M9/M10 (tras M8) | **56.10 / 100** | Básico |
| **Δ** | **+2.49** | Cumple el objetivo de §3.5 (≥+2 en iteraciones 1-5) |

## Categorías que cambiaron, con criterio movido y evidencia

| Categoría | M1 | M9 | Δ | Qué cambió de estado (criterio §8) | Evidencia |
|---|---|---|---|---|---|
| Seguridad alimentaria | 67 | 79 | +12 | C1 (14 alérgenos detectados y propagados) pasó de NO CUMPLIDO a CUMPLIDO en su mayor parte. B-1 y B-2 (bloqueantes) resueltos. C2 (batería IA) y C4 (sign-off DN) siguen sin cumplir — nota se mantiene deliberadamente <80 | `AUDITORIA-M9-nutricion-seguridad.md` |
| Nutrición | 74 | 75 | +1 | Sin cambio de criterio; mejora marginal por coherencia de plan (B-2) y salvaguarda de infrapeso severo | `AUDITORIA-M9-nutricion-seguridad.md` |
| Accesibilidad | 38 | 54 | +16 | Criterio 1 (axe 0 errores): hallazgo crítico `button-name` (46 nodos) eliminado, verificado con axe antes/después. Criterio 2 (contraste AA): los 2 tokens sistémicos desaparecieron de las 7 vistas | `AUDITORIA-M9-ux-accesibilidad.md` |
| Escalabilidad | 28 | 33 | +5 | Criterio RLS: de "deshabilitado" (0) a "activo, verificado, pero sin aislamiento por cuenta" (parcial). Advisors: de "no verificable" a "verificado, 1 WARN aceptado" | `AUDITORIA-M9-escalabilidad.md` |
| Calidad del contenido | 60 | 64 | +4 | Disclaimer general ausente en el PDF → presente. Autocertificado (delta ≤5) | Verificación directa: `grep disclaimer` en `config/clinic.ts` y `DietPlanDisplay.tsx` |
| UX | 60 | 60 | 0 | Ningún criterio de UX fue objeto de mejora esta iteración — confirmado, no solo asumido | `AUDITORIA-M9-ux-accesibilidad.md` |

**Categorías sin cambio (no tocadas, correctamente no re-auditadas):** Motor de recetas (48), IA (58), Personalización (71), Arquitectura (62), Rendimiento (40), UI (66), Retención (35), Monetización (0), Gamificación (20), Competencia (55).

## Regla anti-inflación aplicada (§2.2)

Los 3 deltas >5 puntos (Seguridad alimentaria +12, Accesibilidad +16, Escalabilidad +5 en el límite) fueron verificados por un agente **distinto** al que implementó la mejora correspondiente:
- Nutrición/Seguridad alimentaria: implementado por el orquestador directamente (M8), re-auditado por `healthcare-reviewer`.
- Escalabilidad: implementado por el orquestador (verificación MCP Supabase), re-auditado por `database-reviewer`.
- Accesibilidad: implementado por el orquestador (M8), re-auditado por `e2e-runner` con comparación axe-core antes/después nodo a nodo.

El delta de Calidad del contenido (+4) no superó el umbral de 5, por lo que se autocertificó directamente con evidencia de código citada.

## Regresiones detectadas

Ninguna. Los 3 agentes de re-auditoría confirmaron explícitamente que los hallazgos no tocados por las mejoras de esta iteración (micronutrientes de embarazo, objetivos deterministas por condición, paginación/índices/multi-tenant, heading-order, label-title-only, modales sin semántica ARIA, etc.) siguen exactamente en el mismo estado, sin empeorar.

## Hallazgos nuevos detectados durante la re-auditoría

- **Falsos positivos menores en el matching de alérgenos** (`ALLERGEN_KEYWORDS`): "leche de almendras" se marca como alérgeno Leche, "avena" se marca bajo Gluten. Erran del lado seguro (sobre-avisan), impacto bajo — candidato a backlog futuro, no bloqueante.
- **Riesgo residual reconocido:** la exclusión de un alérgeno en el plato generado sigue dependiendo del LLM — el resaltado de la lista de la compra es un aviso pasivo, no un bloqueo determinista. No es una regresión (es el no-alcance ya declarado en MEJORA-001), pero queda registrado como candidato de mejora futura (verificador post-generación).
