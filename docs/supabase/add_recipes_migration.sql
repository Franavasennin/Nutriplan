-- ✅ APLICADA el 2026-07-25 (proyecto nutriplan, oodbwiknxuldokaajwdc)
-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: tabla `recipes` — recetas gestionables desde el panel
--
-- Contexto: data/recipes.ts es hoy un fichero de código estático (78 recetas
-- hardcodeadas) -- no hay forma de añadir/editar/borrar una receta sin tocar
-- TypeScript y desplegar. App.tsx ya pasa <RecipeSearch recipes={dbRecipes}/>
-- y RecipeSearch.tsx ya prioriza dbRecipes sobre el RECIPES estático en cuanto
-- tenga contenido -- solo falta que dbRecipes sea de verdad una tabla.
--
-- Mismo criterio que el resto de tablas del proyecto: id text (generado en
-- cliente con crypto.randomUUID()), arrays como jsonb (nunca text[] -- sin
-- precedente de eso en ninguna tabla existente), RLS allow_all_anon (app
-- mono-usuario, sin autenticación real todavía, backlog A-007).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.recipes (
  id            text primary key,
  title         text        not null,
  description   text        not null,
  prep_time     integer     not null,
  calories      numeric     not null,
  protein       numeric     not null,
  carbs         numeric     not null,
  fats          numeric     not null,
  ingredients   jsonb       not null default '[]'::jsonb,
  instructions  jsonb       not null default '[]'::jsonb,
  tags          jsonb       not null default '[]'::jsonb,
  allergens     jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- RLS: mismo patrón allow_all_anon ya usado en las demás tablas.
alter table public.recipes enable row level security;
create policy "allow_all_anon" on public.recipes for all using (true) with check (true);

-- ─── Verificación posterior (ejecutar tras aplicar) ────────────────────────
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'recipes';
-- SELECT count(*) FROM public.recipes; -- debe dar 78 tras el seed (Fase 2)

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- drop table if exists public.recipes;
