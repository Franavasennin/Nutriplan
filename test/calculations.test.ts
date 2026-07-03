import { describe, it, expect } from 'vitest';
import {
  calculateIMC,
  getIMCCategory,
  calculateBMR,
  calculateTEE,
  getActivityFactor,
  calculateIdealWeight,
  calculateAdjustedWeight,
  calculateAdjustedWeightFromBodyFat,
  calculateDailyWater,
  calculateWaistHeightRatio,
  getWaistRisk,
  calculateAllMetrics,
  calculateMacros,
} from '../utils/calculations';
import {
  Gender,
  ActivityLevel,
  DietType,
  AthleteGoal,
  Condition,
  CalorieGoal,
} from '../types';

// ─── calculateIMC ─────────────────────────────────────────────────────────────

describe('calculateIMC', () => {
  it('calcula correctamente para peso y talla normales', () => {
    expect(calculateIMC(70, 175)).toBeCloseTo(22.86, 1);
  });

  it('calcula correctamente con sobrepeso', () => {
    expect(calculateIMC(90, 170)).toBeCloseTo(31.14, 1);
  });

  it('devuelve 2 decimales', () => {
    const result = calculateIMC(60, 160);
    expect(result.toString()).toMatch(/^\d+\.\d{1,2}$/);
  });
});

// ─── getIMCCategory ───────────────────────────────────────────────────────────

describe('getIMCCategory', () => {
  it('< 18.5 → Bajo peso', () => expect(getIMCCategory(17)).toBe('Bajo peso'));
  it('18.5–24.9 → Normopeso', () => expect(getIMCCategory(22)).toBe('Normopeso'));
  it('25–29.9 → Sobrepeso', () => expect(getIMCCategory(27)).toBe('Sobrepeso'));
  it('30–34.9 → Obesidad grado I', () => expect(getIMCCategory(32)).toBe('Obesidad grado I'));
  it('35–39.9 → Obesidad grado II', () => expect(getIMCCategory(37)).toBe('Obesidad grado II'));
  it('>= 40 → Obesidad grado III', () => expect(getIMCCategory(42)).toBe('Obesidad grado III'));
  it('límite exacto 18.5 → Normopeso', () => expect(getIMCCategory(18.5)).toBe('Normopeso'));
  it('límite exacto 25 → Sobrepeso', () => expect(getIMCCategory(25)).toBe('Sobrepeso'));
});

// ─── calculateBMR ─────────────────────────────────────────────────────────────

describe('calculateBMR', () => {
  const base = {
    age: 30,
    gender: Gender.Male,
    weight: 75,
    height: 175,
    activity: ActivityLevel.Moderate,
    conditions: [],
    dietType: DietType.Balanced,
    duration: '1_mes' as any,
  };

  it('hombre 30 años — ecuación OMS-FAO 30-60', () => {
    // age=30 falls in range age < 60: 11.6 × 75 + 879 = 870 + 879 = 1749
    expect(calculateBMR(base)).toBe(1749);
  });

  it('hombre 25 años — ecuación OMS-FAO 18-30', () => {
    const d = { ...base, age: 25 };
    // 15.3 × 75 + 679 = 1147.5 + 679 = 1826.5 → 1827
    expect(calculateBMR(d)).toBe(1827);
  });

  it('mujer 30 años — ecuación OMS-FAO 30-60', () => {
    const d = { ...base, gender: Gender.Female };
    // age=30 falls in range age < 60: 8.7 × 75 + 829 = 652.5 + 829 = 1481.5 → 1482
    expect(calculateBMR(d)).toBe(1482);
  });

  it('mujer 25 años — ecuación OMS-FAO 18-30', () => {
    const d = { ...base, gender: Gender.Female, age: 25 };
    // 14.7 × 75 + 496 = 1102.5 + 496 = 1598.5 → 1599
    expect(calculateBMR(d)).toBe(1599);
  });

  it('hombre mayor de 60', () => {
    const d = { ...base, age: 65 };
    // 13.5 × 75 + 487 = 1012.5 + 487 = 1499.5 → 1500
    expect(calculateBMR(d)).toBe(1500);
  });

  it('mujer menor de 18', () => {
    const d = { ...base, gender: Gender.Female, age: 16 };
    // 12.2 × 75 + 746 = 915 + 746 = 1661
    expect(calculateBMR(d)).toBe(1661);
  });

  it('devuelve entero (Math.round)', () => {
    expect(Number.isInteger(calculateBMR(base))).toBe(true);
  });
});

