# AUDITORÍA M9 (DIFERENCIAL) — Iteración 001 · Nutrición + Seguridad alimentaria

**Fecha:** 2026-07-09 · **Modalidad:** diferencial (verificación post-implementación) · **Auditor:** healthcare-reviewer (IA) · **Base:** `docs/loop/iteracion-001/AUDITORIA-nutricion-seguridad.md` (Nutrición 74 / Seguridad 67)

**Regla anti-inflación aplicada (§2.2):** todo Δ>5 se justifica con `fichero:línea` verificado de forma independiente. No se sube nota "porque parece resuelto".

---

## 1. Notas nuevas y Δ

| Categoría | Nota original | Nota M9 | Δ | Banda |
|---|---|---|---|---|
| Nutrición | 74 | **75** | +1 | Sin cambio de banda |
| Seguridad alimentaria | 67 | **79** | +12 | Sube de "hueco estructural" a "funcional con red determinista parcial", **aún <80** |

### Seguridad alimentaria: 67 → 79 (+12) — justificación criterio a criterio

- **C1 (14 alérgenos UE detectados y propagados a plan + lista + PDF): NO CUMPLIDO → CUMPLIDO en su mayor parte.** Este es el driver del salto. Evidencia:
  - Enum `Allergen` con los 14 alérgenos UE exactos en `types.ts:121-136`. Etiquetas `ALLERGEN_LABELS` `types.ts:138-152` y keywords `ALLERGEN_KEYWORDS` `types.ts:158-172`.
  - Propagación al prompt con prioridad absoluta: `geminiService.ts:511-518` fusiona `patient.allergens` con `excludedFoods` y exclusiones clínicas en la línea "EXCLUIR COMPLETAMENTE (prioridad absoluta...)". Incluida también en la rama DAP (`:544`).
  - Lista de la compra: resaltado real vía `findMatchingAllergens` (`utils/shoppingList.ts:6-9`), consumido en `DietPlanDisplay.tsx:989-1015` (badge rojo con tooltip).
  - Documento imprimible: cabecera de alérgenos en `DietPlanDisplay.tsx:1262-1266`.
  - **Por qué NO es CUMPLIDO pleno:** (a) el corpus de 68 recetas no se rellenó con alérgenos (no-alcance declarado); (b) no hay verificador determinista post-generación de que la IA obedeció — la única red determinista es el resaltado *pasivo* de la lista de la compra (avisa, no bloquea); (c) el matching es por subcadena.
- **C2 (0 recomendaciones inseguras en batería ≥50): PARCIAL → PARCIAL (reforzado, no cerrado).** Se cierran 3 huecos deterministas (A-1 BMI<17, A-4 DM1-ayuno, B-2 jerarquía), pero **la batería sigue sin ejecutarse** → no puede pasar a CUMPLIDO.
- **C3 (avisos clínicos en puntos de decisión): PARCIAL → PARCIAL (mejorado).** Nuevos avisos verificados: banner de ayuno bloqueado por DM1 (`PatientForm.tsx:614-618`), selector de alérgenos con nota de prioridad absoluta (`PatientForm.tsx:503-524`), motivo "IMC muy bajo (infrapeso severo)" (`clinicalSafety.ts:63`). Sigue sin verificación post-generación de que el plan respete las exclusiones.
- **C4 (sign-off DN): NO CUMPLIDO → NO CUMPLIDO.** Sin cambios.

Los dos bloqueantes (B-1, B-2) quedan resueltos en código, lo que levanta el veto de §3.3(a), pero la nota se mantiene deliberadamente por debajo de 80 porque C2 (batería) y C4 (sign-off) siguen incumplidos y persiste riesgo residual no cuantificado (sin filtro determinista post-generación). Con 79, el tope de seguridad global de §2.1 (nota <80) técnicamente sigue vigente aunque el veto por bloqueantes se haya levantado.

### Nutrición: 74 → 75 (+1) — justificación

Movimiento mínimo y acotado. C1/C2/C3/C4 de Nutrición no cambian de estado. El +1 responde solo a la mejora de validez/coherencia del plan por B-2 (la rotación ya no puede forzar una proteína excluida — `geminiService.ts:249,265`) y a la salvaguarda de infrapeso severo. Los altos específicos de Nutrición (A-2 micronutrientes de embarazo, A-3 objetivos por condición) no forman parte de este diferencial y no reclaman puntos. Δ+1 está muy por debajo del umbral de §2.2 y no requiere anclaje extraordinario.

