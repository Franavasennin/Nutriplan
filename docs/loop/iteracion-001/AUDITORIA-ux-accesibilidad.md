# Auditoría M1 — UX y Accesibilidad — Iteración 001

**Fecha:** 2026-07-09
**Responsable:** `e2e-runner`
**Alcance:** categorías "UX" (peso 8%) y "Accesibilidad" (peso 5%) según `docs/loop/LOOP-MAESTRO-100.md` §1.2 y §8.
**Servidor auditado:** `http://localhost:5173` (Vite dev, arrancado por este agente porque no estaba activo al inicio de la sesión — `npm run dev`, confirmado con `curl` → HTTP 200).

**Herramientas usadas:**
- `@axe-core/cli@4.12.1` (axe-core `4.12.1`) — instalado previamente en el repo.
- `playwright@1.61.1` (chromium `1228`) — **instalado en esta sesión** vía `npx playwright install chromium` (no estaba disponible; no hay Agent Browser ni Playwright como dependencia del proyecto). Se usó para navegar entre vistas reales de la SPA (no tiene rutas propias — es un solo `index.html` con estado `currentStep` en `App.tsx`) e inyectar `axe.min.js` de `node_modules/axe-core` contra el DOM real en cada estado.
- Revisión manual de código para ARIA/foco/teclado donde no se pudo interactuar en vivo.

---

## 0. Nota importante de alcance

axe-core CLI por sí solo **no puede navegar la SPA** (no hay URLs distintas por vista, todo vive bajo `currentStep` en memoria). Para cubrir las 4+1 vistas pedidas se instaló Playwright (efímero, en `npx`, no añadido a `package.json`) y se inyectó axe-core contra el DOM en cada paso de navegación real (clics reales en el Sidebar y en tarjetas de historial). Esto permitió auditar **en vivo** 7 estados de la aplicación, no solo el Dashboard inicial.

Los datos de pacientes usados en Historial/Seguimiento son los que ya existían en el Supabase de desarrollo conectado (pacientes con nombres de prueba: Araceli Correa, Guillermina, Sergio, Ligia, Pachi, etc. — coinciden con el lote de pacientes sintéticos de `docs/loop/datos-sinteticos/`). No se generó, editó ni borró ningún dato — solo lectura/click de navegación.

---

## 1. Notas

### UX: **60 / 100** — banda "Funcional" (60–74, según §1.3)

Checklist de §8 (UX 100 cuando…), con evidencia:

| # | Criterio (§8) | Estado | Evidencia |
|---|---|---|---|
| 1 | Los 5 flujos núcleo completables en E2E sin errores | **PARCIAL** | Verificado **en vivo** (Playwright + captura de errores de consola, 0 errores registrados en todo el recorrido) para 4 de los 5 flujos: (a) Dashboard → "Nuevo Cliente" → `PatientForm` renderiza sin errores; (b) Dashboard → "Seguimiento" → `ProgressTracker` renderiza con datos reales; (c) Historial → "Ver Dieta Completa" → `DietPlanDisplay` carga un plan real (Araceli Correa, 1517 kcal) sin errores; (d) dentro de `DietPlanDisplay`: clic en icono "Editar" de una comida abre el panel de edición inline sin errores, y clic en "Lista compra" abre la lista de la compra (46 artículos, 7 categorías) sin errores. **No verificado en vivo:** la generación real de un plan nuevo llamando a Gemini (flujo 2 desde cero) — no se ejecutó para no consumir cuota/coste de API real sin autorización explícita; el camino de código (`App.tsx:95-139`, `handleFormSubmit`) se revisó y es coherente (try/catch con toast de error, `setIsLoading` true/false). |
| 2 | SUS ≥ 85 medido con ≥ 5 nutricionistas reales | **NO cumplido** | 0 evidencia — no existe ninguna medición SUS en el repo ni en `docs/loop/`. No se puede generar en una auditoría automatizada de una sesión. |
| 3 | Todos los estados (vacío, carga, error) diseñados y verificados | **PARCIAL** | Carga: `LoadingOverlay.tsx` (pantalla completa, mensajes rotativos, confirmado por código, no disparado en vivo por no ejecutar generación real). Error: `toast(err.message, 'error')` presente en los 6 `catch` de `App.tsx` (líneas 134, 184, 267, 311). Vacío: **sí** hay estado vacío para "sin resultados de búsqueda" (`Dashboard.tsx:209-214`, `RecipeSearch.tsx:100-101`, verificado por código) pero **no** hay estado vacío de bienvenida/primer uso cuando `uniqueClients.length === 0` (revisé todo `Dashboard.tsx` con grep, no existe ese condicional) — un nutricionista nuevo sin pacientes ve un dashboard con contadores en "0" y una rejilla vacía sin ningún mensaje ni CTA explicativo más allá del botón genérico "+ Nuevo Cliente" ya visible en cabecera. |
| 4 | 0 callejones sin salida | **CUMPLIDO (con evidencia parcial)** | En los 7 estados navegados en vivo, el Sidebar permanece siempre visible y funcional, y el panel de edición de comida y la lista de la compra tienen botón de cierre (`X`) visible. No se detectó ningún estado sin salida en el recorrido realizado. No es una cobertura del 100% de todos los sub-estados de la app (p. ej. modales de `ConfirmDialog`/edición de cliente en `Dashboard.tsx` no se probaron en vivo). |

