# MEJORA-003 — Verificación y remediación de RLS en Supabase

**Iteración:** 001 · **Categoría:** Escalabilidad / Seguridad · **Origen:** P-001 (bloqueante, CRÍTICO)

## Problema

`public/supabase_setup.sql:58-61` (idéntico en `dist/`) **deshabilita explícitamente RLS** en `saved_diets`, `custom_foods`, `progress_entries`, `client_goals` (datos de salud, RGPD art. 9). Contradice la nota de proyecto (Obsidian, 2026-05-28) que documenta RLS habilitado con `allow_all_anon`. La `anon key` está embebida en el bundle JS público. Evidencia: `iteracion-001/AUDITORIA-escalabilidad.md` C-1/C-2.

## ⚠️ Nota de proceso — esta mejora requiere confirmación humana antes de ejecutarse

Esta mejora toca infraestructura de producción (proyecto Supabase real `oodbwiknxuldokaajwdc.supabase.co`). Por las reglas de este sistema (acciones difíciles de revertir / que afectan sistemas compartidos requieren confirmación explícita), **no se aplicará ningún cambio en el proyecto Supabase real sin aprobación explícita de Fran**. Esta ficha define el trabajo, pero su ejecución (M8) se divide en dos partes: (a) preparar el script de migración SQL, verificable y revisable, y (b) NO aplicarlo hasta que el Humano-PO confirme el estado real observado en el dashboard.

## Solución propuesta

1. **Verificación (requiere acceso del Humano-PO al dashboard de Supabase, o autorización para usar MCP de Supabase si está disponible):** confirmar si el estado real de RLS en las 4 tablas coincide con `public/supabase_setup.sql` (deshabilitado) o con la nota de Obsidian (habilitado con `allow_all_anon`).
2. **Si RLS está deshabilitado en producción:** preparar (no aplicar sin confirmación) un script de migración que habilite RLS en las 4 tablas con una política equivalente a `allow_all_anon` (ALL, `USING (true)`) — mismo nivel de protección que ya existe en `couples_diets`, coherente con el modelo actual de mono-usuario/intranet. Esto no añade aislamiento por cuenta (no existe ese concepto hoy) pero cierra la discrepancia y establece una base auditable.
3. **Actualizar `public/supabase_setup.sql` y `dist/supabase_setup.sql`** para que coincidan con el estado real aplicado, eliminando la discrepancia entre código y documentación.
4. **Actualizar la nota de Obsidian** del proyecto para reflejar el estado verificado (no el asumido).

## No-alcance

- No se implementa autenticación por usuario ni aislamiento multi-tenant real en esta mejora (eso es A-007/A-003 arquitectura de escalabilidad, de mayor alcance, iteración futura).
- No se cambia la decisión de negocio de "app 100% intranet" — se asume vigente salvo que el Humano-PO indique lo contrario.

## Criterios de aceptación (medibles)

- [ ] Estado real de RLS en las 4 tablas verificado y documentado (con capturas o salida de consulta SQL).
- [ ] Si procede, migración SQL aplicada **solo tras aprobación explícita** — commit separado, revertible.
- [ ] `public/supabase_setup.sql` y `dist/supabase_setup.sql` actualizados y coherentes entre sí y con el estado real.
- [ ] Nota Obsidian del proyecto actualizada con la fecha de verificación y el estado real confirmado.

## Δ puntos estimado

- Categoría: Escalabilidad · Criterio §8: "RLS verificado en todas las tablas" · Estimación: +20 puntos (Confianza: 0.5 — depende de la verificación real, no controlable desde código; sin aislamiento por cuenta el 100 no es alcanzable con este alcance)

## Plan de prueba

- Consulta SQL de verificación: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` contra el proyecto real (ejecutada por el Humano-PO o vía MCP de Supabase con autorización).
- Tras aplicar (si procede): repetir la consulta y confirmar `rowsecurity = true` en las 4 tablas.

## Plan de rollback

Si la migración causa problemas de acceso inesperados, `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` revierte al estado anterior de forma inmediata (script de rollback se prepara junto al de aplicación).

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
