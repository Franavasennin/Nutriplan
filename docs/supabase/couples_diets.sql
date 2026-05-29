-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: couples_diets (Feature 2 — Dietas para Parejas)
-- Ejecutar en Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.couples_diets (
  id        text primary key,
  timestamp bigint not null,
  person_a  jsonb  not null,   -- SavedDiet completa de la persona A
  person_b  jsonb  not null    -- SavedDiet completa de la persona B
);

-- Row Level Security
alter table public.couples_diets enable row level security;

-- Política: permitir todas las operaciones con la anon key
-- (mismo patrón que el resto de tablas de la app)
create policy "Allow all on couples_diets"
  on public.couples_diets
  for all
  using (true)
  with check (true);