**Cálculo (regla de anclaje, sin redondeo entre bandas):** ponderando aprox. 40/25/20/15 pts por criterio 1–4 → (0.8×40) + (0×25) + (0.7×20) + (0.9×15) = 32 + 0 + 14 + 13.5 = **59.5 ≈ 60/100**.

Fricción medida (clics, Nielsen "eficiencia de uso"): muy baja en los flujos verificados en vivo — Historial → plan completo = **2 clics**; dentro del plan, editar una comida = **1 clic** (icono lápiz); ver lista de la compra = **1 clic**; exportar PDF = **1 clic** (`window.print()`, `DietPlanDisplay.tsx:818`, confirmado por código — no se ejecutó el diálogo nativo de impresión del SO en esta sesión). Nuevo cliente = **1 clic** para llegar al formulario. Seguimiento = **1 clic** para llegar a la vista + selector de cliente.

Otras observaciones Nielsen: buen "control y libertad del usuario" (`ConfirmDialog.tsx` para acciones destructivas, confirmado por código); buena "visibilidad del estado del sistema" (Toast + LoadingOverlay); "prevención de errores" con validación inline en `PatientForm.tsx` (líneas 264-697, bordes rojos + mensaje bajo el campo) pero **sin** vínculo programático (`aria-invalid`/`aria-describedby`) entre el error y el campo — esto penaliza tanto UX para lector de pantalla como accesibilidad (ver abajo).

---

### Accesibilidad: **38 / 100** — banda "Deficiente" (0–39, según §1.3, en el límite superior)

Checklist de §8 (Accesibilidad 100 cuando…):

| # | Criterio (§8) | Estado | Evidencia |
|---|---|---|---|
| 1 | WCAG 2.2 AA verificado: axe 0 errores + recorrido manual de teclado y lector de pantalla en flujos núcleo | **NO cumplido** | axe-core **en vivo** encontró violaciones reales en **las 7 vistas escaneadas**: Dashboard, PatientForm, ProgressTracker, FoodDatabase, Historial, DietPlanDisplay (vista de plan), Lista de la compra. Ver detalle completo en §2. Recorrido de teclado: se hizo un `Tab` de muestra en `PatientForm` (foco cayó correctamente en el primer botón de navegación del Sidebar, orden lógico) — no se hizo un recorrido de teclado completo de los 5 flujos ni prueba con lector de pantalla real (NVDA/VoiceOver), por alcance de tiempo de esta sesión. |
| 2 | Contraste AA en ambos temas | **NO cumplido** | Confirmado **en vivo** con axe: fallo de contraste en **tema claro** en las 7 vistas (`color-contrast`, impacto "serious"), incluyendo `#61896f` sobre blanco = 3.95:1 (mínimo AA 4.5:1) y, más grave, `#13ec5b` (verde primario de marca) usado como texto sobre blanco = **1.59:1** para los valores de kcal en las tarjetas de cliente del Dashboard (`Dashboard.tsx:297`). **Tema oscuro no verificado en vivo** (axe se ejecutó en el tema por defecto, claro) — sin evidencia = no cumplido para esa mitad del criterio. |
| 3 | Informe de accesibilidad publicado | **PARCIAL** | Este documento es ese informe; su publicación efectiva depende de que quede commiteado en `docs/loop/iteracion-001/` (ya escrito en esa ruta en esta misma sesión). |
| 4 | (implícito) Foco visible y teclado funcional en componentes nuevos | **PARCIAL** | `PatientForm.tsx` tiene 30 usos de `focus:ring-2 focus:ring-primary` (buena señal, verificado por código). `ProgressTracker.tsx` solo 1 (inputs del formulario de seguimiento con foco menos consistente, revisión de código). Gaps reales encontrados por código: `ConfirmDialog.tsx` (líneas 38-73) y el modal de edición de cliente en `Dashboard.tsx` (líneas 335-348) **no** tienen `role="dialog"`, `aria-modal="true"`, gestión de foco al abrir/cerrar, ni cierre con `Escape` — son overlays de clic-fuera-para-cerrar sin las garantías de un diálogo accesible real. |

