# AUDITORÍA — Iteración 001 · Nutrición + Seguridad alimentaria

**Fecha:** 2026-07-09 · **Modalidad:** completa (primer M1 real) · **Auditor:** healthcare-reviewer (IA) · **Pendiente:** sign-off Humano-DN (Ester Correa)

**Regla aplicada:** "sin evidencia no hay puntos" (§1.3, §2.2). Cada criterio con `fichero:línea`. Los criterios de §8 son la barra del 100; se marca cumplido / parcial / no cumplido y la nota se deriva por anclaje (§1.3).

## Notas

| Categoría | Peso | Nota (0-100) | Banda |
|---|---|---|---|
| Nutrición | 12% | **74** | Funcional→Competitivo, con huecos reales |
| Seguridad alimentaria | 10% | **67** | Funcional con limitaciones (hueco estructural en alérgenos) |

Ambas < 80 → **dispara el "tope de seguridad" (§2.1): la nota global de la iteración quedaría capada a 59** hasta cerrar los bloqueantes. Además, ninguna de las dos puede alcanzar 100 por ausencia de sign-off DN (§2.2 regla 3).

---

## 1. Checklist §8 con evidencia

### Nutrición (§8 exige 4 condiciones)

**C1 — Fórmulas contrastadas con ≥2 guías autorizadas + tests que las fijan → PARCIAL**
- BMR: ecuaciones OMS-FAO/UNU correctas, `utils/calculations.ts:70-91`, fijadas por tests `test/calculations.test.ts:58-108` (6 casos por tramo/sexo verificados a mano). ✔
- Factores de actividad PAL FAO/WHO `calculations.ts:95-104`, tests `:112-118`. ✔
- Corrección real y verificada: TEF ya no se suma dos veces `calculations.ts:106-113`. ✔
- Distribución de macros documentada contra ESPEN/NAM `calculations.ts:130-155`, pero **solo en comentario**: no hay artefacto que contraste números de macros contra ≥2 guías (EFSA/SENC). El requisito "≥2 guías" se cumple para BMR/PAL, no para el reparto de macros. → parcial.

**C2 — 0 planes generados fuera de rango en batería ≥50 casos sintéticos → NO CUMPLIDO**
- No existe evidencia de ejecución de la batería (requiere llamadas reales a Mistral, no realizadas en este M1). Sin artefacto = no cumplido (§1.3).

**C3 — Coherencia kcal↔macros exacta en el 100% de los planes → PARCIAL**
- Reconciliación determinista de la salida IA: `utils/macroValidation.ts:45-67`, tolerancia 12% (`:19`), tests `test/macroValidation.test.ts:13-26`. Corrige inconsistencias graves pero **no garantiza exactitud** (tolera ±12%) y no se ha verificado sobre planes reales. → parcial.

**C4 — Sign-off escrito del Humano-DN → NO CUMPLIDO** (§11 punto 6: DN sin SLA acordado).

**Derivación Nutrición:** núcleo determinista sólido y bien testeado (C1 mayormente, C3 parcial) pero C2 y C4 sin cumplir, más los huecos de micronutrientes de embarazo y de objetivos por condición (§2 hallazgos). Anclaje: **74**.

### Seguridad alimentaria (§8 exige 4 condiciones)

**C1 — 14 alérgenos UE detectados y propagados a plan + lista de la compra + PDF → NO CUMPLIDO (hueco estructural)**
- No existe sistema estructurado de los 14 alérgenos. Solo: texto libre `excludedFoods` (`types.ts:126`, campo en `components/PatientForm.tsx:498-508`) + exclusiones obligatorias únicamente para celiaquía y lactosa (`utils/clinicalTargets.ts:43-54`).
- La lista de la compra **no tiene ninguna capa de alérgenos** (`utils/shoppingList.ts` completo; categorías por keyword, sin marcado alérgeno).
- El PDF **no menciona alérgenos** (`services/pdfService.ts`: 0 coincidencias de alérgeno/exclusión).

**C2 — 0 recomendaciones inseguras en batería de poblaciones de riesgo → PARCIAL**
- Capa determinista real y buena: `enforceClinicalSafety` fuerza mantenimiento + sin ayuno en vulnerables (`utils/clinicalSafety.ts:60-79`), invocada antes de calcular (`App.tsx:99`, `:168-169`); `calculateMacros` reaplica seguridad como defensa en profundidad (`calculations.ts:195-213`); cap renal KDOQI 0.8 g/kg (`calculations.ts:250-259`); cap grasa DM2 35% (`calculations.ts:233-245`); bloqueo de ayuno en DM2 y vulnerables en el prompt (`geminiService.ts:547-555`).
- Huecos concretos: BMI extremo bajo no cribado, DM1 sin bloqueo de ayuno, DAP+vulnerable no reconducido, conflicto exclusión↔rotación (ver §2). → parcial.

