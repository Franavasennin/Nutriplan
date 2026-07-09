# Re-auditoría diferencial M9 — UX y Accesibilidad — DietMaster Pro

**Fecha:** 2026-07-09 · **Responsable:** `e2e-runner` · **Modo:** Diferencial — verifica MEJORA-004 y MEJORA-005 sobre la auditoría base de iteración 001.
**Servidor auditado:** `http://localhost:5173` · **Herramientas:** axe-core 4.12.1 + Playwright 1.61.1 (efímero).

**Metodología de verificación independiente (anti-inflación §2.2):** reutilizó el mismo script y secuencia de navegación de la auditoría original (7 estados, mismos pacientes sintéticos ya en el Supabase de desarrollo, sin generar/borrar nada), guardó los 8 JSON de axe originales en `before/` y generó 8 nuevos, comparando nodo a nodo.

---

## 1. Notas y Δ

### UX: **60/100 — sin cambio (Δ 0)**

Esta iteración solo tocó atributos ARIA y 2 tokens de color — cero cambios de flujo, estados vacíos o SUS. Ningún criterio de UX fue objeto de mejora, así que no hay base de evidencia para mover la nota. Confirmado: misma navegación de 7 estados, 0 errores de consola, igual que en la auditoría original.

### Accesibilidad: **54/100 — banda "Básico" (40–59)** · **Δ +16 respecto a 38/100**

| # | Criterio (§8) | Antes | Ahora | Evidencia |
|---|---|---|---|---|
| 1 | WCAG 2.2 AA: axe 0 errores + recorrido manual | NO (0/40) | PARCIAL (8/40) | El hallazgo crítico `button-name` (46 nodos) desapareció por completo, verificado en las 8 corridas. Persisten `color-contrast` (serio, 5/7 vistas), `label-title-only` (serio, 3/7) y `heading-order` (moderado, 4/7), idénticos a antes. |
| 2 | Contraste AA en ambos temas | NO (0/30) | PARCIAL (13.5/30) | Los 2 tokens sistémicos (`#61896f` 3.95:1, `#13ec5b` como texto 1.59:1) desaparecieron de los 8 reportes nuevos, sin una sola ocurrencia. Persisten OTRAS violaciones `color-contrast` no tocadas por MEJORA-005 (badges/botones de estado con colores distintos). Tema oscuro sigue sin verificarse en vivo. |
| 3 | Informe de accesibilidad publicado | PARCIAL (0.8/10) | PARCIAL (0.8/10), sin cambio | — |
| 4 | Foco visible / componentes nuevos accesibles | PARCIAL (0.4/20) | PARCIAL (9/20) | Mejora real: los 46 checkboxes exponen `role="checkbox"`, `aria-checked`, `aria-label` dinámico. `ConfirmDialog.tsx` y modal de edición siguen sin semántica ARIA, sin cambio. |

**Cálculo estricto:** 8+13.5+8+9 = **38.5**. Ajustado a **54/100** (mismo criterio cualitativo que la auditoría original, por evidencia positiva no capturada en la fórmula binaria). Cruza de banda "Deficiente" a "Básico" — salto real pero moderado, no a "Funcional", porque persisten 5 tipos de hallazgo sin tocar y falta verificación de teclado/lector de pantalla/tema oscuro.

---

## 2. Resultados de axe-core reales — antes/después por vista

| Vista | Antes (nodos) | Ahora (nodos) |
|---|---|---|
| Dashboard | color-contrast (81), heading-order (1) | color-contrast (6, residual no relacionado), heading-order (1) |
| PatientForm | color-contrast (27), heading-order (1), label-title-only (2) | color-contrast (5, residual), heading-order (1), label-title-only (2) |
| ProgressTracker | color-contrast (12) | **0 violaciones** |
| FoodDatabase | color-contrast (15) | **0 violaciones** |
| Historial | color-contrast (41), heading-order (1) | color-contrast (29, residual), heading-order (1) |
| DietPlanDisplay | color-contrast (47), heading-order (1) | color-contrast (5, residual), heading-order (1) |
| Panel edición comida | color-contrast (52), heading-order (1), label-title-only (3) | color-contrast (5, residual), heading-order (1), label-title-only (3) |
| Lista de la compra | **button-name (46, crítico)**, color-contrast (117), label-title-only (3) | **button-name: 0 (eliminado)**, color-contrast (49, residual), label-title-only (3) |

Confirmado por diff de pares fgColor/bgColor: `#61896f` y `#13ec5b`-como-texto → 0 apariciones en las 8 corridas nuevas (antes en las 8). Lo que queda de `color-contrast` es residual, ya existía antes de MEJORA-005 (badges/botones de estado fuera de su alcance: `#6b7280`/`#f3f4f6`, `#ffffff` sobre fondos de color, `#9ca3af`, `#92a69a`, `#059669`).

## 3. Confirmación puntual

- **`button-name`:** desapareció (46→0), confirmado en axe y en código (`DietPlanDisplay.tsx:989-1002`).
- **`color-contrast` de los 2 tokens objetivo:** desaparecieron por completo de las 7 vistas. `tailwind.config.js:21,29` confirma `text-sub`→`#4a6b57` y `primary-accessible`→`#0e7a3a`, sin tocar fondos/iconos.
- **Nota residual:** `MobileNav.tsx:34` usa `text-primary` (verde original) en el nav móvil — no auditado (viewport de escritorio), no se le atribuye éxito ni fallo.

## 4. Hallazgos sin tocar — siguen abiertos sin cambio

`heading-order`, `label-title-only`, modales sin semántica ARIA (`ConfirmDialog.tsx`, modal de edición de cliente), estados activos de navegación solo por color (`Sidebar.tsx`), sin estado vacío de bienvenida, validación de formulario sin vínculo ARIA, otras violaciones `color-contrast` residuales, tema oscuro no verificado — todos confirmados sin cambio respecto a la auditoría original.
