# RIESGOS — Iteración NNN

Para cada riesgo: probabilidad × severidad → mitigación o aceptación explícita. Ver M7 en `LOOP-MAESTRO-100.md`.

| ID | Familia | Descripción | Probabilidad | Severidad | Mitigación / Aceptación | Responsable | Estado |
|---|---|---|---|---|---|---|---|
| R-01 | Clínico | | | | | | |
| R-02 | Técnico | | | | | | |
| R-03 | Datos (RGPD) | | | | | | |
| R-04 | UX | | | | | | |
| R-05 | Negocio | | | | | | |

**Familias:** clínico (¿puede generar una recomendación dañina?) · técnico (¿puede romper flujos existentes?) · datos (¿toca datos de salud? ¿RGPD?) · UX (¿aumenta fricción?) · negocio.

**Regla:** ningún riesgo "alto" avanza sin mitigación aceptada. Riesgos clínicos altos requieren visto bueno explícito del Humano-DN antes de M8.

## Veredicto de la revisión de riesgos

- [ ] Todos los riesgos altos tienen mitigación aceptada
- [ ] Riesgos clínicos altos firmados por Humano-DN
- **Avanza a M8:** sí / no
