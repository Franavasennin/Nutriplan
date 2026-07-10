# EVIDENCIA C1 (Nutrición) — Contraste del reparto de macros con guías autorizadas

**Fecha:** 2026-07-10 · **Cierra:** criterio C1 de Nutrición (§8), que estaba en PARCIAL desde la auditoría 001 porque el reparto de macros solo estaba "documentado en comentario" sin artefacto de contraste ni tests que lo fijaran.

**Ancla reproducible:** `test/macroDistribution.test.ts` (14 tests). Si alguien cambia `MACRO_DEFS` (`utils/calculations.ts:142-155`), los tests fallan y obligan a rehacer este contraste.

## 1. Diseño del sistema (qué se contrasta)

El reparto NO se define por porcentajes: se ancla en **g de proteína por kg de peso de referencia** (`proteinGPerKg`) y una **fracción de las kcal restantes para grasa** (`fatOfRemaining`), con el resto a HC. Es el enfoque de las guías clínicas y deportivas (ESPEN, ISSN/ACSM anclan proteína en g/kg, no en %E). Los %E resultantes dependen del ratio kg/kcal del paciente — por eso el contraste usa un paciente de referencia explícito: **70 kg de peso de referencia, GET 2000 kcal, sin condiciones ni ajuste calórico**.

## 2. Guías utilizadas (≥2 por afirmación)

| Guía | Qué fija |
|---|---|
| **EFSA DRV** (Dietary Reference Values) | Proteína PRI 0.83 g/kg/día (adultos); grasa 20-35% E (RI); HC 45-60% E (RI) |
| **NAM/IOM AMDR** | Proteína 10-35% E; grasa 20-35% E; HC 45-65% E |
| **SENC** (guías alimentarias españolas) | Patrón mediterráneo: HC ~50-55% E, grasa 30-35% E (predominio MUFA/AOVE) |
| **ISSN / ACSM-AND-DC** (posicionamientos deporte) | Proteína 1.2-2.0 g/kg en activos; hasta 2.3 g/kg en déficit para preservar masa magra |
| **ESPEN** | Proteína clínica 1.0-1.5 g/kg (adulto enfermo/mayor); soporte del anclaje en g/kg |
| **ADA Standards of Care** | No existe un reparto ideal único en diabetes; los patrones bajos en HC son opción válida — legitima las dietas terapéuticas que se desvían de EFSA |

## 3. Contraste por tipo de dieta (paciente de referencia, valores computados reales)

| Tipo | g/kg P | P g (%E) | G g (%E) | HC g (%E) | ¿Cumple EFSA/AMDR? | Notas |
|---|---|---|---|---|---|---|
| Equilibrada | 1.4 | 98 (19.6%) | 59 (26.6%) | 269 (53.8%) | ✅ ambas | Dentro de EFSA y AMDR en los 3 macros |
| Mediterránea | 1.3 | 91 (18.2%) | 76 (34.2%) | 237 (47.4%) | ✅ ambas | Grasa en el límite alto (SENC 30-35%; coherente con patrón AOVE) |
| Vegetariana | 1.4 | 98 (19.6%) | 59 (26.6%) | 269 (53.8%) | ✅ ambas | = Equilibrada con fuentes vegetales |
| Vegana | 1.5 | 105 (21.0%) | 53 (23.7%) | 277 (55.4%) | ✅ ambas | +0.1 g/kg por biodisponibilidad proteica vegetal (posición AND sobre dietas vegetarianas) |
| Sin cocina | 1.4 | 98 (19.6%) | 59 (26.6%) | 269 (53.8%) | ✅ ambas | = Equilibrada con conservas |
| Baja en HC | 1.8 | 126 (25.2%) | 96 (43.4%) | 157 (31.4%) | ⚠️ desviación intencionada | HC <45% y grasa >35% POR DEFINICIÓN del tipo terapéutico (ADA reconoce patrones bajos en HC). P dentro de AMDR e ISSN |
| Cetogénica | 1.5 | 105 (21.0%) | 144 (64.8%) | 71 (14.2%) | ⚠️ desviación intencionada + **discrepancia** | Ver §4 |
| Paleo | 1.7 | 119 (23.8%) | 81 (36.5%) | 198 (39.6%) | ⚠️ desviación intencionada | HC 39.6% — por encima del rango 25-35% estimado en el comentario del código (ver §4) |
| Proteica | 2.0 | 140 (28.0%) | 61 (27.5%) | 223 (44.6%) | ⚠️ desviación leve | P en el techo de 2.0 g/kg (límite ISSN sin supervisión deportiva); HC 44.6% roza el suelo AMDR |

**Verificaciones transversales (testeadas):** proteína ≥0.83 g/kg (PRI EFSA) en el 100% de los tipos ✔ · proteína ≤2.0 g/kg en todos los tipos no-atleta ✔ · los 5 patrones generales cumplen AMDR en los 3 macros ✔.

## 4. Discrepancias encontradas (flags para la DN — el contraste es real, no un sello)

1. **Cetogénica genera ~71 g HC/día (14.2% E)** para el paciente de referencia — por encima del umbral cetogénico típico (20-50 g/día) y del rango 5-10% E que declara el comentario del código. En la práctica es una "muy baja en HC", no una cetogénica estricta. **No se corrige de forma autónoma**: la corrección implicaría subir aún más la grasa (64.8% → ~72%), una decisión clínica que corresponde a la DN. El comportamiento actual yerra del lado MENOS extremo (más seguro). Test que lo fija y documenta: `macroDistribution.test.ts` ("DISCREPANCIA CONOCIDA").
2. **Paleo produce HC 39.6%**, por encima del rango 25-35% estimado en el comentario de `calculations.ts:137`. El comentario era una estimación optimista; el valor real sigue siendo defendible como "paleo moderada", pero el comentario y la realidad no cuadran. Pendiente de que la DN decida el rango objetivo.
3. **Proteica queda en 28% P**, algo por debajo del "30-35%" del comentario para este paciente de referencia (depende del ratio kg/kcal). El ancla real (2.0 g/kg) es la correcta según ISSN; el % del comentario era orientativo.

## 5. Estado del criterio C1 tras esta evidencia

- BMR/PAL: ya CUMPLÍA desde la auditoría 001 (OMS-FAO/UNU + PAL FAO/WHO, con tests).
- Reparto de macros: **ahora tiene artefacto de contraste con ≥2 guías nombradas por afirmación Y tests que fijan los números** (este documento + `macroDistribution.test.ts`).
- C1 pasa de PARCIAL a **CUMPLIDO con reservas documentadas** (las 3 discrepancias de §4 quedan como flags abiertos para la DN — no impiden el criterio, que pide contraste y fijación, no perfección clínica; el 100 de la categoría sigue reservado al sign-off de la DN por §2.2.3).

**PENDIENTE DE VALIDACIÓN CLÍNICA** (como todos los umbrales): los valores de `MACRO_DEFS` son razonables y están ahora contrastados y fijados, pero la palabra final sobre cada tipo de dieta es de Ester Correa (Humano-DN).