// ─── getActivityFactor ────────────────────────────────────────────────────────

describe('getActivityFactor', () => {
  it('Sedentario → 1.2',  () => expect(getActivityFactor(ActivityLevel.Sedentary)).toBe(1.2));
  it('Ligero → 1.375',   () => expect(getActivityFactor(ActivityLevel.Light)).toBe(1.375));
  it('Moderado → 1.55',  () => expect(getActivityFactor(ActivityLevel.Moderate)).toBe(1.55));
  it('Intenso → 1.725',  () => expect(getActivityFactor(ActivityLevel.Heavy)).toBe(1.725));
  it('Atleta → 1.9',     () => expect(getActivityFactor(ActivityLevel.Athlete)).toBe(1.9));
});

// ─── calculateTEE ─────────────────────────────────────────────────────────────

describe('calculateTEE', () => {
  it('multiplica BMR por factor correctamente', () => {
    expect(calculateTEE(1800, ActivityLevel.Moderate)).toBe(Math.round(1800 * 1.55));
  });

  it('devuelve entero', () => {
    expect(Number.isInteger(calculateTEE(1750, ActivityLevel.Light))).toBe(true);
  });
});

// ─── calculateIdealWeight ─────────────────────────────────────────────────────

describe('calculateIdealWeight', () => {
  it('180 cm → punto medio IMC OMS saludable (21.7 × 1.8²)', () => {
    expect(calculateIdealWeight(180, Gender.Male)).toBeCloseTo(21.7 * 1.8 * 1.8, 1);
  });

  it('165 cm → punto medio IMC OMS saludable (21.7 × 1.65²)', () => {
    expect(calculateIdealWeight(165, Gender.Female)).toBeCloseTo(21.7 * 1.65 * 1.65, 1);
  });

  it('unisex — mismo resultado para ambos sexos a igual altura', () => {
    expect(calculateIdealWeight(170, Gender.Male)).toBe(calculateIdealWeight(170, Gender.Female));
  });
});

// ─── calculateAdjustedWeight ──────────────────────────────────────────────────

describe('calculateAdjustedWeight', () => {
  it('ajusta correctamente', () => {
    // ideal=70, actual=100 → 70 + 0.25×30 = 77.5
    expect(calculateAdjustedWeight(100, 70)).toBe(77.5);
  });

  it('igual al ideal si no hay exceso', () => {
    expect(calculateAdjustedWeight(70, 70)).toBe(70);
  });
});

// ─── calculateAdjustedWeightFromBodyFat (auditoría #11) ──────────────────────

describe('calculateAdjustedWeightFromBodyFat', () => {
  it('80kg con 30% grasa → masa magra 56kg + 0.25×24kg grasa = 62kg', () => {
    expect(calculateAdjustedWeightFromBodyFat(80, 30)).toBe(62);
  });

  it('detecta obesidad sarcopénica: peso normal pero % graso alto reduce el peso de referencia', () => {
    // 70kg con 35% grasa (alto) → referencia baja considerablemente por debajo del peso real
    const result = calculateAdjustedWeightFromBodyFat(70, 35);
    expect(result).toBeLessThan(70);
  });

  it('% graso bajo (deportista) → peso de referencia cercano al peso real', () => {
    // 70kg, 10% grasa: masa magra 63kg + 0.25×7kg = 64.75kg (cercano a 70, no muy reducido)
    const result = calculateAdjustedWeightFromBodyFat(70, 10);
    expect(result).toBeCloseTo(64.75, 1);
    expect(result).toBeGreaterThan(60);
  });
});

