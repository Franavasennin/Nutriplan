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
| P-001 | Escalabilidad / Seguridad | **CRÍTICA** | `public/supabase_setup.sql:58-61` (idéntico en `dist/`) **deshabilita RLS explícitamente** en `saved_diets`, `custom_foods`, `progress_entries`, `client_goals` (datos de salud, RGPD art. 9). Contradice la nota de proyecto (Obsidian, 2026-05-28) que afirma RLS habilitado con `allow_all_anon`. La `anon key` está embebida en el bundle JS público (CVE-2 histórico) — si esta discrepancia se confirma en el proyecto Supabase real, cualquiera con esa key puede leer/escribir/borrar todos los datos de pacientes. Requiere verificación urgente en el dashboard real de Supabase (`oodbwiknxuldokaajwdc.supabase.co`), fuera del alcance de esta auditoría de código. Ver `iteracion-001/AUDITORIA-escalabilidad.md` hallazgos C-1/C-2 | abierto — **veto automático de §3.3(a), entra en iteración 001/002 sin esperar priorización** |

*Backlog formal (P-nnn/O-nnn con evidencia completa) se genera en M2 tras la primera auditoría M1.*
