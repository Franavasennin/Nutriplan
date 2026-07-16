import { FastingProtocol } from '../types';
import { MealKey } from './couplePrint';

/**
 * Horarios y configuración de tomas — hoisted desde components/DietPlanDisplay.tsx
 * para que el portal del paciente (components/portal/) pueda mostrar los mismos
 * horarios sin duplicar la lógica ni importar el editor de 1600+ líneas.
 * Sin cambio de comportamiento respecto al original.
 */

export type { MealKey };

export interface MealSectionConfig {
  key: MealKey;
  title: string;
  time: string;
  icon: string;
}

export const ALL_MEAL_CONFIGS: MealSectionConfig[] = [
  { key: 'breakfast',      title: 'Desayuno',     icon: 'wb_twilight'   , time: '08:00' },
  { key: 'morningSnack',   title: 'Media Mañana', icon: 'light_mode'    , time: '11:00' },
  { key: 'lunch',          title: 'Almuerzo',     icon: 'wb_sunny'      , time: '14:00' },
  { key: 'afternoonSnack', title: 'Merienda',     icon: 'bakery_dining' , time: '17:30' },
  { key: 'dinner',         title: 'Cena',         icon: 'nights_stay'   , time: '20:30' },
];

// Meal times per fasting protocol
export const FASTING_TIMES: Record<string, Partial<Record<MealKey, string>>> = {
  [FastingProtocol.IF16_8]: { breakfast: '12:00', morningSnack: '13:30', lunch: '15:30', afternoonSnack: '17:30', dinner: '19:30' },
  [FastingProtocol.IF18_6]: { breakfast: '13:00', morningSnack: '14:30', lunch: '16:00', afternoonSnack: undefined,  dinner: '18:45' },
  [FastingProtocol.IF20_4]: { breakfast: undefined,   morningSnack: undefined,   lunch: '14:00', afternoonSnack: undefined,  dinner: '17:30' },
  [FastingProtocol.IF5_2]:  { breakfast: '08:00', morningSnack: '11:00', lunch: '14:00', afternoonSnack: '17:30', dinner: '20:30' },
};

export const MEAL_KEYS_BY_COUNT: Record<number, MealKey[]> = {
  2: ['lunch', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'morningSnack', 'lunch', 'dinner'],
  5: ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'],
};

export function getMealSections(mealCount = 5, fastingProtocol?: FastingProtocol): MealSectionConfig[] {
  const allowedKeys = MEAL_KEYS_BY_COUNT[mealCount] ?? MEAL_KEYS_BY_COUNT[5];
  const times = (fastingProtocol && fastingProtocol !== FastingProtocol.None)
    ? FASTING_TIMES[fastingProtocol] ?? {}
    : {};

  return ALL_MEAL_CONFIGS
    .filter(cfg => allowedKeys.includes(cfg.key))
    .map(cfg => ({
      ...cfg,
      time: times[cfg.key] ?? cfg.time,
    }))
    .filter(cfg => {
      if (!fastingProtocol || fastingProtocol === FastingProtocol.None) return true;
      const t = FASTING_TIMES[fastingProtocol];
      if (!t) return true;
      return cfg.key in t ? (t[cfg.key] !== undefined) : true;
    });
}
