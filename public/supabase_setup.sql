-- ─────────────────────────────────────────────────────────────────
--  NutriPlan — Schema Supabase
--  Ejecuta este archivo completo en:
--  Supabase Dashboard → SQL Editor → New query → Pegar → Run
-- ─────────────────────────────────────────────────────────────────

-- 1. Planes de dieta guardados
create table if not exists saved_diets (
  id            text        primary key,
  timestamp     bigint      not null,
  patient_data  jsonb       not null,
  metrics       jsonb       not null,
  plan          jsonb       not null,
  created_at    timestamptz default now()
);

-- 2. Alimentos personalizados
create table if not exists custom_foods (
  id            text        primary key,
  name          text        not null,
  brand         text,
  calories      numeric     not null,
  protein       numeric     not null,
  carbs         numeric     not null,
  fats          numeric     not null,
  portion_size  text        not null,
  created_at    timestamptz default now()
);

-- 3. Registros de progreso (pesa inteligente)
create table if not exists progress_entries (
  id               text        primary key,
  client_name      text        not null,
  date             bigint      not null,
  weight           numeric     not null,
  imc              numeric,
  body_fat         numeric,
  water_percent    numeric,
  protein_percent  numeric,
  basal_metabolism numeric,
  muscle_mass      numeric,
  visceral_fat     numeric,
  bone_mass        numeric,
  notes            text,
  created_at       timestamptz default now()
);

-- 4. Objetivos de peso por cliente
create table if not exists client_goals (
  client_name  text        primary key,
  weight_goal  numeric,
  goal_date    bigint,
  updated_at   timestamptz default now()
);

-- ─── Permisos: app privada de un solo usuario ─────────────────────
-- RLS habilitado con política de acceso abierto (allow_all_anon) — mismo
-- patrón que couples_diets.sql. Corregido en la auditoría iteración 001
-- (MEJORA-003): este script decía "disable row level security", pero el
-- estado real verificado en el proyecto Supabase (2026-07-09, vía MCP,
-- solo lectura) tenía RLS activo con estas políticas desde antes — el
-- script commiteado estaba desactualizado respecto a la migración real
-- aplicada. Ver docs/loop/iteracion-001/MEJORA-003.md.
alter table saved_diets      enable row level security;
alter table custom_foods     enable row level security;
alter table progress_entries enable row level security;
alter table client_goals     enable row level security;

create policy if not exists "allow_all_anon" on saved_diets      for all using (true) with check (true);
create policy if not exists "allow_all_anon" on custom_foods     for all using (true) with check (true);
create policy if not exists "allow_all_anon" on progress_entries for all using (true) with check (true);
create policy if not exists "allow_all_anon" on client_goals     for all using (true) with check (true);
