# AUDITORÍA — Arquitectura (categoría 7, peso 7%) — Iteración 001 / M1

**Fecha:** 2026-07-09 · **Modalidad:** completa (primer M1 real) · **Auditor:** `architect` + `typescript-reviewer`

## Nota: **62 / 100** — Banda "Funcional (60–74): usable en consulta real con limitaciones"

Ninguno de los 5 criterios de §8 (Arquitectura) se cumple al 100%. Fundamentos sólidos (capas limpias sin ciclos, `tsc --noEmit` en verde, code-splitting, 104 tests verdes) pero no alcanza "Competitivo" por: modo estricto ausente, ADRs para componentes gigantes ausentes, cobertura no verificable.

---

## 1. Checklist de criterios §8 (Arquitectura)

| # | Criterio §8 | Estado | Evidencia |
|---|---|---|---|
| C1 | `tsc` estricto limpio | NO CUMPLIDO (parcial) | `tsc --noEmit` exit 0, pero `tsconfig.json:2-28` sin `strict`/`noImplicitAny`/`strictNullChecks`. Limpio ≠ estricto. |
| C2 | 0 componentes >400 líneas sin ADR | NO CUMPLIDO | 6 componentes >400 líneas, 0 ADRs en el repo. |
| C3 | Capas documentadas sin ciclos | PARCIAL | Sin ciclos verificado (`services/`+`hooks/` → `utils/`+`types` únicamente); capas no documentadas. |
| C4 | Cobertura núcleo clínico ≥90% | NO CUMPLIDO | Sin `@vitest/coverage-*` instalado; `utils/clinicalSafety.ts` sin ningún test. |
| C5 | Deuda registrada = 0 ítems altos | NO CUMPLIDO | Esta auditoría genera ≥3 hallazgos altos. |

**Derivación:** crédito parcial por criterio (C1 8/20, C2 0/20, C3 12/20, C4 4/20, C5 5/20 ≈ 29 base), ajustado a **62** por fundamentos verificados no capturados en la checklist binaria (capas reales sin ciclos, tsc verde, code-splitting, 104 tests, patrones inmutables).

---

## 2. Hallazgos por severidad

### ALTA

- **A-1 · `tsconfig` no estricto.** `tsconfig.json:2-28` sin `strict`/`noImplicitAny`/`strictNullChecks`. Los ~24 `any` de producción pasan invisibles. Bloquea C1.
- **A-2 · `utils/clinicalSafety.ts` sin tests.** Barrera de defensa en profundidad clínica (`clinicalSafety.ts:60-79`) sin ningún test. Riesgo de regresión silenciosa en lógica de seguridad.
- **A-3 · Componentes-Dios.** `DietPlanDisplay.tsx` (1352 líneas) y `ProgressTracker.tsx` (1109) concentran presentación+lógica sin descomposición ni ADR. Bloquea C2.
- **A-4 · Cobertura no instrumentada.** Sin `@vitest/coverage-v8`, C4 (≥90% núcleo clínico) no es verificable.

### MEDIA

- **M-1 · Escrituras BD "fire-and-forget".** `useAppData.ts:167-169` inserta en background; ante error solo `console.error`, sin feedback al usuario.
- **M-2 · `App.tsx` mezcla orquestación y lógica de negocio.** Contiene `computeMetrics` (`:145-161`) y orquestación de generación, acoplando la vista raíz al núcleo de cálculo.
- **M-3 · Conversores de fila sin tipar (`r: any`).** `useAppData.ts:11,20,27,38` — el contrato BD↔dominio no está tipado.
- **M-4 · `PatientForm.tsx` (879) y `Dashboard.tsx` (585)** >400 líneas sin justificación.

### BAJA

- **B-1 ·** `any` en parsing de Gemini (`geminiService.ts:800,833,840,954-955`), sin validador de esquema.
- **B-2 ·** 3 `eslint-disable react-hooks/exhaustive-deps` (`useNotifications.ts:125`, `RecipeSearch.tsx:104`, `ProgressTracker.tsx:116`).
- **B-3 ·** Capas sin documentar (aunque respetadas en la práctica).

---

## 3. Métricas concretas

### Líneas por fichero (código de producto)

| Fichero | Líneas | >400 |
|---|---|---|
| `components/DietPlanDisplay.tsx` | 1352 | ⚠️ |
| `services/geminiService.ts` | 1181 | ⚠️ |
| `components/ProgressTracker.tsx` | 1109 | ⚠️ |
| `components/PatientForm.tsx` | 879 | ⚠️ |
| `components/Dashboard.tsx` | 585 | ⚠️ |
| `App.tsx` | 512 | ⚠️ |
| `hooks/useAppData.ts` | 484 | ⚠️ |
| `components/CouplesDietView.tsx` | 446 | ⚠️ |
| `components/RecipeSearch.tsx` | 437 | ⚠️ |
| `types.ts` | 306 | — |
| `utils/calculations.ts` | 331 | — |
| `utils/shoppingList.ts` | 256 | — |
| `services/exportService.ts` | 211 | — |
| `components/Sidebar.tsx` | 170 | — |
| `hooks/useNotifications.ts` | 155 | — |
| `components/NotificationSettings.tsx` | 152 | — |
| `components/SavedDietsList.tsx` | 147 | — |
| `utils/macroValidation.ts` 80 / `clinicalSafety.ts` 79 / `clinicalTargets.ts` 57 | — |
| `services/supabaseClient.ts` 43 / `pdfService.ts` 45 | — |

**9 ficheros de producto >400 líneas** (6 componentes + 1 servicio + 1 hook + App), **0 ADR** que los justifique.

### `tsc --noEmit`
Exit 0, sin errores (confirmado en línea base M0). Limpio ≠ estricto (A-1).

### `any` encontrados
~24 en producción: `catch (err: any)` ~13 (App.tsx:134,184,267,311; useAppData:112,140; exportService:157; geminiService:696,938,1029,1081; DietPlanDisplay:687); conversores de fila 4 (useAppData:11,20,27,38); parsing Gemini 5 (geminiService:800,833,840,954,955); otros (supabaseClient:16,19 Proxy stub justificado; Dashboard:16).

### Cobertura de tests
5 ficheros de test, 104 tests verdes (`calculations`, `macroValidation`, `clinicalTargets`, `shoppingList`, `micronutrientGuidelines`). Núcleo clínico `utils/`: 4/5 ficheros con test; `clinicalSafety.ts` sin cobertura. Sin herramienta de coverage instalada → % real no verificable.

### Dependencias circulares
0 detectadas. `services/`+`hooks/` → `utils/`+`types` únicamente; ninguna capa inferior importa de `components/`/`App`.

---

## Recomendaciones para M2/BACKLOG

1. **P-alta:** activar `strict: true` en `tsconfig.json` y resolver la cascada de `any`. Ataca C1.
2. **P-alta:** tests para `clinicalSafety.ts` + instalar `@vitest/coverage-v8` con umbral ≥90% en `utils/`. Ataca C4.
3. **P-alta:** descomponer `DietPlanDisplay.tsx` y `ProgressTracker.tsx`, o documentar ADR. Ataca C2.
4. **P-media:** extraer `computeMetrics`/orquestación de `App.tsx`; tipar conversores de fila Supabase.
5. **P-media:** feedback al usuario ante fallo de escritura BD en `useAppData`.
6. **P-baja:** doc/ADR de capas.

**Ficheros relevantes:** `tsconfig.json`, `App.tsx`, `hooks/useAppData.ts`, `utils/clinicalSafety.ts`, `components/DietPlanDisplay.tsx`, `components/ProgressTracker.tsx`, `services/geminiService.ts`.
