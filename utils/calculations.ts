import { PatientData, Gender, ActivityLevel, DietType, AthleteGoal, Condition, CalorieGoal, CALORIE_GOAL_ADJUST, CalculatedMetrics } from '../types';
import { RENAL_PROTEIN_CAP_G_PER_KG } from './clinicalSafety';
import { getClinicalTargets } from './clinicalTargets';

// ─── IMC ──────────────────────────────────────────────────────────────────────

export const calculateIMC = (weight: number, height: number): number => {
  const h = height / 100;
  return parseFloat((weight / (h * h)).toFixed(2));
};

export type IMCCategory =
  | 'Bajo peso'
  | 'Normopeso'
  | 'Sobrepeso'
  | 'Obesidad grado I'
  | 'Obesidad grado II'
  | 'Obesidad grado III';

export const getIMCCategory = (imc: number): IMCCategory => {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25)   return 'Normopeso';
  if (imc < 30)   return 'Sobrepeso';
  if (imc < 35)   return 'Obesidad grado I';
  if (imc < 40)   return 'Obesidad grado II';
  return 'Obesidad grado III';
};

// ─── Peso de referencia saludable (OMS — punto medio del rango de IMC) ────────
// Sustituye a la antigua fórmula de Lorentz (1929, sin base fisiológica
// moderna). Usa el punto medio del rango de IMC saludable de la OMS que la
// app ya emplea para clasificar el IMC (18.5–24.9 → punto medio ≈ 21.7),
// coherente con el resto del sistema (auditoría, mejora #10). Los cortes de
// IMC de la OMS son los mismos para ambos sexos; `gender` se conserva en la
// firma por compatibilidad con las llamadas existentes.
const HEALTHY_BMI_MIDPOINT = 21.7;

export const calculateIdealWeight = (height: number, _gender: Gender): number => {
  const h = height / 100;
  return parseFloat((HEALTHY_BMI_MIDPOINT * h * h).toFixed(1));
};

// ─── Peso ajustado (para obesidad — cálculos de macro y dosis) ────────────────
// Solo aplicar cuando IMC > 30. Usa peso ideal como base.

export const calculateAdjustedWeight = (
  actualWeight: number,
  idealWeight: number
): number => {
  return parseFloat((idealWeight + 0.25 * (actualWeight - idealWeight)).toFixed(1));
};

// ─── Peso ajustado a partir de composición corporal MEDIDA (auditoría #11) ────
// Cuando se conoce el % de grasa corporal real (báscula de bioimpedancia,
// pliegues, DEXA...) esta es una estimación más precisa que la basada en IMC:
// usa la masa magra real + el mismo factor de seguridad 0.25 sobre la masa
// grasa real que ya se aplicaba sobre el "exceso estimado" en la fórmula de
// obesidad por IMC. Detecta también la "obesidad sarcopénica" (IMC normal
// pero % graso alto), que el IMC por sí solo no revela.
export const calculateAdjustedWeightFromBodyFat = (
  weightKg: number,
  bodyFatPercent: number
): number => {
  const fatMassKg  = weightKg * (bodyFatPercent / 100);
  const leanMassKg = weightKg - fatMassKg;
  return parseFloat((leanMassKg + 0.25 * fatMassKg).toFixed(1));
};

// ─── BMR — Ecuaciones OMS-FAO ─────────────────────────────────────────────────

export const calculateBMR = (data: PatientData): number => {
  const { age, gender, weight } = data;
  let bmr = 0;

  if (gender === Gender.Male) {
    if (age < 3)        bmr = 60.9  * weight - 54;
    else if (age < 10)  bmr = 22.7  * weight + 495;
    else if (age < 18)  bmr = 17.5  * weight + 651;
    else if (age < 30)  bmr = 15.3  * weight + 679;
    else if (age < 60)  bmr = 11.6  * weight + 879;
    else                bmr = 13.5  * weight + 487;
  } else {
    if (age < 3)        bmr = 61.0  * weight - 51;
    else if (age < 10)  bmr = 22.5  * weight + 499;
    else if (age < 18)  bmr = 12.2  * weight + 746;
    else if (age < 30)  bmr = 14.7  * weight + 496;
    else if (age < 60)  bmr = 8.7   * weight + 829;
    else                bmr = 10.5  * weight + 596;
  }

  return Math.round(bmr);
};