// ─── calculateMacros ─────────────────────────────────────────────────────────

describe('calculateMacros', () => {
  it('dieta equilibrada — calorías = TEE sin ajuste', () => {
    const m = calculateMacros(2000, DietType.Balanced, 70);
    expect(m.calories).toBe(2000);
  });

  it('macros positivos en dieta equilibrada', () => {
    const m = calculateMacros(2000, DietType.Balanced, 70);
    expect(m.protein).toBeGreaterThan(0);
    expect(m.carbs).toBeGreaterThan(0);
    expect(m.fats).toBeGreaterThan(0);
  });

  it('atleta definición → déficit −350 kcal', () => {
    const m = calculateMacros(2500, DietType.Athlete, 75, AthleteGoal.Definition);
    expect(m.calories).toBe(2150);
  });

  it('atleta volumen → superávit +400 kcal', () => {
    const m = calculateMacros(2500, DietType.Athlete, 75, AthleteGoal.Volume);
    expect(m.calories).toBe(2900);
  });

  it('CalorieGoal.DeficitFast → −500 kcal', () => {
    const m = calculateMacros(2000, DietType.Balanced, 70, undefined, 22, [], CalorieGoal.DeficitFast);
    expect(m.calories).toBe(1500);
  });

  it('CalorieGoal.SurplusSlow → +200 kcal', () => {
    const m = calculateMacros(2000, DietType.Balanced, 70, undefined, 22, [], CalorieGoal.SurplusSlow);
    expect(m.calories).toBe(2200);
  });

  it('IMC > 30 sin calorieGoal → déficit automático −450 kcal', () => {
    const m = calculateMacros(2500, DietType.Balanced, 70, undefined, 32, []);
    expect(m.calories).toBe(2050);
  });

  it('nunca baja de 1500 kcal', () => {
    const m = calculateMacros(1600, DietType.Balanced, 50, undefined, 30, [], CalorieGoal.DeficitFast);
    expect(m.calories).toBeGreaterThanOrEqual(1500);
  });

  it('diabetes T2 — grasas ≤ 35% de calorías (evidencia ADA/EASD)', () => {
    const m = calculateMacros(2000, DietType.Keto, 70, undefined, 22, [Condition.DiabetesType2]);
    const maxFatG = Math.floor(m.calories * 0.35 / 9);
    expect(m.fats).toBeLessThanOrEqual(maxFatG + 1);
  });

  it('diabetes T2 — el excedente de grasa no eleva la proteína por encima de 2.0 g/kg', () => {
    const m = calculateMacros(2000, DietType.Keto, 70, undefined, 22, [Condition.DiabetesType2]);
    expect(m.protein).toBeLessThanOrEqual(Math.round(2.0 * 70));
  });

  // ─── Seguridad clínica (auditoría) ───────────────────────────────────────────

  it('perfil vulnerable (menor) → sin déficit aunque haya CalorieGoal.DeficitFast', () => {
    const m = calculateMacros(2000, DietType.Balanced, 50, undefined, 22, [], CalorieGoal.DeficitFast, { isMinor: true });
    expect(m.calories).toBe(2000);
  });

  it('perfil vulnerable (embarazo) → sin déficit automático por obesidad (IMC > 30)', () => {
    const m = calculateMacros(2500, DietType.Balanced, 70, undefined, 32, [], undefined, { isPregnant: true });
    expect(m.calories).toBe(2500);
  });

  it('perfil vulnerable (lactancia) → atleta en definición se fuerza a mantenimiento', () => {
    const vulnerable = calculateMacros(2500, DietType.Athlete, 75, AthleteGoal.Definition, undefined, [], undefined, { isLactating: true });
    expect(vulnerable.calories).toBe(2500);
  });

  it('enfermedad renal → proteína limitada a 0.8 g/kg independientemente de la dieta', () => {
    const m = calculateMacros(2000, DietType.Protein, 70, undefined, 22, [Condition.RenalDisease]);
    expect(m.protein).toBeLessThanOrEqual(Math.round(0.8 * 70) + 1);
  });

  it('cetogénica tiene más grasa que equilibrada al mismo TEE', () => {
    const keto    = calculateMacros(2000, DietType.Keto, 70);
    const balanced = calculateMacros(2000, DietType.Balanced, 70);
    expect(keto.fats).toBeGreaterThan(balanced.fats);
  });

  it('proteica tiene más proteína que mediterránea al mismo TEE', () => {
    const prot = calculateMacros(2000, DietType.Protein, 70);
    const med  = calculateMacros(2000, DietType.Mediterranean, 70);
    expect(prot.protein).toBeGreaterThan(med.protein);
  });
});

