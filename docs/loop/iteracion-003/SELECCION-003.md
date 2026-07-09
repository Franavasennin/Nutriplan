# SELECCIÓN + FICHAS — Iteración 003 (M3/M4 compactos)

**Fecha:** 2026-07-09 · **Método:** §3.3 sobre el backlog vivo. Sin bloqueantes abiertos (todos resueltos en iteraciones 001-002), así que toda la selección sale de la fórmula Impacto×Confianza/Esfuerzo. Formato compacto: una ficha por sección en este único documento (mismo contenido que exige M4, menos overhead documental — decisión del orquestador).

**Criterio de esta iteración:** solo mejoras ejecutables de forma autónoma — sin coste de API de IA (evals vetadas sin autorización puntual), sin tocar producción de Supabase (índices A-007 se preparan pero no se aplican), sin decisiones clínicas nuevas (todo lo clínico queda etiquetado "pendiente de validación DN").

## Selección (5 mejoras)

| # | Mejora | Categoría | Prioridad calculada | Origen |
|---|---|---|---|---|
| MEJORA-011 | Extender verificador de alérgenos a TODOS los puntos de generación | Seguridad alimentaria | (7×0.9)/3 = 2.10 | Extensión de MEJORA-010 (backlog it. 002) |
| MEJORA-012 | Instrumentar cobertura de tests (@vitest/coverage-v8) | Arquitectura | (5×1.0)/2 = 2.50 | A-006 parcial (C4 de §8 no era medible) |
| MEJORA-013 | Alérgenos derivados en runtime para el corpus de 68 recetas + badge en RecipeSearch | Motor de recetas / Seguridad alimentaria | (6×0.8)/3 = 1.60 | A-008 |
| MEJORA-014 | Semántica ARIA de modales (ConfirmDialog) + aria-current en navegación | Accesibilidad | (6×0.9)/3 = 1.80 | Hallazgos "moderado" de la auditoría UX/a11y |
| MEJORA-015 | Estado vacío de bienvenida en Dashboard | UX | (4×1.0)/1 = 4.00 | Hallazgo UX (criterio 3 de §8, "estados vacíos") |

No seleccionadas esta vez: A-007 índices/paginación Supabase (los índices tocan producción — se pospone hasta ronda con aprobación), A-003/A-004 (requieren sign-off DN previo), A-009 evals (coste API), fuente `text-primary` en MobileNav (pendiente auditoría con viewport móvil).

---

## MEJORA-011 — Verificador de alérgenos en todos los puntos de generación

**Problema:** MEJORA-010 solo cubre `handleFormSubmit` (generación inicial individual). Los otros 5 puntos donde la IA produce comida (`handleCoupleSubmit`, `handleRegenerateDay`, swap de comida, añadir toma, `adaptPlanToPartner`) siguen sin verificación determinista.
**Solución:** invocar `verifyPlanAgainstAllergens` (planes completos) o una variante por-comida (swap/añadir toma) en cada punto, con el mismo toast de aviso. Sin bloquear ni corregir automáticamente.
**Aceptación:** test unitario de la variante por-comida; verificación de que cada handler llama al verificador (revisión de código); 0 regresiones en suite.
**Δ estimado:** Seguridad alimentaria +3 (autocertificable).
**Rollback:** revertir commit, sin migración.

## MEJORA-012 — Cobertura de tests instrumentada

**Problema:** El criterio C4 de Arquitectura (§8: cobertura núcleo clínico ≥90%) no es medible — no hay herramienta de cobertura instalada (hallazgo A-4 de la auditoría de Arquitectura).
**Solución:** instalar `@vitest/coverage-v8`, añadir script `test:coverage`, ejecutar y registrar el % real del núcleo clínico (`utils/`) como línea base en la ficha.
**Aceptación:** `npm run test:coverage` funciona y reporta % por fichero; % de `utils/` registrado con evidencia.
**Δ estimado:** Arquitectura +3 (habilita la métrica; el % que salga se registra sin inflar).
**Rollback:** desinstalar devDependency.

## MEJORA-013 — Alérgenos derivados para el corpus de recetas

**Problema:** Las 68 recetas de `data/recipes.ts` no declaran alérgenos (campo `Recipe.allergens` existe pero vacío) — hallazgo A-008. Rellenarlas a mano = 68 ediciones con criterio clínico pendiente de DN.
**Solución:** derivación heurística en runtime — `getRecipeAllergens(recipe)` aplica `findMatchingAllergens` (con la excepción de leche vegetal ya existente) sobre los ingredientes; si la receta ya declara `allergens` explícitos (futuro, validados por DN), estos tienen prioridad sobre la heurística. `RecipeSearch` muestra badge de alérgenos por receta con etiqueta clara de "detección automática".
**Aceptación:** tests unitarios de la derivación (receta con gambas → Crustáceos; prioridad de declarados sobre derivados); badge visible en RecipeSearch verificado en navegador.
**Δ estimado:** Motor de recetas +4 (autocertificable — cubre el hueco de datos de alérgenos de forma honesta: heurística etiquetada, no verdad clínica).
**Rollback:** revertir commit.

## MEJORA-014 — Semántica ARIA de modales + aria-current

**Problema:** `ConfirmDialog.tsx` (usado en acciones destructivas) no tiene `role="dialog"`, `aria-modal`, gestión de foco ni cierre con Escape; la navegación (`Sidebar.tsx`, `MobileNav.tsx`) indica el ítem activo solo por color, sin `aria-current` (hallazgos "moderado" de la auditoría a11y, verificados por código).
**Solución:** ConfirmDialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco inicial al botón de confirmación, cierre con Escape, devolución de foco al cerrar. Sidebar/MobileNav: `aria-current="page"` en el ítem activo.
**Aceptación:** atributos verificados en el DOM en vivo; Escape cierra el diálogo (verificado en navegador); sin regresión visual ni de flujo.
**Δ estimado:** Accesibilidad +4 (autocertificable).
**Rollback:** revertir commit.

## MEJORA-015 — Estado vacío de bienvenida en Dashboard

**Problema:** Con 0 clientes, el Dashboard muestra contadores en 0 y una rejilla vacía sin mensaje ni CTA (hallazgo UX, criterio "estados vacíos" de §8).
**Solución:** bloque condicional cuando `uniqueClients.length === 0`: mensaje de bienvenida + CTA "Crear tu primer cliente" que navega al formulario.
**Aceptación:** verificado en navegador (simulando lista vacía); sin efecto cuando hay clientes.
**Δ estimado:** UX +2 (autocertificable).
**Rollback:** revertir commit.

---

**Presupuesto estimado:** ~6-9 h-IA (dentro de §3.6). Riesgos: todos los cambios son aditivos y de bajo riesgo técnico; el único matiz clínico (MEJORA-013) queda explícitamente etiquetado como heurística automática pendiente de validación DN, sin presentarse como verdad clínica.