// ─── Factor de actividad ──────────────────────────────────────────────────────

export const getActivityFactor = (level: ActivityLevel): number => {
  switch (level) {
    case ActivityLevel.Sedentary: return 1.2;
    case ActivityLevel.Light:     return 1.375;
    case ActivityLevel.Moderate:  return 1.55;
    case ActivityLevel.Heavy:     return 1.725;
    case ActivityLevel.Athlete:   return 1.9;
    default:                      return 1.2;
  }
};

// ─── GET (Gasto Energético Total) ─────────────────────────────────────────────
// CORRECCIÓN: Los factores OMS-FAO ya incorporan el efecto térmico de los
// alimentos (TEF ~10%). No debe sumarse por separado — la versión anterior
// lo contabilizaba dos veces.

export const calculateTEE = (bmr: number, activityLevel: ActivityLevel): number => {
  return Math.round(bmr * getActivityFactor(activityLevel));
};

// ─── Distribución de macronutrientes ─────────────────────────────────────────
// Proteína calculada desde g/kg de peso de referencia (estándar clínico).
// El resto de calorías se distribuye entre grasa y carbohidratos según la dieta.

interface MacroDef {
  proteinGPerKg: number;       // g proteína por kg de peso de referencia
  fatOfRemaining: number;      // fracción de (kcal_restantes tras proteína) → grasa
  kcalAdjust?: number;         // ajuste calórico respecto al GET (déficit/superávit)
}

// ─── Distribución de macros por tipo de dieta ─────────────────────────────────
// proteinGPerKg: g proteína por kg de peso de referencia (ESPEN / NAM guidelines).
// fatOfRemaining: fracción de (kcal restantes tras proteína) que van a grasa.
//   → El resto va a carbohidratos.
//
// Revisión clínica de cada tipo:
//   Equilibrada      P 20-25% / G 25-30% / HC 45-55%  → proteinGPerKg 1.4, fatOfRemaining 0.33
//   Mediterránea     P 18-22% / G 35-40% / HC 40-50%  → proteinGPerKg 1.3, fatOfRemaining 0.42
//   Baja en carbos   P 25-30% / G 40-50% / HC 20-30%  → proteinGPerKg 1.8, fatOfRemaining 0.58
//   Cetogénica       P 15-20% / G 70-75% / HC  5-10%  → proteinGPerKg 1.5, fatOfRemaining 0.82
//   Vegetariana      P 18-22% / G 25-30% / HC 45-55%  → proteinGPerKg 1.4, fatOfRemaining 0.33
//   Vegana           P 18-22% / G 25-30% / HC 45-55%  → proteinGPerKg 1.5, fatOfRemaining 0.30 (más proteína por biodisponibilidad vegetal)
//   Paleo            P 25-30% / G 35-45% / HC 25-35%  → proteinGPerKg 1.7, fatOfRemaining 0.48
//   Proteica         P 30-35% / G 25-30% / HC 35-40%  → proteinGPerKg 2.0, fatOfRemaining 0.38
//   Atleta           → sobrescrito por AthleteGoal
//   DAP4/5           → protocolos médicos Protéifine (sin cambio)

