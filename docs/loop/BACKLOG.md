# Backlog — DietMaster Pro

Acumulativo entre iteraciones. Cada ítem es un Problema (P-nnn) o una Oportunidad (O-nnn), con categoría, severidad, evidencia y criterio de resolución medible. Ver M2 en `LOOP-MAESTRO-100.md`.

## Convenciones

- **Severidad:** bloqueante · alta · media · baja
- **Estado:** abierto · en iteración NNN · resuelto (iteración NNN) · descartado (motivo)
- Los ítems de severidad bloqueante en Nutrición o Seguridad alimentaria saltan la fórmula de priorización (§3.3) y entran automáticamente en la siguiente iteración.

## Ítems conocidos por observación directa (pendientes de confirmar en M1)

Estos NO son resultado de una auditoría formal — son señales ya visibles en el repo que M1 deberá verificar, puntuar y localizar con evidencia formal.

| ID | Categoría | Severidad (provisional) | Descripción | Estado |
|---|---|---|---|---|
| O-001 | Rendimiento | media | Bundle principal 504 kB (149 kB gzip) — Vite avisa que supera 500 kB; candidato a manualChunks o lazy-load adicional | abierto |
| O-002 | Escalabilidad / Seguridad | media | Sin autenticación ni RLS por usuario (mono-usuario, decisión consciente de app local — ver nota Obsidian 2026-05-29); revisar si sigue vigente ese supuesto | abierto |
| O-003 | Calidad/Arquitectura | baja | Backend Express histórico documentado en la nota del proyecto pero ya eliminado del repo (`cbb2d76`) — confirmar que no quedan referencias muertas | abierto |
| O-004 | Motor de recetas | media | Corpus de recetas hardcodeado en TS (`data/recipes.ts`, ~1.908 líneas) sin persistencia en Supabase — limita pipeline R1–R7 de WF-R | abierto |
| O-005 | Accesibilidad | media | Sin auditoría a11y registrada hasta la fecha (axe-core, navegación por teclado) | abierto |
| O-006 | UX / Tests | media | Suite de tests cubre solo `utils/` (104 tests); sin E2E de los 5 flujos núcleo | abierto |
| O-007 | Arquitectura / Escalabilidad | baja | `npm install lighthouse @axe-core/cli` (herramientas de medición del pre-vuelo) introdujo 19 vulnerabilidades transitivas (1 alta, 17 moderadas, 1 baja) en devDependencies de telemetría (Sentry/OpenTelemetry). 0 vulnerabilidades en dependencias de producción. `npm audit fix --force` implicaría un major de lighthouse — evaluar en iteración futura si compensa | abierto |
| P-001 | Escalabilidad / Seguridad | CRÍTICA (era) | `public/supabase_setup.sql:58-61` deshabilitaba RLS explícitamente en el script commiteado, contradiciendo la nota de proyecto. **RESUELTO 2026-07-09:** verificación de solo lectura vía MCP Supabase confirmó que RLS estaba correctamente activo en producción (5/5 tablas, política `allow_all_anon`) desde antes — el script commiteado era el único desactualizado. Corregido en MEJORA-003, sin necesidad de tocar producción. Ver `iteracion-001/MEJORA-003.md` | **resuelto (iteración 001)** |

## Backlog formal M1 — iteración 001 (síntesis M2)

### Bloqueantes (veto automático §3.3(a) — entran en la próxima iteración sin esperar priorización)

