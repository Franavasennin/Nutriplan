# MEJORA-003 — Verificación y remediación de RLS en Supabase

**Iteración:** 001 · **Categoría:** Escalabilidad / Seguridad · **Origen:** P-001 (bloqueante, CRÍTICO) · **Estado: RESUELTA (2026-07-09)**

## Problema

`public/supabase_setup.sql:58-61` (idéntico en `dist/`) **deshabilita explícitamente RLS** en `saved_diets`, `custom_foods`, `progress_entries`, `client_goals` (datos de salud, RGPD art. 9). Contradice la nota de proyecto (Obsidian, 2026-05-28) que documenta RLS habilitado con `allow_all_anon`. La `anon key` está embebida en el bundle JS público. Evidencia: `iteracion-001/AUDITORIA-escalabilidad.md` C-1/C-2.

## ✅ Resolución (2026-07-09)

Se verificó el estado real del proyecto Supabase (`oodbwiknxuldokaajwdc`, "nutriplan") vía MCP de Supabase, en **modo solo lectura** (`execute_sql` con `SELECT`, sin ninguna sentencia de escritura/DDL contra producción):

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- client_goals=true · couples_diets=true · custom_foods=true ·
-- progress_entries=true · saved_diets=true   → LAS 5 CON RLS ACTIVO

SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public';
-- política "allow_all_anon" (ALL, using true, with check true) presente en las 5 tablas
```

**Conclusión: el estado real de producción SIEMPRE fue correcto** (RLS activo + política `allow_all_anon`, coherente con la nota de Obsidian y con `couples_diets.sql`). La discrepancia era exclusivamente del fichero `public/supabase_setup.sql` commiteado, desactualizado respecto a una migración real aplicada directamente en el dashboard en algún momento sin actualizar el script.

**No se aplicó ningún cambio en la base de datos real** — no hizo falta. Se corrigió únicamente el script local (`public/supabase_setup.sql`) para que refleje la realidad (`enable row level security` + políticas `allow_all_anon`), eliminando la discrepancia. Ver también `docs/supabase/enable_rls_migration.sql`, que documenta el proceso de verificación completo.

Advisors de seguridad de Supabase consultados (`get_advisors`, tipo `security`): solo el WARN esperado `rls_policy_always_true` en las 5 tablas (política sin restricción real) — ya conocido y coherente con la decisión de negocio de "app 100% intranet, mono-usuario". No hay hallazgos nuevos.

## ⚠️ Nota de proceso original (ya superada por la resolución anterior)

Esta mejora tocaba potencialmente infraestructura de producción, por lo que se estableció que ningún cambio se aplicaría sin aprobación explícita de Fran. En la práctica, la verificación reveló que no hacía falta ningún cambio de infraestructura — solo se corrigió documentación/código local, por lo que esta cautela no llegó a activarse.

## Solución propuesta

1. **Verificación (requiere acceso del Humano-PO al dashboard de Supabase, o autorización para usar MCP de Supabase si está disponible):** confirmar si el estado real de RLS en las 4 tablas coincide con `public/supabase_setup.sql` (deshabilitado) o con la nota de Obsidian (habilitado con `allow_all_anon`).
2. **Si RLS está deshabilitado en producción:** preparar (no aplicar sin confirmación) un script de migración que habilite RLS en las 4 tablas con una política equivalente a `allow_all_anon` (ALL, `USING (true)`) — mismo nivel de protección que ya existe en `couples_diets`, coherente con el modelo actual de mono-usuario/intranet. Esto no añade aislamiento por cuenta (no existe ese concepto hoy) pero cierra la discrepancia y establece una base auditable.
3. **Actualizar `public/supabase_setup.sql` y `dist/supabase_setup.sql`** para que coincidan con el estado real aplicado, eliminando la discrepancia entre código y documentación.
4. **Actualizar la nota de Obsidian** del proyecto para reflejar el estado verificado (no el asumido).

## No-alcance

- No se implementa autenticación por usuario ni aislamiento multi-tenant real en esta mejora (eso es A-007/A-003 arquitectura de escalabilidad, de mayor alcance, iteración futura).
- No se cambia la decisión de negocio de "app 100% intranet" — se asume vigente salvo que el Humano-PO indique lo contrario.

## Criterios de aceptación (medibles)

- [x] Estado real de RLS en las 4 tablas verificado y documentado (salida de consulta SQL vía MCP, solo lectura).
- [x] No fue necesaria ninguna migración SQL en producción (RLS ya estaba correctamente configurado).
- [x] `public/supabase_setup.sql` actualizado para coincidir con el estado real (`dist/` se regenera en build, no versionado).
- [ ] Nota Obsidian del proyecto: pendiente de una pequeña actualización (añadir fecha de re-verificación 2026-07-09) — no urgente, el contenido ya era correcto.

## Δ puntos estimado

- Categoría: Escalabilidad · Criterio §8: "RLS verificado en todas las tablas" · Estimación: +20 puntos (Confianza: 0.5 — depende de la verificación real, no controlable desde código; sin aislamiento por cuenta el 100 no es alcanzable con este alcance)

## Plan de prueba

- Consulta SQL de verificación: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` contra el proyecto real (ejecutada por el Humano-PO o vía MCP de Supabase con autorización).
- Tras aplicar (si procede): repetir la consulta y confirmar `rowsecurity = true` en las 4 tablas.

## Plan de rollback

Si la migración causa problemas de acceso inesperados, `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` revierte al estado anterior de forma inmediata (script de rollback se prepara junto al de aplicación).

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
