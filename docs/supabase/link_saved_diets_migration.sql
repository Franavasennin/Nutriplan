-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: vínculo Paciente Principal → Pareja/Familia en saved_diets
-- Sustituye couples_diets (dos SavedDiet embebidas sin relación entre ellas,
-- no escala a N personas) por un vínculo real dentro de saved_diets, vía
-- linked_to_id — escalable a familias/hijos en el futuro sin nueva migración.
--
-- Auditoría previa (2026-07-11, vía execute_sql de solo lectura):
--   SELECT count(*), count(*) filter (where person_a->>'id' is null or
--     person_b->>'id' is null) FROM couples_diets;
--   → total: 2, malformadas: 0. Seguro migrar sin filas huérfanas.
--
-- ✅ APLICADA el 2026-07-11 (columnas + índice + migración de datos).
--    Verificado: 5/5 columnas creadas, 2/2 filas de couples_diets migradas
--    (principal + pareja), linked_to_id de cada pareja apunta a un
--    principal existente (JOIN de verificación sin huérfanos).
--    couples_diets NO se ha borrado todavía — eso es una migración
--    separada, pendiente hasta verificar en vivo que la UI nueva funciona
--    (fase 6 del plan).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Columnas nuevas en saved_diets, todas nullable (retrocompatibles)
alter table public.saved_diets
  add column if not exists linked_to_id     text references public.saved_diets(id) on delete cascade,
  add column if not exists linked_role      text,
  add column if not exists linked_synced_at bigint,
  add column if not exists locked_meals     jsonb not null default '[]'::jsonb,
  add column if not exists substitutions    jsonb not null default '[]'::jsonb;

-- 2) Índice para "traer todas las personas vinculadas a este principal"
create index if not exists idx_saved_diets_linked_to_id on public.saved_diets(linked_to_id);

-- 3) Migrar datos existentes de couples_diets → saved_diets
--    person_a se inserta como PRINCIPAL (sin linked_to_id).
insert into public.saved_diets (id, timestamp, patient_data, metrics, plan, plan_versions)
select (person_a->>'id'), (person_a->>'timestamp')::bigint,
       person_a->'patientData', person_a->'metrics', person_a->'plan',
       coalesce(person_a->'planVersions', '[]'::jsonb)
from public.couples_diets
on conflict (id) do nothing;

--    person_b se inserta con linked_to_id apuntando al id de person_a.
insert into public.saved_diets (id, timestamp, patient_data, metrics, plan, plan_versions,
                                 linked_to_id, linked_role, linked_synced_at)
select (person_b->>'id'), (person_b->>'timestamp')::bigint,
       person_b->'patientData', person_b->'metrics', person_b->'plan',
       coalesce(person_b->'planVersions', '[]'::jsonb),
       (person_a->>'id'), 'partner', (person_b->>'timestamp')::bigint
from public.couples_diets
on conflict (id) do nothing;

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'saved_diets' AND column_name LIKE 'linked%' OR column_name IN ('locked_meals','substitutions');
-- SELECT count(*) FROM saved_diets WHERE linked_role = 'partner';  -- debe coincidir con el nº de filas de couples_diets

-- ─── Retirada de couples_diets (migración SEPARADA, tras verificar en vivo) ──
-- drop table if exists public.couples_diets;

-- ─── Rollback de esta migración (si algo falla antes del drop) ─────────────
-- delete from saved_diets where linked_role = 'partner';  -- borra las filas migradas de person_b
-- (las filas de person_a quedan como clientes normales — decidir caso a caso si also deben borrarse)
-- alter table saved_diets drop column if exists linked_to_id, drop column if exists linked_role,
--   drop column if exists linked_synced_at, drop column if exists locked_meals, drop column if exists substitutions;
