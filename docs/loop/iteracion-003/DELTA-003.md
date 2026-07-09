# DELTA — M10 Recalcular puntuación — Iteración 003

**Fecha:** 2026-07-09 · Compara el cierre de la iteración 002 (59.04) con el cierre de la 003. Todos los deltas son ≤5 → autocertificados con evidencia directa (§2.2 no exige segunda verificación).

## Nota global

| | Nota |
|---|---|
| Cierre iteración 002 | 59.04 |
| Cierre iteración 003 | **60.49** |
| **Δ (todo mejora real de producto — sin cambios de pesos esta vez)** | **+1.45** |

## Categorías que cambiaron

| Categoría | Antes | Ahora | Δ | Qué cambió | Evidencia |
|---|---|---|---|---|---|
| Seguridad alimentaria | 83 | 86 | +3 | Verificador de alérgenos extendido a TODOS los puntos de generación (pareja, regenerar día, swap) — cobertura completa del riesgo M-002 | MEJORA-011, commit `94a90d5`, 145 tests |
| Arquitectura | 62 | 66 | +4 | Cobertura instrumentada por primera vez: núcleo clínico `utils/` medido en **95.36% líneas — CUMPLE el criterio C4 (≥90%) de §8**, antes no medible. `macroValidation` (74%) identificado como el más flojo del núcleo | MEJORA-012, commit `68367fc`, salida de `npm run test:coverage` |
| Motor de recetas | 48 | 53 | +5 | (a) Alérgenos disponibles para todo el corpus vía derivación heurística etiquetada + badge en RecipeSearch; (b) **bug preexistente corregido: el corpus de 68 recetas nunca se usaba** (`[] ?? RECIPES` devolvía `[]`) — el buscador local mostraba "0 recetas" siempre; ahora muestra y filtra las 68 | MEJORA-013, commit `9e55692`, verificado en vivo |
| Accesibilidad | 54 | 58 | +4 | ConfirmDialog con role/aria-modal/labelledby/foco/Escape (verificado en el DOM en vivo); aria-current en Sidebar/MobileNav; aria-label en español para botones de solo-icono | MEJORA-014, commit `6d8e955` |
| UX | 60 | 62 | +2 | Estado vacío de bienvenida con CTA en el Dashboard (caso negativo verificado en vivo; positivo por revisión de código) | MEJORA-015, commit `68960ee` |

**Cálculo (pesos reponderados de la iteración 002):**
```
(12.5×75 + 10.4167×86 + 9.375×53 + 8.3333×58 + 8.3333×62 + 8.3333×71
 + 7.2917×66 + 6.25×43 + 5.2083×33 + 5.2083×58 + 5.2083×66 + 5.2083×35
 + 3.125×20 + 3.125×64 + 2.0833×55) / 100 = 60.49

Topes de §2.1: no aplican (Seg. alimentaria 86 ≥80; ninguna categoría ≥90).
```

## Regresiones

Ninguna. 145/145 tests (127→145 en esta iteración, +18 nuevos). `tsc` limpio en cada mejora. Caso negativo del estado vacío verificado en vivo (12 clientes → sin bloque de bienvenida, 12 tarjetas intactas).

## Notas de honestidad

- El hallazgo más valioso de la iteración no estaba en el backlog: el buscador local de recetas llevaba roto desde que se introdujo la prop `recipes` (mostraba 0 recetas siempre). Se detectó porque este proceso verifica en vivo, no solo compila.
- La cobertura del núcleo clínico (95.36%) cumple C4, pero `geminiService.ts` está al 32% (solo las funciones puras de prompt) — subirlo requeriría mocks de la API, registrado como trabajo futuro, no reclamado como logro.
- Los umbrales clínicos siguen "PENDIENTE DE VALIDACIÓN CLÍNICA" (sin sign-off de Ester Correa) — nada de esta iteración cambia eso.
