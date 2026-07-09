# Backlog — DietMaster Pro

Acumulativo entre iteraciones. Cada ítem es un Problema (P-nnn) o una Oportunidad (O-nnn), con categoría, severidad, evidencia y criterio de resolución medible. Ver M2 en `LOOP-MAESTRO-100.md`.

## Convenciones

- **Severidad:** bloqueante · alta · media · baja
- **Estado:** abierto · en iteración NNN · resuelto (iteración NNN) · descartado (motivo)
- Los ítems de severidad bloqueante en Nutrición o Seguridad alimentaria saltan la fórmula de priorización (§3.3) y entran automáticamente en la siguiente iteración.

## Ítems conocidos por observación directa (pendientes de confirmar en M1)

Estos NO son resultado de una auditoría formal — son señales ya visibles en el repo que M1 deberá verificar, puntuar y localizar con evidencia formal.

| ID | Categoría | Severidad (provisional) | Descripción | Estado |
|---|---|---|---|---|
| O-001 | Rendimiento | media | Bundle principal 504 kB (149 kB gzip) — Vite avisa que supera 500 kB; candidato a manualChunks o lazy-load adicional | abierto |
| O-002 | Escalabilidad / Seguridad | media | Sin autenticación ni RLS por usuario (mono-usuario, decisión consciente de app local — ver nota Obsidian 2026-05-29); revisar si sigue vigente ese supuesto | abierto |
| O-003 | Calidad/Arquitectura | baja | Backend Express histórico documentado en la nota del proyecto pero ya eliminado del repo (`cbb2d76`) — confirmar que no quedan referencias muertas | abierto |
| O-004 | Motor de recetas | media | Corpus de recetas hardcodeado en TS (`data/recipes.ts`, ~1.908 líneas) sin persistencia en Supabase — limita pipeline R1–R7 de WF-R | abierto |
| O-005 | Accesibilidad | media | Sin auditoría a11y registrada hasta la fecha (axe-core, navegación por teclado) | abierto |
| O-006 | UX / Tests | media | Suite de tests cubre solo `utils/` (104 tests); sin E2E de los 5 flujos núcleo | abierto |

*Backlog formal (P-nnn/O-nnn con evidencia completa) se genera en M2 tras la primera auditoría M1.*
