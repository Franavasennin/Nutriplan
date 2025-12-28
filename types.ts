export enum Gender {
  Male = 'hombre',
  Female = 'mujer'
}

export enum ActivityLevel {
  Sedentary = 'sedentario', // 1.2
  Light = 'ligero', // 1.375
  Moderate = 'moderado', // 1.55
  Heavy = 'intenso', // 1.725
  Athlete = 'muy_intenso' // 1.9
}

export enum DietType {
  Balanced = 'equilibrada',
  LowCarb = 'baja_en_carbohidratos',
  Keto = 'cetogenica',
  Vegetarian = 'vegetariana',
  Vegan = 'vegana',
  Mediterranean = 'mediterranea',
  Paleo = 'paleo',
  Protein = 'proteica',
  Athlete = 'atleta'
}

export enum Condition {
  None = 'ninguna',
  DiabetesType1 = 'diabetes_t1',
  DiabetesType2 = 'diabetes_t2',
  Hypertension = 'hipertension',
  Hypothyroidism = 'hipotiroidismo',
  Hyperthyroidism = 'hipertiroidismo',
  LactoseIntolerance = 'intolerancia_lactosa',
  Hypertriglyceridemia = 'hipertrigliceridemia',
  Celiac = 'celiaquia',
  Obesity = 'obesidad'
}

export enum Duration {
  OneMonth = '1_mes',
  SixMonths = '6_meses'
}

export interface PatientData {
  age: number;
  gender: Gender;
  weight: number; // kg
  height: number; // cm
  activity: ActivityLevel;
  conditions: Condition[];
  dietType: DietType;
  duration: Duration;
  name?: string;
}

export interface CalculatedMetrics {
  imc: number;
  bmr: number; // Tasa Metabólica Basal
  tee: number; // Gasto Energético Total
  macros: {
    protein: number; // grams
    carbs: number; // grams
    fats: number; // grams
    calories: number;
  };
}

export interface Meal {
  name: string; // "Desayuno", "Almuerzo", etc.
  description: string;
  ingredients: string[];
  calories?: number;
}

export interface DayPlan {
  day: number;
  meals: {
    breakfast: Meal;
    morningSnack: Meal;
    lunch: Meal;
    afternoonSnack: Meal;
    dinner: Meal;
  };
}

export interface DietResponse {
  weeklyPlan: DayPlan[]; // Representative week
  generalGuidelines: string[];
  durationText: string;
}

export interface SavedDiet {
  id: string;
  timestamp: number;
  patientData: PatientData;
  metrics: CalculatedMetrics;
  plan: DietResponse;
}

// --- NEW TYPES FOR FEATURES ---

export interface CustomFood {
  id: string;
  name: string;
  brand?: string;
  calories: number; // per 100g or per portion
  protein: number;
  carbs: number;
  fats: number;
  portionSize: string; // e.g., "100g", "1 unidad"
}

export interface ProgressEntry {
  id: string;
  date: number; // timestamp
  weight: number;
  waist?: number;
  hip?: number;
  notes?: string;
}

export interface ClientProgress {
  clientName: string;
  entries: ProgressEntry[];
}

// --- RECIPE SEARCH TYPES ---

export enum MealType {
  Breakfast = 'desayuno',
  Lunch = 'almuerzo',
  Dinner = 'cena',
  Snack = 'merienda',
  Any = 'cualquiera'
}

export interface RecipeFilters {
  query: string;
  mealType: MealType;
  maxPrepTime: number; // minutes
  dietType: DietType | 'cualquiera';
  maxCalories?: number;
  excludeIngredients?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  prepTime: number; // minutes
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
}