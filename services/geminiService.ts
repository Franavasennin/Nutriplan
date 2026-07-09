/**
 * aiService.ts — Migrado de Gemini a Groq (API compatible con OpenAI)
 * Mantiene la misma interfaz pública para no romper el resto de la app.
 */
import {
  CalculatedMetrics, PatientData, DietResponse, DietType, FastingProtocol,
  CustomFood, RecipeFilters, Recipe, AthleteGoal, ATHLETE_GOAL_LABELS,
  SavedDiet, Gender, ActivityLevel, Duration, Condition,
  CalorieGoal, CALORIE_GOAL_LABELS, CALORIE_GOAL_ADJUST,
  DayPlan, Meal, BudgetLevel,
} from '../types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros, calculateIdealWeight, calculateAdjustedWeight } from '../utils/calculations';
import { reconcileMealMacros, reconcileDayPlan, reconcileDietResponse } from '../utils/macroValidation';
import { getClinicalSafetyFlags } from '../utils/clinicalSafety';
import { getClinicalTargets } from '../utils/clinicalTargets';

// ─── Micronutrientes obligatorios en dietas vegana/vegetariana (auditoría #7) ─
/**
 * Antes, la suplementación de B12 y la vigilancia de hierro/calcio/omega-3
 * en dietas veganas dependía de que la IA se acordara de mencionarlo, mezclado
 * genéricamente con el resto de suplementos. Ahora se GARANTIZA en código:
 * si el modelo no las incluyó, se añaden aquí de forma determinista.
 */
export function ensureMicronutrientGuidelines(guidelines: string[], dietType: DietType): string[] {
  const isVegan      = dietType === DietType.Vegan;
  const isVegetarian = dietType === DietType.Vegetarian;
  if (!isVegan && !isVegetarian) return guidelines;

  const has = (kw: string) => guidelines.some(g => g.toLowerCase().includes(kw));
  const additions: string[] = [];

  if (!has('b12') && !has('cobalamina')) {
    additions.push(
      'Suplementación de vitamina B12 OBLIGATORIA (cianocobalamina 25-100 mcg/día o 1000-2000 mcg/semana): no existen fuentes vegetales fiables que cubran los requerimientos. Su déficit no da síntomas hasta fases avanzadas — no es opcional, consultar con el médico/nutricionista la pauta exacta.'
    );
  }
  if (isVegan) {
    if (!has('hierro')) {
      additions.push('Vigilar hierro: combina legumbres/tofu/espinacas (hierro no-hemo, se absorbe peor) con vitamina C en la misma comida (cítricos, pimiento, kiwi) para mejorar su absorción.');
    }
    if (!has('calcio')) {
      additions.push('Vigilar calcio: incluye a diario bebidas vegetales fortificadas, tofu cuajado con calcio, sésamo/tahini y verduras de hoja verde (col rizada, brócoli).');
    }
    if (!has('omega') && !has('dha') && !has('epa')) {
      additions.push('Omega-3 (DHA/EPA): las fuentes vegetales (lino, chía, nueces) solo aportan ALA, con conversión limitada a DHA/EPA — valorar suplemento de algas si no hay control analítico periódico.');
    }
  }

  return additions.length ? [...guidelines, ...additions] : guidelines;
}

// ─── Fase de mantenimiento / transición anti-rebote (auditoría #9) ───────────
/**
 * Los planes en déficit o superávit no incluían ninguna indicación sobre qué
 * hacer al alcanzar el objetivo — un factor de riesgo conocido de efecto
 * rebote. Se garantiza una pauta de transición gradual, independientemente
 * de si la IA la mencionó.
 */
export function ensureTransitionGuideline(guidelines: string[], calorieGoal: CalorieGoal | undefined): string[] {
  const isRestrictive = calorieGoal !== undefined && calorieGoal !== CalorieGoal.Maintenance;
  if (!isRestrictive) return guidelines;

  const has = guidelines.some(g => /transici[oó]n|mantenimiento|efecto rebote/i.test(g));
  if (has) return guidelines;

  return [
    ...guidelines,
    'Fase de transición al alcanzar el objetivo: NO vuelvas de golpe a comer "normal". Sube las calorías gradualmente (+100-150 kcal/semana) durante 2-4 semanas hasta llegar a mantenimiento, para minimizar el efecto rebote y dar tiempo al metabolismo a readaptarse.',
  ];
}

const GROQ_API_URL   = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr';
const MODEL_DIET     = 'mistral-small-latest';
const MODEL_RECIPES  = 'open-mistral-nemo';

// ─── Rate limiter (protección contra abuso de la API de IA) ──────────────────
// Máximo 10 llamadas por ventana de 60 s. Se persiste en localStorage para que
// no se resetee al recargar la página.

const RL_KEY       = 'ai_rate_limit';
const RL_WINDOW    = 60_000; // 1 minuto en ms
const RL_MAX_CALLS = 10;     // max llamadas por ventana

interface RateLimitState { calls: number[]; }

function checkRateLimit(): void {
  let state: RateLimitState = { calls: [] };
  try {
    const raw = localStorage.getItem(RL_KEY);
    if (raw) state = JSON.parse(raw) as RateLimitState;
  } catch {
    // localStorage no disponible (modo incógnito estricto) — continuar sin límite
    return;
  }

  const now = Date.now();
  // Descartar llamadas fuera de la ventana actual
  state.calls = state.calls.filter(t => now - t < RL_WINDOW);

  if (state.calls.length >= RL_MAX_CALLS) {
    const oldest      = Math.min(...state.calls);
    const waitSeconds = Math.ceil((RL_WINDOW - (now - oldest)) / 1000);
    throw new Error(
      `Límite de ${RL_MAX_CALLS} solicitudes por minuto alcanzado. ` +
      `Espera ${waitSeconds} segundos e inténtalo de nuevo.`
    );
  }

  state.calls.push(now);
  try { localStorage.setItem(RL_KEY, JSON.stringify(state)); } catch { /* silent */ }
}

// ─── Input sanitization ───────────────────────────────────────────────────────
/**
 * Elimina caracteres que pueden ser usados para inyectar instrucciones en un prompt:
 * - Saltos de línea que rompen la estructura del prompt
 * - Caracteres de control
 * - Limita la longitud para evitar contextos enormes
 */
function sanitizeForPrompt(input: string, maxLength = 300): string {
  return input
    .replace(/[\r\n\t]+/g, ' ')          // saltos de línea → espacio
    .replace(/[<>{}\[\]\\]/g, '')        // caracteres estructurales peligrosos
    .replace(/\s{2,}/g, ' ')             // espacios múltiples
    .trim()
    .slice(0, maxLength);
}

// ─── Helper ───────────────────────────────────────────────────────────────────
const groqRequest = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  // Verificar rate limit antes de cada llamada a la IA
  checkRateLimit();

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
};

