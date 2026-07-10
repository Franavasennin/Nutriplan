# DELTA-005 — P-002: Nutrición 75→80, el tope de seguridad se levanta (iteración 003)

**Fecha:** 2026-07-10 · **Origen:** P-002 (BACKLOG), el bloqueante creado por la corrección de DELTA-004: mientras Nutrición <80, la nota global oficial quedaba capada a 59 por §2.1.

## 1. Qué se hizo (4 commits)

| Commit | Qué | Hallazgo que cierra |
|---|---|---|
| `f963a53` | Micronutrientes deterministas en embarazo (folato/hierro/yodo/DHA/vit. D) y lactancia (yodo/DHA/hidratación), con citas EFSA/OMS/AESAN, añadidos post-generación si la IA los omite | **A-2** (Alta, Nutrición) |
| `f8c0085` | Directivas clínicas deterministas para hipotiroidismo, hipertiroidismo, hipertrigliceridemia, DM1 y obesidad (antes solo texto libre) + exclusiones obligatorias nuevas (alcohol en HTG, algas en hipertiroidismo, crudos/no pasteurizados/mercurio/alcohol en embarazo — AESAN) + ERC documentado contra KDIGO 2021 | **A-3** (Alta, Nutrición) y **M-3** (Media) |
| `14aa5a8` | Artefacto de contraste del reparto de macros con ≥2 guías (EFSA DRV, NAM/IOM AMDR, SENC, ISSN/ACSM, ESPEN) + 14 tests que fijan los números (`EVIDENCIA-C1-macros-vs-guias.md`, `macroDistribution.test.ts`) | **C1** de Nutrición (PARCIAL→CUMPLIDO con reservas) |
| `76fffcc` | Fixes de la revisión healthcare independiente del bloque (1 MEDIA + 2 BAJA corregidos, 1 BAJA aceptado) | — |

**Verificación independiente:** aunque el delta es +5 (límite autocertificable por §2.2), el bloque completo fue revisado por un agente `healthcare-reviewer` independiente ANTES de certificar: verdict SAFE, **cero errores en las citas de guías** (todas contrastadas una a una), 4 hallazgos accionables de los que 3 se corrigieron en `76fffcc` y 1 (cosmético) se aceptó documentado.

## 2. Estado de los criterios §8 de Nutrición, antes → después

| Criterio | Antes (auditoría 001/M9) | Ahora | Evidencia |
|---|---|---|---|
| C1 — Fórmulas contrastadas con ≥2 guías + tests | PARCIAL (BMR/PAL sí; reparto de macros solo en comentario) | **CUMPLIDO con reservas** (3 discrepancias documentadas como flags DN, ver §4 de EVIDENCIA-C1) | `EVIDENCIA-C1-macros-vs-guias.md`, `test/macroDistribution.test.ts` (14 tests) |
| C2 — Batería ≥50 casos sintéticos con 0 fuera de rango | NO CUMPLIDO | **NO CUMPLIDO (sin cambios)** — requiere llamadas reales de IA, no autorizadas por coste | — |
| C3 — Coherencia kcal↔macros exacta | PARCIAL (reconciliación ±12%) | **PARCIAL (sin cambios)** | — |
| C4 — Sign-off DN | NO CUMPLIDO | **NO CUMPLIDO (sin cambios)** — externo | — |
| Hallazgo A-2 (micronutrientes embarazo/lactancia) | Abierto | **RESUELTO** (garantía determinista con citas, revisada) | `f963a53`, 10 tests |
| Hallazgo A-3 (condiciones sin objetivos deterministas) | Abierto | **RESUELTO** (5 condiciones + ERC; DM2/HTA ya existían) | `f8c0085`, 15 tests |
| Hallazgo M-3 (sodio ERC) | Abierto | **RESUELTO por evidencia** (2000 mg ya cumple KDIGO 2021 <2 g/día; documentado + directiva K/P) | `f8c0085` |

**Anclaje 75 → 80 (+5):** se cierran los DOS hallazgos Altos propios de la categoría y el criterio C1 completo — el grueso de lo que la auditoría 001 señaló como "huecos reales" por debajo del banda-80. NO se sube más de 80 porque C2 (batería) y C3 (exactitud) siguen abiertos y C4 (sign-off) es condición explícita para acercarse al 100. Δ+5 en el límite autocertificable de §2.2, reforzado con revisión independiente.

## 3. Nota global — el tope se levanta

```
Tope de seguridad §2.1: Nutrición 80 ≥ 80 ✔ y Seguridad alimentaria 86 ≥ 80 ✔
  → EL CAP DE 59 SE LEVANTA (por primera vez de forma legítima).

Nota = (12.5×80 + 10.4167×86 + 9.375×53 + 8.3333×58 + 8.3333×65 + 8.3333×74
        + 7.2917×69 + 6.25×43 + 5.2083×33 + 5.2083×58 + 5.2083×66 + 5.2083×37
        + 3.125×20 + 3.125×64 + 2.0833×55) / 100
     = 6193.74 / 100 = 61.94

Tope de mínimos (§2.1): no aplica (nota <90).

NOTA GLOBAL OFICIAL = 61.94 / 100 — banda Funcional (60-74)
```

Es la primera nota global por encima de 59 que es **válida**: el cruce a banda Funcional que se reclamó en el cierre original de la iteración 003 (60.49) era inválido porque el cap estaba mal aplicado (ver DELTA-004). Progresión oficial real: 53.61 → 56.10 → 59.00 (capada) → 59.00 (capada) → **61.94**.

## 4. Nota de Seguridad alimentaria (sin doble contabilidad)

Las exclusiones AESAN de embarazo (`f8c0085`) son también una mejora real de Seguridad alimentaria (antes un plan podía incluir sushi a una embarazada). **No se reclama delta en esa categoría** en este recálculo para no contar la misma mejora dos veces — queda registrada como mejora no puntuada, re-evaluable en la próxima auditoría completa de esa categoría.

## 5. Flags abiertos para la DN (nuevos, sin resolver a propósito)

1. **Cetogénica produce ~71 g HC/día** (por encima del umbral cetogénico 20-50 g) — corregirlo implica subir la grasa a ~72% E, decisión clínica de Ester (EVIDENCIA-C1 §4.1; fijado en test como DISCREPANCIA CONOCIDA).
2. Rangos del comentario de `calculations.ts` desalineados con la realidad computada en Paleo (HC 39.6% vs 25-35%) y Proteica (P 28% vs 30-35%) — decidir el rango objetivo (EVIDENCIA-C1 §4.2-4.3).
3. "Sin cocina" + embarazo: la exclusión AESAN prevalece por Regla 0, pero conviene que la DN revise el caso (revisión healthcare, hallazgo #4 — mitigado con "jamón cocido").

## 6. Regresiones

Ninguna. 184/184 tests (145 → 184 en esta sesión, +39), `tsc` limpio en cada commit. Sin llamadas reales de IA (C2 sigue honestamente en NO CUMPLIDO).