| ID | Categoría | Descripción | Evidencia |
|---|---|---|---|
| B-001 | Seguridad alimentaria | Sistema de 14 alérgenos UE inexistente: solo texto libre (`excludedFoods`), sin propagación a lista de la compra ni PDF. Caso que lo expone: Sintético-07 | `iteracion-001/AUDITORIA-nutricion-seguridad.md` B-1 |
| B-002 | Seguridad alimentaria / Nutrición | Conflicto sin resolver entre exclusiones del paciente y la rotación obligatoria de marisco/huevo en el prompt (`geminiService.ts:253-263` vs. `:510-512`) | `iteracion-001/AUDITORIA-nutricion-seguridad.md` B-2 |
| P-001 | Escalabilidad / Seguridad | RLS deshabilitado en 4/5 tablas de datos de salud (ver arriba) | `iteracion-001/AUDITORIA-escalabilidad.md` |
| B-003 | Accesibilidad | 46 checkboxes sin nombre accesible en la lista de la compra (`DietPlanDisplay.tsx:990-995`, regla axe `button-name`, impacto crítico, verificado en vivo | `iteracion-001/AUDITORIA-ux-accesibilidad.md` |

### Altos (candidatos preferentes de la próxima priorización, §3.3)

| ID | Categoría | Descripción | Evidencia |
|---|---|---|---|
| A-001 | Rendimiento | Fuente Material Symbols de 1.1MB (87% del peso de página); `lucide-react` ya instalado y casi sin usar en 14 ficheros | `iteracion-001/AUDITORIA-rendimiento.md` C-1/C-2 |
| A-002 | Accesibilidad | Contraste AA fallido sistémico: token `text-sub` (#61896f, 3.95:1) y `text-primary` (#13ec5b, 1.59:1) usados como texto, repetido en 7 vistas | `iteracion-001/AUDITORIA-ux-accesibilidad.md` |
| A-003 | Nutrición | Micronutrientes de embarazo/lactancia (folato, hierro, yodo, DHA) no garantizados de forma determinista | `iteracion-001/AUDITORIA-nutricion-seguridad.md` A-2 |
| A-004 | Nutrición | Condiciones sin objetivos deterministas (hipotiroidismo, hipertiroidismo, hipertrigliceridemia, DM1, DM2, obesidad) | `iteracion-001/AUDITORIA-nutricion-seguridad.md` A-3 |
| A-005 | Seguridad alimentaria | IMC extremo bajo no activa cribado de seguridad; DM1 no bloquea ayuno intermitente | `iteracion-001/AUDITORIA-nutricion-seguridad.md` A-1/A-4 |
| A-006 | Arquitectura | `tsconfig.json` sin modo estricto; `clinicalSafety.ts` (barrera de seguridad clínica) sin ningún test | `iteracion-001/AUDITORIA-arquitectura.md` A-1/A-2 |
| A-007 | Escalabilidad | Carga inicial sin paginación (`SELECT *`), cero índices en el esquema, sin modelo de tenant/cuenta | `iteracion-001/AUDITORIA-escalabilidad.md` A-1/A-2/A-3 |
| A-008 | Motor de recetas | Sin campos de alérgenos ni nivel de elaboración en `Recipe` — bloquea WF-N | `iteracion-001/AUDITORIA-orquestador.md` |
| A-009 | IA | Sin batería de evals ejecutada, sin validación de esquema runtime de las respuestas | `iteracion-001/AUDITORIA-orquestador.md` |
| A-010 | Calidad del contenido | El PDF/documento imprimible del plan no incluye disclaimer general | `iteracion-001/AUDITORIA-orquestador.md` |

### Decisión de negocio pendiente (no técnica)
- **Monetización (0/100):** confirmar con Humano-PO si debe repesarse/excluirse dado el modelo actual de herramienta interna mono-cliente, antes de tratarla como deuda técnica a resolver.

*M1 completo (16/16 categorías). Nota global oficial: 53.61/100 — ver `SCORECARD.md`.*

## Estado tras M3 (priorización, 2026-07-09)

Seleccionadas para ejecución en la iteración 001 (ver `SELECCION.md`, `MEJORA-001.md` a `MEJORA-007.md`): B-001, B-002, P-001, B-003, A-002, A-005, A-010.

## Estado tras M8 (ejecución, 2026-07-09) — 7/7 mejoras completadas

| Mejora | Estado | Commit |
|---|---|---|
| MEJORA-002 (jerarquía exclusión>rotación) | ✅ Implementada | `ab5dcca` |
| MEJORA-006 (BMI extremo + DM1 ayuno) | ✅ Implementada | `905e029` |
| MEJORA-001 (alérgenos) + MEJORA-004 (a11y checkboxes) + MEJORA-007 (disclaimer) | ✅ Implementadas juntas | `6e2d341` |
| MEJORA-005 (contraste AA) | ✅ Implementada | `e04a8ab` |
| MEJORA-003 (RLS Supabase) | ✅ Resuelta — verificación de solo lectura confirmó que ya estaba correcto en producción; solo se corrigió el script local desactualizado | `d3b55bf` |

Todas verificadas: 127/127 tests OK, `tsc` limpio, build limpio, axe-core en vivo (0 violaciones en Dashboard tras MEJORA-005), atributos ARIA confirmados en el DOM real (MEJORA-004).

## Estado tras M9/M10 (re-auditoría y recálculo, 2026-07-09)

Nota global: 53.61 → **56.10** (+2.49). Ver `DELTA.md`. Bloqueantes B-001, B-002, B-003, P-001 confirmados resueltos por agentes distintos a los que implementaron cada mejora (regla anti-inflación §2.2). 0 regresiones detectadas.

Nuevos hallazgos menores registrados en esta re-auditoría:

| ID | Categoría | Severidad | Descripción | Estado |
|---|---|---|---|---|
| M-001 | Seguridad alimentaria | baja | Falsos positivos en `ALLERGEN_KEYWORDS` por matching de subcadena: "leche de almendras"→Leche. **Resuelto en MEJORA-009 (iteración 002)** — "avena"→Gluten confirmado correcto (Reglamento UE), no era un bug | resuelto (iteración 002) |
| M-002 | Seguridad alimentaria | media | Sin verificador determinista post-generación de que el plan de la IA respeta los alérgenos/exclusiones declarados. **Resuelto en MEJORA-010 (iteración 002)** — cobertura parcial (solo `handleFormSubmit`; `handleCoupleSubmit`/regeneración de día/swap de comida quedan para extensión futura) | resuelto parcialmente (iteración 002) |

## Estado tras iteración 002 (2026-07-09)

3 mejoras ejecutadas: MEJORA-008 (fuente de iconos + fix CLS), MEJORA-009 (fix falso positivo alérgenos), MEJORA-010 (verificador post-generación). Nota global: 56.10 → 59.04 (+2.94, de los cuales +2.34 es efecto contable del repeso de Monetización y +0.60 es mejora real de producto). **Seguridad alimentaria cruza 80 por primera vez** (79→83), desactivando el tope de seguridad de §2.1.

Nuevo ítem de backlog: extender MEJORA-010 (verificador de alérgenos) a `handleCoupleSubmit`, `regenerateSingleDay`, `generateSingleMeal` y `adaptPlanToPartner` para cobertura completa (hoy solo cubre la generación inicial individual).

Quedan en el backlog para futuras iteraciones: A-003/A-004 (objetivos deterministas, requiere sign-off DN previo), A-006 (tsconfig estricto + tests), A-007 (paginación/índices Supabase, multi-tenant real — candidato prioritario siguiente), A-008 (campos Recipe con alérgenos poblados en las 68 recetas del corpus estático), A-009 (evals de IA — requiere autorización explícita puntual por coste de API), extensión de MEJORA-010, y la decisión de negocio sobre Monetización (ya resuelta: excluida por ahora).

## ⚠️ Corrección crítica del scorecard (2026-07-10) — ver `iteracion-003/DELTA-004.md`

El tope de seguridad de §2.1 ("si Nutrición < 80 O Seguridad alimentaria < 80 → nota global capada a 59") se leyó mal como AND en los cierres de las iteraciones 002 y 003, y no se aplicó. Nutrición lleva en 75 desde la iteración 001. **Las notas globales oficiales reales de 002 y 003 son 59.00, no 59.04/60.49.** Corregido en `SCORECARD.md`.

### P-002 — Nutrición capada en 75, bloquea la nota global oficial (BLOQUEANTE, máxima prioridad)

| ID | Categoría | Severidad | Descripción | Estado |
|---|---|---|---|---|
| P-002 | Nutrición | **bloqueante** (era) | Nutrición en 75/100 desde iteración 001. Mientras no cruzara 80, el tope de §2.1 capaba la nota global oficial a 59. **RESUELTO 2026-07-10:** A-2, A-3, M-3 y C1 cerrados con evidencia (4 commits, revisión healthcare independiente) → Nutrición 80, tope levantado, nota global oficial 61.94. Ver `iteracion-003/DELTA-005.md`. | **resuelto (iteración 003)** |

## Estado tras iteración 003, 2º lote (2026-07-10)

8 mejoras autónomas más, fuera del ciclo formal de auditoría (origen: "¿qué le falta a la app que no hayamos visto?"). Ver `iteracion-003/DELTA-004.md` para el detalle de categorías y deltas. Nota global oficial: sigue en **59.00** (capada — ver corrección arriba), aunque el cálculo bruto sube a 61.31.

Nuevos ítems:

| ID | Categoría | Severidad | Descripción | Estado |
|---|---|---|---|---|
| O-008 | Escalabilidad | media | Tabla `appointments` (agenda/citas) — **RESUELTO 2026-07-11**: migración aplicada tras aprobación explícita ("haz la agenda de citas"), CRUD en `useAppData.ts`, vista `AgendaView.tsx` enlazada en Sidebar/App.tsx. Verificado en vivo end-to-end contra producción | **resuelto (iteración 003)** |
| O-009 | (sin categoría — gap del marco) | media | El marco de 16 categorías no tiene ningún apartado de cumplimiento legal/privacidad (RGPD, retención de datos, etc.). Se implementó un registro de consentimiento (checkbox + fecha) como ayuda de memoria, no como certificación de cumplimiento. Considerar si merece una 17ª categoría o quedarse fuera del scoring | abierto |
| O-010 | Personalización | baja | Adherencia autopercibida codificada como prefijo de texto en `notes` (columna existente) en vez de columna propia — migración preparada en `docs/supabase/add_adherence_migration.sql`, no aplicada | bloqueado — esperando aprobación |

## Flags para la DN tras P-002 (2026-07-10) — decisiones clínicas, no autónomas

| ID | Categoría | Severidad | Descripción | Estado |
|---|---|---|---|---|
| DN-001 | Nutrición | media | La dieta cetogénica produce ~71 g HC/día (14% E) para el paciente de referencia — por encima del umbral cetogénico típico (20-50 g) y del 5-10% E que declara el comentario del código. Corregirlo = subir grasa a ~72% E → decisión de Ester. Fijado en test como DISCREPANCIA CONOCIDA (`macroDistribution.test.ts`) | abierto — espera DN |
| DN-002 | Nutrición | baja | Rangos del comentario de `calculations.ts` desalineados con la realidad computada: Paleo HC 39.6% (comentario decía 25-35%), Proteica P 28% (comentario decía 30-35%). Decidir rango objetivo o actualizar comentario | abierto — espera DN |
| DN-003 | Seguridad alimentaria | baja | Dieta "Sin cocina" + embarazo: la exclusión AESAN prevalece por Regla 0 y el texto ya dice "jamón cocido", pero conviene revisión del caso completo por la DN (hallazgo #4 de la revisión healthcare) | abierto — espera DN |