**Cálculo:** ponderando aprox. 40/30/10/20 pts por criterio 1–4 → (0×40) + (0×30) + (0.8×10) + (0.4×20) = 0 + 0 + 8 + 8 = **16/100** por la fórmula estricta; se ajusta a **38/100** aplicando criterio de evaluador para reconocer evidencia positiva real no capturada en la fórmula binaria (landmarks correctos en `Sidebar.tsx` con `<aside>`, `aria-label` correctos y descriptivos en 8+ campos de `ProgressTracker.tsx`, validación inline visible, 0 imágenes sin alternativa textual porque la app no usa `<img>`, iconos implementados como texto real vía ligature de Material Symbols — lo que de hecho les da nombre accesible por defecto, ver nota en §3). Se documenta la discrepancia entre el cálculo estricto (16) y la nota otorgada (38) para trazabilidad — banda "Deficiente" en ambos casos, por lo que la banda final no cambia.

---

## 2. Hallazgos por severidad (con localización exacta)

### Crítico

- **`button-name` (axe, impacto "critical") — 46 nodos sin nombre accesible en la Lista de la Compra.**
  Localización: `components/DietPlanDisplay.tsx:990-995`. Los checkboxes personalizados de cada artículo de la lista de la compra son `<button onClick={() => toggleShopItem(ci, ii)}>` completamente vacíos (sin texto, sin `aria-label`, sin `aria-checked`, sin `role="checkbox"`). Un usuario de lector de pantalla no puede saber qué es cada botón ni si el artículo está marcado. Afecta al flujo crítico 4 (exportar PDF / lista de la compra).
  **Verificado en vivo**: axe ejecutado sobre el DOM real tras clic en "Lista compra" dentro de un plan cargado (paciente "Araceli Correa").

### Serio

- **`color-contrast` — presente en las 7 vistas escaneadas**, con casos destacados:
  - `#13ec5b` (verde de marca, clase Tailwind `text-primary`) sobre fondo blanco → **ratio 1.59:1** (mínimo AA 4.5:1). Localización: `components/Dashboard.tsx:297` (valores de kcal en tarjetas de cliente).
  - `#ffffff` sobre `#10b981` (botón "Exportar CSV", `bg-emerald-500`) → **ratio 2.53:1**. Localización: botón con `title="Exportar lista de clientes a CSV"` en la vista de Historial (`components/SavedDietsList.tsx`, clase `bg-emerald-500 ... text-white`).
  - `#61896f` (token global `text-sub`, definido en `tailwind.config.js:23`) sobre blanco → **ratio 3.95:1**, repetido en decenas de nodos en las 7 vistas (81 nodos solo en Dashboard, 47 en el plan de dieta, 41 en Historial). Es un problema sistémico de un único token de color, no un caso aislado.
  **Verificado en vivo** con axe en las 7 vistas (JSON de resultados generado en esta sesión).

- **`label-title-only` — inputs del panel de edición de comida y de la lista de la compra dependen solo de `title` como nombre accesible**, sin `<label>`/`aria-label`. Localización: `components/DietPlanDisplay.tsx` (inputs "Nombre de la comida", "Descripción de la comida", textarea "Ingredientes de la comida" dentro del panel "Editar manual" de cada comida) y `PatientForm.tsx` (los `<select>` de "Número de comidas al día" y "Protocolo de ayuno" usan `title=` como único nombre accesible, líneas correspondientes a esos `<select>`).
  **Verificado en vivo** (axe, tras abrir el panel de edición y la lista de la compra).

### Moderado

- **`heading-order` — jerarquía de encabezados incorrecta en 4 de las 7 vistas** (Dashboard, PatientForm, Historial, DietPlanDisplay): aparecen `<h3>`/`<h4>` sin un `<h1>`/`<h2>` intermedio coherente en el árbol (p. ej. `Dashboard.tsx` tarjeta "Añadir Cliente" con `<h3>` suelto; `DietPlanDisplay.tsx` con `<h4>Desayuno</h4>` para cada comida). No es solo un caso aislado — es un patrón repetido de estructura de encabezados poco planificada.
  **Verificado en vivo** (axe, 1 ocurrencia por vista consistentemente).

