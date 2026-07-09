# MEJORA-001 — Sistema mínimo de alérgenos UE

**Iteración:** 001 · **Categoría:** Seguridad alimentaria (10%) · **Origen:** B-001 (bloqueante)

## Problema

No existe ningún sistema estructurado de los 14 alérgenos UE. Solo `PatientData.excludedFoods` (texto libre) y exclusiones obligatorias solo para celiaquía/lactosa (`utils/clinicalTargets.ts:43-54`). La lista de la compra (`utils/shoppingList.ts`) y el PDF (`services/pdfService.ts`) no mencionan alérgenos. Evidencia: `iteracion-001/AUDITORIA-nutricion-seguridad.md` B-1.

## Solución propuesta

1. Añadir un campo estructurado `allergens: Allergen[]` (enum de los 14 alérgenos UE) a `PatientData` en `types.ts`, con selector múltiple en `PatientForm.tsx` (además del texto libre existente, no en su lugar).
2. Añadir `allergens?: Allergen[]` a `Recipe` en `types.ts` (para el corpus estático) — de momento sin rellenar retroactivamente las 68 recetas (eso es WF-R, fuera de alcance de esta mejora puntual).
3. Propagar los alérgenos seleccionados del paciente como instrucción de exclusión estructurada (no solo texto libre) al prompt de `geminiService.ts`, con la misma prioridad de "EXCLUIR COMPLETAMENTE" que ya usa `excludedFoods`.
4. Marcar visualmente en la lista de la compra (`DietPlanDisplay.tsx`, panel de lista de la compra) qué ingredientes coinciden textualmente con alguno de los alérgenos declarados del paciente (matching simple por palabra clave, no NLP).
5. Añadir una línea de alérgenos declarados en la cabecera del PDF/documento imprimible.

## No-alcance

- No se rellenan los 68 registros de `data/recipes.ts` con alérgenos (eso es trabajo de WF-R, iteración futura).
- No se construye un pipeline ICR ni de validación determinista de que la IA respetó el alérgeno (eso requeriría un verificador post-generación, candidato a MEJORA futura si esta no basta).
- No se sustituye el campo de texto libre existente.

## Criterios de aceptación (medibles)

- [ ] `Allergen` enum con los 14 alérgenos UE existe en `types.ts` y compila sin error (`tsc --noEmit`).
- [ ] `PatientForm.tsx` permite seleccionar 0-14 alérgenos, persistidos en `PatientData.allergens`.
- [ ] El prompt de `geminiService.ts` incluye los alérgenos seleccionados en la sección de exclusiones obligatorias.
- [ ] La lista de la compra resalta visualmente cualquier ingrediente que contenga el nombre de un alérgeno declarado.
- [ ] El documento imprimible/PDF muestra los alérgenos declarados del paciente en la cabecera.
- [ ] Test unitario nuevo que verifica que un paciente con alérgenos declarados genera una sección de exclusión en el prompt.

## Δ puntos estimado

- Categoría: Seguridad alimentaria · Criterio §8 al que apunta: C1 (14 alérgenos detectados y propagados) · Estimación: +15 puntos (Confianza: 0.7 — cubre estructura y propagación, no verificación determinista de que la IA obedezca)

## Plan de prueba

- Test unitario: paciente sintético con 3 alérgenos → prompt generado contiene los 3 en sección de exclusión.
- Test unitario: `normalizeIngredient`/lista de la compra marca correctamente un ingrediente que coincide con un alérgeno.
- Revisión manual del PDF renderizado con paciente sintético Sintético-07.

## Plan de rollback

Revertir el commit; el campo `allergens` es opcional (`?`) por lo que no rompe datos existentes si se revierte.

## Subworkflows invocados

- [x] WF-R (recetas) — parcialmente, solo el campo de tipo en `Recipe`, no el pipeline completo
- [ ] WF-N (niveles de elaboración)