// ─── calculateDailyWater ─────────────────────────────────────────────────────

describe('calculateDailyWater', () => {
  it('sedentario 70 kg → 2500 ml (35×70=2450 → round to 100 → 2500)', () => {
    // Math.round(2450/100)*100 = Math.round(24.5)*100 = 25*100 = 2500
    expect(calculateDailyWater(70, ActivityLevel.Sedentary)).toBe(2500);
  });

  it('sedentario 60 kg → 2100 ml (35×60=2100 → already multiple of 100)', () => {
    expect(calculateDailyWater(60, ActivityLevel.Sedentary)).toBe(2100);
  });

  it('moderado 70 kg → 3000 ml (base 2500 + 500)', () => {
    expect(calculateDailyWater(70, ActivityLevel.Moderate)).toBe(3000);
  });

  it('atleta 80 kg → 3800 ml (2800 + 1000)', () => {
    expect(calculateDailyWater(80, ActivityLevel.Athlete)).toBe(3800);
  });
});

// ─── calculateWaistHeightRatio / getWaistRisk ─────────────────────────────────

describe('waistHeightRatio', () => {
  it('ratio calculado correctamente', () => {
    expect(calculateWaistHeightRatio(80, 175)).toBeCloseTo(0.457, 2);
  });

  it('< 0.5 → Bajo (rango saludable, no alarmista)', () => expect(getWaistRisk(0.46)).toBe('Bajo'));
  it('0.5–0.59 → Aumentado', () => expect(getWaistRisk(0.54)).toBe('Aumentado'));
  it('>= 0.6 → Alto',      () => expect(getWaistRisk(0.62)).toBe('Alto'));
  it('límite exacto 0.5 → Aumentado', () => expect(getWaistRisk(0.5)).toBe('Aumentado'));
});

// ─── calculateAllMetrics ──────────────────────────────────────────────────────

describe('calculateAllMetrics', () => {
  const data = {
    age: 35,
    gender: Gender.Female,
    weight: 68,
    height: 168,
    activity: ActivityLevel.Light,
    conditions: [] as Condition[],
    dietType: DietType.Mediterranean,
    duration: '1_mes' as any,
  };

  it('devuelve todos los campos requeridos', () => {
    const m = calculateAllMetrics(data);
    expect(m).toHaveProperty('imc');
    expect(m).toHaveProperty('imcCategory');
    expect(m).toHaveProperty('bmr');
    expect(m).toHaveProperty('tee');
    expect(m).toHaveProperty('idealWeight');
    expect(m).toHaveProperty('adjustedWeight');
    expect(m).toHaveProperty('dailyWater');
    expect(m).toHaveProperty('macros');
  });

  it('adjustedWeight null cuando IMC ≤ 30', () => {
    const m = calculateAllMetrics(data);
    expect(m.adjustedWeight).toBeNull();
  });

  it('adjustedWeight no nulo cuando IMC > 30', () => {
    const m = calculateAllMetrics({ ...data, weight: 110 });
    expect(m.adjustedWeight).not.toBeNull();
  });

  it('macros.calories coherentes con TEE', () => {
    const m = calculateAllMetrics(data);
    expect(m.macros.calories).toBeGreaterThan(1000);
    expect(m.macros.calories).toBeLessThan(5000);
  });
});
