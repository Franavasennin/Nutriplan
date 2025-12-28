import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CalculatedMetrics, PatientData, DietResponse, Condition, CustomFood, RecipeFilters, Recipe } from '../types';

const getSystemInstruction = () => `
  Eres un nutricionista experto. Tu objetivo es generar planes nutricionales CLÍNICOS de forma rápida y eficiente.
  
  REGLA DE ORO DE VELOCIDAD:
  - Sé extremadamente conciso. 
  - Las descripciones de las comidas deben tener un máximo de 15 palabras.
  - No repitas información obvia.
  - Ve directo a los ingredientes y la preparación básica.
  
  ESTILO:
  Usa términos prácticos españoles (Mercadona, Hacendado, medidas caseras).
  
  CONDICIONES MÉDICAS:
  Ajusta estrictamente según las patologías (Diabetes, Hipertensión, etc.) sin explicaciones largas.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    durationText: { type: Type.STRING },
    generalGuidelines: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }
    },
    weeklyPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.INTEGER },
          meals: {
            type: Type.OBJECT,
            required: ["breakfast", "morningSnack", "lunch", "afternoonSnack", "dinner"],
            properties: {
              breakfast: { 
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              },
              morningSnack: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } } } },
              lunch: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } } } },
              afternoonSnack: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } } } },
              dinner: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } } } }
            }
          }
        }
      }
    }
  }
};

export const generateDietPlan = async (
  patient: PatientData, 
  metrics: CalculatedMetrics,
  customFoods: CustomFood[] = []
): Promise<DietResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key no encontrada");

  const ai = new GoogleGenAI({ apiKey });

  const conditionsText = (patient.conditions && patient.conditions.length > 0)
    ? patient.conditions.join(", ") 
    : "Ninguna";

  const customFoodsText = customFoods.length > 0
    ? `\nUsa estos alimentos si encajan: ${customFoods.map(f => f.name).join(', ')}`
    : '';

  const prompt = `
    Genera Dieta Concisa:
    - Paciente: ${patient.age} años, ${patient.gender}, ${patient.weight}kg, ${patient.height}cm.
    - Objetivo: ${patient.dietType} con ${metrics.tee}kcal.
    - Patologías: ${conditionsText}.
    - Macros: P:${metrics.macros.protein}g, HC:${metrics.macros.carbs}g, G:${metrics.macros.fats}g.
    ${customFoodsText}

    REQUISITOS:
    1. Genera exactamente 7 días.
    2. Cada día DEBE tener las 5 tomas (breakfast, morningSnack, lunch, afternoonSnack, dinner).
    3. Descripciones de máximo 12 palabras para mayor velocidad.
    4. El JSON debe ser estricto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: getSystemInstruction(),
        // DESACTIVAMOS EL PENSAMIENTO PARA MÁXIMA VELOCIDAD
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sin respuesta de la IA");
    return JSON.parse(text) as DietResponse;
  } catch (error) {
    console.error("Error generating diet:", error);
    throw new Error("Error de conexión con el servidor de IA. Inténtalo de nuevo.");
  }
};

export const findRecipes = async (filters: RecipeFilters): Promise<Recipe[]> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });
  
    const recipeSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          prepTime: { type: Type.INTEGER },
          calories: { type: Type.INTEGER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    };
  
    const prompt = `Busca 6 recetas breves de ${filters.query || 'comida saludable'} para ${filters.mealType}. Máximo ${filters.maxCalories || 600}kcal.`;
  
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: recipeSchema,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return JSON.parse(response.text || '[]') as Recipe[];
    } catch (error) {
      return [];
    }
  };