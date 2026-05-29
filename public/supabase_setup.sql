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
-- Desactivamos RLS para acceso directo con la publishable key
alter table saved_diets     disable row level security;
alter table custom_foods    disable row level security;
alter table progress_entries disable row level security;
alter table client_goals    disable row level security;