**C3 — Avisos clínicos presentes y correctos en todos los puntos de decisión → PARCIAL**
- Banner de perfil vulnerable en el formulario (`PatientForm.tsx:220-235`), bloqueo de UI de objetivo/ayuno (`:365-371`, `:569-586`), nota de vulnerable/renal en prompt (`geminiService.ts:571-579`).
- Falta: aviso en presencia de BMI extremo bajo; sin verificación post-generación de que el plan respete exclusiones. → parcial.

**C4 — Sign-off DN → NO CUMPLIDO.**

**Derivación Seguridad:** la capa de poblaciones vulnerables es genuinamente buena, pero el requisito de los 14 alérgenos (núcleo de esta categoría) está completamente sin cubrir y hay huecos de cribado. Anclaje: **67**.

---

## 2. Hallazgos por severidad

### BLOQUEANTE

**B-1 · Sistema de 14 alérgenos UE inexistente y sin propagación a lista/PDF** (Seguridad)
- Localización: `types.ts:126` (solo texto libre), `utils/clinicalTargets.ts:43-54` (solo celiaquía+lactosa), `utils/shoppingList.ts` (sin alérgenos), `services/pdfService.ts` (sin alérgenos).
- Impacto: exposición potencial a alérgeno declarado si la IA lo ignora; ni la lista de la compra ni el PDF advierten. Incumple §8 Seguridad C1 directamente.
- Caso del dataset que lo expone: **Sintético-07 "Alergias múltiples"** (`excludedFoods: "frutos secos, marisco, huevo"` + celiaquía + lactosa). Las exclusiones libres dependen solo de que el LLM las respete; sin verificación determinista.

**B-2 · Conflicto sin resolver entre exclusiones del paciente y la rotación de proteínas obligatoria del prompt** (Seguridad / Nutrición)
- Localización: `services/geminiService.ts:253-263` — la Regla 5 impone marisco el día 5 y huevos los días 2/6, con lenguaje coercitivo ("el plan es INVÁLIDO" si no se sigue). Las exclusiones del paciente llegan como `EXCLUIR COMPLETAMENTE` (`:510-512`) sin jerarquía explícita que anule la rotación.
- Impacto: instrucciones contradictorias al modelo → riesgo de que el plan incluya el alérgeno excluido. Sin filtro determinista post-generación.
- Caso que lo expone: **Sintético-07** (excluye marisco y huevo, ambos forzados por la rotación).

### ALTA

**A-1 · IMC extremadamente bajo no activa cribado de seguridad** (Seguridad / Nutrición)
- Localización: `utils/clinicalSafety.ts:30-46` — `isVulnerable` solo contempla menor / embarazo / lactancia / TCA. El infrapeso severo (BMI < 17) no marca vulnerabilidad ni bloquea déficit.
- Caso: **Sintético-04 "IMC bajo" (~15.6)**. No hay salvaguarda por BMI si se configurara un déficit.

**A-2 · Micronutrientes críticos del embarazo/lactancia no garantizados** (Nutrición)
- Localización: `services/geminiService.ts:24-50` — `ensureMicronutrientGuidelines` solo cubre vegana/vegetariana. No hay garantía determinista de folato/hierro/yodo/DHA/vitamina D para embarazo/lactancia.
- Casos: **Sintético-01 (Embarazo)**, **Sintético-02 (Lactancia)**, **Sintético-03 (Embarazo+DM2)**.

**A-3 · Condiciones clínicas sin objetivos deterministas** (Nutrición)
- Localización: `utils/clinicalTargets.ts:31-56` — solo Hipertensión, Celiaquía y Lactosa generan targets/exclusiones. Hipotiroidismo, hipertiroidismo, hipertrigliceridemia, DM1, DM2 y obesidad se pasan como texto libre (`geminiService.ts:493-494`).
- Casos: **Sintético-11 (Hipotiroidismo)**, **Sintético-12 (Hipertiroidismo)**, **Sintético-13 (Hipertrigliceridemia)**.

**A-4 · DM1 no bloquea el ayuno intermitente** (Seguridad)
- Localización: `services/geminiService.ts:547-555` — `blockFasting = hasT2Diabetes || safetyFlags.isVulnerable`. DM1 (mayor riesgo de hipoglucemia/cetoacidosis con ayuno) no incluida.
- Caso: **Sintético-09 (DM1)** — hueco latente, no expuesto activamente en ese registro.

