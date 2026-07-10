-- ─────────────────────────────────────────────────────────────────────────────
-- MEJORA-018 (iteración 003) — Vincular seguimiento por ID de paciente, no por
-- nombre en texto libre. Hallazgo: "los pacientes no existen como entidad" —
-- progress_entries y client_goals se indexan hoy por client_name (texto libre).
-- Riesgo real: si la nutricionista escribe "María García" un día y
-- "Maria Garcia" (sin tilde) otro, se crean dos historiales de seguimiento
-- separados para la misma persona; si corrige el nombre de un cliente, su
-- seguimiento queda huérfano (no hay ON UPDATE CASCADE posible sobre texto).
--
-- Estado actual (aplicado ya en el frontend, sin tocar el esquema):
--   - PatientData.clientId (dentro de patient_data JSONB en saved_diets) se
--     genera una vez por cliente y se conserva en cada edición.
--   - progress_entries y client_goals SIGUEN usando client_name como hoy.
--
-- ⚠️ NO EJECUTAR SIN APROBACIÓN EXPLÍCITA — toca el esquema de producción
--    (oodbwiknxuldokaajwdc.supabase.co). Es aditivo y reversible (columnas
--    nuevas nullable, sin borrar nada), pero sigue el mismo criterio de
--    cautela que la migración de RLS: solo lectura hasta confirmar.
--
-- Tras aprobar, el código de la app (hooks/useAppData.ts) necesitaría
-- actualizarse para escribir/leer client_id además de client_name — ese
-- cambio de aplicación NO está incluido en este script ni se ha hecho
-- todavía; esto es únicamente la migración de esquema preparatoria.
-- ─────────────────────────────────────────────────────────────────────────────

alter table progress_entries add column if not exists client_id text;
alter table client_goals     add column if not exists client_id text;

create index if not exists idx_progress_entries_client_id on progress_entries (client_id);

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name IN ('progress_entries','client_goals') AND column_name = 'client_id';

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- alter table progress_entries drop column if exists client_id;
-- alter table client_goals     drop column if exists client_id;
-- drop index if exists idx_progress_entries_client_id;