- **Modales sin semántica ni gestión de foco**: `components/ConfirmDialog.tsx` (líneas 38-73) y el modal de edición de cliente en `components/Dashboard.tsx` (líneas 335-348) no tienen `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, no mueven el foco al abrir, no lo devuelven al cerrar y no responden a `Escape`. Afectan a acciones destructivas (borrar paciente/dieta) y de edición — flujos con consecuencias reales.
  **Verificado por revisión de código** (no se disparó ningún `confirm()` en vivo en esta sesión para no borrar datos reales del Supabase de desarrollo).

- **Estados activos de navegación solo por color**: `components/Sidebar.tsx` (`NavButton`, líneas 31-45) indica el ítem activo únicamente cambiando el color de fondo/texto, sin `aria-current="page"`. Un usuario de lector de pantalla no puede saber en qué sección está.
  **Verificado por revisión de código.**

- **Sin estado vacío de bienvenida**: si `uniqueClients.length === 0`, el Dashboard no muestra ningún mensaje de onboarding (solo contadores en 0 y rejilla vacía). Verificado por revisión de código (`grep` sin resultados para un condicional de "0 clientes" en `Dashboard.tsx`).

### Menor

- **Validación de formulario sin vínculo ARIA**: `PatientForm.tsx` (líneas 264-697) marca errores con borde rojo + texto bajo el campo pero sin `aria-invalid="true"` ni `aria-describedby` apuntando al mensaje de error. El error es visible pero no está asociado programáticamente al campo para un lector de pantalla.
  **Verificado por revisión de código.**

---

## 3. Qué fue verificado en vivo vs. revisión de código

**Verificado en vivo (servidor real en `localhost:5173`, navegación real con Playwright + inyección de axe-core real contra el DOM, sin datos inventados):**
- axe-core ejecutado y con resultados reales guardados en 7 estados: Dashboard, PatientForm, ProgressTracker, FoodDatabase, Historial, DietPlanDisplay (plan cargado de un paciente real de la BD de desarrollo), Lista de la compra.
- 0 errores de consola/página durante toda la navegación (`page.on('console'/'pageerror')` capturado y vacío).
- Recorrido de clics real para los flujos 3, 4 y 5 (parcial), y llegada real a `PatientForm` y `ProgressTracker` (flujos 1 y 5, parcial — sin envío de formulario).
- Un `Tab` de muestra para comprobar orden de foco en `PatientForm`.

**Revisión de código (no ejecutado en vivo en esta sesión):**
- El envío real de `PatientForm` y la llamada real a Gemini (`generateDietPlan`) — no se disparó para no consumir cuota de API sin autorización explícita del Humano-PO.
- `ConfirmDialog` y el modal de edición de cliente de `Dashboard.tsx` — no se dispararon para no modificar/borrar datos reales del Supabase de desarrollo.
- Tema oscuro — no se activó `toggleTheme` durante el escaneo axe (todas las corridas fueron en tema claro, el que carga por defecto).
- SUS y recorrido con lector de pantalla real (NVDA/VoiceOver) — fuera del alcance de una sesión automatizada de una IA.

**Nota metodológica sobre iconos:** los iconos de Material Symbols en toda la app se implementan como `<span className="material-symbols-outlined">close</span>` (texto real "close", "save", "edit", etc. renderizado como glifo vía fuente ligature). Esto significa que, a diferencia de un icono SVG decorativo, estos botones **sí tienen nombre accesible por defecto** (el texto literal del nodo), aunque a veces poco descriptivo en contexto (p. ej. dos botones "close" en la misma pantalla). Se documenta para no sobrestimar el problema de "iconos sin texto" de forma genérica — el problema real y verificado es el de los checkboxes vacíos de la lista de la compra (sección Crítico) y los inputs con `title`-only (sección Serio), no los botones de icono en general.

---

## 4. Artefactos generados en esta sesión (temporales, no versionados en el repo)

Resultados JSON de axe-core y capturas de pantalla guardados en el scratchpad de la sesión (no en el repo, por ser artefactos de ejecución puntual, no código):
`axe-01-dashboard.json` … `axe-08-shopping-list.json`, y capturas `01-dashboard.png` … `08-shopping-list.png`.
Si se desea trazabilidad completa versionada, se recomienda repetir la ejecución del script Playwright+axe (`e2e-audit.js`, mismo directorio) desde un `e2e-runner` con Playwright como devDependency real del proyecto, y commitear los JSON de resultado junto a esta auditoría.
