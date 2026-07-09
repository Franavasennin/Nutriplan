# MEJORA-005 — Contraste AA de tokens de color

**Iteración:** 001 · **Categoría:** Accesibilidad (5%) · **Origen:** A-002 (alto)

## Problema

Dos tokens de Tailwind fallan contraste AA de forma sistémica, verificado en vivo con axe en 7 vistas:
- `text-sub` (`#61896f`, `tailwind.config.js:23`) sobre blanco → ratio 3.95:1 (mínimo AA 4.5:1), repetido en decenas de nodos (81 en Dashboard, 47 en plan de dieta, 41 en Historial).
- `text-primary` (`#13ec5b`) usado como texto sobre blanco → ratio 1.59:1, en valores de kcal de las tarjetas de cliente (`Dashboard.tsx:297`).

Evidencia: `iteracion-001/AUDITORIA-ux-accesibilidad.md`.

## Solución propuesta

1. Oscurecer `text-sub` en `tailwind.config.js` a un valor que alcance ≥4.5:1 sobre blanco (ej. `#4a6b57` o similar, verificar con calculadora de contraste antes de fijar el valor final).
2. Para los usos de `text-primary` como texto (no como fondo/acento), introducir un token nuevo `text-primary-accessible` (más oscuro) reservado para texto, dejando `text-primary` para fondos/iconos donde el contraste no aplica igual.
3. Aplicar el nuevo token en `Dashboard.tsx:297` y cualquier otro uso de `text-primary` como color de texto sobre fondo claro (grep antes de tocar, para no dejar ninguno).
4. Verificar también en tema oscuro (no auditado en vivo en M1) que el cambio no rompe el contraste ya aceptable ahí.

## No-alcance

- No se cambia la paleta de marca en fondos, botones o iconos — solo el uso como color de texto.
- No se resuelve `heading-order` ni los modales sin semántica (hallazgos separados, no seleccionados para esta iteración).

## Criterios de aceptación (medibles)

- [ ] Los 2 tokens alcanzan ratio ≥4.5:1 verificado con herramienta de contraste (ej. WebAIM) antes de commitear.
- [ ] `npx axe` ya no reporta `color-contrast` en las 7 vistas previamente escaneadas (Dashboard, PatientForm, ProgressTracker, FoodDatabase, Historial, DietPlanDisplay, Lista de la compra).
- [ ] Verificación visual en ambos temas (claro/oscuro) sin regresión de legibilidad.

## Δ puntos estimado

- Categoría: Accesibilidad · Criterio §8: C2 (contraste AA en ambos temas) · Estimación: +12 puntos (Confianza: 1.0 — cambio mecánico y de bajo riesgo, alto impacto por ser sistémico)

## Plan de prueba

- Re-ejecutar `npx axe` en las 7 vistas, comparar resultado antes/después.
- Captura visual en 2 temas para confirmar que el cambio de color no desentona.

## Plan de rollback

Revertir el commit; cambio de valores hexadecimales en `tailwind.config.js` y clases en 1-2 componentes.

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
