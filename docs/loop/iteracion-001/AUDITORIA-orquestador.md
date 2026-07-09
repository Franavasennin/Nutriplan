# AUDITORÍA — Categorías IA-Orquestador/Growth — Iteración 001 / M1

**Fecha:** 2026-07-09 · **Auditor:** IA-Orquestador (directo, sin subagente) — Motor de recetas, IA, Personalización, UI, Retención, Monetización, Gamificación, Calidad del contenido, Competencia.

## Notas

| Categoría | Peso | Nota | Banda |
|---|---|---|---|
| Motor de recetas | 9% | **48** | Básico |
| IA | 8% | **58** | Básico |
| Personalización | 8% | **71** | Funcional |
| UI | 5% | **66** | Funcional |
| Retención | 5% | **35** | Deficiente |
| Monetización | 4% | **0** | Deficiente (inexistente) |
| Gamificación | 3% | **20** | Deficiente |
| Calidad del contenido | 3% | **60** | Funcional (básico) |
| Competencia | 2% | **55** | Básico |

---

## Motor de recetas — 48/100

**Método:** inventario del corpus estático (`data/recipes.ts`) + revisión de filtros (`components/RecipeSearch.tsx`) + `types.ts` (interfaz `Recipe`).

**Hallazgos:**
- **ALTA · Sin campo de alérgenos en `Recipe`** (`types.ts:294-306`). Ninguna de las 68 recetas del corpus estático declara alérgenos. Mismo hueco estructural que B-1 en Seguridad alimentaria.
- **ALTA · Sin campo de nivel de elaboración/dificultad.** No existe ningún campo `nivel`/`dificultad` en `Recipe` ni en `data/recipes.ts` — WF-N (niveles de elaboración) no tiene ningún soporte de datos hoy.
- **ALTA · Sin campo de coste.** No hay `€/ración` ni categoría de presupuesto en el corpus estático (aunque `BudgetLevel` sí sesga la generación por IA vía prompt).
- **MEDIA · Cobertura de tipos de dieta incompleta en el corpus estático:** de los 12 `DietType`, el corpus de 68 recetas cubre razonablemente equilibrada/vegetariana/vegana/keto/paleo/proteica/atleta, pero **0 recetas etiquetadas** para `baja_en_carbohidratos`, `mediterranea`, `proteifine_dap4/5`, `precocinados` (grep de tags). Nota: la generación real de planes usa la IA (Gemini/Mistral), no este corpus — este corpus es solo la herramienta de búsqueda de referencia para la nutricionista (`RecipeSearch.tsx`), por lo que el impacto real es menor de lo que parecería a primera vista, pero sigue siendo una brecha frente al WF-R diseñado (ICR, pipeline R1-R7).
- **MEDIA · Sin ICR ni pipeline de tendencias.** No existe ninguna infraestructura (campo, proceso o documentación) que corresponda al Índice de Calidad de Receta ni al pipeline T1-T5 de tendencias definidos en `LOOP-MAESTRO-100.md` §5. Es diseño puro, sin ejecutar — coherente con que es la primera iteración.
- **BAJA · Filtro de exclusión de ingredientes es texto libre** (`RecipeFilters.excludeIngredients`, `types.ts:291`), sin normalización ni relación con alérgenos declarados.

**Por qué no es más bajo:** el corpus existe y tiene datos nutricionales completos por receta (kcal/P/HC/G, `types.ts:294-306`), con filtros funcionales por tipo de comida, dieta, tiempo, calorías y exclusión de texto libre — es una base funcional, solo le faltan las dimensiones que exige el WF-R diseñado.

---

## IA — 58/100

**Método:** revisión de `services/geminiService.ts` (prompts, parsing, guardrails, rate limiting).

**Hallazgos:**
- **ALTA · Sin batería de evals ejecutada.** §8 exige tasa de salida válida ≥99.5% y 0 alucinaciones en ≥100 casos — no hay ningún artefacto de evals en el repo. El criterio C2/evals de Nutrición (batería ≥50 casos) tampoco se ejecutó — mismo hueco, categorías distintas.
- **ALTA · Sin reintento automático ante fallo de la API.** `groqRequest` (`geminiService.ts:131-166`) lanza una única vez; si Groq/Mistral devuelve error transitorio (5xx, timeout), no hay backoff/retry — el usuario ve un error directo. No es una alucinación, pero afecta la fiabilidad medida por la categoría IA.
- **MEDIA · Sin validación de esquema estructurado (JSON Schema / Zod) más allá de `response_format: json_object`.** Groq garantiza JSON *sintácticamente* válido, no que cumpla la forma esperada (`DietResponse`); el `as DietResponse` (`geminiService.ts:682`, `874`, etc.) es un cast sin runtime-check. Los `try/catch` alrededor de `JSON.parse` cubren el caso de JSON roto, pero no de JSON válido con forma incorrecta.
- **MEDIA · Rate limiter es de mitigación de coste, no un guardrail de contenido.** `RL_MAX_CALLS = 10`/minuto (`geminiService.ts:83`) protege costes, correcto, pero es la única "guardrail" explícita fuera de las de seguridad clínica (que están en `clinicalSafety.ts`/`clinicalTargets.ts`, no en este fichero).
- **POSITIVO (no penaliza):** `sanitizeForPrompt` (`geminiService.ts:121-128`) mitiga prompt injection desde campos de texto libre — hallazgo de una auditoría de seguridad previa (2026-05-24), sigue vigente.
- **POSITIVO:** `normalizeIngredient` (`utils/macroValidation.ts`, commiteado esta misma sesión) corrige un bug real donde la IA devolvía ingredientes como objeto en vez de string.

