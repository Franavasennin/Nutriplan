# MEJORA-002 — Jerarquía exclusión-paciente > rotación obligatoria en el prompt

**Iteración:** 001 · **Categoría:** Seguridad alimentaria / Nutrición · **Origen:** B-002 (bloqueante)

## Problema

`services/geminiService.ts:253-263` (Regla 5) impone rotación obligatoria de marisco/huevo con lenguaje coercitivo ("el plan es INVÁLIDO" si no se sigue). Las exclusiones del paciente (`:510-512`, "EXCLUIR COMPLETAMENTE") no tienen jerarquía explícita que anule la rotación — riesgo real de que el modelo incluya un alérgeno excluido para cumplir la regla de rotación. Expuesto por Sintético-07 (excluye marisco y huevo, ambos forzados por la regla). Evidencia: `iteracion-001/AUDITORIA-nutricion-seguridad.md` B-2.

## Solución propuesta

Reescribir la Regla 5 (`geminiService.ts:253-263`) para que explicite: "esta rotación NUNCA puede violar las exclusiones obligatorias del paciente listadas más abajo; si un ingrediente de rotación coincide con una exclusión, se sustituye por la alternativa de proteína más cercana disponible". Mover la sección de exclusiones del paciente antes de la regla de rotación en el prompt (el orden de aparición importa en prompts largos) y añadir una frase de máxima prioridad al inicio del prompt: "Las exclusiones del paciente tienen prioridad absoluta sobre cualquier otra regla de este documento, incluida la rotación de proteínas."

## No-alcance

- No se añade un filtro determinista post-generación que verifique el cumplimiento (eso sería una mejora adicional de mayor esfuerzo, candidata a iteración futura si esta reformulación no basta).
- No se cambia la lista de alimentos de rotación en sí.

## Criterios de aceptación (medibles)

- [ ] El prompt generado para Sintético-07 (marisco+huevo excluidos) no contiene la instrucción de rotación de esos dos alimentos sin la salvedad de exclusión.
- [ ] Test unitario que verifica que `buildUserPrompt`/`buildDietSystemPrompt` incluye la frase de prioridad de exclusiones antes de la regla de rotación (orden de aparición en el string).
- [ ] Revisión manual del prompt completo generado para 2 pacientes sintéticos con exclusiones distintas.

## Δ puntos estimado

- Categoría: Seguridad alimentaria · Criterio §8: C2 (0 recomendaciones inseguras) · Estimación: +8 puntos (Confianza: 0.6 — mitiga el riesgo en el prompt, pero sin verificación determinista no hay garantía absoluta contra alucinaciones del modelo)

## Plan de prueba

- Test unitario de construcción de prompt (no requiere llamada real a la IA) verificando presencia/orden de las frases clave.
- Nota para el Humano-DN: este fix reduce el riesgo pero no lo elimina sin un verificador post-generación — dejar constancia en el informe de re-auditoría (M9).

## Plan de rollback

Revertir el commit; cambio contenido en `geminiService.ts`, sin migración de datos.

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
