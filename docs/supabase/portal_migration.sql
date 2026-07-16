-- ✅ APLICADA el 2026-07-16 (proyecto nutriplan, oodbwiknxuldokaajwdc)
--
-- Portal del Paciente (Fase 2) — backfill de clientId + tablas del portal.
--
-- Contexto: auditado con execute_sql antes de escribir esto — de las 30 filas
-- de saved_diets, NINGUNA tenía patient_data->>'clientId' relleno (el campo
-- solo se genera para pacientes creados desde MEJORA-018, iteración 003; los
-- 30 existentes son anteriores). El portal ancla su token a clientId (estable
-- entre regeneraciones de plan) — sin backfill, esos 30 pacientes no podrían
-- tener portal.

-- 1) Backfill: un clientId nuevo por cada fila que no lo tenga. Cada fila es
--    una persona distinta (incluidas las parejas vinculadas vía linked_to_id,
--    que son personas separadas con su propio patient_data) — no se comparte
--    clientId entre filas.
update public.saved_diets
set patient_data = jsonb_set(patient_data, '{clientId}', to_jsonb(gen_random_uuid()::text))
where patient_data->>'clientId' is null;

-- 2) Tokens del portal — uno por paciente (ancla en clientId, no en saved_diets.id,
--    para que el enlace siga funcionando aunque la nutricionista regenere el plan).
create table if not exists public.portal_tokens (
  token             text primary key,
  client_id         text not null,
  client_name       text not null,
  enabled           boolean not null default true,
  show_equivalences boolean not null default true,
  created_at        timestamptz not null default now(),
  last_access_at    timestamptz
);
create index if not exists idx_portal_tokens_client_id on public.portal_tokens(client_id);

-- 3) Comidas marcadas como realizadas por el paciente en el portal.
create table if not exists public.portal_meal_completions (
  id          text primary key,
  token       text not null references public.portal_tokens(token) on delete cascade,
  day_number  int not null,
  meal_key    text not null,
  meal_date   date not null,
  created_at  timestamptz not null default now(),
  unique (token, meal_date, meal_key)
);
create index if not exists idx_portal_completions_token on public.portal_meal_completions(token);

-- 4) RLS — misma política que el resto de tablas (allow_all_anon): app mono-
--    usuario, sin autenticación real de la nutricionista todavía (A-007 en
--    BACKLOG.md). El portal en sí NO usa la clave anónima directamente — pasa
--    siempre por las Edge Functions portal-diet/portal-complete, que validan
--    el token con la service role. Este RLS es para que el panel de la
--    nutricionista (que sí usa la clave anónima) pueda gestionar los tokens.
alter table public.portal_tokens enable row level security;
create policy "allow_all_anon" on public.portal_tokens for all using (true) with check (true);

alter table public.portal_meal_completions enable row level security;
create policy "allow_all_anon" on public.portal_meal_completions for all using (true) with check (true);
