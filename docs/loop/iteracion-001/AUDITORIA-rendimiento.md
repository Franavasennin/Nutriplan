# AUDITORÍA — Rendimiento (categoría 8, peso 6%) — Iteración 001 / M1

**Fecha:** 2026-07-09 · **Modalidad:** completa (primer M1 real) · **Auditor:** `performance-optimizer`

## Nota: **40 / 100** — Banda "Básico (40–59): funciona pero por debajo del estándar profesional"

## 1. Checklist de criterios §8 (Rendimiento: "100 cuando...")

| # | Criterio §8 | Peso asignado | Estado | Evidencia |
|---|---|---|---|---|
| P1 | Lighthouse ≥95 en Performance (móvil) en las 3 vistas principales | 30 | NO CUMPLIDO | Medido solo 1 vista (carga inicial/Dashboard) por límite de tiempo/alcance: **79/100** contra build de producción (`vite preview`), **38/100** contra servidor de desarrollo. Ninguno alcanza 95. Cobertura incompleta (1 de 3 vistas). |
| P2 | LCP ≤ 2.0 s | 20 | NO CUMPLIDO | Build producción: **3.54 s**. Dev server: **20.9 s** (no representativo, ver §3). |
| P3 | INP ≤ 150 ms | 20 | NO CUMPLIDO / NO MEDIBLE DIRECTAMENTE | Lighthouse lab no mide INP real (requiere interacción de usuario real/CrUX). Proxy usado: Total Blocking Time = **300 ms** (build prod) / 700 ms (dev) y Max Potential FID = 250 ms — ambos por encima del presupuesto equivalente. |
| P4 | CLS ≤ 0.1 | 15 | CUMPLIDO | **0.037** en ambos entornos. Evidencia: `docs/loop/iteracion-001/lighthouse-mobile-prodbuild.json`. |
| P5 | Generación de plan con feedback de progreso y p95 dentro de presupuesto | 15 | PARCIAL | Existe `LoadingOverlay.tsx` y estados `isLoading`/`aiLoading` (feedback visual presente) pero **no hay telemetría de latencia p95** de `generateDietPlan`/Gemini instrumentada. |

**Derivación:** P1 12/30 (parcial por gap 79→95, cobertura 1/3 vistas) + P2 8/20 (parcial, 3.5s vs 2.0s) + P3 0/20 (no cumplido) + P4 15/15 + P5 6/15 (feedback existe, p95 no medido) = **41 ≈ 40/100**.

---

## 2. Hallazgos por severidad

### CRÍTICA
- **C-1 · Fuente de iconos "Material Symbols Outlined" cargada con rango completo de variación (`wght@100..700,0..1`) desde Google Fonts.** `index.html:15`. Lighthouse contra el build de producción reporta un único fichero woff2 de **1.1 MB** (`totalBytes: 1,125,001`), que domina el peso total de página (**1.28 MB**, ~87% es esta fuente). Es render-blocking y retrasa la pintura de cualquier icono en el primer renderizado. Mayor contribuyente individual a LCP/FCP/peso de página.
- **C-2 · Doble sistema de iconos.** `lucide-react` está instalado (`package.json`) pero solo se usa en **1 archivo**, mientras `material-symbols-outlined` (la fuente de 1.1 MB) se usa en **14 archivos** con >100 instancias (`Dashboard.tsx` 28, `DietPlanDisplay.tsx` 38, `PatientForm.tsx` 28, `ProgressTracker.tsx` 24, verificado por grep). Mantener la fuente variable completa para lo que podría resolverse con iconos SVG tree-shakeables de `lucide-react` (ya pagado en el bundle) es la causa raíz más accionable del mal rendimiento.

### ALTA
- **A-1 · Lighthouse Performance por debajo de objetivo incluso contra build optimizado.** Producción (`vite preview`, mobile): score **79/100**, LCP 3.54s, FCP 2.76s, TTI 4.21s, Speed Index 3.14s, TBT 300ms. Todos por debajo de §8. Evidencia: `docs/loop/iteracion-001/lighthouse-mobile-prodbuild.json`.
- **A-2 · Chunk principal por encima del límite de Vite.** `dist/assets/index-Bk3gPBwl.js` = **504.10 kB / 149.35 kB gzip** (sin cambio vs. línea base). `unused-javascript` de Lighthouse marca **58.8%** de bytes no usados en ese chunk en la carga inicial (87.8 KB desperdiciados de 149.2 KB) — candidatos: `@supabase/supabase-js`, `pdfService`, `exportService` empaquetados junto al núcleo.
- **A-3 · Medición contra dev server no representativa.** Contra `http://localhost:5173`: score **38/100**, LCP **20.9s**, FCP 18.2s, TTI 25.7s, TBT 700ms — Vite dev sirve ESM sin bundlear (overhead de cientos de módulos + HMR), no representa producción. Se documenta explícitamente para que el scorecard no use esta cifra sin el contraste del build real.

