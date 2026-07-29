-- Migración: tabla `clinic_settings` — criterio global de la nutricionista
--
-- Contexto: plan "Hacer la IA experta en nutrición" (Fase 3). Hoy
-- `PatientData.planInstructions` (feature "Pautas") permite dar una
-- instrucción en lenguaje natural POR DIETA CONCRETA. Esta migración añade
-- el equivalente A NIVEL DE CLÍNICA -- un criterio de Ester que se aplica a
-- TODAS las generaciones futuras, no solo a una dieta puntual.
--
-- Fila única (id fijo 'default') en vez de una tabla de config genérica:
-- no hay multi-usuario en esta app (mono-clínica), así que no hace falta más.
-- Mismo criterio que el resto de tablas del proyecto: RLS allow_all_anon.

create table if not exists public.clinic_settings (
  id         text primary key default 'default',
  criteria   text,
  updated_at timestamptz not null default now()
);

alter table public.clinic_settings enable row level security;
create policy "allow_all_anon" on public.clinic_settings for all using (true) with check (true);

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'clinic_settings';

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- drop table if exists public.clinic_settings;