// ─── OCR: extrae el texto del PDF con mistral-ocr-latest ──────────────────────
const extractTextFromPDF = async (apiKey: string, pdfBase64: string): Promise<string> => {
  const response = await fetch(MISTRAL_OCR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: `data:application/pdf;base64,${pdfBase64}`,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error OCR ${response.status}`);
  }

  const data = await response.json();
  // Combina el markdown de todas las páginas
  const pages: Array<{ markdown?: string }> = data.pages ?? [];
  return pages.map(p => p.markdown ?? '').join('\n\n');
};

// ─── Meal key config by count ──────────────────────────────────────────────────

const MEAL_KEYS_BY_COUNT: Record<number, string[]> = {
  2: ['lunch', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'morningSnack', 'lunch', 'dinner'],
  5: ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'],
};

// Eating window description per fasting protocol
const FASTING_WINDOW: Record<string, string> = {
  [FastingProtocol.IF16_8]: 'Ventana de alimentación 12:00–20:00 (ayuno 20:00–12:00). Las horas de comida deben estar dentro de esta ventana.',
  [FastingProtocol.IF18_6]: 'Ventana de alimentación 13:00–19:00 (ayuno 19:00–13:00). Todas las tomas dentro de esta ventana.',
  [FastingProtocol.IF20_4]: 'Ventana de alimentación 14:00–18:00 (ayuno 18:00–14:00). Máximo 2 tomas en esta ventana.',
  [FastingProtocol.IF5_2]:  '5 días normales según calorías indicadas. 2 días no consecutivos (marcados como "día de ayuno") con máx 500 kcal y solo 2 tomas.',
};

// ─── System prompts ────────────────────────────────────────────────────────────

const MEAL_TIME_CONSTRAINTS = `
RESTRICCIONES POR MOMENTO DEL DÍA — MUY IMPORTANTE:
Muchos pacientes encuentran inapropiados ciertos alimentos a determinadas horas. Aplica estas reglas SIEMPRE:

DESAYUNO (breakfast) — PROHIBIDO incluir:
- Guisos/platos de cuchara: lentejas, fabada, cocido madrileño, potaje, caldo de cocido
- Sopas frías: gazpacho, salmorejo, ajoblanco
- Pescados en conserva de olor fuerte: sardinas en lata, boquerones en vinagre, anchoas
- Casquería y embutidos grasos: callos, morcilla, morros, manitas de cerdo
- Arroces elaborados: paella, arroz al horno, arroz con costillas
- Ensaladilla rusa, croquetas de guiso, ropa vieja
- Cualquier plato de olla/cocido que normalmente se sirve como comida principal de mediodía
El desayuno debe ser: lácteos, huevos, tostadas, fruta, avena, cereales, frutos secos, yogur, batidos.

CENA (dinner) — PREFERIR alimentos ligeros:
- Evitar guisos muy pesados y de larga digestión (fabada, cocido completo, potaje de garbanzos con chorizo)
- Priorizar: pescado a la plancha, huevos, verduras, ensaladas, cremas de verduras, pechuga a la plancha
- Las legumbres en cena: solo si son ligeras (lentejas con verduras sin embutido, hummus); nunca fabada o cocido

SNACKS / MERIENDAS (morningSnack, afternoonSnack) — SOLO alimentos ligeros:
- Válido: fruta fresca, yogur, frutos secos, tostadas ligeras, batido de proteína, barritas energéticas
- Prohibido: guisos, platos elaborados, fritos pesados, embutidos en cantidad
`.trim();

export const buildDietSystemPrompt = (mealKeys: string[], fastingProtocol?: string, dietNote?: string): string => {
  const mealStructure = mealKeys.map(k => `        "${k}": { "name": "string", "description": "string", "ingredients": ["string con gramos/medida"], "calories": número, "protein": número, "carbs": número, "fats": número }`).join(',\n');
  const fastingNote = (fastingProtocol && fastingProtocol !== FastingProtocol.None)
    ? `\nAYUNO INTERMITENTE: ${FASTING_WINDOW[fastingProtocol] ?? ''}\n- Adapta los horarios de las tomas a la ventana indicada.\n- NO incluyas tomas fuera de la ventana de alimentación.`
    : '';

  return `
Eres un nutricionista clínico experto. Generas planes nutricionales precisos en formato JSON.

REGLAS CRÍTICAS — INCUMPLIR CUALQUIERA INVALIDA EL PLAN:
0. PRIORIDAD ABSOLUTA — EXCLUSIONES DEL PACIENTE: las exclusiones indicadas más abajo (alergias, intolerancias, alimentos excluidos) tienen prioridad sobre CUALQUIER otra regla de este documento, incluida la Regla 5 de rotación de proteínas. Si un alimento de la rotación obligatoria coincide con una exclusión del paciente, sustitúyelo por la alternativa de proteína más próxima que no esté excluida, sin romper la variedad exigida.
1. Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional.
2. RACIONES CALIBRADAS: Las raciones de cada toma deben ser suficientes para alcanzar el objetivo de macros por toma. No uses porciones "estándar" de restaurante — usa las gramos exactos que el cálculo requiera. Ejemplo: si el objetivo es 56g proteína por toma, necesitas 220g pechuga de pollo (63g P) o 200g atún en agua (48g P) + 2 huevos (14g P).
3. SUMA EXACTA: La suma de "calories"/"protein"/"carbs"/"fats" de todas las tomas del día DEBE coincidir con el objetivo indicado en el prompt (±3%). Verifica la suma mentalmente antes de responder.
4. NINGUNA TOMA VACÍA: Cada toma incluida en el plan debe tener ingredientes con contenido nutricional real. No generes tomas con lista de ingredientes vacía o con solo agua/café/infusión — si no hay alimento, omite esa toma del JSON.
5. VARIEDAD MÁXIMA — ASIGNACIÓN OBLIGATORIA POR DÍA:
   Sigue EXACTAMENTE este esquema de proteínas principales (almuerzo / cena):
   - Día 1: pollo o pavo  /  salmón o caballa
   - Día 2: ternera o cerdo magro  /  huevos (tortilla/revuelto)
   - Día 3: legumbres (lentejas/garbanzos)  /  merluza o bacalao
   - Día 4: atún fresco o salmón  /  pollo o pavo
   - Día 5: gambas o calamar o marisco  /  ternera o cerdo
   - Día 6: merluza o bacalao  /  huevos o legumbres
   - Día 7: pavo o conejo  /  salmón o sardinas
   Desayunos: cada día debe tener una base distinta de este ciclo (en este orden): avena, huevos, yogur griego, pan integral + aguacate, avena con frutas distintas a día 1, tortilla, yogur + fruta.
   PROHIBIDO: repetir la misma comida completa (mismo nombre + mismos ingredientes) en más de 1 día. Si dos días tienen el mismo plato principal, el plan es INVÁLIDO.
   ESTA ROTACIÓN ESTÁ SUBORDINADA A LA REGLA 0: nunca incluyas un alimento de este esquema si coincide con una exclusión del paciente — sustitúyelo por la alternativa de proteína más próxima disponible.
6. CAMPOS NUTRICIONALES OBLIGATORIOS: En cada toma rellena "calories", "protein", "carbs" y "fats" con valores estimados en kcal/g basados ÚNICAMENTE en los ingredientes que hayas listado. NO escribas un valor de "fats" mayor de lo que suman los ingredientes reales. Si un ingrediente no está en la lista, no puede contar en los macros.
10. GRASAS VISIBLES OBLIGATORIAS: Cada toma debe incluir al menos 1 fuente de grasa visible en la lista de ingredientes. Opciones:
    - Proteína grasa presente (salmón, sardinas, caballa, huevos con yema): contribuyen grasa suficiente para tomas con ese ingrediente.
    - Si la proteína es magra (pollo, pavo, ternera, merluza, atún en agua): AÑADE SIEMPRE 10-15ml AOVE O 20-25g frutos secos (nueces/almendras) como ingrediente explícito.
    - NO es válido escribir "fats": 19 sin que los ingredientes listados sumen ≥18g G.
    - Ejemplo correcto: "120g pechuga de pollo, 200g arroz cocido, 15ml AOVE" → fats: ≥15g.
    - Ejemplo incorrecto: "120g pechuga de pollo, 200g arroz cocido" → fats: 4g máximo, no 19g.
7. Usa términos prácticos españoles (Mercadona, medidas caseras). Descripciones: máximo 15 palabras.
8. Ajusta estrictamente según patologías indicadas.
9. RECOMENDACIONES OBLIGATORIAS: El array "generalGuidelines" debe contener EXACTAMENTE 8 elementos como mínimo. Un array con menos de 8 elementos invalida el plan completo. Los 8 elementos obligatorios son:
   1) Hidratación diaria (cantidad y tipo de líquidos)
   2) Suplementación recomendada (magnesio, omega-3, vitamina D, probióticos u otros según dieta/patologías)
   3) Consejo de sueño y descanso (horas, rutina nocturna)
   4) Recomendaciones de actividad física (tipo, frecuencia, intensidad)
   5) Pauta específica para las patologías indicadas del paciente
   6) Consejo de gestión del estrés o bienestar emocional ligado a la alimentación
   7) Consejo práctico de planificación semanal o meal prep
   8) Pauta adicional personalizada según el perfil concreto del paciente
   RECUERDA: contar hasta 8 antes de cerrar el array. Si llegas a 7, añade uno más.
11. VERIFICACIÓN FINAL OBLIGATORIA — ANTES DE CERRAR EL JSON: Para CADA día, suma los campos calories, protein, carbs y fats de TODAS sus tomas. Compara cada suma con el objetivo diario indicado en el prompt:
    - Si calorías totales difieren más del 5% del objetivo → ajusta las raciones (gramos) de las tomas hasta cuadrar.
    - Si proteína/HC/grasa total difiere más del 8% del objetivo → ajusta las cantidades de los ingredientes correspondientes.
    - Es PREFERIBLE ajustar los gramos de un ingrediente existente que añadir alimentos nuevos.
    - NO entregues el JSON hasta que las sumas de cada día cuadren con el objetivo. Este paso es lo que diferencia un plan profesional de uno aproximado.

REFERENCIA DE DENSIDAD PROTEICA (usa estas fuentes para calibrar):
- Pechuga de pollo/pavo: 31g P / 100g → para 60g P necesitas ~195g
- Salmón/atún fresco: 22g P / 100g → para 60g P necesitas ~270g
- Atún en agua (lata): 26g P / 100g → para 60g P necesitas ~230g
- Huevo mediano: 7g P → para 60g P necesitas ~9 huevos (combina con otra fuente)
- Merluza/bacalao: 20g P / 100g → para 60g P necesitas ~300g
- Ternera magra: 28g P / 100g → para 60g P necesitas ~215g
- Requesón/queso cottage: 12g P / 100g → complemento, no fuente principal
- Yogur griego (0%): 10g P / 100g → complemento