### MEDIA

**M-1 · `clinicalSafety.ts` sin ningún test directo.**
- La barrera de defensa en profundidad (`utils/clinicalSafety.ts`) no aparece en ningún fichero de `test/`. Solo cubierta indirectamente vía `calculateMacros` en `test/calculations.test.ts:240-253`.

**M-2 · DAP4/DAP5 en perfiles vulnerables no-menores no se reconduce** (Seguridad)
- `utils/clinicalSafety.ts:74-76` reconduce DAP→equilibrada solo si `isMinor`; embarazo/lactancia/TCA con DAP mantienen el protocolo restrictivo. El branch DAP de `buildUserPrompt` (`geminiService.ts:532-541`) retorna sin `vulnerableNote`/`renalNote`/`t2DiabetesNote`.

**M-3 · Enfermedad renal no endurece el sodio numérico** (Seguridad)
- `utils/clinicalTargets.ts:37` — sodio solo baja a 1500mg con Hipertensión; ERC mantiene 2000mg. Caso: **Sintético-08 (ERC)**.

### BAJA

- **BJ-1 ·** Floor calórico fijo 1500 kcal (`calculations.ts:188,215`), seguro pero no personalizado por sexo/talla.
- **BJ-2 ·** `parseDietFromPDF` fija height=165/age=30 por defecto (`geminiService.ts:824,829`).
- **BJ-3 ·** Peso ideal unisex 21.7 (`calculations.ts:35-40`), decisión defendible y documentada.

---

## 3. Trazabilidad hallazgo alto/bloqueante → caso sintético

| Hallazgo | Severidad | Caso(s) del dataset |
|---|---|---|
| B-1 Alérgenos sin sistema ni propagación | Bloqueante | Sintético-07 |
| B-2 Conflicto exclusión ↔ rotación obligatoria | Bloqueante | Sintético-07 |
| A-1 BMI extremo bajo sin cribado | Alta | Sintético-04 |
| A-2 Micronutrientes embarazo/lactancia | Alta | Sintético-01, 02, 03 |
| A-3 Condiciones sin objetivos deterministas | Alta | Sintético-11, 12, 13 |
| A-4 DM1 sin bloqueo de ayuno | Alta | Sintético-09 (latente) |

Casos que el sistema **sí** maneja correctamente: Sintético-01/02 (bloqueo déficit+ayuno), Sintético-06 TCA vulnerable, Sintético-08 cap proteína renal, Sintético-10 DM2 cap grasa 35%+HTA sodio 1500 simultáneos, Sintético-14 micronutrientes veganos garantizados, Sintético-16/17 atleta, Sintético-19 ayuno sano no bloqueado, Sintético-22 obesidad sarcopénica por %graso, Sintético-23 menor vulnerable.

---

## 4. PENDIENTE DE VALIDACIÓN CLÍNICA (sign-off Humano-DN obligatorio)

Según §2.2 regla 3 y §11 punto 6, el 100 en Nutrición y Seguridad alimentaria **solo** lo otorga la DN por escrito. Requieren sign-off antes de darse por buenos:

1. Reparto de macros por tipo de dieta (`calculations.ts:142-165`).
2. Umbrales de seguridad numéricos (floor 1500 kcal, cap proteína renal, cap grasa DM2, etc.).
3. Objetivos clínicos deterministas y qué añadir para las condiciones hoy sin target (A-3).
4. Micronutrientes que deben garantizarse por población de riesgo (A-2).
5. Resolución del conflicto exclusión↔rotación (B-2): jerarquía correcta.
6. Diseño del sistema de 14 alérgenos (B-1) y su etiquetado en plan/lista/PDF.
7. Reglas de cribado por BMI extremo (A-1) y bloqueo de ayuno por patología (A-4).
8. Batería ≥50 planes sintéticos recalculados: no ejecutada en este M1.

Hasta que existan (a) el sign-off DN y (b) la batería ejecutada y revisada, Nutrición y Seguridad alimentaria quedan **"PENDIENTE DE VALIDACIÓN CLÍNICA"**. Con las notas actuales (74/67), el tope de seguridad de §2.1 capa la nota global de la iteración a 59 mientras B-1 y B-2 sigan abiertos.

---

**Resumen para M2:** 2 bloqueantes (B-1, B-2) entran automáticamente en la siguiente iteración por veto de §3.3(a). 4 hallazgos altos (A-1 a A-4) y 3 medios (M-1 a M-3) para backlog.
