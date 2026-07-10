-- ─────────────────────────────────────────────────────────────────────────────
-- (iteración 003) — Columna estructurada de adherencia por visita de
-- seguimiento. Hallazgo: no existía ninguna forma de registrar/consultar la
-- adherencia autopercibida del paciente en progress_entries.
--
-- Estado actual (aplicado ya en el frontend, sin tocar el esquema):
--   - components/ProgressTracker.tsx codifica la adherencia como un prefijo
--     legible dentro del propio campo `notes` (ej. "[Adherencia: Alta] ...")
--     y lo parsea de vuelta para mostrar una insignia de color en el
--     historial. Funciona y persiste ya mismo porque `notes` es una columna
--     existente -- no exige aprobar ni aplicar ningún DDL.
--   - Limitación de ese enfoque: no se puede graficar la adherencia en el
--     tiempo ni filtrar/consultar por nivel sin parsear texto.
--
-- ⚠️ NO EJECUTAR SIN APROBACIÓN EXPLÍCITA — toca el esquema de producción
--    (oodbwiknxuldokaajwdc.supabase.co). Es aditivo y reversible (columna
--    nueva nullable, sin borrar nada), mismo criterio de cautela que las
--    migraciones de RLS y de client_id.
--
-- Tras aprobar, useAppData.ts (saveProgressEntry/updateProgressEntry/carga
-- inicial) necesitaría leer/escribir `adherence` como columna propia en vez
-- de parsear el prefijo de `notes` -- ese cambio de aplicación NO está
-- incluido en este script ni se ha hecho todavía; esto es únicamente la
-- migración de esquema preparatoria.
-- ─────────────────────────────────────────────────────────────────────────────

alter table progress_entries add column if not exists adherence smallint
  check (adherence is null or adherence between 1 and 5);

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'progress_entries' AND column_name = 'adherence';

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- alter table progress_entries drop column if exists adherence;
