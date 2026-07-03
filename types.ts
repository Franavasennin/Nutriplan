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
  Athlete = 'atleta',
  ProteinDAP4 = 'proteifine_dap4',
  ProteinDAP5 = 'proteifine_dap5',
  Precooked   = 'precocinados'
}

export enum AthleteGoal {
  Performance = 'rendimiento',
  Definition  = 'definicion',
  Volume      = 'volumen',
}

export const ATHLETE_GOAL_LABELS: Record<AthleteGoal, string> = {
  [AthleteGoal.Performance]: 'Rendimiento / Mantenimiento',
  [AthleteGoal.Definition]:  'Definición (déficit -350 kcal)',
  [AthleteGoal.Volume]:      'Volumen / Masa (superávit +400 kcal)',
};

// ─── Objetivo calórico (para todas las dietas excepto Atleta y DAP) ───────────
// Basado en: 7700 kcal ≈ 1 kg de tejido graso
// Déficit lento:  −250 kcal/día → ~1 kg/mes
// Déficit rápido: −500 kcal/día → ~2 kg/mes
// Superávit lento:  +200 kcal/día → ganancia muscular mínima de grasa
// Superávit rápido: +400 kcal/día → ganancia más rápida

export enum CalorieGoal {
  Maintenance  = 'mantenimiento',
  DeficitSlow  = 'deficit_lento',
  DeficitFast  = 'deficit_rapido',
  SurplusSlow  = 'superavit_lento',
  SurplusFast  = 'superavit_rapido',
}

export const CALORIE_GOAL_ADJUST: Record<CalorieGoal, number> = {
  [CalorieGoal.Maintenance]:  0,
  [CalorieGoal.DeficitSlow]:  -250,
  [CalorieGoal.DeficitFast]:  -500,
  [CalorieGoal.SurplusSlow]:  +200,
  [CalorieGoal.SurplusFast]:  +400,
};

export const CALORIE_GOAL_LABELS: Record<CalorieGoal, { title: string; subtitle: string; icon: string; color: string }> = {
  [CalorieGoal.DeficitFast]:  { title: 'Déficit Rápido', subtitle: '−500 kcal · ~2 kg/mes', icon: 'keyboard_double_arrow_down', color: 'blue' },
  [CalorieGoal.DeficitSlow]:  { title: 'Déficit Lento',  subtitle: '−250 kcal · ~1 kg/mes', icon: 'keyboard_arrow_down',        color: 'sky'  },
  [CalorieGoal.Maintenance]:  { title: 'Mantenimiento',  subtitle: '0 kcal',                  icon: 'balance',                    color: 'green'},
  [CalorieGoal.SurplusSlow]:  { title: 'Superávit Lento', subtitle: '+200 kcal',              icon: 'keyboard_arrow_up',          color: 'amber'},
  [CalorieGoal.SurplusFast]:  { title: 'Superávit Rápido', subtitle: '+400 kcal',             icon: 'keyboard_double_arrow_up',   color: 'orange'},
};

export enum FastingProtocol {
  None   = 'none',
  IF16_8 = '16:8',
  IF18_6 = '18:6',
  IF20_4 = '20:4',
  IF5_2  = '5:2',
}

// ─── Nivel de presupuesto (auditoría, mejora #12) ─────────────────────────────
// Sesga los alimentos que sugiere la IA hacia opciones más económicas o
// premium según el presupuesto real del cliente.
export enum BudgetLevel {
  Tight     = 'ajustado',
  Standard  = 'estandar',
  Unlimited = 'sin_limite',
}

export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, string> = {
  [BudgetLevel.Tight]:     'Ajustado',
  [BudgetLevel.Standard]:  'Estándar',
  [BudgetLevel.Unlimited]: 'Sin límite',
};

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
  Obesity = 'obesidad',
  // ─── Auditoría clínica: perfiles que requieren restricciones de seguridad ────
  RenalDisease = 'enfermedad_renal',           // ERC → cap de proteína (KDOQI)
  EatingDisorderHistory = 'antecedente_tca',   // antecedente TCA → sin déficit/ayuno automáticos
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
  excludedFoods?: string;   // comma-separated list of foods to avoid
  weeks?: number;           // number of weeks to generate (1-4)
  mealCount?: number;       // number of meals per day (2-5)
  fastingProtocol?: FastingProtocol; // intermittent fasting protocol
  targetWeight?: number;    // kg — client's weight goal
  athleteGoal?: AthleteGoal; // objetivo específico para dieta atleta
  calorieGoal?: CalorieGoal;  // objetivo calórico para dietas no-atleta
  trainingTime?: string;    // hora de entrenamiento HH:MM — solo dieta atleta
  clinicalNotes?: string;   // notas clínicas del nutricionista (no enviadas a la IA)
  // ─── Cribado de seguridad clínica (auditoría) ──────────────────────────────
  isPregnant?: boolean;     // embarazo — bloquea déficit calórico y ayuno automáticos
  isLactating?: boolean;    // lactancia — bloquea déficit calórico y ayuno automáticos
  // ─── Realimentación con composición corporal (auditoría, mejora #11) ──────
  // Última medición conocida de % graso (viene de ProgressTracker). Si está
  // presente, el peso de referencia para dosificar macros se calcula a
  // partir de masa magra + grasa medida, en vez de estimarla por IMC.
  bodyFatPercent?: number;
  budgetLevel?: BudgetLevel; // presupuesto del cliente — sesga los alimentos sugeridos
}

