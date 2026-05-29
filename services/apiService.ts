/**
 * apiService.ts — Frontend client for the NutriPlan Express/PostgreSQL backend.
 * All calls go through Vite's /api proxy → localhost:3001.
 * Every function returns null/false on network error so the caller can fall back to localStorage.
 */
import { SavedDiet, CustomFood, ClientProgress, PatientData, CalculatedMetrics, DietResponse, ProgressEntry, Recipe } from '../types';

const BASE = '/api';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function patch(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function put(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function del(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true && data?.db === 'connected';
  } catch {
    return false;
  }
}

// ─── Diets ───────────────────────────────────────────────────────────────────

export async function fetchDiets(): Promise<SavedDiet[] | null> {
  return get<SavedDiet[]>('/diets');
}

export async function saveDietToDb(diet: SavedDiet): Promise<boolean> {
  return post('/diets', {
    id:          diet.id,
    timestamp:   diet.timestamp,
    patientData: diet.patientData,
    metrics:     diet.metrics,
    plan:        diet.plan,
  });
}

export async function updateDietPlanInDb(id: string, plan: DietResponse): Promise<boolean> {
  return patch(`/diets/${id}/plan`, { plan });
}

export async function updateFullDietInDb(
  id: string,
  patientData: PatientData,
  metrics: CalculatedMetrics,
  plan: DietResponse
): Promise<boolean> {
  return patch(`/diets/${id}/full`, { patientData, metrics, plan });
}

export async function updatePatientDataInDb(id: string, data: Partial<PatientData>): Promise<boolean> {
  return patch(`/diets/${id}/patient`, { patientData: data });
}

export async function deleteDietFromDb(id: string): Promise<boolean> {
  return del(`/diets/${id}`);
}

export async function bulkImportDiets(diets: SavedDiet[]): Promise<boolean> {
  return post('/diets/bulk', { diets });
}

// ─── Foods ────────────────────────────────────────────────────────────────────

export async function fetchFoods(): Promise<CustomFood[] | null> {
  return get<CustomFood[]>('/foods');
}

export async function saveFoodToDb(food: CustomFood): Promise<boolean> {
  return post('/foods', food);
}

export async function deleteFoodFromDb(id: string): Promise<boolean> {
  return del(`/foods/${id}`);
}

export async function bulkImportFoods(foods: CustomFood[]): Promise<boolean> {
  return post('/foods/bulk', { foods });
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function fetchProgress(): Promise<ClientProgress[] | null> {
  return get<ClientProgress[]>('/progress');
}

export async function saveProgressEntryToDb(clientName: string, entry: ProgressEntry): Promise<boolean> {
  return post(`/progress/${encodeURIComponent(clientName)}/entry`, { entry });
}

export async function replaceClientProgressInDb(clientName: string, entries: ProgressEntry[]): Promise<boolean> {
  return put(`/progress/${encodeURIComponent(clientName)}`, { entries });
}

export async function bulkImportProgress(progress: ClientProgress[]): Promise<boolean> {
  return post('/progress/bulk', { progress });
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export async function fetchRecipesFromDb(): Promise<Recipe[] | null> {
  return get<Recipe[]>('/recipes');
}

export async function saveRecipeToDb(recipe: Recipe): Promise<boolean> {
  return post('/recipes', recipe);
}

export async function deleteRecipeFromDb(id: string): Promise<boolean> {
  return del(`/recipes/${id}`);
}

export async function bulkImportRecipes(recipes: Recipe[]): Promise<boolean> {
  return post('/recipes/bulk', { recipes });
}
