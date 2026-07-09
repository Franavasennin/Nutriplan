# RIESGOS — M7 — Iteración 001

**Fecha:** 2026-07-09 · Familias evaluadas: clínico, técnico, datos (RGPD), UX, negocio. Ver §M7 en `LOOP-MAESTRO-100.md`.

| ID | Familia | Descripción | Probabilidad | Severidad | Mitigación / Aceptación | Responsable | Estado |
|---|---|---|---|---|---|---|---|
| R-01 | Clínico | MEJORA-002/001 modifican el prompt de generación de dietas — un error de redacción podría introducir una nueva inconsistencia en vez de resolver la existente | Media | Alta | Revisión manual del prompt completo generado para Sintético-07 antes de dar por cerrada la mejora (punto de verificación intermedio §PLAN.md 3.1); no requiere llamada real a la IA para esta verificación | IA-Orquestador | Mitigado en el plan |
| R-02 | Clínico | MEJORA-006 introduce un umbral de BMI (<17) sin sign-off previo del Humano-DN | Media | Alta | Aprobado con condiciones en M6: se implementa con el umbral provisional, pero se marca "PENDIENTE DE VALIDACIÓN CLÍNICA" hasta que Ester Correa lo confirme en la re-auditoría (M9) | Humano-DN (Ester Correa) | Aceptado con condición explícita |
| R-03 | Técnico | Los cambios en `geminiService.ts` (3 mejoras distintas en el mismo fichero) podrían generar conflictos o regresiones si no se secuencian bien | Media | Media | Orden de ejecución fijado en PLAN.md (002→001→006), commits atómicos, suite de tests completa tras cada uno | Ejecutor (M8) | Mitigado en el plan |
| R-04 | Datos (RGPD) | MEJORA-003 (RLS) toca infraestructura real de datos de salud de pacientes | Baja (si se sigue el proceso) / Alta si se aplica sin verificar | **Alta** | **RESUELTO (2026-07-09):** verificación de solo lectura (MCP Supabase, `SELECT` sin DDL) confirmó que RLS ya estaba correctamente habilitado en las 5 tablas con política `allow_all_anon` — no hizo falta aplicar ningún cambio en producción. Solo se corrigió el script local desactualizado (`public/supabase_setup.sql`) | Humano-PO (Fran) — informado | **Cerrado sin necesidad de aprobación de escritura — la verificación de solo lectura resolvió el riesgo** |
| R-05 | UX | MEJORA-005 (cambio de tokens de color) podría alterar la identidad visual de la marca si el nuevo tono se aleja demasiado del verde original | Baja | Baja | Verificación visual en ambos temas antes de commitear; mantener el tono dentro de la misma familia de verde, solo ajustando luminosidad | IA-Orquestador | Mitigado en el plan |
| R-06 | Técnico | MEJORA-004 cambia atributos ARIA en un componente con lógica de estado (`toggleShopItem`) — riesgo bajo de romper el evento de clic si se manipula mal el `role` | Baja | Baja | Test de regresión manual del flujo de marcar/desmarcar tras el cambio | Ejecutor (M8) | Mitigado en el plan |
| R-07 | Negocio | Ninguna de las 7 mejoras seleccionadas toca Monetización — la decisión pendiente sobre esa categoría (0/100) no se resuelve en esta iteración | Alta (seguirá abierta) | Baja | Aceptado explícitamente — no es un riesgo de esta iteración sino una decisión de negocio pendiente, ya registrada en `BACKLOG.md` | Humano-PO | Aceptado, fuera de alcance de esta iteración |

## Veredicto de la revisión de riesgos

- [x] Todos los riesgos altos (R-02, R-04) tienen mitigación o aceptación explícita documentada.
- [x] Riesgos clínicos altos (R-01, R-02) tienen plan de verificación o requieren sign-off DN antes de darse por definitivos.
- [x] El único riesgo verdaderamente bloqueante (R-04, infraestructura de producción) tiene su propio gate de aprobación humana ya incorporado en la ficha MEJORA-003 y en este documento.

**Avanza a M8:** **sí, con la condición de que MEJORA-003 no se aplique en producción sin la aprobación explícita de Fran.** Las otras 6 mejoras pueden ejecutarse sin bloqueo adicional.