REFERENCIA DE DENSIDAD DE CARBOHIDRATOS (usa estas fuentes para calibrar — igual que haces con proteína):
- Arroz blanco/integral cocido: 28g HC / 100g → para 80g HC necesitas ~285g arroz cocido (~95g crudo)
- Pasta cocida: 25g HC / 100g → para 80g HC necesitas ~320g pasta cocida (~110g cruda)
- Avena: 60g HC / 100g → para 80g HC necesitas ~133g avena seca
- Pan integral: 46g HC / 100g → para 80g HC necesitas ~175g pan
- Patatas cocidas: 17g HC / 100g → para 80g HC necesitas ~470g patatas
- Quinoa cocida: 21g HC / 100g → para 80g HC necesitas ~380g quinoa cocida
- Legumbres cocidas (lentejas/garbanzos): 20g HC / 100g → para 80g HC necesitas ~400g
- Plátano: 23g HC / 100g · Manzana: 14g HC / 100g · Pera: 12g HC / 100g
- Miel: 82g HC / 100g · Dátiles: 75g HC / 100g
- COMBINA FUENTES si el objetivo es alto: 250g arroz cocido (70g HC) + 200g legumbres cocidas (40g HC) + 1 plátano (23g HC) = 133g HC en una sola toma.

REFERENCIA DE DENSIDAD DE GRASAS (usa estas fuentes para calibrar):
- AOVE (aceite): 100g G / 100ml → 1 cucharada sopera (10ml) = 10g G
- Frutos secos (nueces, almendras, cacahuetes): 55g G / 100g → 30g nueces = 17g G
- Aguacate: 14g G / 100g → 1 aguacate mediano (150g) = 21g G
- Salmón: 13g G / 100g · Sardinas: 11g G / 100g · Atún fresco: 5g G / 100g
- Yema de huevo: 5g G / unidad · Huevo entero mediano: 5g G
- Queso semicurado: 30g G / 100g · Queso fresco: 6g G / 100g
- Mantequilla: 80g G / 100g → 10g mantequilla = 8g G
- Estrategia: 1 cda AOVE (10g G) + 20g nueces (11g G) + salmón 150g (20g G) = 41g G en una toma
${fastingNote}
${dietNote ? `\n${dietNote}\n` : ''}
${MEAL_TIME_CONSTRAINTS}

ESTRUCTURA JSON OBLIGATORIA:
{
  "durationText": "string",
  "generalGuidelines": ["string (mínimo 8 pautas detalladas)"],
  "weeklyPlan": [
    {
      "day": 1,
      "meals": {
${mealStructure}
      }
    }
  ]
}
`.trim();
};

// ─── Protéifine DAP 4 ─────────────────────────────────────────────────────────

const DAP4_SYSTEM_PROMPT = `
Eres un nutricionista experto en el protocolo Protéifine. Generas planes nutricionales DAP 4 (Fase de Transición) precisos en formato JSON.

PROTOCOLO DAP 4 - REGLAS ESTRICTAS:

VERDURAS SIN LÍMITE: Acedera, Acelga, Apio, Apionabo, Berros, Brécol, Brócoli, Brotes de soja, Calabacín, Cardo, Cebollino, Champiñones, Setas, Coliflor, Endibia, Escarola, Espinacas, Hinojo, Lechuga, Níscalo, Pepinillo natural, Pepino, Pimiento verde, Rábanos.

VERDURAS CON MODERACIÓN (máx 200g/día total): Berenjena, Boletus, Borraja, Calabaza, Col blanca hervida, Col de bruselas, Col lombarda, Col repollo, Col rizada, Colirrábano, Espárragos, Judía verde, Nabo, Pimiento rojo, Pimiento color, Puerro, Remolacha blanca, Repollo, Rúcula, Ruibarbo, Tomate.

DESAYUNO: 30-40g pan integral + 10g mantequilla o 1 cda sopera AOVE + UNA opción: 1 huevo | 1 loncha jamón (30g) | 25g queso (20-30% MG).
MEDIA MAÑANA: infusión, café solo o té sin azúcar. Sin sólidos.
COMIDA: 150g carne (ternera, buey/lomo, cerdo/filete, conejo, codornices, pollo, pavo) o 2 huevos + verduras sin límite. Sin grasa para cocinar.
MERIENDA: 1 fruta de la lista: 1 naranja | 1 melocotón | 1 pera | 1 manzana | 1 plátano | 2 rodajas piña | 2 mandarinas | 2 kiwis | 2 ciruelas | 2 higos | 3 albaricoques | 200g fresas/frambuesas | 200g melón/sandía | 100g cerezas/uvas | 80g compota sin azúcar.
CENA: 200g pescado/sepia/pulpo/calamar/marisco/moluscos o 150g pollo/pavo (pechuga sin piel) + verduras sin límite.

ALIÑOS (máx/día): 1-2 cdas soperas AOVE (solo aliñar), 1 cda sopera vinagre vino blanco, 1 cda sopera zumo limón. Mostaza Dijon y tamari moderados. Todas las especias permitidas.
BEBIDAS: Mínimo 1.5L agua. Té/café/infusiones sin azúcar. Prohibido leche (excepto Protéifine). Sin alcohol.

SUPLEMENTACIÓN RECOMENDADA DAP 4: Incluir en generalGuidelines: Omega-3 (1-2g/día con comidas), Vitamina D3 (1000-2000 UI/día), Magnesio (200-400mg/noche), Complejo B (apoya metabolismo proteico), Probióticos (mejoran tránsito en fases proteicas).

REGLAS JSON:
- Responde ÚNICAMENTE con el JSON. 5 tomas fijas (breakfast, morningSnack, lunch, afternoonSnack, dinner).
- En "ingredients" incluye cantidad exacta.
- OBLIGATORIO: en cada toma rellena "calories", "protein", "carbs" y "fats" con los valores nutricionales estimados en kcal/g.
- En "generalGuidelines" incluye pautas Protéifine + suplementación + hidratación + actividad física.
- Genera exactamente los días indicados. Varía proteínas y verduras cada día.