**Por qué no es más bajo:** el diseño de prompts es detallado y con reglas explícitas (rotación, tolerancias, formato), el parsing está defendido con try/catch en los 8 puntos de contacto, y hay mitigación de prompt injection y de costes — pero sin evals ejecutados ni validación de esquema, no puede acercarse al criterio del 100.

---

## Personalización — 71/100

**Método:** trazabilidad campo→prompt (`PatientData` en `types.ts` vs. usos en `geminiService.ts`).

**Hallazgos:**
- **POSITIVO relevante:** de los 22 campos de `PatientData`, prácticamente todos influyen en el plan: 15 se usan directamente en el prompt (`age`, `gender`, `height`, `weight`, `conditions`, `dietType`, `excludedFoods`, `weeks`, `mealCount`, `fastingProtocol`, `targetWeight`, `athleteGoal`, `calorieGoal`, `trainingTime`, `budgetLevel`); `activity` y `bodyFatPercent` influyen indirectamente vía `metrics` (calculado en `calculations.ts` y luego inyectado en el prompt como macros/calorías objetivo); `isPregnant`/`isLactating` actúan como gate en `clinicalSafety.ts` antes de llegar al prompt; `clinicalNotes` está **deliberadamente excluido** del envío a la IA (decisión de diseño documentada); `name`/`duration` son de uso interno/UI.
- **ALTA · Ningún campo de preferencia de nivel de cocina/dificultad.** No existe en `PatientData` ningún campo que capture la habilidad culinaria o el tiempo disponible del paciente para cocinar — precondición que WF-N necesitaría para elegir el nivel de elaboración por defecto (§6.3 punto 6 del diseño).
- **MEDIA · Preferencias culturales no capturadas explícitamente.** No hay campo de origen/preferencia cultural gastronómica; solo se infiere indirectamente por `dietType: mediterranea` o por `excludedFoods` en texto libre.
- **MEDIA · Adaptación al progreso real es parcial.** `bodyFatPercent` se recupera automáticamente del último registro de `ProgressTracker` al editar un cliente (`App.tsx`, según nota de proyecto 2026-07-03), pero no hay lógica que ajuste el plan según *tendencia* de progreso (p. ej., estancamiento de 3 semanas → sugerencia automática) — esto se solapa con la petición reciente del usuario sobre "sugerencias para mejorar la pérdida de peso", que según la nota del proyecto está pendiente de implementar.

**Por qué la nota:** el enrutamiento campo→prompt es notablemente completo (poca "personalización de fachada"), pero faltan dos ejes completos (nivel de cocina, cultura explícita) y la adaptación dinámica al progreso real es incipiente.

---

## UI — 66/100

**Método:** revisión de `tailwind.config.js`, `index.css`, convenciones de color/tipografía.

**Hallazgos:**
- **POSITIVO:** sistema de tokens semántico real (`primary`, `background-light/dark`, `surface-light/dark`, `text-main/sub`, `border-light/dark` — `tailwind.config.js:14-24`), no colores mágicos sueltos; tipografía única (`Manrope`) consistente; modo oscuro vía `darkMode: 'class'` con paleta dedicada, no solo un filtro.
- **ALTA · Sin verificación de consistencia en 3 breakpoints × 2 temas con evidencia** (§8 UI exige capturas). No se ha hecho esta pasada — coherente con que es diseño de proceso, aún no ejecutado en profundidad visual.
- **MEDIA · Sin revisión de densidad de información clínica** en vistas con mucho dato (`ProgressTracker.tsx` 1109 líneas, `DietPlanDisplay.tsx` 1352 líneas) — el hallazgo de Arquitectura (componentes-gigante) tiene una contrapartida en UI: alta probabilidad de sobrecarga visual en pantallas complejas, no verificado visualmente en este M1.
- **BAJA:** plugin `@tailwindcss/forms` instalado y usado (`tailwind.config.js:2,32`), coherente con formularios extensos (`PatientForm.tsx` 879 líneas).