const MACRO_DEFS: Record<DietType, MacroDef> = {
  [DietType.Balanced]:      { proteinGPerKg: 1.4, fatOfRemaining: 0.33 }, // ~20%P / 27%G / 53%HC
  [DietType.Mediterranean]: { proteinGPerKg: 1.3, fatOfRemaining: 0.42 }, // ~20%P / 36%G / 44%HC — grasa principalmente AOVE+pescado
  [DietType.LowCarb]:       { proteinGPerKg: 1.8, fatOfRemaining: 0.58 }, // ~25%P / 42%G / 33%HC
  [DietType.Keto]:          { proteinGPerKg: 1.5, fatOfRemaining: 0.82 }, // ~18%P / 72%G / 10%HC
  [DietType.Vegetarian]:    { proteinGPerKg: 1.4, fatOfRemaining: 0.33 }, // igual que equilibrada, fuentes vegetales
  [DietType.Vegan]:         { proteinGPerKg: 1.5, fatOfRemaining: 0.30 }, // +0.1g/kg por menor biodisponibilidad proteica vegetal
  [DietType.Paleo]:         { proteinGPerKg: 1.7, fatOfRemaining: 0.48 }, // ~28%P / 38%G / 34%HC
  [DietType.Protein]:       { proteinGPerKg: 2.0, fatOfRemaining: 0.38 }, // ~32%P / 28%G / 40%HC
  [DietType.Athlete]:       { proteinGPerKg: 2.0, fatOfRemaining: 0.25 }, // base — sobrescrito por AthleteGoal
  [DietType.ProteinDAP4]:   { proteinGPerKg: 1.6, fatOfRemaining: 0.45 }, // protocolo médico Protéifine
  [DietType.ProteinDAP5]:   { proteinGPerKg: 1.5, fatOfRemaining: 0.40 }, // protocolo médico Protéifine
  [DietType.Precooked]:     { proteinGPerKg: 1.4, fatOfRemaining: 0.33 }, // sin cocina — distribución equilibrada con conservas
};

// Macros específicos por objetivo atleta (sobrescriben el valor base de DietType.Athlete)
const ATHLETE_GOAL_DEFS: Record<AthleteGoal, MacroDef> = {
  // Rendimiento: mantenimiento calórico, carbos altos para combustible. 28% grasa protege hormonas en mujeres activas.
  [AthleteGoal.Performance]: { proteinGPerKg: 2.0, fatOfRemaining: 0.28, kcalAdjust:    0 },
  // Definición: déficit moderado, proteína alta para preservar músculo
  [AthleteGoal.Definition]:  { proteinGPerKg: 2.3, fatOfRemaining: 0.30, kcalAdjust: -350 },
  // Volumen: superávit controlado, proteína alta para síntesis muscular
  [AthleteGoal.Volume]:      { proteinGPerKg: 2.2, fatOfRemaining: 0.25, kcalAdjust: +400 },
};

