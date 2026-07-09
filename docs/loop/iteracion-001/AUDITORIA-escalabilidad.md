# Auditoría — Categoría Escalabilidad (peso 5%) — Iteración 001

**Responsable:** `database-reviewer` · **Método aplicado:** revisión estática de código/esquema (sin advisors, sin prueba de volumen real, sin acceso a la base de datos de producción — según instrucción explícita de no tocarla).

## 1. Nota: **28/100** — Banda: Deficiente (0-39)

### Checklist §8 "Escalabilidad (100 cuando...)" — 0/4 criterios cumplidos con evidencia

| Criterio §8 | Cumplido | Evidencia |
|---|---|---|
| RLS verificado en **todas** las tablas con test de aislamiento entre cuentas | ❌ NO | `public/supabase_setup.sql:56-61` **desactiva RLS explícitamente** en las 4 tablas núcleo (`saved_diets`, `custom_foods`, `progress_entries`, `client_goals`). Solo `couples_diets` tiene RLS habilitado (`docs/supabase/couples_diets.sql:14-22`), pero con `USING (true) WITH CHECK (true)` — no hay aislamiento porque no existe concepto de cuenta/tenant en el esquema (grep de `user_id`, `auth.uid`, `nutritionist` en todo `docs/`, `hooks/`, `services/` → 0 resultados). No existe ningún test de aislamiento. |
| 0 advisors de Supabase abiertos | ⚠️ NO VERIFICABLE | No se dispone de acceso al dashboard/CLI de Supabase en esta auditoría (fuera de alcance). Sin evidencia = criterio NO cumplido (regla §2.2). |
| Prueba de volumen (500 pacientes / 5.000 registros) sin degradación perceptible | ❌ NO EJECUTADA | No se ha tocado la BD real. Hallazgo de código que hace sospechar degradación: `hooks/useAppData.ts:72-77` carga con `select('*')` **sin paginación ni límite** las 4 tablas completas en cada `mount` de la app. |
| Estrategia offline documentada y testeada | ⚠️ PARCIAL | `public/sw.js` documenta la estrategia en comentarios (líneas 31-37). Sin evidencia de test que la verifique. |

**Discrepancia crítica detectada:** la nota del proyecto (Obsidian `06 - SaaS/dietmaster-pro.md`, sección "Security Review 2026-05-28") afirma que "RLS habilitado con `allow_all_anon` (ALL) en las 4 tablas" (2026-05-28). Sin embargo, el fichero de esquema realmente commiteado y servido (`public/supabase_setup.sql`, idéntico a `dist/supabase_setup.sql` — verificado con `diff`) hace lo contrario: **`alter table ... disable row level security;`** en las 4 tablas. El código fuente de verdad en el repo no coincide con lo documentado — o el estado real en Supabase difiere de ambos ficheros locales. No se puede resolver sin consultar el proyecto Supabase real (fuera de alcance de esta auditoría). Este hallazgo bloquea el criterio de RLS aunque la app sea intranet: el criterio de §8 es binario y no pondera el contexto de red.

## 2. Hallazgos por severidad

### CRÍTICO
- **C-1 — RLS deshabilitado en 4/5 tablas de datos de salud.** `public/supabase_setup.sql:58-61` (y `dist/supabase_setup.sql`, idéntico). Cualquier cliente con la `anon key` (embebida en el bundle JS público, confirmado en la nota de seguridad 2026-05-28 CVE-1/CVE-2) puede leer/escribir/borrar `saved_diets`, `custom_foods`, `progress_entries`, `client_goals` sin restricción — son datos de salud (RGPD art. 9). Riesgo real mitigado *solo* si la afirmación "100% intranet, nunca publicada" se mantiene sin excepción; no verificable desde el código que esto sea cierto en producción hoy.
- **C-2 — Discrepancia documentación vs. esquema real** (ver arriba). Sin resolver, no se puede dar por bueno ningún estado de RLS.

### ALTO
- **A-1 — Carga inicial sin paginación (`SELECT *` sin límite).** `hooks/useAppData.ts:72-77`. Las 4 queries de arranque no usan `.limit()`, `.range()` ni paginación. A escala de 500 pacientes esto es una carga completa de tabla en cada refresco de página.
- **A-2 — Cero índices definidos en todo el esquema.** Ni `public/supabase_setup.sql` ni `docs/supabase/couples_diets.sql` crean ningún índice más allá de las PK. `progress_entries.client_name` (`hooks/useAppData.ts:208,334,346`) es texto libre sin índice y sin FK — a 5.000 registros el filtro por cliente hará *seq scan*.
- **A-3 — No hay modelo de FK ni de tenant/cuenta.** No existe `user_id`/`nutritionist_id` en ningún fichero. La funcionalidad "multi-tenant (varias nutricionistas)" exigida por §1.2 está completamente ausente.
- **A-4 — Mutaciones no transaccionales.** `hooks/useAppData.ts:389-447` (`importAll`): borra la tabla completa y luego inserta sin transacción. Un fallo de red entre ambas deja al cliente sin datos. Patrón similar (menor) en `updatePatientData` (`:195-218`).

### MEDIO
- **M-1 —** `timestamp bigint` (epoch ms) en vez de `timestamptz` en `saved_diets`, `couples_diets`, `progress_entries.date`.
- **M-2 —** LocalStorage sin gestión de límites para lista de la compra por dieta (dato de la nota de proyecto, no verificado directamente en código en esta auditoría — evidencia de segunda mano).
- **M-3 —** Stub local de Supabase silencioso ante fallo de credenciales (`services/supabaseClient.ts:14-27`) — correcto para no crashear, pero sin telemetría que distinga "modo local intencional" de "fallo real".

### POSITIVO (a destacar)
- **P-1 —** carga inicial de las 4 tablas usa `Promise.all` (`useAppData.ts:72-77`), evita N+1 secuencial. `couples_diets` con degradación explícita si la tabla no existe (`:126-146`).
- **P-2 —** todas las llamadas a Supabase centralizadas en `hooks/useAppData.ts` (verificado por grep) — sin N+1 disperso por componentes.
- **P-3 —** inserciones batch reales donde corresponde (`appendDiets`, `importAll`).

## 3. Partes del método no ejecutadas y por qué

- **Supabase advisors:** no ejecutado — requiere acceso al proyecto real, fuera de alcance.
- **Prueba de volumen sintética:** no ejecutada por la misma restricción; sustituida por inspección de código de patrones de carga.
- **Test de aislamiento RLS entre cuentas:** no ejecutable — no existe concepto de cuenta/usuario en el esquema.
- **Verificación en vivo del estado real de RLS en Supabase** (para resolver C-2): no realizada, mismo motivo de alcance.

## Ficheros revisados
`services/supabaseClient.ts` · `hooks/useAppData.ts` · `docs/supabase/couples_diets.sql` · `public/supabase_setup.sql` · `dist/supabase_setup.sql` · `public/sw.js` · nota Obsidian del proyecto (contexto, no código de producto).