### MEDIA
- **M-1 · Baja memoización en componentes grandes.** `DietPlanDisplay.tsx` (1352 líneas): solo 3 usos de `useMemo`/`useCallback`/`React.memo` y 59 `.map()`/manejadores inline. No se ejecutó React DevTools Profiler (fuera de alcance headless) — reportado como sospecha de patrón, no hallazgo medido.
- **M-2 · Filtrado de recetas sin memoizar.** `components/RecipeSearch.tsx:96-99` recalcula `filterLocally` dentro de un `useEffect` con `setState` en cada tecleo, en vez de `useMemo`. Con 68 recetas el impacto es despreciable hoy, pero no escala.
- **M-3 · Falta de virtualización en listas.** Grid de recetas y listas de ingredientes/instrucciones sin `react-window`. No es problema hoy (corpus pequeño) pero es limitación estructural si el corpus crece (WF-R apunta a ICR≥85).

### BAJA
- **B-1 ·** `apple-touch-icon` servido desde CDN externo (`flaticon.com`, `index.html:8`) en vez de asset local.
- **B-2 ·** Preconnect presentes (`index.html:12-13`) mitigan parcialmente el RTT a Google Fonts, pero no el peso de descarga (C-1).

---

## 3. Puntos positivos verificados

- **Code-splitting a nivel de ruta ya implementado.** `App.tsx:5-12` usa `React.lazy()` para las 8 vistas principales, cada una en su propio chunk — no es un hallazgo, es una fortaleza existente.
- **CLS excelente** (0.037, muy por debajo del umbral 0.1) en ambos entornos.
- **`data/recipes.ts` ya vive en un chunk separado** (51.89 kB/12.90 kB gzip), no forma parte del bundle inicial.

---

## 4. Evidencia cruda adjunta

- `docs/loop/iteracion-001/lighthouse-mobile.json` — Lighthouse móvil contra dev server (2026-07-09T08:49:25Z). Score: **0.38**. LCP 20927ms, FCP 18199ms, CLS 0.037, TBT 701ms, TTI 25731ms.
- `docs/loop/iteracion-001/lighthouse-mobile-prodbuild.json` — Lighthouse móvil contra `vite preview` (build de producción real). Score: **0.79**. LCP 3536ms, FCP 2756ms, CLS 0.037, TBT 303ms, TTI 4205ms, Speed Index 3144ms, total-byte-weight 1,288 KiB (1,125,001 bytes = fuente Material Symbols).
- Salida de `npm run build` (2026-07-09): chunk principal `index-Bk3gPBwl.js` 504.10 kB / gzip 149.35 kB, sin cambio vs. línea base. Warning nativo de Vite ("chunks are larger than 500 kB").

---

## 5. Recomendaciones para M2/BACKLOG

1. **P-crítica:** sustituir/auto-hospedar/subsetear la fuente Material Symbols, o migrar los 14 componentes a `lucide-react` (ya instalado, casi sin usar). Ataca P1/P2 — palanca individual más grande (1.1 MB → pocos KB con SVG tree-shaken).
2. **P-alta:** revisar composición del chunk principal con `source-map-explorer`, mover a `manualChunks` lo no necesario en carga inicial. Ataca P1/P2, reduce el 58.8% de JS no usado.
3. **P-alta:** instrumentar latencia p95 real de generación de plan (Gemini). Ataca P5.
4. **P-media:** medir INP con datos de campo (web-vitals + CrUX/RUM); Lighthouse lab no lo captura.
5. **P-media:** repetir Lighthouse cubriendo las 3 vistas exigidas por §8 (Dashboard, `DietPlanDisplay`, `RecipeSearch`) con Lighthouse `startFlow`.
6. **P-baja:** memoizar `filterLocally` en `RecipeSearch.tsx`, evaluar `React.memo` selectivo en `DietPlanDisplay.tsx` antes de que crezca el corpus.

**Ficheros relevantes:** `index.html:15`, `App.tsx:5-12`, `components/RecipeSearch.tsx:96-105`, `components/DietPlanDisplay.tsx`, `data/recipes.ts`, `package.json` (lucide-react infrautilizado).