// referenceWeightKg: peso ajustado si IMC > 30, peso real si no.
// imc:         si > 30 y no hay calorieGoal explícito → déficit auto de −450 kcal.
// conditions:  RenalDisease → cap de proteína; DiabetesType2 → cap de grasa relajado (ver abajo).
// calorieGoal: objetivo calórico explícito del usuario (sobreescribe el auto-déficit de obesidad).
// safety:      perfil vulnerable (menor / embarazo / lactancia) → fuerza mantenimiento,
//              tiene prioridad sobre cualquier objetivo de déficit/superávit (incluido atleta).
export const calculateMacros = (
  tee: number,
  dietType: DietType,
  referenceWeightKg: number,
  athleteGoal?: AthleteGoal,
  imc?: number,
  conditions?: Condition[],
  calorieGoal?: CalorieGoal,
  safety?: { isMinor?: boolean; isPregnant?: boolean; isLactating?: boolean }
) => {
  const isAthlete = dietType === DietType.Athlete && !!athleteGoal;
  const def = isAthlete
    ? ATHLETE_GOAL_DEFS[athleteGoal!]
    : (MACRO_DEFS[dietType] ?? MACRO_DEFS[DietType.Balanced]);

  const MIN_CALORIES    = 1500;
  const OBESITY_DEFICIT = 450; // kcal — déficit clínico estándar para IMC > 30

  // ── Seguridad clínica: perfil vulnerable → sin déficit/superávit automático ──
  // (auditoría) Menores, embarazo y lactancia no deben recibir restricción
  // energética automática. Tiene prioridad sobre el ajuste de atleta y sobre
  // cualquier calorieGoal explícito.
  const isVulnerable = !!safety?.isMinor || !!safety?.isPregnant || !!safety?.isLactating;

  // ── Ajuste calórico ─────────────────────────────────────────────────────────
  let kcalAdjust: number;

  if (isVulnerable) {
    kcalAdjust = 0; // mantenimiento forzado por seguridad clínica
  } else if (isAthlete) {
    // Atleta: el ajuste lo define AthleteGoal (rendimiento/definición/volumen)
    kcalAdjust = def.kcalAdjust ?? 0;
  } else if (calorieGoal !== undefined && calorieGoal !== CalorieGoal.Maintenance) {
    // El usuario seleccionó un objetivo calórico explícito → respetarlo siempre
    kcalAdjust = CALORIE_GOAL_ADJUST[calorieGoal];
  } else if (imc !== undefined && imc > 30) {
    // Sin objetivo explícito + obesidad → déficit automático de seguridad
    kcalAdjust = -OBESITY_DEFICIT;
  } else {
    kcalAdjust = 0; // mantenimiento
  }

  const targetCalories = Math.max(tee + kcalAdjust, MIN_CALORIES);

  let protein = Math.round(def.proteinGPerKg * referenceWeightKg);
  const remaining = Math.max(targetCalories - protein * 4, 0);
  let fats  = Math.round(remaining * def.fatOfRemaining / 9);
  let carbs = Math.round(remaining * (1 - def.fatOfRemaining) / 4);

  // ── Diabetes tipo 2: relajar el cap de grasa a 35% (evidencia ADA/EASD) ─────
  // Antes: cap a 28% con TODO el excedente movido a proteína, sin techo.
  // Corrección (auditoría): un techo de grasa tan bajo va por detrás de la
  // evidencia actual (los patrones mediterráneo / bajo en carbohidratos con
  // grasa MUFA alta son opciones válidas y a menudo preferibles para el
  // control glucémico — ADA Standards of Care, EASD). Además, mover TODO el
  // excedente a proteína sin límite es arriesgado en pacientes con nefropatía
  // diabética no diagnosticada (frecuente y silente en DM2). Ahora: cap a 35%
  // (coherente con patrón mediterráneo) y el excedente se reparte entre
  // proteína (con techo de seguridad 2.0 g/kg) y carbohidratos, en vez de ir
  // todo a proteína.
  if (conditions?.includes(Condition.DiabetesType2)) {
    const maxFatG = Math.floor(targetCalories * 0.35 / 9);
    if (fats > maxFatG) {
      const savedCals = (fats - maxFatG) * 9;
      fats = maxFatG;
      const proteinCeilingG = Math.round(2.0 * referenceWeightKg);
      const proteinRoom  = Math.max(0, proteinCeilingG - protein);
      const proteinAddG  = Math.min(proteinRoom, Math.round(savedCals / 4 * 0.5));
      protein += proteinAddG;
      const usedCals = proteinAddG * 4;
      carbs += Math.round((savedCals - usedCals) / 4);
    }
  }

  // ── Enfermedad renal / ERC: cap de proteína (KDOQI ~0.8 g/kg en ERC no dialítica) ──
  // Se aplica DESPUÉS de cualquier redistribución (incluida la de diabetes T2)
  // porque es una restricción de seguridad que prevalece sobre el resto.
  if (conditions?.includes(Condition.RenalDisease)) {
    const maxProteinG = Math.round(RENAL_PROTEIN_CAP_G_PER_KG * referenceWeightKg);
    if (protein > maxProteinG) {
      const savedCals = (protein - maxProteinG) * 4;
      protein = maxProteinG;
      // El excedente se reparte a carbohidratos y grasa según la proporción de la dieta
      carbs += Math.round(savedCals * (1 - def.fatOfRemaining) / 4);
      fats  += Math.round(savedCals * def.fatOfRemaining / 9);
    }
  }

  return { protein, fats, carbs, calories: targetCalories };
};

// ─── Ingesta hídrica diaria ───────────────────────────────────────────────────
// Base: 35 ml/kg. Ajuste: +500 ml por nivel de actividad moderado/intenso.

export const calculateDailyWater = (weight: number, activity: ActivityLevel): number => {
  const base = weight * 35; // ml
  const activityBonus =
    activity === ActivityLevel.Moderate ? 500 :
    activity === ActivityLevel.Heavy    ? 750 :
    activity === ActivityLevel.Athlete  ? 1000 : 0;
  return Math.round((base + activityBonus) / 100) * 100; // redondeado a 100ml
};

