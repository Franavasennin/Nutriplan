# MEJORA-004 — Accesibilidad de checkboxes en la lista de la compra

**Iteración:** 001 · **Categoría:** Accesibilidad (5%) · **Origen:** B-003 (bloqueante, crítico verificado en vivo)

## Problema

Los 46 checkboxes personalizados de la lista de la compra son `<button onClick={...}>` completamente vacíos, sin `aria-label`, `aria-checked` ni `role="checkbox"`. Regla axe `button-name`, impacto crítico. Localización: `components/DietPlanDisplay.tsx:990-995`. Evidencia: `iteracion-001/AUDITORIA-ux-accesibilidad.md`.

## Solución propuesta

Añadir a cada botón-checkbox: `role="checkbox"`, `aria-checked={isChecked}` y `aria-label={`Marcar ${itemName} como comprado`}` (o "desmarcar" según estado). Sin cambiar la lógica de `toggleShopItem` ni el aspecto visual — es un cambio puramente de atributos ARIA.

## No-alcance

- No se rediseña visualmente el componente de checkbox.
- No se resuelve `label-title-only` (inputs del panel de edición con solo `title`) — eso queda para otra mejora si se prioriza en una iteración futura.

## Criterios de aceptación (medibles)

- [ ] `npx axe http://localhost:5173` (o la vista específica) ya no reporta la violación `button-name` en la lista de la compra.
- [ ] Verificación manual: el estado de "marcado/no marcado" se anuncia correctamente (comprobable inspeccionando `aria-checked` en el DOM).
- [ ] Sin regresión visual (captura antes/después idéntica salvo atributos no visibles).

## Δ puntos estimado

- Categoría: Accesibilidad · Criterio §8: C1 (axe 0 errores en flujos núcleo) · Estimación: +6 puntos (Confianza: 0.9 — cambio directo y de bajo riesgo)

## Plan de prueba

- Ejecutar `npx axe` contra la vista de lista de la compra antes y después del cambio, adjuntar ambos resultados como evidencia en la re-auditoría (M9).

## Plan de rollback

Revertir el commit; cambio de atributos JSX, sin efecto en datos ni lógica.

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
