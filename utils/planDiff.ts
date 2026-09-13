import { DietResponse, Meal } from '../types';
import { MealKey, ALL_MEAL_CONFIGS } from './mealSchedule';

export interface MealDiffSummary {
  calorieDelta: number;
  proteinDelta: number;
  carbsDelta: number;
  fatsDelta: number;
  nameChanged: boolean;
  ingredientsChanged: boolean;
}

export interface MealDiff {
  mealKey: MealKey;
  mealLabel: string;
  type: 'changed' | 'added' | 'removed' | 'identical';
  oldMeal?: Meal;
  newMeal?: Meal;
  diffSummary?: MealDiffSummary;
}

export interface DayDiff {
  day: number;
  hasChanges: boolean;
  mealDiffs: MealDiff[];
}

export interface PlanDiffResult {
  totalChangedMeals: number;
  hasChanges: boolean;
  days: DayDiff[];
}

function normalizeText(str?: string): string {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareIngredients(oldList: string[] = [], newList: string[] = []): boolean {
  if (oldList.length !== newList.length) return true;
  const sOld = [...oldList].map(normalizeText).sort().join('||');
  const sNew = [...newList].map(normalizeText).sort().join('||');
  return sOld !== sNew;
}

/**
 * Calcula las diferencias plato a plato y macro a macro entre dos versiones de un plan dietético.
 * @param oldPlan Versión guardada anteriormente
 * @param newPlan Versión actual del plan
 */
export function computePlanDiff(oldPlan: DietResponse, newPlan: DietResponse): PlanDiffResult {
  const allDays = Array.from(
    new Set([
      ...(oldPlan.weeklyPlan || []).map(d => d.day),
      ...(newPlan.weeklyPlan || []).map(d => d.day),
    ])
  ).sort((a, b) => a - b);

  let totalChangedMeals = 0;
  const days: DayDiff[] = [];

  for (const dayNum of allDays) {
    const oldDay = oldPlan.weeklyPlan?.find(d => d.day === dayNum);
    const newDay = newPlan.weeklyPlan?.find(d => d.day === dayNum);

    const mealDiffs: MealDiff[] = [];
    let dayHasChanges = false;

    for (const cfg of ALL_MEAL_CONFIGS) {
      const oldMeal = oldDay?.meals?.[cfg.key];
      const newMeal = newDay?.meals?.[cfg.key];

      if (!oldMeal && !newMeal) continue;

      if (!oldMeal && newMeal) {
        dayHasChanges = true;
        totalChangedMeals++;
        mealDiffs.push({
          mealKey: cfg.key,
          mealLabel: cfg.title,
          type: 'added',
          newMeal,
          diffSummary: {
            calorieDelta: newMeal.calories || 0,
            proteinDelta: newMeal.protein || 0,
            carbsDelta: newMeal.carbs || 0,
            fatsDelta: newMeal.fats || 0,
            nameChanged: true,
            ingredientsChanged: true,
          },
        });
      } else if (oldMeal && !newMeal) {
        dayHasChanges = true;
        totalChangedMeals++;
        mealDiffs.push({
          mealKey: cfg.key,
          mealLabel: cfg.title,
          type: 'removed',
          oldMeal,
          diffSummary: {
            calorieDelta: -(oldMeal.calories || 0),
            proteinDelta: -(oldMeal.protein || 0),
            carbsDelta: -(oldMeal.carbs || 0),
            fatsDelta: -(oldMeal.fats || 0),
            nameChanged: true,
            ingredientsChanged: true,
          },
        });
      } else if (oldMeal && newMeal) {
        const nameChanged = normalizeText(oldMeal.name) !== normalizeText(newMeal.name);
        const ingrChanged = compareIngredients(oldMeal.ingredients, newMeal.ingredients);
        const calDelta = Math.round((newMeal.calories || 0) - (oldMeal.calories || 0));
        const proDelta = Math.round(((newMeal.protein || 0) - (oldMeal.protein || 0)) * 10) / 10;
        const carbDelta = Math.round(((newMeal.carbs || 0) - (oldMeal.carbs || 0)) * 10) / 10;
        const fatDelta = Math.round(((newMeal.fats || 0) - (oldMeal.fats || 0)) * 10) / 10;

        const isDifferent = nameChanged || ingrChanged || Math.abs(calDelta) >= 5;

        if (isDifferent) {
          dayHasChanges = true;
          totalChangedMeals++;
          mealDiffs.push({
            mealKey: cfg.key,
            mealLabel: cfg.title,
            type: 'changed',
            oldMeal,
            newMeal,
            diffSummary: {
              calorieDelta: calDelta,
              proteinDelta: proDelta,
              carbsDelta: carbDelta,
              fatsDelta: fatDelta,
              nameChanged,
              ingredientsChanged: ingrChanged,
            },
          });
        } else {
          mealDiffs.push({
            mealKey: cfg.key,
            mealLabel: cfg.title,
            type: 'identical',
            oldMeal,
            newMeal,
          });
        }
      }
    }

    days.push({
      day: dayNum,
      hasChanges: dayHasChanges,
      mealDiffs,
    });
  }

  return {
    totalChangedMeals,
    hasChanges: totalChangedMeals > 0,
    days,
  };
}