ESTRUCTURA JSON OBLIGATORIA:
{
  "durationText": "string",
  "generalGuidelines": ["string (mínimo 8 pautas)"],
  "weeklyPlan": [
    {
      "day": 1,
      "meals": {
        "breakfast":      { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "morningSnack":   { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "lunch":          { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "afternoonSnack": { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "dinner":         { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número }
      }
    }
  ]
}
`.trim();

// ─── Protéifine DAP 5 ─────────────────────────────────────────────────────────

const DAP5_SYSTEM_PROMPT = `
Eres un nutricionista experto en el protocolo Protéifine. Generas planes nutricionales DAP 5 (Fase de Transición) precisos en formato JSON.

PROTOCOLO DAP 5 - REGLAS ESTRICTAS:

VERDURAS: TODAS permitidas sin límite. Máx 2 cdas soperas AOVE al día.

DESAYUNO: 30-40g pan integral + 10g mantequilla o 1 cda sopera AOVE + UNA opción: 1 huevo | 1 loncha jamón (30g) | 25g queso (20-30% MG).
MEDIA MAÑANA: infusión, café solo o té sin azúcar.
COMIDA: 150g carne (ternera, buey/lomo, cerdo/filete, conejo, codornices, pollo, pavo) o 2 huevos + LEGUMBRE/CEREAL (3 cdas soperas de arroz/pasta/lentejas/garbanzos/guisantes/alubias o 2 patatas medianas) + verduras.
MERIENDA: 1 fruta de la lista: 1 naranja | 1 melocotón | 1 pera | 1 manzana | 1 plátano | 2 rodajas piña | 2 mandarinas | 2 kiwis | 2 ciruelas | 2 higos | 3 albaricoques | 200g fresas/frambuesas | 200g melón/sandía | 100g cerezas/uvas | 80g compota sin azúcar.
CENA: 200g pescado/sepia/pulpo/calamar/marisco/moluscos o 150g pollo/pavo (pechuga sin piel) + verduras.

ALIÑOS (máx/día): 2 cdas soperas AOVE, 2 cdas postre vinagre, 1 cda postre zumo limón. Mostaza Dijon y tamari moderados.
BEBIDAS: Mínimo 1.5L agua. Té/café/infusiones sin azúcar. Sin leche (excepto Protéifine).

SUPLEMENTACIÓN RECOMENDADA DAP 5: Omega-3 (1-2g/día), Vitamina D3 (1000 UI/día), Magnesio (200mg/noche), Probióticos (flora intestinal), Fibra soluble si hay estreñimiento.

REGLAS JSON: 5 tomas fijas. Cantidad exacta en ingredientes. Varía proteínas, legumbres/cereales y verduras cada día.
OBLIGATORIO: en cada toma rellena "calories", "protein", "carbs" y "fats" con los valores nutricionales estimados en kcal/g.

ESTRUCTURA JSON OBLIGATORIA:
{
  "durationText": "string",
  "generalGuidelines": ["string (mínimo 8 pautas)"],
  "weeklyPlan": [
    {
      "day": 1,
      "meals": {
        "breakfast":      { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "morningSnack":   { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "lunch":          { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "afternoonSnack": { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número },
        "dinner":         { "name": "string", "description": "string", "ingredients": ["string con gramos"], "calories": número, "protein": número, "carbs": número, "fats": número }
      }
    }
  ]
}
`.trim();

// ─── Dieta sin cocina — conservas y precocinados ──────────────────────────────

const PRECOOKED_NOTE = `
⚠ DIETA SIN COCINA — REGLAS QUE ANULAN LAS REGLAS GENERALES DEL SISTEMA:
Esta dieta es para personas que NO cocinan. TODAS las preparaciones: sin fogones, sin horno, solo frío o microondas.

── ANULACIÓN OBLIGATORIA DE LA REGLA 5 (variedad de proteínas) ──
La rotación estándar (pollo fresco, ternera, merluza…) NO APLICA porque esos alimentos requieren cocción.
Usa EXACTAMENTE esta rotación de conservas para almuerzo/cena (7 días):
  Día 1: atún en agua  /  garbanzos en lata + jamón cocido
  Día 2: sardinas en tomate  /  lentejas en lata + queso fresco
  Día 3: caballa en escabeche  /  mejillones en lata + arroz precocinado
  Día 4: atún en aceite de oliva  /  alubias blancas + fiambre de pavo
  Día 5: pulpo cocido en lata  /  garbanzos + huevos duros precocidos
  Día 6: berberechos + palitos de cangrejo  /  lentejas + requesón
  Día 7: sardinas en aceite  /  alubias rojas + jamón cocido
Si el plan tiene más de 7 días, repite el ciclo desde el día 1 variando el cereal o la verdura de acompañamiento.
GENERA SIEMPRE TODOS LOS DÍAS SOLICITADOS — no te detengas en el día 1.

── ALIMENTOS PERMITIDOS ──
• Conservas de pescado: atún en agua, atún en aceite, sardinas en tomate, caballa en escabeche, mejillones, berberechos, pulpo cocido en lata, anchoas
• Legumbres cocidas (lata/bote): garbanzos, lentejas, alubias blancas, alubias rojas
• Verduras en conserva: pimientos del piquillo (bote), espárragos (lata), aceitunas, alcachofas, tomate triturado, maíz dulce (lata)
• Proteínas frías listas: huevos duros precocidos (bolsa), fiambre de pavo/pollo loncheado, jamón cocido, palitos de cangrejo, queso en porciones, queso fresco tipo Burgos, requesón
• Lácteos: yogur natural/griego, kéfir, leche
• Cereales listos: pan de molde integral, tortitas de arroz/maíz, avena de cocción rápida (agua caliente 2 min), bolsas arroz precocinado (microondas 90 s), quinoa precocinada en bolsa
• Platos fríos envasados: gazpacho en tetrabrik, salmorejo en tetrabrik, hummus comercial, guacamole en tarrina
• Frutas frescas: plátano, manzana, pera, naranja, kiwi, fresas, uvas, arándanos
• Frutos secos: nueces, almendras, anacardos, semillas de chía/lino

── PREPARACIONES PERMITIDAS ✓ ──
✓ Abrir lata/bote, escurrir y aliñar en frío con AOVE + limón + especias
✓ Microondas: bolsa de arroz precocinado (90 s)
✓ Hervir agua para avena de cocción rápida o té/café
✓ Mezclar y aliñar en frío (ensaladas, boles)

── PROHIBIDO ✗ ──
✗ Plancha, sartén, horno, freidora, olla
✗ Carne o pescado fresco (requieren cocinarse)
✗ Pasta o arroz no precocinado
`.trim();

// ─── Get system prompt ─────────────────────────────────────────────────────────

const getSystemPrompt = (patient: PatientData): string => {
  if (patient.dietType === DietType.ProteinDAP4) return DAP4_SYSTEM_PROMPT;
  if (patient.dietType === DietType.ProteinDAP5) return DAP5_SYSTEM_PROMPT;

  const mealCount = patient.mealCount ?? 5;
  const mealKeys  = MEAL_KEYS_BY_COUNT[mealCount] ?? MEAL_KEYS_BY_COUNT[5];
  const dietNote  = patient.dietType === DietType.Precooked ? PRECOOKED_NOTE : undefined;
  return buildDietSystemPrompt(mealKeys, patient.fastingProtocol, dietNote);
};

// ─── Build user prompt ─────────────────────────────────────────────────────────

export const buildUserPrompt = (
  patient: PatientData,
  metrics: CalculatedMetrics,
  customFoods: CustomFood[],
  startDay: number,
  daysToGenerate: number
): string => {
  const conditionsText = patient.conditions?.length
    ? patient.conditions.map(c => sanitizeForPrompt(c, 50)).join(', ')
    : 'Ninguna';

  const customFoodsText = customFoods.length
    ? `\nIncluye estos alimentos si encajan: ${customFoods.map(f => sanitizeForPrompt(f.name, 60)).join(', ')}`
    : '';

  // Auditoría (mejora #5): las condiciones clínicas dejan de ser solo texto
  // libre — celiaquía e intolerancia a la lactosa generan exclusiones
  // OBLIGATORIAS que se fusionan con las del usuario, independientemente de
  // si el modelo interpreta correctamente el nombre de la condición.
  const clinicalTargets = getClinicalTargets(patient, metrics.macros.calories);
  const allExclusions = [
    ...(patient.excludedFoods?.trim() ? [sanitizeForPrompt(patient.excludedFoods, 200)] : []),
    ...clinicalTargets.mandatoryExclusions,
  ].join(', ');
  const excludedText = allExclusions
    ? `\nEXCLUIR COMPLETAMENTE (prioridad absoluta sobre cualquier regla, incluida la rotación de proteínas): ${allExclusions}`
    : '';

  // Auditoría (mejora #6): objetivos numéricos de fibra/azúcar/sodio, antes
  // ausentes del prompt por completo.
  const clinicalTargetsNote = `\n- OBJETIVOS ADICIONALES: fibra mínima ${clinicalTargets.fiberGMin}g/día, azúcares libres máximo ${clinicalTargets.addedSugarGMax}g/día, sodio máximo ${clinicalTargets.sodiumMgMax}mg/día${clinicalTargets.sodiumMgMax <= 1500 ? ' (restricción por hipertensión — evitar embutidos, conservas saladas, precocinados)' : ''}.`;

  // Auditoría (mejora #12): el presupuesto sesga los alimentos sugeridos.
  const budgetNote = (() => {
    const level = patient.budgetLevel ?? BudgetLevel.Standard;
    if (level === BudgetLevel.Tight) {
      return '\n- PRESUPUESTO AJUSTADO: prioriza SIEMPRE alimentos económicos — legumbres, huevo, pollo/pavo, atún en lata, arroz, avena, pasta, verduras y frutas de temporada (plátano, manzana, naranja). EVITA salmón, marisco, frutos secos premium, quinoa importada y "superalimentos" caros salvo que sean imprescindibles por alguna condición.';
    }
    if (level === BudgetLevel.Unlimited) {
      return '\n- SIN RESTRICCIÓN DE PRESUPUESTO: puedes usar salmón, marisco, frutos secos, quinoa y productos gourmet libremente cuando mejoren la calidad nutricional del plan.';
    }
    return '';
  })();

  const isDAP = patient.dietType === DietType.ProteinDAP4 || patient.dietType === DietType.ProteinDAP5;

  if (isDAP) {
    return `
Genera un plan de ${daysToGenerate} días (días ${startDay} al ${startDay + daysToGenerate - 1}) para:
- Paciente: ${patient.age} años, ${patient.gender}, ${patient.weight}kg, ${patient.height}cm
- Protocolo: ${patient.dietType === DietType.ProteinDAP4 ? 'Protéifine DAP 4' : 'Protéifine DAP 5'}
${excludedText}${customFoodsText}

Numera los días desde ${startDay}. Devuelve SOLO el JSON. Sin explicaciones.
`.trim();
  }

  const mealCount = patient.mealCount ?? 5;
  const mealKeys  = MEAL_KEYS_BY_COUNT[mealCount] ?? MEAL_KEYS_BY_COUNT[5];

  // Fix 3: Bloquear ayuno intermitente en diabetes T2 (riesgo de hipoglucemia)
  const hasT2Diabetes = patient.conditions?.includes(Condition.DiabetesType2);

  // Auditoría (mejora crítica #3): bloquear también el ayuno en perfiles
  // vulnerables (menor / embarazo / lactancia / antecedente de TCA). Defensa
  // en profundidad: aunque enforceClinicalSafety ya debería haber puesto
  // fastingProtocol en None antes de llegar aquí, este es el último filtro
  // antes de construir el prompt que recibe la IA.
  const safetyFlags = getClinicalSafetyFlags(patient);
  const blockFasting = hasT2Diabetes || safetyFlags.isVulnerable;

  const fastingNote = (!blockFasting && patient.fastingProtocol && patient.fastingProtocol !== FastingProtocol.None)
    ? `\n- Protocolo de ayuno: ${patient.fastingProtocol} — ${FASTING_WINDOW[patient.fastingProtocol] ?? ''}`
    : '';

  // For 5:2 fasting, flag 2 of the 7 days as low-calorie
  const fasting52Note = (!blockFasting && patient.fastingProtocol === FastingProtocol.IF5_2)
    ? `\n- IMPORTANTE para 5:2: días ${startDay + 2} y ${startDay + 5} son DÍAS DE AYUNO (500 kcal, solo 2 tomas: comida y cena ligeras, ej: 250g verdura + 100g proteína cada una).`
    : '';

  // Nota específica para diabetes T2: 5 tomas pequeñas, sin ayuno
  const t2DiabetesNote = hasT2Diabetes
    ? '\n- DIABETES T2 — DISTRIBUCIÓN OBLIGATORIA EN 5 TOMAS: Distribuir las calorías en 5 tomas equidistribuidas (cada 3h aproximadamente) para estabilidad glucémica. PROHIBIDO cualquier protocolo de ayuno intermitente o periodos sin comer superiores a 4h — puede causar hipoglucemia en pacientes con metformina o insulina. Priorizar HC de bajo índice glucémico (avena, legumbres, verduras, arroz integral). Incluir en generalGuidelines pautas de monitoreo glucémico postprandial.'
    : '';

  // Nota de seguridad clínica para perfiles vulnerables (auditoría)
  const vulnerableNote = safetyFlags.isVulnerable
    ? `\n- ⚠ PERFIL CLÍNICAMENTE VULNERABLE (${safetyFlags.reasons.join(', ')}): PROHIBIDO cualquier restricción calórica agresiva, ayuno o mensaje orientado a la pérdida de peso. El plan debe ser de mantenimiento nutricional completo y variado, sin lenguaje alarmista sobre el peso corporal. Requiere supervisión profesional directa.`
    : '';

  // Nota de seguridad para enfermedad renal (proteína ya limitada en el cálculo, refuerzo textual)
  const renalNote = safetyFlags.hasRenalDisease
    ? '\n- ENFERMEDAD RENAL/ERC: la proteína objetivo ya ha sido limitada por seguridad. NO añadas fuentes proteicas extra ni suplementos proteicos. Prioriza control de sodio y potasio; evita embutidos y conservas saladas.'
    : '';

  const athleteGoalText = (patient.dietType === DietType.Athlete && patient.athleteGoal)
    ? `\n- Objetivo atleta: ${ATHLETE_GOAL_LABELS[patient.athleteGoal]}${
        patient.athleteGoal === AthleteGoal.Definition
          ? '\n  → DÉFICIT DEFINICIÓN: Proteína alta (2.3g/kg) distribuida OBLIGATORIAMENTE en todas las tomas (cada 3-4h) para preservar músculo — ninguna toma puede tener menos de 25g de proteína. Carbos moderados y de índice glucémico bajo-medio (avena, arroz integral, legumbres). Evitar harinas refinadas, azúcares y alimentos de alta densidad calórica. Verduras en cantidad para maximizar saciedad por volumen. Grasas saludables presentes pero controladas.'
          : patient.athleteGoal === AthleteGoal.Volume
          ? '\n  → SUPERÁVIT VOLUMEN: Aumenta raciones de HC complejos en cada toma (arroz, avena, pasta, patata, plátano). Toma pre-entreno: 40-60g HC rápidos + 30g proteína (60-90 min antes). Toma post-entreno: 50-70g HC rápidos + 35-40g proteína (dentro de los 30-45 min post). Frutos secos y aguacate para cubrir calorías sin inflar volumen digestivo. Distribución proteína: mínimo 35g por toma principal.'
          : (() => {
              const t   = patient.trainingTime ?? '17:30';
              const [hh, mm] = t.split(':').map(Number);
              const preH  = `${String(Math.max(0, hh - 2)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
              const postH = `${String(Math.min(23, hh + 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
              return `\n  → RENDIMIENTO MANTENIMIENTO: El paciente entrena a las ${t}h. Toma pre-WO (${preH}h): 40-50g HC moderados + 25g proteína, poca grasa. Toma post-WO (${postH}h, cena): 50-60g HC + 30-35g proteína. Resto de tomas: distribución equilibrada. Carbos altos globalmente. Proteína cada 3-4h.`;
            })()
      }`
    : '';

  const weightGoalText = patient.targetWeight != null
    ? `- Objetivo de peso: ${patient.targetWeight}kg (actual ${patient.weight}kg → ${patient.targetWeight < patient.weight ? `pérdida de ${(patient.weight - patient.targetWeight).toFixed(1)}kg` : patient.targetWeight > patient.weight ? `ganancia de ${(patient.targetWeight - patient.weight).toFixed(1)}kg` : 'mantenimiento'})`
    : '';

  // Texto del objetivo calórico para el prompt
  const calorieGoalText = (() => {
    if (patient.dietType === DietType.Athlete) return ''; // Atleta usa athleteGoalText
    const goal = patient.calorieGoal ?? CalorieGoal.Maintenance;
    const meta  = CALORIE_GOAL_LABELS[goal];
    const adj   = CALORIE_GOAL_ADJUST[goal];
    if (goal === CalorieGoal.Maintenance) return `\n- Objetivo calórico: Mantenimiento (GET sin ajuste)`;
    const direction = adj < 0 ? 'Déficit' : 'Superávit';
    return `\n- Objetivo calórico: ${direction} ${Math.abs(adj)} kcal/día (${meta.title} — ${meta.subtitle}). Las calorías objetivo ya incorporan este ajuste.`;
  })();

  const proteinPerMeal  = Math.round(metrics.macros.protein / mealCount);
  const carbsPerMeal    = Math.round(metrics.macros.carbs   / mealCount);
  const fatsPerMeal     = Math.round(metrics.macros.fats    / mealCount);
  const calPerMeal      = Math.round(metrics.tee            / mealCount);

  // Precooked diet: replace fresh-protein calibration with canned equivalents
  const precookedUserNote = patient.dietType === DietType.Precooked ? `
DIETA SIN COCINA — RECORDATORIO PARA ESTE PLAN:
• Genera TODOS los ${daysToGenerate} días completos. No pares en el día 1.
• Proteína disponible (en conserva): atún en agua (26g P/100g) → para ${proteinPerMeal}g P necesitas ~${Math.round(proteinPerMeal/0.26)}g; sardinas (21g P/100g) → ~${Math.round(proteinPerMeal/0.21)}g; garbanzos cocidos (9g P/100g) → ~${Math.round(proteinPerMeal/0.09)}g + combina con jamón (18g P/100g)
• HC disponible: bolsa arroz precocinado (28g HC/100g) → para ${carbsPerMeal}g HC necesitas ~${Math.round(carbsPerMeal/0.28)}g; avena (60g HC/100g) → ~${Math.round(carbsPerMeal/0.60)}g; lentejas en lata (20g HC/100g) → combina fuentes
• Grasa: AOVE (100g G/100ml) → ${fatsPerMeal}g G = ${fatsPerMeal}ml; nueces (55g G/100g) → ${Math.round(fatsPerMeal/0.55)}g
• USA LA ROTACIÓN DE CONSERVAS del sistema (días 1-7) y GENERA TODOS LOS DÍAS.
` : '';

  return `
Genera un plan dietético de ${daysToGenerate} días (días ${startDay} al ${startDay + daysToGenerate - 1}) para:
- Paciente: ${patient.age} años, ${patient.gender}, ${patient.weight}kg, ${patient.height}cm
- Tipo de dieta: ${patient.dietType}${athleteGoalText}${calorieGoalText}
- Calorías objetivo: ${metrics.macros.calories} kcal/día
- Macros diarios: Proteínas ${metrics.macros.protein}g | HC ${metrics.macros.carbs}g | Grasas ${metrics.macros.fats}g
- Patologías: ${conditionsText}
${weightGoalText}
- Tomas por día: ${mealCount} (claves: ${mealKeys.join(', ')})
- OBJETIVO POR TOMA (~${mealCount} tomas equidistribuidas): ~${calPerMeal} kcal · ~${proteinPerMeal}g proteína · ~${carbsPerMeal}g HC · ~${fatsPerMeal}g grasa
  → CALIBRACIÓN OBLIGATORIA para esta toma (ejemplos con los valores exactos de este paciente):
    · HC ${carbsPerMeal}g: necesitas ~${Math.round(carbsPerMeal / 0.28)}g arroz integral cocido, o ~${Math.round(carbsPerMeal / 0.21)}g quinoa cocida, o combina fuentes (ej: ${Math.round(carbsPerMeal * 0.5 / 0.28)}g arroz + ${Math.round(carbsPerMeal * 0.3 / 0.20)}g legumbres + fruta).
    · P ${proteinPerMeal}g: necesitas ~${Math.round(proteinPerMeal / 0.31)}g pechuga de pollo, o ~${Math.round(proteinPerMeal / 0.22)}g salmón, o ~${Math.round(proteinPerMeal / 0.28)}g ternera magra. ⚠ TECHO MÁXIMO: NUNCA superes ${Math.round(proteinPerMeal * 1.2)}g de proteína por toma — si el objetivo es ${proteinPerMeal}g P, usa ${Math.round(proteinPerMeal / 0.31)}g de pollo, NO 120g (que dan ${Math.round(120 * 0.31)}g P y exceden el objetivo).
    · G ${fatsPerMeal}g: necesitas ~${Math.round(fatsPerMeal / 0.55)}g nueces, o ~${Math.round(fatsPerMeal / 1.00)}ml AOVE, o combina (ej: ${Math.round(fatsPerMeal * 0.4 / 0.13)}g salmón aporta ${Math.round(fatsPerMeal * 0.4)}g G + ${Math.round(fatsPerMeal * 0.6 / 1.00)}ml AOVE).
  → Si usas solo 100g de un cereal o 100g de aceite en cada toma, el plan NO alcanza el objetivo.${carbsPerMeal > 80 ? `
  ⚠ ALERTA HC ELEVADO (${carbsPerMeal}g por toma): Una sola fuente de cereal NO alcanza este objetivo. DEBES combinar 2-3 fuentes de HC en cada toma principal. Ejemplo para ${carbsPerMeal}g HC: ${Math.round(carbsPerMeal * 0.5 / 0.28)}g arroz integral cocido (${Math.round(carbsPerMeal * 0.5)}g HC) + ${Math.round(carbsPerMeal * 0.3 / 0.20)}g legumbres (${Math.round(carbsPerMeal * 0.3)}g HC) + 1 fruta mediana (${Math.round(carbsPerMeal * 0.2)}g HC). Ajusta según el plato.` : ''}
${clinicalTargetsNote}${budgetNote}
${fastingNote}${fasting52Note}${t2DiabetesNote}${vulnerableNote}${renalNote}${precookedUserNote}${excludedText}${customFoodsText}

Numera los días desde ${startDay}. Devuelve SOLO el JSON. Sin explicaciones.
`.trim();
};

// ─── Diet generation ──────────────────────────────────────────────────────────

export const generateDietPlan = async (
  patient: PatientData,
  metrics: CalculatedMetrics,
  customFoods: CustomFood[] = []
): Promise<DietResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa vite.config.ts');

  const totalWeeks = patient.weeks ?? 1;
  const totalDays  = totalWeeks * 7;
  const systemPrompt = getSystemPrompt(patient);

  const allDayPlans: DietResponse['weeklyPlan'] = [];
  let generalGuidelines: string[] = [];
  let durationText = '';

  const DAYS_PER_BATCH = 7;
  const batches = Math.ceil(totalDays / DAYS_PER_BATCH);

  for (let batch = 0; batch < batches; batch++) {
    const startDay = batch * DAYS_PER_BATCH + 1;
    const daysLeft = totalDays - batch * DAYS_PER_BATCH;
    const daysThisBatch = Math.min(DAYS_PER_BATCH, daysLeft);

    const userPrompt = buildUserPrompt(patient, metrics, customFoods, startDay, daysThisBatch);

    try {
      const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
      if (!text) throw new Error('Sin respuesta de la IA');

      const parsed = JSON.parse(text) as DietResponse;
      if (!Array.isArray(parsed.weeklyPlan) || parsed.weeklyPlan.length === 0) {
        throw new Error('El plan generado está vacío o tiene formato incorrecto');
      }

      // Renumerar días desde startDay por si el modelo no respeta la numeración
      parsed.weeklyPlan.forEach((day, i) => { day.day = startDay + i; });

      allDayPlans.push(...parsed.weeklyPlan);

      if (batch === 0) {
        generalGuidelines = parsed.generalGuidelines ?? [];
        durationText = parsed.durationText ?? '';
      }
    } catch (error: any) {
      const msg: string = error?.message ?? String(error);
      console.error(`Error generating batch ${batch + 1}:`, msg);
      if (msg.includes('rate_limit') || msg.includes('429')) {
        throw new Error('Límite de peticiones alcanzado. Espera 30 segundos e inténtalo de nuevo.');
      }
      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('API Key')) {
        throw new Error('API Key inválida o no configurada. Revisa el fichero .env.local.');
      }
      if (msg.includes('400') || msg.includes('413') || msg.includes('context_length')) {
        throw new Error(`Error en la petición al modelo (${msg}). Reduce el número de semanas o contacta soporte.`);
      }
      // Surface the real message so it's visible in the toast
      throw new Error(msg || 'Error de conexión con el servidor de IA. Inténtalo de nuevo.');
    }
  }

  // Validación determinista de macros (auditoría): corrige inconsistencias
  // aritméticas entre las kcal declaradas y los macros declarados por la IA.
  // También garantiza pautas de B12/hierro/calcio/omega-3 en vegana/vegetariana.
  const finalGuidelines = ensureTransitionGuideline(
    ensureMicronutrientGuidelines(generalGuidelines, patient.dietType),
    patient.calorieGoal
  );
  return reconcileDietResponse({ weeklyPlan: allDayPlans, generalGuidelines: finalGuidelines, durationText });
};

// ─── Recipe search ────────────────────────────────────────────────────────────
const RECIPE_SYSTEM_PROMPT = `
Eres un chef nutricionista. Generas recetas saludables en formato JSON.
Responde ÚNICAMENTE con un array JSON de recetas. Sin texto adicional.

ESTRUCTURA por receta:
{
  "id": "string único",
  "title": "string",
  "description": "string (máx 20 palabras)",
  "prepTime": número en minutos,
  "calories": número,
  "protein": número en gramos,
  "carbs": número en gramos,
  "fats": número en gramos,
  "ingredients": ["string con cantidad exacta, ej: 150g pechuga de pollo"],
  "instructions": ["string"],
  "tags": ["string"]
}

Devuelve el JSON como: { "recipes": [ ...array de recetas... ] }
`.trim();

// ─── PDF diet import (vision) ─────────────────────────────────────────────────

const PDF_VISION_PROMPT = `
Estas imágenes son páginas de un plan nutricional. Extrae TODOS los datos y devuelve ÚNICAMENTE este JSON (sin markdown, sin texto extra):

{
  "name": "nombre del paciente que aparece en la cabecera",
  "imc": número IMC del documento,
  "bmr": número TMB del documento,
  "tee": número GET del documento,
  "protein": gramos proteína de MACROS OBJETIVO/DÍA,
  "carbs": gramos carbohidratos de MACROS OBJETIVO/DÍA,
  "fats": gramos grasas de MACROS OBJETIVO/DÍA,
  "calories": kcal de MACROS OBJETIVO/DÍA (o GET si no hay otro),
  "gender": "hombre" o "mujer",
  "activity": "sedentario"|"ligero"|"moderado"|"intenso"|"muy_intenso",
  "dietType": "equilibrada"|"baja_en_carbohidratos"|"cetogenica"|"vegetariana"|"vegana"|"mediterranea"|"paleo"|"proteica"|"atleta",
  "generalGuidelines": ["cada recomendación de la sección RECOMENDACIONES como elemento separado"],
  "weeklyPlan": [
    {
      "day": 1,
      "meals": {
        "breakfast":      { "name": "...", "description": "...", "ingredients": ["con cantidad"], "calories": 0, "protein": 0, "carbs": 0, "fats": 0 },
        "morningSnack":   { "name": "...", "description": "...", "ingredients": [], "calories": 0, "protein": 0, "carbs": 0, "fats": 0 },
        "lunch":          { "name": "...", "description": "...", "ingredients": [], "calories": 0, "protein": 0, "carbs": 0, "fats": 0 },
        "afternoonSnack": { "name": "...", "description": "...", "ingredients": [], "calories": 0, "protein": 0, "carbs": 0, "fats": 0 },
        "dinner":         { "name": "...", "description": "...", "ingredients": [], "calories": 0, "protein": 0, "carbs": 0, "fats": 0 }
      }
    }
  ]
}

Mapeo de tomas: DESAYUNO→breakfast, MEDIA MAÑANA→morningSnack, ALMUERZO→lunch, MERIENDA→afternoonSnack, CENA→dinner.
Omite las tomas que no aparezcan en el documento. Extrae TODOS los días del plan.
Macros por toma: ponlos a 0 si no están en el PDF. Los valores de name/description/ingredients SÍ deben extraerse.
`.trim();

export const parseDietFromPDF = async (pdfBase64: string): Promise<SavedDiet> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  // Rechazar PDFs > ~15 MB en base64 (~20 MB archivo original) para evitar peticiones enormes
  if (pdfBase64.length > 20 * 1024 * 1024) {
    throw new Error('El PDF es demasiado grande. Máximo ~15 MB. Usa un PDF más pequeño.');
  }

  // Paso 1: OCR — extrae el texto del PDF
  const pdfText = await extractTextFromPDF(apiKey, pdfBase64);
  if (!pdfText.trim()) throw new Error('No se pudo extraer texto del PDF.');

  // Paso 2: Parseo — usa mistral-small para estructurar el JSON
  const userPrompt = `El siguiente texto fue extraído de un plan nutricional en PDF. ${PDF_VISION_PROMPT}\n\nTEXTO DEL PDF:\n${pdfText}`;
  const raw = await groqRequest(apiKey, MODEL_DIET, '', userPrompt);
  if (!raw) throw new Error('El modelo no devolvió ningún contenido. Intenta de nuevo.');
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('La IA devolvió una respuesta con formato inválido al importar el PDF. Inténtalo de nuevo.');
  }

  const gender   = (Object.values(Gender) as string[]).includes(parsed.gender)
    ? parsed.gender as Gender : Gender.Female;
  const activity = (Object.values(ActivityLevel) as string[]).includes(parsed.activity)
    ? parsed.activity as ActivityLevel : ActivityLevel.Moderate;
  const dietType = (Object.values(DietType) as string[]).includes(parsed.dietType)
    ? parsed.dietType as DietType : DietType.Balanced;

  const imc    = Number(parsed.imc)    || 0;
  const bmr    = Number(parsed.bmr)    || 0;
  const tee    = Number(parsed.tee)    || 0;
  const macros = {
    protein:  Number(parsed.protein)  || 0,
    carbs:    Number(parsed.carbs)    || 0,
    fats:     Number(parsed.fats)     || 0,
    calories: Number(parsed.calories) || tee,
  };

  const height = 165;
  const weight = imc > 0 ? parseFloat((imc * (height / 100) ** 2).toFixed(1)) : 70;

  const patientData: PatientData = {
    name: parsed.name ?? 'Paciente importado',
    age: 30, weight, height, gender, activity, dietType,
    duration: Duration.OneMonth, conditions: [],
  };

  const weeklyPlan = (parsed.weeklyPlan ?? []).map((day: any) => ({
    day: day.day,
    meals: Object.fromEntries(
      Object.entries(day.meals ?? {}).filter(
        ([, m]: [string, any]) => m?.name?.trim()
      )
    ),
  })).filter((day: any) => Object.keys(day.meals).length > 0);

  return {
    id:        `pdf_${Date.now()}`,
    timestamp: Date.now(),
    patientData,
    metrics:   { imc, bmr, tee, macros },
    plan: reconcileDietResponse({
      weeklyPlan,
      generalGuidelines: Array.isArray(parsed.generalGuidelines)
        ? parsed.generalGuidelines
        : ['Plan importado desde PDF'],
      durationText: `${weeklyPlan.length} días`,
    }),
  };
};

// ─── Regenerar un único día ───────────────────────────────────────────────────

export const regenerateSingleDay = async (
  patient: PatientData,
  metrics: CalculatedMetrics,
  dayNumber: number,
  customFoods: CustomFood[] = []
): Promise<DayPlan> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  const systemPrompt = getSystemPrompt(patient);
  const userPrompt   = buildUserPrompt(patient, metrics, customFoods, dayNumber, 1);

  const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
  if (!text) throw new Error('Sin respuesta de la IA');

  const parsed = JSON.parse(text) as DietResponse;
  if (!Array.isArray(parsed.weeklyPlan) || parsed.weeklyPlan.length === 0) {
    throw new Error('Respuesta vacía del modelo al regenerar el día');
  }
  const day = parsed.weeklyPlan[0];
  day.day = dayNumber;
  return reconcileDayPlan(day);
};

// ─── Sugerir alternativa para una comida ─────────────────────────────────────

export const getMealSwap = async (
  currentMeal: Meal,
  mealKey: string,
  patient: PatientData,
  metrics: CalculatedMetrics
): Promise<Meal> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  const mealCount     = patient.mealCount ?? 5;
  const calPerMeal    = Math.round(metrics.macros.calories / mealCount);
  const proteinPerMeal = Math.round(metrics.macros.protein / mealCount);
  const carbsPerMeal  = Math.round(metrics.macros.carbs   / mealCount);
  const fatsPerMeal   = Math.round(metrics.macros.fats    / mealCount);

  const mealLabel: Record<string, string> = {
    breakfast: 'desayuno', morningSnack: 'media mañana',
    lunch: 'almuerzo', afternoonSnack: 'merienda', dinner: 'cena',
  };

  const systemPrompt = `
Eres un nutricionista clínico. Devuelves ÚNICAMENTE un JSON con una comida alternativa.
Respeta los macros objetivo y las restricciones del paciente.
Formato:
{
  "name": "string",
  "description": "string (máx 15 palabras)",
  "ingredients": ["string con gramos/medida"],
  "calories": número,
  "protein": número,
  "carbs": número,
  "fats": número
}
${MEAL_TIME_CONSTRAINTS}
`.trim();

  const userPrompt = `
El paciente no quiere esta comida de ${mealLabel[mealKey] ?? mealKey}:
- Nombre: ${currentMeal.name}
- Ingredientes: ${currentMeal.ingredients.join(', ')}

Propón UNA alternativa diferente para ${mealLabel[mealKey] ?? mealKey} con:
- ~${calPerMeal} kcal · ~${proteinPerMeal}g proteína · ~${carbsPerMeal}g HC · ~${fatsPerMeal}g grasa
- Dieta: ${patient.dietType}
- Patologías: ${patient.conditions?.join(', ') || 'ninguna'}
- Alimentos excluidos: ${patient.excludedFoods || 'ninguno'}
Devuelve SOLO el JSON.
`.trim();

  const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
  if (!text) throw new Error('Sin respuesta de la IA al sugerir alternativa.');
  try {
    return reconcileMealMacros(extractMeal(JSON.parse(text)));
  } catch (err: any) {
    throw new Error(err.message || 'La IA devolvió una respuesta con formato inválido al sugerir la alternativa. Inténtalo de nuevo.');
  }
};

// ─── Generar una toma nueva (añadir ración sin rehacer la dieta) ──────────────
// ─── Helper: extrae y valida un Meal de la respuesta de la IA ────────────────
/**
 * Mistral con json_object a veces envuelve el objeto en una clave extra:
 *   {"toma": {"name": "...", "ingredients": [...]}}  ← wrapper no deseado
 *   {"name": "...", "ingredients": [...]}             ← correcto
 * Este helper intenta ambas formas y valida los campos mínimos.
 */
function extractMeal(raw: unknown): Meal {
  const isMeal = (v: unknown): v is Meal =>
    !!v && typeof v === 'object' &&
    typeof (v as any).name === 'string' && (v as any).name.length > 0 &&
    Array.isArray((v as any).ingredients);

  if (isMeal(raw)) return raw;

  // Buscar en el primer nivel de valores del objeto
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw as object)) {
      if (isMeal(v)) return v;
    }
  }
  throw new Error('La IA no devolvió una comida con formato válido. Inténtalo de nuevo.');
}

/**
 * Genera una sola toma para un día concreto, calibrada a los macros residuales
 * (objetivo del día menos lo que ya suman las tomas existentes).
 * Si los macros residuales son <= 0, usa el promedio por toma como objetivo.
 */
export const generateSingleMeal = async (
  mealKey: string,
  residual: { calories: number; protein: number; carbs: number; fats: number },
  patient: PatientData,
  metrics: CalculatedMetrics
): Promise<Meal> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  const mealCount = patient.mealCount ?? 5;
  // Si el residual es negativo o ínfimo, usar el promedio por toma como objetivo
  const target = {
    calories: residual.calories > 50  ? residual.calories : Math.round(metrics.macros.calories / mealCount),
    protein:  residual.protein  > 5   ? residual.protein  : Math.round(metrics.macros.protein  / mealCount),
    carbs:    residual.carbs    > 5   ? residual.carbs    : Math.round(metrics.macros.carbs    / mealCount),
    fats:     residual.fats     > 3   ? residual.fats     : Math.round(metrics.macros.fats     / mealCount),
  };

  const mealLabel: Record<string, string> = {
    breakfast: 'desayuno', morningSnack: 'media mañana',
    lunch: 'almuerzo', afternoonSnack: 'merienda', dinner: 'cena',
  };

  const systemPrompt = `
Eres un nutricionista clínico. Devuelves ÚNICAMENTE un JSON con UNA comida para la toma indicada.
Calibra las raciones (gramos) para cuadrar exactamente con los macros objetivo (±8%).
Respeta el tipo de dieta, las patologías y los alimentos excluidos del paciente.
Formato:
{
  "name": "string",
  "description": "string (máx 15 palabras)",
  "ingredients": ["string con gramos/medida"],
  "calories": número,
  "protein": número,
  "carbs": número,
  "fats": número
}
${MEAL_TIME_CONSTRAINTS}
`.trim();

  const userPrompt = `
Genera UNA toma de ${mealLabel[mealKey] ?? mealKey} para:
- Paciente: ${patient.age} años, ${patient.gender}, ${patient.weight}kg, ${patient.height}cm
- Tipo de dieta: ${patient.dietType}
- Patologías: ${patient.conditions?.map(c => sanitizeForPrompt(c, 50)).join(', ') || 'ninguna'}
- Alimentos excluidos: ${patient.excludedFoods ? sanitizeForPrompt(patient.excludedFoods, 200) : 'ninguno'}

OBJETIVO DE MACROS PARA ESTA TOMA (cuadra exacto): ~${target.calories} kcal · ~${target.protein}g proteína · ~${target.carbs}g HC · ~${target.fats}g grasa.
Calibra los gramos de cada ingrediente para alcanzar estos valores. Incluye siempre una fuente de grasa visible si la proteína es magra.
Devuelve SOLO el JSON.
`.trim();

  const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
  if (!text) throw new Error('Sin respuesta de la IA al generar la toma.');
  try {
    return reconcileMealMacros(extractMeal(JSON.parse(text)));
  } catch (err: any) {
    throw new Error(err.message || 'La IA devolvió una respuesta con formato inválido al generar la toma. Inténtalo de nuevo.');
  }
};

// ─── Re-porcionar una comida existente a unos macros nuevos ───────────────────
/**
 * Mantiene EL MISMO plato e ingredientes de `meal`, pero ajusta las cantidades
 * (gramos/ml) y los macros para cuadrar con `target`. Se usa para reducir el
 * desayuno y la cena cuando se añade una toma nueva (mantener el total del día).
 */
export const reportionMeal = async (
  meal: Meal,
  target: { calories: number; protein: number; carbs: number; fats: number },
  patient: PatientData
): Promise<Meal> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  const systemPrompt = `
Eres un nutricionista clínico. Recibes una comida y devuelves ÚNICAMENTE el JSON de ESA MISMA comida,
manteniendo el mismo nombre, descripción y los MISMOS ingredientes (mismos alimentos),
pero AJUSTANDO las cantidades (gramos/ml de cada ingrediente) y los macros para cuadrar con el objetivo.
No cambies los alimentos: solo recalcula las cantidades proporcionalmente.
Formato:
{
  "name": "string (igual que el original)",
  "description": "string",
  "ingredients": ["mismo alimento con la nueva cantidad ajustada"],
  "calories": número,
  "protein": número,
  "carbs": número,
  "fats": número
}
`.trim();

  const userPrompt = `
Comida original:
- Nombre: ${meal.name}
- Ingredientes: ${meal.ingredients.join(', ')}
- Macros actuales: ${meal.calories ?? '?'} kcal · ${meal.protein ?? '?'}g P · ${meal.carbs ?? '?'}g HC · ${meal.fats ?? '?'}g G

Ajusta las CANTIDADES de los mismos ingredientes para que la comida pase a tener aproximadamente:
~${target.calories} kcal · ~${target.protein}g proteína · ~${target.carbs}g HC · ~${target.fats}g grasa.
Alimentos excluidos del paciente: ${patient.excludedFoods ? sanitizeForPrompt(patient.excludedFoods, 200) : 'ninguno'}.
Devuelve SOLO el JSON con los mismos alimentos y las cantidades recalculadas.
`.trim();

  const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
  if (!text) throw new Error('Sin respuesta de la IA al reajustar la comida.');
  try {
    return reconcileMealMacros(extractMeal(JSON.parse(text)));
  } catch (err: any) {
    throw new Error(err.message || 'La IA devolvió una respuesta inválida al reajustar la comida. Inténtalo de nuevo.');
  }
};

// ─── Adaptar un plan a la pareja (mismo menú, distintas porciones) ────────────
/**
 * Toma el plan base (persona A) y devuelve el MISMO menú (mismos platos e
 * ingredientes en todos los días) pero con las cantidades y macros ajustados a
 * los objetivos diarios de la pareja (persona B). Garantiza que salgan TODOS los
 * días del plan base, procesando en lotes de 7 días.
 */
export const adaptPlanToPartner = async (
  basePlan: DietResponse,
  partner: PatientData,
  partnerMetrics: CalculatedMetrics
): Promise<DietResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa .env.local');

  const baseDays = basePlan.weeklyPlan ?? [];
  if (baseDays.length === 0) return basePlan;

  const systemPrompt = `
Eres un nutricionista clínico. Recibes un menú semanal (lista de días con sus tomas).
Devuelve EXACTAMENTE el mismo menú — los MISMOS platos, los MISMOS ingredientes y el MISMO número de días y tomas —
pero AJUSTANDO las cantidades (gramos/ml de cada ingrediente) y los macros de cada toma
para que el TOTAL de cada día cuadre con los macros objetivo de este paciente.
NO cambies los alimentos ni los nombres de los platos: la pareja come lo mismo, solo cambian las raciones.
Mantén las mismas claves de tomas (breakfast, morningSnack, lunch, afternoonSnack, dinner) que trae cada día.
Responde ÚNICAMENTE con este JSON:
{
  "weeklyPlan": [
    { "day": número, "meals": { "<clave>": { "name": "...", "description": "...", "ingredients": ["alimento con nueva cantidad"], "calories": número, "protein": número, "carbs": número, "fats": número } } }
  ]
}
`.trim();

  const adaptedDays: DietResponse['weeklyPlan'] = [];
  const BATCH = 7;

  for (let i = 0; i < baseDays.length; i += BATCH) {
    const chunk = baseDays.slice(i, i + BATCH);
    const userPrompt = `
OBJETIVO DIARIO de este paciente (cada día debe sumar aprox. esto):
~${partnerMetrics.macros.calories} kcal · ~${partnerMetrics.macros.protein}g proteína · ~${partnerMetrics.macros.carbs}g HC · ~${partnerMetrics.macros.fats}g grasa.
Alimentos excluidos: ${partner.excludedFoods ? sanitizeForPrompt(partner.excludedFoods, 200) : 'ninguno'}.

MENÚ BASE A AJUSTAR (mantén los mismos platos e ingredientes, recalcula solo las cantidades y macros):
${JSON.stringify({ weeklyPlan: chunk })}

Devuelve SOLO el JSON con los ${chunk.length} día(s), mismos platos, cantidades ajustadas al objetivo.
`.trim();

    const text = await groqRequest(apiKey, MODEL_DIET, systemPrompt, userPrompt);
    if (!text) throw new Error('Sin respuesta de la IA al adaptar el plan de la pareja');
    let parsed: DietResponse;
    try {
      parsed = JSON.parse(text) as DietResponse;
    } catch {
      throw new Error('La IA devolvió una respuesta inválida al adaptar el plan de la pareja.');
    }
    const days = parsed.weeklyPlan ?? [];
    if (days.length === 0) {
      // Fallback: si la IA no devolvió nada, reutiliza el menú base de este lote
      adaptedDays.push(...chunk);
    } else {
      // Forzar la numeración correcta de días
      days.forEach((d, idx) => { d.day = i + idx + 1; });
      adaptedDays.push(...days);
    }
  }

  return reconcileDietResponse({
    weeklyPlan: adaptedDays,
    generalGuidelines: ensureTransitionGuideline(
      ensureMicronutrientGuidelines(basePlan.generalGuidelines ?? [], partner.dietType),
      partner.calorieGoal
    ),
    durationText: basePlan.durationText ?? '',
  });
};

export const findRecipes = async (filters: RecipeFilters): Promise<Recipe[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada');

  const userPrompt = `
Genera 6 recetas de "${filters.query || 'comida saludable'}" para ${filters.mealType}.
- Calorías máximas: ${filters.maxCalories || 600} kcal
- Tiempo máximo de preparación: ${filters.maxPrepTime || 30} minutos
- Tipo de dieta: ${filters.dietType}
${filters.excludeIngredients ? `- Excluir: ${filters.excludeIngredients}` : ''}

Devuelve SOLO el JSON con la estructura indicada.
`.trim();

  const text = await groqRequest(apiKey, MODEL_RECIPES, RECIPE_SYSTEM_PROMPT, userPrompt);
  const parsed = JSON.parse(text || '{"recipes":[]}');
  return (parsed.recipes ?? parsed) as Recipe[];
};
