/**
 * aiService.ts — Migrado de Gemini a Groq (API compatible con OpenAI)
 * Mantiene la misma interfaz pública para no romper el resto de la app.
 */
import {
  CalculatedMetrics, PatientData, DietResponse,
  CustomFood, RecipeFilters, Recipe
} from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_DIET    = 'llama-3.3-70b-versatile';   // Mejor para razonamiento clínico
const MODEL_RECIPES = 'llama-3.1-8b-instant';       // Más rápido para recetas simples

// ─── Helper ───────────────────────────────────────────────────────────────────
const groqRequest = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 8192,
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

// ─── Diet generation ──────────────────────────────────────────────────────────
const DIET_SYSTEM_PROMPT = `
Eres un nutricionista clínico experto. Generas planes nutricionales precisos en formato JSON.

REGLAS:
- Responde ÚNICAMENTE con el JSON solicitado, sin texto adicional.
- Usa términos prácticos españoles (Mercadona, medidas caseras).
- Descripciones de comidas: máximo 15 palabras.
- Ajusta estrictamente según patologías indicadas.
- Genera exactamente 7 días con 5 tomas cada uno.

ESTRUCTURA JSON OBLIGATORIA:
{
  "durationText": "string",
  "generalGuidelines": ["string"],
  "weeklyPlan": [
    {
      "day": 1,
      "meals": {
        "breakfast":      { "name": "string", "description": "string", "ingredients": ["string"] },
        "morningSnack":   { "name": "string", "description": "string", "ingredients": ["string"] },
        "lunch":          { "name": "string", "description": "string", "ingredients": ["string"] },
        "afternoonSnack": { "name": "string", "description": "string", "ingredients": ["string"] },
        "dinner":         { "name": "string", "description": "string", "ingredients": ["string"] }
      }
    }
  ]
}
`.trim();

export const generateDietPlan = async (
  patient: PatientData,
  metrics: CalculatedMetrics,
  customFoods: CustomFood[] = []
): Promise<DietResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API Key no encontrada. Revisa vite.config.ts');

  const conditionsText = patient.conditions?.length
    ? patient.conditions.join(', ')
    : 'Ninguna';

  const customFoodsText = customFoods.length
    ? `\nIncluye estos alimentos si encajan: ${customFoods.map(f => f.name).join(', ')}`
    : '';

  const userPrompt = `
Genera un plan dietético de 7 días para:
- Paciente: ${patient.age} años, ${patient.gender}, ${patient.weight}kg, ${patient.height}cm
- Tipo de dieta: ${patient.dietType}
- Calorías objetivo: ${metrics.tee} kcal/día
- Patologías: ${conditionsText}
- Macros diarios: Proteínas ${metrics.macros.protein}g | HC ${metrics.macros.carbs}g | Grasas ${metrics.macros.fats}g
${customFoodsText}

Devuelve SOLO el JSON con la estructura indicada. Sin explicaciones.
`.trim();

  try {
    const text = await groqRequest(apiKey, MODEL_DIET, DIET_SYSTEM_PROMPT, userPrompt);
    if (!text) throw new Error('Sin respuesta de la IA');

    const parsed = JSON.parse(text) as DietResponse;

    // Validación mínima
    if (!parsed.weeklyPlan || parsed.weeklyPlan.length === 0) {
      throw new Error('El plan generado está vacío');
    }

    return parsed;
  } catch (error: any) {
    console.error('Error generating diet:', error);

    if (error.message?.includes('rate_limit')) {
      throw new Error('Límite de peticiones alcanzado. Espera 30 segundos e inténtalo de nuevo.');
    }
    if (error.message?.includes('API Key')) {
      throw new Error(error.message);
    }

    throw new Error('Error de conexión con el servidor de IA. Inténtalo de nuevo.');
  }
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
  "ingredients": ["string"],
  "instructions": ["string"],
  "tags": ["string"]
}

Devuelve el JSON como: { "recipes": [ ...array de recetas... ] }
`.trim();

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

  try {
    const text = await groqRequest(apiKey, MODEL_RECIPES, RECIPE_SYSTEM_PROMPT, userPrompt);
    const parsed = JSON.parse(text || '{"recipes":[]}');
    return (parsed.recipes ?? parsed) as Recipe[];
  } catch (error) {
    console.error('Error finding recipes:', error);
    return [];
  }
};