**Por qué la nota:** el sistema de diseño de base (tokens, tipografía, dark mode) es sólido y evita la "deuda visual" más común (colores hardcodeados), pero sin verificación visual real (capturas en breakpoints/temas) no se puede acreditar el criterio de consistencia del 100.

---

## Retención — 35/100

**Método:** inventario de mecanismos existentes (`hooks/useNotifications.ts`, `components/NotificationSettings.tsx`) vs. matriz de referencia de mercado (recordatorios, informes de progreso, resúmenes).

**Hallazgos:**
- **POSITIVO:** existe infraestructura de notificaciones (`useNotifications.ts` 155 líneas + `NotificationSettings.tsx` 152 líneas) — mecanismo base presente, no es una app sin ningún gancho de retorno.
- **ALTA · Sin analítica de uso instrumentada.** Búsqueda de Posthog/Mixpanel/GA/analytics en todo el repo → 0 resultados. Sin medición de uso real, ningún dato de retención (D30, frecuencia de uso) puede calcularse — bloquea directamente el criterio del 100 ("retención D30 medida").
- **ALTA · Historial de dietas y seguimiento existen pero no hay resumen periódico proactivo** (p. ej., "resumen semanal" push/email) — son mecanismos pasivos (el usuario debe entrar a verlos), no activos.
- **MEDIA · Sin verificación de que las notificaciones estén realmente conectadas a un canal push real** (más allá de dentro de la app) — no se ha verificado en este M1 si `useNotifications.ts` usa Web Push real o son solo recordatorios in-app; requiere revisión adicional en iteración futura.

**Por qué la nota tan baja:** sin instrumentación de analítica, cualquier afirmación sobre retención real es no verificable — y el criterio del 100 pide explícitamente medición, no solo mecanismos.

---

## Monetización — 0/100

**Método:** búsqueda exhaustiva de Stripe/PayPal/pricing/suscripción en todo el repo (`.ts`/`.tsx`).

**Hallazgo único (BLOQUEANTE para esta categoría, no para el loop):**
- **Cero infraestructura de monetización.** 0 referencias a Stripe, PayPal, planes de precio, o lógica de suscripción en ningún fichero del proyecto. Coherente con la decisión de diseño documentada: "app 100% local/intranet, uso mono-usuario para una clínica concreta" (nota de proyecto, 2026-05-29) — no es un fallo de calidad, es que el producto no está planteado hoy como SaaS multi-cliente.

**Nota:** se puntúa 0 porque el criterio de §8 (modelo de precios validado, infraestructura de cobro operativa) exige un producto comercializable; si la decisión de negocio confirmada sigue siendo "herramienta interna para una clínica", esta categoría debería **repesarse a la baja o excluirse** en una iteración futura con aprobación del Humano-PO — marcarlo así en el backlog en vez de tratarlo como deuda a resolver por defecto.

---

## Gamificación — 20/100

**Método:** búsqueda de rachas/hitos/badges en `ProgressTracker.tsx` y componentes relacionados.

**Hallazgos:**
- **POSITIVO parcial:** existe seguimiento de objetivo de peso con barra de progreso y contador de días restantes (`weightGoal`/`goalDate` en `ClientProgress`, según nota de proyecto 2026-04-14) — es progreso visible, precursor de gamificación, pero no es gamificación en sí (no hay refuerzo, hito o racha).
- **ALTA · 0 mecánicas de gamificación real** (rachas, insignias, celebraciones de hito) — grep sin resultados.
- El diseño (§8) exige explícitamente que cualquier mecánica sea clínicamente apropiada y sin dark patterns ni presión sobre TCA — dado que hoy no hay ninguna, no hay riesgo activo, pero tampoco valor.

**Por qué no es 0:** la barra de progreso hacia el objetivo de peso ya es una forma elemental de feedback visual de avance, aunque no cumpla la definición estricta de "gamificación" del diseño.

---

## Calidad del contenido — 60/100

**Método:** revisión de `services/pdfService.ts` (solo validación de import), estructura de impresión en `DietPlanDisplay.tsx`, disclaimers existentes.