---

## 2. Estado de cada hallazgo original

- **B-1 · Sistema de 14 alérgenos inexistente → RESUELTO (a nivel estructural; verificación determinista parcial).** Enum + propagación al prompt + resaltado en lista + cabecera imprimible. Reserva: exclusión real en el plato sigue dependiendo del LLM; la red determinista avisa pero no bloquea, y el corpus de recetas no se rellenó.
- **B-2 · Conflicto exclusión ↔ rotación → RESUELTO (a nivel de prompt).** "Regla 0 — PRIORIDAD ABSOLUTA" en `geminiService.ts:249`; la Regla 5 declara su subordinación explícita en `:265`; orden Regla 0 (`:249`) antes de Regla 5 (`:254`); línea de exclusión marcada con prioridad absoluta (`:518`). Sin verificador post-generación (no-alcance declarado).
- **A-1 · IMC extremo bajo sin cribado → RESUELTO.** `SEVERE_UNDERWEIGHT_BMI_THRESHOLD = 17` (`clinicalSafety.ts:24`), cálculo local de BMI (`:28-31`), `hasSevereUnderweight` alimenta `isVulnerable` (`:52-56`). Testeado con Sintético-04 en `clinicalSafety.test.ts:61-96`.
- **A-4 · DM1 no bloquea ayuno → RESUELTO.** `blockFasting = hasT2Diabetes || safetyFlags.hasDiabetesType1 || safetyFlags.isVulnerable` (`geminiService.ts:564`); banner UI (`PatientForm.tsx:614-618`); selector deshabilitado (`:597-599`). Testeado en `geminiService.test.ts:54-70`.

**Verificación de tests (aserciones, no nombres):** son reales y significativas. `clinicalSafety.test.ts` calcula el BMI y afirma `<threshold`, `hasSevereUnderweight` y `isVulnerable`; confirma DM1 con `hasDiabetesType1 true` pero `isVulnerable false`. `geminiService.test.ts` verifica orden Regla 0<Regla 5 por índice de string, la frase de subordinación, y la fusión alérgenos+texto libre. `shoppingList.test.ts:150-168` prueba `findMatchingAllergens` con casos positivos y negativos. Tests de regresión (menor, embarazo, lactancia, TCA, atleta-definición→rendimiento, adulto sano) presentes con aserciones reales.

---

## 3. Regresiones y hallazgos nuevos

- **Sin regresión** en la lógica de vulnerabilidad previa (tests de regresión reales, adulto sano devuelto intacto).
- **NUEVO (menor, seguridad-conservadora) · Falsos positivos por matching de subcadena:** `ALLERGEN_KEYWORDS` marca "leche de almendras" como alérgeno Leche y "avena" bajo Gluten. Erran del lado seguro (sobre-avisan), impacto bajo. Registrar para el DN.
- **NUEVO (residual, ya previsto) · La exclusión del alérgeno en el plato no está garantizada de forma determinista.** El resaltado de la lista es aviso pasivo, no bloqueo; no existe verificador post-generación. Riesgo residual abierto para próxima iteración.
- **NUEVO (informativo, correcto por diseño) · DM1 no marca `isVulnerable`** — comportamiento especificado en MEJORA-006 y confirmado por su test, no es regresión.
- **Deuda conocida · Corpus de 68 recetas sin alérgenos** (`Recipe.allergens` añadido pero vacío) — no-alcance (WF-R futuro).

---

## 4. Confirmación explícita C2 / C4 (ambas categorías)

- **C2 — Batería ≥50 planes generados por IA: SIGUE SIN CUMPLIRSE** en Nutrición y Seguridad alimentaria. Sin artefacto de ejecución. Los tests nuevos son unitarios de construcción de prompt/flags, no generación real.
- **C4 — Sign-off escrito del Humano-DN (Ester Correa): SIGUE SIN CUMPLIRSE** en ambas categorías. Varios umbrales tocados (BMI<17, inclusión de DM1, jerarquía de exclusiones) son provisionales pendientes de validación clínica.

---

**Resumen:** B-1, B-2, A-1 y A-4 verificados como resueltos en código con evidencia `fichero:línea`. Seguridad alimentaria 67→79 (+12, justificado). Nutrición 74→75 (+1). Ambas permanecen <80 y "PENDIENTE DE VALIDACIÓN CLÍNICA" por C2/C4 incumplidos. Riesgo residual abierto: ausencia de verificador determinista post-generación de alérgenos.
