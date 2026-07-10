# DELTA-004 — Corrección del tope de seguridad + 2º lote de mejoras (iteración 003)

**Fecha:** 2026-07-10

## Hallazgo: el tope de seguridad de §2.1 llevaba dos cierres de iteración mal aplicado

`LOOP-MAESTRO-100.md` §2.1 dice, literalmente:

> **Tope de seguridad:** si Nutrición < 80 **o** Seguridad alimentaria < 80, la nota global se **capa a 59**.

Es una condición **OR** — basta con que UNA de las dos esté por debajo de 80. Nutrición lleva en **75** desde la iteración 001, sin cambios desde entonces.

Al cerrar la iteración 002 y la 003, el propio `SCORECARD.md` interpretó la regla como si fuera una condición **AND** ("el cap solo se dispara si Nutrición Y Seguridad están ambas <80 simultáneamente" — texto literal que quedó escrito en la sección de iteración 002). Con esa lectura equivocada, como Seguridad alimentaria ya había cruzado 80, se dio por no aplicable el tope — cuando en realidad Nutrición (75) por sí sola ya lo activa.

**Consecuencia:** las notas globales oficiales reportadas — 59.04 (iteración 002) y 60.49 (iteración 003) — no son válidas tal cual se publicaron. Aplicando el tope correctamente, ambas quedan **capadas a 59.00**.

| | Nota bruta reportada (incorrecta) | Nota oficial corregida (con tope) |
|---|---|---|
| Iteración 002 | 59.04 | **59.00** |
| Iteración 003 (primer lote) | 60.49 | **59.00** |

La iteración 001 (56.10) no se ve afectada — ya estaba por debajo de 59, así que el tope no habría cambiado el resultado aunque se hubiera aplicado bien.

## Segundo lote de mejoras de esta sesión (2026-07-10) — 8 hallazgos fuera del marco de auditoría formal

Mejoras reales, verificadas en vivo, con commits propios. Se registran los deltas de categoría con la misma disciplina anti-inflación (§2.2) aunque el resultado quede capado:

| Categoría | Antes | Ahora | Δ | Qué cambió | Evidencia |
|---|---|---|---|---|---|
| UX | 62 | **65** | +3 | Feedback de error real en escrituras a Supabase (toast en vez de consola); papelera con deshacer de 6s al borrar una dieta | commits `e2bce5d`, `7ff7f02` |
| Personalización | 71 | **74** | +3 | Peso precargado en seguimiento (permite anotar visita de control sin repesaje); registro de adherencia autopercibida de 5 niveles | commits `6e20dd0`, `aa834eb` |
| Arquitectura | 66 | **69** | +3 | clientId estable por paciente (evita duplicados/huérfanos por variación de nombre); recordatorio de backup + aviso de proyecto Supabase pausado por inactividad | commits `f4fb2cb`, `e34edae` |
| Retención | 35 | **37** | +2 | Compartir resumen del plan por WhatsApp/email (antes solo imprimir) | commit `dd4465a` |

**No se le asigna categoría a "Registro de consentimiento RGPD"** (commit `1b1e6a4`) — el marco de las 16 categorías no tiene ningún apartado de cumplimiento legal/privacidad. Se registra como gap del propio marco de auditoría, no como mejora de producto puntuable. Igualmente, la migración preparada de `appointments` (commit `559db82`) no suma delta — es documentación, no una funcionalidad enviada.

### Cálculo (con el tope aplicado correctamente)

```
Bruto = (12.5×75 + 10.4167×86 + 9.375×53 + 8.3333×58 + 8.3333×65 + 8.3333×74
         + 7.2917×69 + 6.25×43 + 5.2083×33 + 5.2083×58 + 5.2083×66 + 5.2083×37
         + 3.125×20 + 3.125×64 + 2.0833×55) / 100
= 6131.24 / 100 = 61.31

Tope de seguridad (§2.1): Nutrición (75) < 80 → SE ACTIVA (independientemente
  de que Seguridad alimentaria (86) ya esté ≥80 — es OR, no AND).
  → Nota global se capa a 59.00.

NOTA GLOBAL OFICIAL (corregida) = 59.00 / 100
```

El bruto de 61.31 queda registrado como referencia de progreso interno (para saber que las mejoras de producto son reales y van sumando), pero la nota global oficial reportable es 59.00 — igual que llevaba desde la iteración 002, aunque nadie lo hubiera dicho así hasta ahora.

## Camino para destapar el cap

El tope solo se levanta subiendo Nutrición de 75 a ≥80. La regla §2.2.3 ("El 100 en Nutrición y Seguridad alimentaria solo lo otorga el Humano-DN por escrito") exige el sign-off de Ester **solo para llegar a 100** — subir de 75 a 80-89 con evidencia verificable (auditoría de contenido nutricional, cobertura de casos clínicos, etc.) es, en principio, alcanzable sin su sign-off. Queda como el ítem de mayor prioridad en `BACKLOG.md`: mientras Nutrición no cruce 80, ninguna otra mejora de producto puede mover la nota global oficial por encima de 59, por buena que sea.

## Regresiones

Ninguna. `tsc` limpio y 145/145 tests en cada uno de los 8 commits de este lote, verificación en vivo en el navegador antes de cada uno (ver mensajes de commit individuales para el detalle de cada verificación).

## Nota de honestidad

Este es exactamente el tipo de error que el propio proceso (§2.2, "sin evidencia no hay puntos") está diseñado para atrapar tarde o temprano — en este caso se atrapó al re-leer la regla literal en vez de confiar en la interpretación ya escrita en el scorecard de una iteración anterior. Se corrige de inmediato en cuanto se detecta, con el número real (peor) puesto por delante del numero bonito (mejor pero incorrecto).
