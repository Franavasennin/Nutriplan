import { PatientData, Gender, ActivityLevel, CalculatedMetrics, DietType } from '../types';

export const calculateIMC = (weight: number, height: number): number => {
  const heightInMeters = height / 100;
  return parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(2));
};

// OMS-FAO Equations for BMR (Basal Metabolic Rate)
export const calculateBMR = (data: PatientData): number => {
  const { age, gender, weight } = data;
  let bmr = 0;

  if (gender === Gender.Male) {
    if (age < 3) bmr = 60.9 * weight - 54;
    else if (age < 10) bmr = 22.7 * weight + 495;
    else if (age < 18) bmr = 17.5 * weight + 651;
    else if (age < 30) bmr = 15.3 * weight + 679;
    else if (age < 60) bmr = 11.6 * weight + 879;
    else bmr = 13.5 * weight + 487;
  } else {
    if (age < 3) bmr = 61.0 * weight - 51;
    else if (age < 10) bmr = 22.5 * weight + 499;
    else if (age < 18) bmr = 12.2 * weight + 746;
    else if (age < 30) bmr = 14.7 * weight + 496;
    else if (age < 60) bmr = 8.7 * weight + 829;
    else bmr = 10.5 * weight + 596;
  }

  return Math.round(bmr);
};

export const getActivityFactor = (level: ActivityLevel): number => {
  switch (level) {
    case ActivityLevel.Sedentary: return 1.2;
    case ActivityLevel.Light: return 1.375;
    case ActivityLevel.Moderate: return 1.55;
    case ActivityLevel.Heavy: return 1.725;
    case ActivityLevel.Athlete: return 1.9;
    default: return 1.2;
  }
};

export const calculateTEE = (bmr: number, activityLevel: ActivityLevel): number => {
  const activityFactor = getActivityFactor(activityLevel);
  // Formula requested: Gasto Energético Basal x Coeficiente Actividad + Actividad Metabolismo Basal
  // Interpreting "Actividad Metabolismo Basal" as the Thermic Effect of Food (TEF/SDA), usually ~10% of BMR
  const tef = bmr * 0.10; 
  return Math.round((bmr * activityFactor) + tef);
};

export const calculateMacros = (tee: number, dietType: DietType) => {
  let proteinRatio = 0.15;
  let fatRatio = 0.30;
  let carbRatio = 0.55;

  switch (dietType) {
    case DietType.Keto:
      proteinRatio = 0.25;
      fatRatio = 0.70;
      carbRatio = 0.05;
      break;
    case DietType.LowCarb:
      proteinRatio = 0.30;
      fatRatio = 0.40;
      carbRatio = 0.30;
      break;
    case DietType.Protein:
      proteinRatio = 0.40;
      fatRatio = 0.30;
      carbRatio = 0.30;
      break;
    case DietType.Athlete:
      proteinRatio = 0.25;
      fatRatio = 0.25;
      carbRatio = 0.50;
      break;
    // Standard balanced ratios for others
    default:
      break;
  }

  return {
    protein: Math.round((tee * proteinRatio) / 4), // 4 kcal/g
    fats: Math.round((tee * fatRatio) / 9),        // 9 kcal/g
    carbs: Math.round((tee * carbRatio) / 4),      // 4 kcal/g
    calories: tee
  };
};
