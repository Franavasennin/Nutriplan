import { DietResponse, DayPlan, CalculatedMetrics } from '../types';
import { sumDayMacros, reconcileDietResponse } from './macroValidation';
import { InstructionChange } from '../services/geminiService';

/**
 * Fusión determinista de los cambios propuestos por `applyPlanInstructions`
 * (services/geminiService.ts) sobre el plan ya existente. La IA solo PROPONE
 * qué comidas cambiar — esta función es la única que decide qué se sobrescribe
 * de verdad, para que el resto del plan quede intacto byte a byte y el
 * comportamiento sea auditable/testeable sin depender del modelo.
 *
 * Los cambios con `day` inexistente o `mealKey` que no exista YA en ese día
 * del plan real se descartan (reportados en `skipped`) — validación contra el
 * plan real, no contra `patientData.mealCount` (que falta en algunas dietas
 * antiguas, ver hallazgo del plan aprobado).
 */
export function mergeInstructionChanges(
  plan: DietResponse,
  changes: InstructionChange[]
): { plan: DietResponse; applied: number; skipped: string[] } {
  const skipped: string[] = [];
  let applied = 0;
  const realDays = new Set(plan.weeklyPlan.map(d => d.day));

  const weeklyPlan: DayPlan[] = plan.weeklyPlan.map(day => {
    const relevantChanges = changes.filter(c => c.day === day.day);
    if (relevantChanges.length === 0) return day;

    let meals = day.meals;
    let mutated = false;

    for (const change of relevantChanges) {
      const mealKey = change.mealKey as keyof DayPlan['meals'];
      if (!(mealKey in day.meals) || day.meals[mealKey] == null) {
        skipped.push(`día ${change.day} / ${change.mealKey} (no existe en el plan actual)`);
        continue;
      }
      if (!mutated) {
        meals = { ...day.meals };
        mutated = true;
      }
      meals[mealKey] = change.meal;
      applied++;
    }

    return mutated ? { ...day, meals } : day;
  });

  // Días mencionados en `changes` que no existen en el plan
  for (const c of changes) {
    if (!realDays.has(c.day)) {
      skipped.push(`día ${c.day} / ${c.mealKey} (el día no existe en el plan)`);
    }
  }

  return { plan: reconcileDietResponse({ ...plan, weeklyPlan }), applied, skipped };
}

/**
 * Detecta días cuyos macros totales se desvían del objetivo diario más allá
 * de `tolerancePct`. NO corrige nada — solo avisa, para que la nutricionista
 * decida (deliberadamente no se usa `scalePlanToTarget` aquí: reescalaría
 * también las comidas que ella no quería tocar).
 */
export function findDaysOffTarget(
  plan: DietResponse,
  metrics: CalculatedMetrics,
  tolerancePct = 10
): number[] {
  const target = metrics.macros.calories;
  if (!target) return [];

  const offTarget: number[] = [];
  for (const day of plan.weeklyPlan) {
    const totals = sumDayMacros(day.meals);
    if (!totals) continue;
    const diffPct = Math.abs(totals.calories - target) / target * 100;
    if (diffPct > tolerancePct) offTarget.push(day.day);
  }
  return offTarget;
}