**Hallazgos:**
- **POSITIVO:** el módulo educativo "¿Por qué estas cantidades?" incluye un disclaimer apropiado — "Equivalencias aproximadas orientativas — no sustituyen una tabla de composición de alimentos ni el criterio profesional" (`DietPlanDisplay.tsx:1116`).
- **ALTA · El documento de impresión/PDF del plan (cabecera en `DietPlanDisplay.tsx:1231-1258`) no incluye ningún disclaimer general** (tipo "elaborado por [nutricionista colegiada], no sustituye valoración médica presencial") — solo muestra nombre de clínica, paciente, fecha y métricas. Esto es relevante tanto para Calidad del contenido como, tangencialmente, para Seguridad alimentaria.
- **MEDIA:** no se ha hecho una revisión ortográfica/terminológica sistemática de toda la UI en este M1 (sería un trabajo de auditoría separado, de alto volumen de texto) — se marca como no verificado, no como "aprobado".
- **BAJA:** `services/pdfService.ts` (45 líneas) es solo el importador de PDF (OCR), no el generador del PDF de salida (que es `window.print()` sobre el DOM) — nombre del fichero puede inducir a confusión sobre su alcance real; sin impacto funcional.

**Por qué la nota:** hay una muestra positiva de buena práctica (el disclaimer del módulo educativo) que demuestra que el patrón se conoce, pero no se aplica de forma consistente en el documento más importante que el paciente se lleva a casa (el plan impreso/PDF).

---

## Competencia — 55/100

**Método:** búsqueda web sobre el panorama de software de nutrición en España, 2026.

**Hallazgos (contexto de mercado, ver fuentes):**
- **Nutrium** (350.000+ dietistas en 90 países, fuerte en España/Portugal/Francia/Italia/Alemania): planes personalizados con seguimiento de micronutrientes, telemedicina y chat integrados, app móvil de marca propia para pacientes, 100+ plantillas, facturación vía Stripe. Precio: ~$15-49/mes según plan.
- **Dietopro**: generador de dietas por ML basado en historia clínica/patologías/interacciones fármaco-nutriente, app móvil dietista+paciente, licencias "DAY" (por días sueltos).
- **INDYA**: nicho deportivo, reajuste automático de dieta según entrenamiento de wearables (Apple Watch/Garmin).

**Comparación con DietMaster Pro:**
- **GAP ALTO:** sin app de paciente (Nutrium y Dietopro la tienen como diferencial fuerte) — el paciente no tiene ningún canal propio, todo pasa por la nutricionista.
- **GAP ALTO:** sin telemedicina/chat integrado.
- **GAP MEDIO:** sin interacciones fármaco-nutriente (Dietopro sí las tiene) — relevante dado que la app ya modela varias patologías.
- **DIFERENCIAL DEFENDIBLE hoy:** cribado de seguridad clínica multicapa (`clinicalSafety.ts`) y validación determinista de macros de la IA (`macroValidation.ts`) — no es evidente que Nutrium/Dietopro documenten públicamente un enfoque equivalente tan explícito; sería un diferencial de marketing genuino *si* se cierran los huecos detectados en Seguridad alimentaria (B-1, B-2).
- **DIFERENCIAL DEFENDIBLE hoy:** dietas de pareja vinculadas (`CouplesDietView.tsx`) — no es una función habitual mencionada en las comparativas revisadas.

**Por qué la nota:** posición de nicho razonable (cribado clínico + parejas) pero con dos gaps estructurales grandes (app de paciente, telemedicina) frente a los líderes del sector.

Fuentes:
- [Los 5 mejores softwares de nutrición para profesionales - indya](https://getindya.com/en/comparison-of-the-5-best-nutrition-software-in-spain-2026/)
- [Mejor Software para Nutricionistas 2026 - FOCUSS](https://www.focuss.es/mejor-software-para-nutricionistas-2026/)
- [Nutrium vs NutriAdmin: Comparativa para Dietistas 2026](https://www.promealplan.com/en/blog/nutrium-vs-nutriadmin)
- [Los 10 Mejores software para nutricionistas 2026](https://agendapro.com/blog/los-mejores-software-para-nutricionistas/)

---

## Recomendaciones para M2/BACKLOG (resumen de estas 9 categorías)

1. **P-alta:** añadir campos de alérgenos y nivel de elaboración a `Recipe`/`data/recipes.ts` — ataca Motor de recetas y es prerrequisito de WF-N.
2. **P-alta:** ejecutar batería de evals de IA (≥30 casos) y añadir validación de esquema runtime a las respuestas parseadas. Ataca IA.
3. **P-alta:** disclaimer general en la cabecera del documento imprimible/PDF del plan. Ataca Calidad del contenido (y roza Seguridad alimentaria).
4. **P-media:** instrumentar analítica de uso (con consentimiento RGPD) — precondición de toda la categoría Retención.
5. **P-media:** capturar preferencia de nivel de cocina/tiempo disponible en `PatientData` — prerrequisito de WF-N por defecto.
6. **Decisión de negocio (no técnica):** revisar con el Humano-PO si Monetización debe repesarse/excluirse dado el modelo actual de herramienta interna mono-cliente.