export interface CalculatedMetrics {
  imc: number;
  bmr: number; // Tasa Metabólica Basal
  tee: number; // Gasto Energético Total
  // Objetivos derivados de condiciones clínicas (auditoría). Opcional por
  // compatibilidad con dietas guardadas antes de esta mejora.
  targets?: {
    fiberG: number;      // fibra mínima recomendada (g/día)
    addedSugarG: number; // azúcares libres máximos (g/día)
    sodiumMg: number;    // sodio máximo (mg/día)
  };
  macros: {
    protein: number; // grams
    carbs: number; // grams
    fats: number; // grams
    calories: number;
  };
}

export interface Meal {
  name: string;
  description: string;
  ingredients: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export interface DayPlan {
  day: number;
  meals: {
    breakfast?:      Meal;
    morningSnack?:   Meal;
    lunch?:          Meal;
    afternoonSnack?: Meal;
    dinner?:         Meal;
  };
}

export interface DietResponse {
  weeklyPlan: DayPlan[];
  generalGuidelines: string[];
  durationText: string;
}

export interface PlanVersion {
  timestamp: number;
  plan: DietResponse;
}

export interface SavedDiet {
  id: string;
  timestamp: number;
  patientData: PatientData;
  metrics: CalculatedMetrics;
  plan: DietResponse;
  planVersions?: PlanVersion[]; // historial de versiones anteriores del plan
}

// ─── Dieta para parejas ───────────────────────────────────────────────────────
// Dos planes vinculados, cada uno con sus propios parámetros y macros.
export interface CouplesDiet {
  id: string;
  timestamp: number;
  personA: SavedDiet;
  personB: SavedDiet;
}

// ─── Diet type display labels ─────────────────────────────────────────────────

export const DIET_TYPE_LABELS: Record<DietType, string> = {
  [DietType.Balanced]:     'Equilibrada',
  [DietType.LowCarb]:      'Baja en Carbohidratos',
  [DietType.Keto]:         'Cetogénica',
  [DietType.Vegetarian]:   'Vegetariana',
  [DietType.Vegan]:        'Vegana',
  [DietType.Mediterranean]:'Mediterránea',
  [DietType.Paleo]:        'Paleo',
  [DietType.Protein]:      'Proteica',
  [DietType.Athlete]:      'Atleta',
  [DietType.Precooked]:    'Sin cocina (conservas y precocinados)',
  [DietType.ProteinDAP4]:  'Protéifine DAP 4',
  [DietType.ProteinDAP5]:  'Protéifine DAP 5',
};

export const FASTING_LABELS: Record<FastingProtocol, string> = {
  [FastingProtocol.None]:   'Sin ayuno',
  [FastingProtocol.IF16_8]: 'Ayuno 16:8 (comer 12:00–20:00)',
  [FastingProtocol.IF18_6]: 'Ayuno 18:6 (comer 13:00–19:00)',
  [FastingProtocol.IF20_4]: 'Ayuno 20:4 (comer 14:00–18:00)',
  [FastingProtocol.IF5_2]:  'Ayuno 5:2 (2 días 500 kcal/semana)',
};

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
  imc?: number;             // IMC calculado o introducido
  bodyFat?: number;         // % grasa corporal
  waterPercent?: number;    // % agua
  proteinPercent?: number;  // % proteína
  basalMetabolism?: number; // metabolismo basal (kcal)
  muscleMass?: number;      // masa muscular (kg)
  visceralFat?: number;     // grasa visceral (nivel 1-20)
  boneMass?: number;        // masa ósea (kg)
  notes?: string;
}

export interface ClientProgress {
  clientName: string;
  entries: ProgressEntry[];
  weightGoal?: number;  // kg — objetivo de peso
  goalDate?: number;    // timestamp — fecha objetivo
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
