-- ─────────────────────────────────────────────────────────────────────────────
-- (iteración 003) — Agenda/citas básica. Hallazgo: no existe ningún sistema
-- de citas/agenda -- la nutricionista no tiene forma de programar ni ver
-- próximas consultas dentro de la app.
--
-- A diferencia de otros hallazgos de esta misma iteración (adherencia,
-- clientId), aquí NO hay ningún campo o columna JSONB existente donde meter
-- esto sin que sea un hack semántico: una cita es una entidad nueva (fecha,
-- hora, cliente, estado), no un dato adicional de algo que ya existe. Por
-- eso no se ha implementado ya un "workaround" de frontend como con la
-- adherencia -- construir la funcionalidad sin esta tabla implicaría, o bien
-- que cada guardado falle (la tabla no existe todavía), o bien guardar solo
-- en localStorage (se perdería todo al limpiar datos del navegador o cambiar
-- de dispositivo -- inaceptable para citas reales, a diferencia de una
-- papelera de deshacer de 6 segundos).
--
-- ✅ APLICADA el 2026-07-11 tras aprobación explícita de Fran ("haz la
--    agenda de citas"). Frontend completo ya implementado: types.ts
--    (Appointment, AppointmentStatus), hooks/useAppData.ts (CRUD + carga)
--    y components/AgendaView.tsx (calendario + lista, ver App.tsx paso
--    'agenda' y Sidebar.tsx). Verificado en vivo end-to-end contra la
--    producción real: crear → persistir → marcar realizada → historial →
--    eliminar, con lectura directa de la tabla en cada paso.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists appointments (
  id                text primary key,
  client_name       text not null,
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 30,
  status            text not null default 'scheduled'
                       check (status in ('scheduled', 'done', 'cancelled', 'no_show')),
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_appointments_scheduled_at on appointments (scheduled_at);
create index if not exists idx_appointments_client_name  on appointments (client_name);

-- RLS: seguir el mismo patrón allow_all_anon ya usado en las demás tablas
-- (ver public/supabase_setup.sql) -- app de un solo usuario (la nutricionista),
-- sin autenticación multiusuario todavía (hallazgo #3, explícitamente fuera
-- de alcance de esta iteración).
alter table appointments enable row level security;
create policy allow_all_anon on appointments for all using (true) with check (true);

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'appointments';

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- drop table if exists appointments;
