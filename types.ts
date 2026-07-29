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

// ─── Alérgenos UE (Reglamento (UE) 1169/2011, Anexo II) ───────────────────────
// Sistema mínimo de alérgenos estructurados (auditoría iteración 001,
// MEJORA-001). Complementa a PatientData.excludedFoods (texto libre), no lo
// sustituye — un paciente puede tener alérgenos declarados Y exclusiones de
// texto libre adicionales (preferencias, no solo alergias).
export enum Allergen {
  Gluten = 'gluten',
  Crustaceos = 'crustaceos',
  Huevos = 'huevos',
  Pescado = 'pescado',
  Cacahuetes = 'cacahuetes',
  Soja = 'soja',
  Leche = 'leche',
  FrutosCascara = 'frutos_cascara',
  Apio = 'apio',
  Mostaza = 'mostaza',
  Sesamo = 'sesamo',
  Sulfitos = 'sulfitos',
  Altramuces = 'altramuces',
  Moluscos = 'moluscos',
}

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  [Allergen.Gluten]: 'Gluten (cereales)',
  [Allergen.Crustaceos]: 'Crustáceos',
  [Allergen.Huevos]: 'Huevos',
  [Allergen.Pescado]: 'Pescado',
  [Allergen.Cacahuetes]: 'Cacahuetes',
  [Allergen.Soja]: 'Soja',
  [Allergen.Leche]: 'Leche (lácteos)',
  [Allergen.FrutosCascara]: 'Frutos de cáscara (nueces, almendras...)',
  [Allergen.Apio]: 'Apio',
  [Allergen.Mostaza]: 'Mostaza',
  [Allergen.Sesamo]: 'Sésamo',
  [Allergen.Sulfitos]: 'Sulfitos',
  [Allergen.Altramuces]: 'Altramuces',
  [Allergen.Moluscos]: 'Moluscos',
};

// Palabras clave para detectar coincidencias en ingredientes de texto libre
// (lista de la compra). Coincidencia simple por substring, no NLP — ver
// docs/loop/iteracion-001/MEJORA-001.md, no-alcance.
export const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  [Allergen.Gluten]: ['trigo', 'harina', 'pan', 'pasta', 'cebada', 'centeno', 'avena', 'cuscús', 'seitan'],
  [Allergen.Crustaceos]: ['gamba', 'langostino', 'cangrejo', 'bogavante', 'langosta', 'camarón'],
  [Allergen.Huevos]: ['huevo'],
  [Allergen.Pescado]: ['pescado', 'salmón', 'atún', 'merluza', 'bacalao', 'sardina', 'caballa', 'anchoa', 'boquerón'],
  [Allergen.Cacahuetes]: ['cacahuete', 'maní'],
  [Allergen.Soja]: ['soja', 'tofu', 'edamame', 'tempeh'],
  [Allergen.Leche]: ['leche', 'queso', 'yogur', 'nata', 'mantequilla', 'requesón', 'lácteo'],
  [Allergen.FrutosCascara]: ['nuez', 'nueces', 'almendra', 'avellana', 'pistacho', 'anacardo', 'macadamia'],
  [Allergen.Apio]: ['apio'],
  [Allergen.Mostaza]: ['mostaza'],
  [Allergen.Sesamo]: ['sésamo', 'sesamo', 'tahini'],
  [Allergen.Sulfitos]: ['sulfito', 'vino', 'vinagre'],
  [Allergen.Altramuces]: ['altramuz', 'altramuces', 'lupino'],
  [Allergen.Moluscos]: ['mejillón', 'almeja', 'calamar', 'pulpo', 'sepia', 'ostra', 'vieira'],
};

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
  // ID estable del paciente (MEJORA-018, iteración 003 — hallazgo "los
  // pacientes no existen como entidad, solo un nombre en texto libre").
  // Se genera una vez al crear el cliente y se conserva en cada edición
  // (ver App.tsx handleFormSubmit). Vive dentro de patient_data (JSONB),
  // sin requerir migración de esquema. El seguimiento (progress_entries/
  // client_goals) sigue indexado por nombre en Supabase — vincularlo por
  // clientId de verdad requeriría añadir esa columna allí, propuesto en
  // docs/supabase/add_client_id_migration.sql (no aplicado, pendiente de
  // aprobación — mismo criterio que la migración de RLS).
  clientId?: string;
  // Consentimiento RGPD (iteración 003 — hallazgo "sin registro de
  // consentimiento para tratar datos de salud"). Vive en patient_data
  // (JSONB), igual que clientId, sin migración de esquema. Es una ayuda de
  // registro, no una certificación legal de cumplimiento RGPD completo
  // (eso exige revisión legal fuera del alcance de este cambio de código).
  gdprConsent?: { granted: boolean; consentedAt: number };
  excludedFoods?: string;   // comma-separated list of foods to avoid
  weeks?: number;           // number of weeks to generate (1-4)
  mealCount?: number;       // number of meals per day (2-5)
  fastingProtocol?: FastingProtocol; // intermittent fasting protocol
  targetWeight?: number;    // kg — client's weight goal
  athleteGoal?: AthleteGoal; // objetivo específico para dieta atleta
  calorieGoal?: CalorieGoal;  // objetivo calórico para dietas no-atleta
  trainingTime?: string;    // hora de entrenamiento HH:MM — solo dieta atleta
  clinicalNotes?: string;   // notas clínicas del nutricionista (no enviadas a la IA)
  // Pautas de la nutricionista sobre el plan ya generado (ej: "todos los
  // desayunos con pan integral"). A diferencia de clinicalNotes, ESTA SÍ se
  // envía a la IA — se persiste aquí para que toda regeneración futura
  // (día suelto o plan completo) la respete, no solo el ajuste puntual que
  // la creó. Prioridad siempre por debajo de exclusiones/alérgenos.
  planInstructions?: string;
  // ─── Cribado de seguridad clínica (auditoría) ──────────────────────────────
  isPregnant?: boolean;     // embarazo — bloquea déficit calórico y ayuno automáticos
  isLactating?: boolean;    // lactancia — bloquea déficit calórico y ayuno automáticos
  // ─── Realimentación con composición corporal (auditoría, mejora #11) ──────
  // Última medición conocida de % graso (viene de ProgressTracker). Si está
  // presente, el peso de referencia para dosificar macros se calcula a
  // partir de masa magra + grasa medida, en vez de estimarla por IMC.
  bodyFatPercent?: number;
  budgetLevel?: BudgetLevel; // presupuesto del cliente — sesga los alimentos sugeridos
  // ─── Alérgenos estructurados (auditoría iteración 001, MEJORA-001) ─────────
  allergens?: Allergen[];
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

