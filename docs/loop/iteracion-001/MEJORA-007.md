# MEJORA-007 — Disclaimer general en el documento imprimible del plan

**Iteración:** 001 · **Categoría:** Calidad del contenido · **Origen:** A-010 (alto)

## Problema

La cabecera del documento imprimible/PDF del plan (`components/DietPlanDisplay.tsx:1231-1258`) no incluye ningún disclaimer general (tipo "elaborado por [nutricionista colegiada], no sustituye valoración médica presencial") — solo muestra nombre de clínica, paciente, fecha y métricas. El módulo educativo interno sí tiene un disclaimer equivalente (`:1116`), pero no se aplica al documento que el paciente se lleva a casa. Evidencia: `iteracion-001/AUDITORIA-orquestador.md`.

## Solución propuesta

Añadir una línea de disclaimer al pie (o cabecera) de la sección `only-print` de `DietPlanDisplay.tsx`, con un texto configurable a través de `config/clinic.ts` (ya existe ese fichero de configuración de clínica) para que la nutricionista pueda personalizar su colegiado/nombre si lo desea. Texto por defecto sugerido: "Plan elaborado por un/a profesional de la nutrición. Este documento no sustituye una valoración médica presencial ni el criterio clínico individualizado."

## No-alcance

- No se hace una revisión ortográfica/terminológica completa de toda la UI (M-2 de Calidad del contenido, fuera de alcance por volumen).
- No se cambia el disclaimer ya existente del módulo educativo.

## Criterios de aceptación (medibles)

- [ ] El documento impreso (`window.print()`) muestra el disclaimer en todos los planes generados.
- [ ] El texto es configurable desde `config/clinic.ts` sin tocar el componente.
- [ ] Verificación visual con un plan de ejemplo impreso/exportado a PDF del navegador.

## Δ puntos estimado

- Categoría: Calidad del contenido · Estimación: +8 puntos (Confianza: 1.0 — cambio textual de bajo riesgo)

## Plan de prueba

- Revisión manual: generar un plan de ejemplo (paciente sintético), abrir vista de impresión, confirmar presencia y legibilidad del disclaimer.

## Plan de rollback

Revertir el commit; cambio de JSX + configuración, sin efecto en datos.

## Subworkflows invocados

- [ ] WF-R / WF-N — no aplica
