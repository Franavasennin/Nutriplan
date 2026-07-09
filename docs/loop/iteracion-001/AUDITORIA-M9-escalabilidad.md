# Re-auditoría diferencial — Escalabilidad (M9, iteración 001)

## 1. Nueva nota: **33/100** — Banda: Deficiente (0-39)

**Δ = +5 respecto al 28 original.** Un salto mayor de 5 puntos habría requerido verificación independiente reforzada (§2.2); me ciño a +5 porque, aunque la evidencia de RLS es de buena calidad, no es una verificación reproducible por este auditor (sin MCP de Supabase en este entorno), y el criterio §8 de RLS exige explícitamente "verificado... **con test de aislamiento entre cuentas**" — algo que sigue sin existir y sin poder existir mientras no haya modelo de cuenta (A-3).

| Criterio §8 | Antes | Ahora | Cambio |
|---|---|---|---|
| RLS verificado en todas las tablas + test de aislamiento entre cuentas | ❌ NO (0) | ⚠️ PARCIAL | RLS activo confirmado con evidencia razonable. Test de aislamiento entre cuentas: sigue sin existir — no puede existir sin concepto de cuenta. |
| 0 advisors de Supabase abiertos | ⚠️ NO VERIFICABLE | ⚠️ 1 WARN conocido y aceptado (`rls_policy_always_true`) | Mejora marginal (de "no verificable" a "verificado con 1 warning conocido"), no un "cumplido". |
| Prueba de volumen (500/5.000) sin degradación | ❌ NO EJECUTADA | ❌ NO EJECUTADA | Sin cambios. A-1/A-2 intactos. |
| Estrategia offline documentada y testeada | ⚠️ PARCIAL | ⚠️ PARCIAL | Sin cambios, no tocado en esta iteración. |

Justificación del +5 (no más):
- El hallazgo C-2 (discrepancia doc-vs-esquema) se cierra con evidencia sólida: coincide `public/supabase_setup.sql` corregido, la nota Obsidian original, y `couples_diets.sql` — tres fuentes independientes convergen en el mismo estado (RLS + `allow_all_anon` en las 5 tablas).
- Pero el criterio de escalabilidad de RLS no es solo "¿está encendido?", es "¿hay aislamiento verificado entre cuentas?". `allow_all_anon` con `USING (true)` es equivalente en la práctica a RLS apagado desde el punto de vista de aislamiento de datos — cualquier tenedor de la `anon key` sigue teniendo acceso total. El propio advisor de Supabase (WARN `rls_policy_always_true`) lo señala.
- Trato esto como resolución del **hallazgo de discrepancia documental** (C-2) y **reducción de severidad de C-1** (de "RLS totalmente deshabilitado" a "RLS activo pero sin aislamiento real, por diseño de negocio intranet/mono-usuario"), no como cierre completo del criterio. A-1/A-2/A-3, que pesan más en una nota de "Escalabilidad" real (volumen, tenant), siguen sin tocar.

## 2. Estado C-1 / C-2 (RLS)

**C-2 (discrepancia documento-realidad): RESUELTO.**
- `public/supabase_setup.sql` (líneas 56-72) ahora dice `enable row level security` + política `allow_all_anon`, coherente con `couples_diets.sql` (mismo patrón, sin tocar).
- La evidencia citada en MEJORA-003 (`SELECT rowsecurity FROM pg_tables` → 5/5 true; `SELECT ... FROM pg_policies` → `allow_all_anon` en las 5 tablas) responde exactamente a la pregunta, y es internamente coherente: si RLS estuviera activo sin política coincidente, la app no podría leer/escribir nada, y eso se habría notado en producción.
- Limitación honesta: no reproducible por este auditor (sin MCP de Supabase disponible aquí) — verificación de coherencia y plausibilidad de la evidencia documentada, no repetición independiente del hecho. Dentro de esa limitación, la evidencia es de buena calidad (3 fuentes convergentes, confianza declarada explícitamente en 0.5 en la propia ficha, no inflada). Doy por bueno C-2.

**C-1 (RLS deshabilitado como riesgo): REDUCIDO DE SEVERIDAD, NO ELIMINADO.**
El riesgo original era "RLS totalmente apagado". Verificado que está encendido, pero con política sin restricción real (`allow_all_anon`) — funcionalmente equivalente a no tener RLS para efectos de aislamiento. Decisión de negocio aceptada y documentada (intranet mono-usuario), no un hallazgo nuevo. Reclasificado de CRÍTICO a **MEDIO**, condicionado a que la premisa de intranet se mantenga (la `anon key` sigue embebida en el bundle público).

## 3. A-1 / A-2 / A-3 — confirmado: siguen abiertos, sin cambios

- **A-1 (sin paginación):** `hooks/useAppData.ts:72-77` — sigue sin `.limit()`/`.range()`. Idéntico al hallazgo original.
- **A-2 (sin índices):** `public/supabase_setup.sql` completo (73 líneas) no define ningún `create index`, solo PKs. `progress_entries.client_name` sigue sin índice ni FK.
- **A-3 (sin modelo de tenant/cuenta):** ningún esquema tocado introduce `user_id`/`auth.uid()`/tabla de cuentas. MEJORA-003 lo reconoce explícitamente en su "No-alcance".

**Conclusión:** ascenso de +5 (28→33) justificado y proporcionado. A-1, A-2 y A-3 (mayor peso real para "Escalabilidad") siguen abiertos, verificados línea por línea, sin cambio de código.
