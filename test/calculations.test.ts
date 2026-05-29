import { describe, it, expect } from 'vitest';
import {
  calculateIMC,
  getIMCCategory,
  calculateBMR,
  calculateTEE,
  getActivityFactor,
  calculateIdealWeight,
  calculateAdjustedWeight,
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
  it('hombre 180 cm → Lorentz correcto', () => {
    // 180 - 100 - (180 - 150) / 4 = 80 - 7.5 = 72.5
    expect(calculateIdealWeight(180, Gender.Male)).toBe(72.5);
  });

  it('mujer 165 cm → Lorentz correcto', () => {
    // 165 - 100 - (165 - 150) / 2 = 65 - 7.5 = 57.5
    expect(calculateIdealWeight(165, Gender.Female)).toBe(57.5);
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

  it('diabetes T2 — grasas ≤ 28% de calorías', () => {
    const m = calculateMacros(2000, DietType.Keto, 70, undefined, 22, [Condition.DiabetesType2]);
    const maxFatG = Math.floor(m.calories * 0.28 / 9);
    expect(m.fats).toBeLessThanOrEqual(maxFatG + 1);
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

  it('< 0.43 → Bajo',      () => expect(getWaistRisk(0.40)).toBe('Bajo'));
  it('0.43–0.50 → Moderado', () => expect(getWaistRisk(0.46)).toBe('Moderado'));
  it('0.50–0.58 → Alto',   () => expect(getWaistRisk(0.54)).toBe('Alto'));
  it('>= 0.58 → Muy alto', () => expect(getWaistRisk(0.60)).toBe('Muy alto'));
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