// ─── Ratio cintura / talla (RCT) ─────────────────────────────────────────────
// Indicador de riesgo cardiometabólico. Umbrales alineados con NICE (guía
// pública de salud, Reino Unido): el punto de corte accionable es 0.5 — por
// debajo se considera riesgo bajo y NO debe mostrarse como "moderado" (la
// versión anterior marcaba como riesgo intermedio valores objetivamente
// saludables, un mensaje innecesariamente alarmista — corrección auditoría).
// < 0.5              → Bajo riesgo (rango saludable)
// 0.5 – 0.59         → Riesgo aumentado (valorar cambios de hábitos)
// ≥ 0.6              → Riesgo alto (recomendable valoración clínica)

export const calculateWaistHeightRatio = (waistCm: number, heightCm: number): number => {
  return parseFloat((waistCm / heightCm).toFixed(3));
};

export type WaistRiskLevel = 'Bajo' | 'Aumentado' | 'Alto';

export const getWaistRisk = (ratio: number): WaistRiskLevel => {
  if (ratio < 0.50) return 'Bajo';
  if (ratio < 0.60) return 'Aumentado';
  return 'Alto';
};

// ─── Resumen completo de métricas ─────────────────────────────────────────────
// Función de conveniencia que devuelve todo en una sola llamada.

export interface ExtendedMetrics {
  imc: number;
  imcCategory: IMCCategory;
  bmr: number;
  tee: number;
  idealWeight: number;
  adjustedWeight: number | null; // null si IMC ≤ 30
  dailyWater: number; // ml
  macros: {
    protein: number;
    fats: number;
    carbs: number;
    calories: number;
  };
}

export const calculateAllMetrics = (data: PatientData): ExtendedMetrics => {
  const imc            = calculateIMC(data.weight, data.height);
  const imcCategory    = getIMCCategory(imc);
  const bmr            = calculateBMR(data);
  const tee            = calculateTEE(bmr, data.activity);
  const idealWeight    = calculateIdealWeight(data.height, data.gender);
  const adjustedWeight = imc > 30 ? calculateAdjustedWeight(data.weight, idealWeight) : null;
  const refWeight      = adjustedWeight ?? data.weight;
  const macros         = calculateMacros(tee, data.dietType, refWeight, data.athleteGoal, imc, data.conditions, data.calorieGoal, {
    isMinor: data.age < 18, isPregnant: data.isPregnant, isLactating: data.isLactating,
  });
  const dailyWater     = calculateDailyWater(data.weight, data.activity);

  return { imc, imcCategory, bmr, tee, idealWeight, adjustedWeight, dailyWater, macros };
};

// ─── Métricas completas para generación de plan (Pareja Inteligente) ─────────
// Extraída de App.tsx (donde vivía como función local `computeMetrics`) para
// que components/AddPartnerModal.tsx la reutilice sin depender de App.tsx ni
// duplicar la composición IMC→peso de referencia→BMR→TEE→macros→targets.
// App.tsx sigue siendo el único punto que la invoca para el paciente
// principal; esta es la MISMA función, solo movida de sitio.
export const computeMetrics = (data: PatientData): CalculatedMetrics => {
  const imc         = calculateIMC(data.weight, data.height);
  const bmr         = calculateBMR(data);
  const tee         = calculateTEE(bmr, data.activity);
  const idealWeight = calculateIdealWeight(data.height, data.gender);
  const refWeight   = data.bodyFatPercent != null
    ? calculateAdjustedWeightFromBodyFat(data.weight, data.bodyFatPercent)
    : (imc > 30 ? calculateAdjustedWeight(data.weight, idealWeight) : data.weight);
  const macros      = calculateMacros(tee, data.dietType, refWeight, data.athleteGoal, imc, data.conditions, data.calorieGoal, {
    isMinor: data.age < 18, isPregnant: data.isPregnant, isLactating: data.isLactating,
  });
  const clinicalTargets = getClinicalTargets(data, macros.calories);
  return {
    imc, bmr, tee, macros,
    targets: { fiberG: clinicalTargets.fiberGMin, addedSugarG: clinicalTargets.addedSugarGMax, sodiumMg: clinicalTargets.sodiumMgMax },
  };
};