// ─── Vínculo familiar/pareja (Pareja Inteligente) ────────────────────────────
// Un SavedDiet con linkedToId apunta a OTRO SavedDiet.id que actúa como
// "principal" (dueño de la estructura de comidas). Diseñado para N personas:
// cada pareja/familiar vinculado es una fila propia de saved_diets con
// linkedToId → mismo principal, sin límite a 2 ni tabla de relación aparte.
export type LinkedPersonRole = 'partner'; // futuro: 'child', 'family' — sin migración de esquema

export interface AppliedSubstitution {
  day: number;
  mealKey: string;
  original: string;  // ingrediente original, p.ej. "80g avena"
  replaced: string;   // ingrediente sustituido, p.ej. "80g quinoa"
  allergen: Allergen; // motivo de la sustitución
}

export interface SavedDiet {
  id: string;
  timestamp: number;
  patientData: PatientData;
  metrics: CalculatedMetrics;
  plan: DietResponse;
  planVersions?: PlanVersion[]; // historial de versiones anteriores del plan
  // ─── Campos de vínculo (solo presentes si esta fila ES una pareja/familiar) ──
  linkedToId?: string;          // id del SavedDiet principal
  linkedRole?: LinkedPersonRole;
  linkedSyncedAt?: number;      // última resincronización estructural con el principal
  lockedMeals?: string[];       // claves "<day>-<mealKey>" que NO se tocan al resincronizar
  substitutions?: AppliedSubstitution[]; // sustituciones por alergia del último escalado
}

// ─── Agenda / citas (iteración 003, hallazgo "sin sistema de citas") ─────────
// Tabla propia `appointments` en Supabase (docs/supabase/add_appointments_migration.sql,
// aplicada tras aprobación explícita) — a diferencia de adherencia/clientId, una
// cita es una entidad nueva sin campo JSONB existente donde encajarla.
export enum AppointmentStatus {
  Scheduled = 'scheduled',
  Done      = 'done',
  Cancelled = 'cancelled',
  NoShow    = 'no_show',
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Scheduled]: 'Programada',
  [AppointmentStatus.Done]:      'Realizada',
  [AppointmentStatus.Cancelled]: 'Cancelada',
  [AppointmentStatus.NoShow]:    'No asistió',
};

export interface Appointment {
  id: string;
  clientName: string;
  scheduledAt: number;      // timestamp (ms)
  durationMinutes: number;  // por defecto 30
  status: AppointmentStatus;
  notes?: string;
  createdAt: number;        // timestamp (ms)
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
  // ─── Alérgenos estructurados (auditoría iteración 001, MEJORA-001) ─────────
  // Opcional: el corpus existente no se rellena retroactivamente (WF-R,
  // fuera de alcance de esta mejora puntual).
  allergens?: Allergen[];
}
