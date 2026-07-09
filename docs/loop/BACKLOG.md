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
| M-001 | Seguridad alimentaria | baja | Falsos positivos en `ALLERGEN_KEYWORDS` por matching de subcadena: "leche de almendras"→Leche, "avena"→Gluten. Erra del lado seguro (sobre-avisa), impacto bajo | abierto |
| M-002 | Seguridad alimentaria | media | Sin verificador determinista post-generación de que el plan de la IA respeta los alérgenos/exclusiones declarados — el resaltado de la lista de la compra es solo un aviso pasivo. No-alcance ya declarado en MEJORA-001, pero queda como candidato de mejora futura | abierto |

Quedan en el backlog para futuras iteraciones: A-001 (fuente 1.1MB), A-003/A-004 (objetivos deterministas, requiere sign-off DN previo), A-006 (tsconfig estricto + tests), A-007 (paginación/índices Supabase, multi-tenant real), A-008 (campos Recipe, parcialmente cubierto por MEJORA-001), A-009 (evals de IA), M-001, M-002, y la decisión de negocio sobre Monetización.
