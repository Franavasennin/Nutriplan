import React, { useState, useMemo, useEffect } from 'react';
import { DietResponse, PlanVersion } from '../types';
import { computePlanDiff, MealDiff } from '../utils/planDiff';

export interface PlanDiffModalProps {
  currentPlan: DietResponse;
  version: PlanVersion;
  versionNumber: number;
  onRestore: (version: PlanVersion) => void;
  onClose: () => void;
}

export const PlanDiffModal: React.FC<PlanDiffModalProps> = ({
  currentPlan,
  version,
  versionNumber,
  onRestore,
  onClose,
}) => {
  const diffResult = useMemo(
    () => computePlanDiff(version.plan, currentPlan),
    [version.plan, currentPlan]
  );

  // Seleccionar por defecto el primer día que tenga cambios, o el día 1
  const initialDay = useMemo(() => {
    const firstChanged = diffResult.days.find(d => d.hasChanges);
    return firstChanged ? firstChanged.day : (diffResult.days[0]?.day ?? 1);
  }, [diffResult]);

  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [onlyShowChanges, setOnlyShowChanges] = useState<boolean>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeDayDiff = diffResult.days.find(d => d.day === selectedDay);

  const displayedMeals = useMemo(() => {
    if (!activeDayDiff) return [];
    if (onlyShowChanges) {
      return activeDayDiff.mealDiffs.filter(m => m.type !== 'identical');
    }
    return activeDayDiff.mealDiffs;
  }, [activeDayDiff, onlyShowChanges]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in no-print"
      onClick={onClose}
    >
      <div
        className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-diff-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">compare</span>
            </div>
            <div>
              <h2 id="plan-diff-title" className="text-base sm:text-lg font-bold text-text-main dark:text-white">
                Comparador de Versiones
              </h2>
              <p className="text-xs text-text-sub dark:text-gray-400">
                Comparando <span className="font-semibold text-amber-600 dark:text-amber-400">Versión {versionNumber}</span> ({new Date(version.timestamp).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}) con el <span className="font-semibold text-primary">Plan Actual</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-11 rounded-lg flex items-center justify-center text-text-sub hover:text-text-main dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:ring-2 focus:ring-primary focus-visible:outline-none"
            aria-label="Cerrar comparador"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Resumen & Controles */}
        <div className="p-4 sm:p-5 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3 bg-surface-light dark:bg-surface-dark">
          <div className="flex items-center gap-2">
            {diffResult.hasChanges ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <span className="material-symbols-outlined text-[14px]">tune</span>
                {diffResult.totalChangedMeals} comida(s) con diferencias
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Sin diferencias respecto a la versión actual
              </span>
            )}

            <button
              onClick={() => setOnlyShowChanges(prev => !prev)}
              className="text-xs text-text-sub dark:text-gray-400 hover:text-primary underline ml-2 cursor-pointer focus:ring-2 focus:ring-primary focus-visible:outline-none rounded"
            >
              {onlyShowChanges ? 'Mostrar todas las comidas' : 'Ver solo cambios'}
            </button>
          </div>

          {/* Días Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {diffResult.days.map(d => (
              <button
                key={d.day}
                onClick={() => setSelectedDay(d.day)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer focus:ring-2 focus:ring-primary focus-visible:outline-none ${
                  selectedDay === d.day
                    ? 'bg-primary text-background-dark shadow-sm'
                    : 'bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-sub dark:text-gray-300 hover:text-text-main'
                }`}
              >
                Día {d.day}
                {d.hasChanges && (
                  <span
                    className={`absolute -top-1 -right-1 size-2 rounded-full ${
                      selectedDay === d.day ? 'bg-background-dark' : 'bg-amber-500'
                    }`}
                    title="Este día tiene cambios"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {displayedMeals.length === 0 ? (
            <div className="text-center py-12 text-text-sub dark:text-gray-400">
              <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">done_all</span>
              <p className="text-sm font-semibold">No hay diferencias en el Día {selectedDay}.</p>
              {onlyShowChanges && (
                <button
                  onClick={() => setOnlyShowChanges(false)}
                  className="mt-2 text-xs text-primary underline focus:ring-2 focus:ring-primary focus-visible:outline-none rounded"
                >
                  Ver todas las comidas de este día
                </button>
              )}
            </div>
          ) : (
            displayedMeals.map((mealDiff: MealDiff) => {
              const isChanged = mealDiff.type === 'changed';
              const isAdded = mealDiff.type === 'added';
              const isRemoved = mealDiff.type === 'removed';

              return (
                <div
                  key={mealDiff.mealKey}
                  className={`rounded-xl border p-4 transition-all ${
                    isChanged
                      ? 'border-amber-400/60 dark:border-amber-600/40 bg-amber-500/5'
                      : isAdded
                      ? 'border-blue-400/60 dark:border-blue-600/40 bg-blue-500/5'
                      : isRemoved
                      ? 'border-red-400/60 dark:border-red-600/40 bg-red-500/5'
                      : 'border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/30'
                  }`}
                >
                  {/* Meal Header with type badge & deltas */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-border-light/60 dark:border-border-dark/60">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-text-main dark:text-white uppercase tracking-wider">
                        {mealDiff.mealLabel}
                      </span>
                      {isChanged && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          Modificado
                        </span>
                      )}
                      {isAdded && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          Nueva en plan actual
                        </span>
                      )}
                      {isRemoved && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          Eliminada en plan actual
                        </span>
                      )}
                      {mealDiff.type === 'identical' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          Idéntico
                        </span>
                      )}
                    </div>

                    {/* Macro Deltas */}
                    {mealDiff.diffSummary && (
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span
                          className={
                            mealDiff.diffSummary.calorieDelta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : mealDiff.diffSummary.calorieDelta < 0
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-text-sub'
                          }
                        >
                          {mealDiff.diffSummary.calorieDelta > 0 ? '+' : ''}
                          {mealDiff.diffSummary.calorieDelta} kcal
                        </span>
                        {mealDiff.diffSummary.proteinDelta !== 0 && (
                          <span className="text-text-sub dark:text-gray-400">
                            {mealDiff.diffSummary.proteinDelta > 0 ? '+' : ''}
                            {mealDiff.diffSummary.proteinDelta}g P
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Versión Anterior */}
                    <div className="p-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Versión {versionNumber} (Anterior)
                        </span>
                        {mealDiff.oldMeal?.calories != null && (
                          <span className="text-xs font-bold text-text-sub dark:text-gray-400">
                            {mealDiff.oldMeal.calories} kcal
                          </span>
                        )}
                      </div>
                      {mealDiff.oldMeal ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-bold text-text-main dark:text-white">
                            {mealDiff.oldMeal.name}
                          </p>
                          <ul className="text-xs text-text-sub dark:text-gray-400 space-y-0.5 list-disc list-inside">
                            {mealDiff.oldMeal.ingredients?.map((ing, i) => (
                              <li key={i}>{ing}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-text-sub italic">No existía en esta versión.</p>
                      )}
                    </div>

                    {/* Plan Actual */}
                    <div className="p-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-primary-accessible dark:text-primary uppercase tracking-wide">
                          Plan Actual
                        </span>
                        {mealDiff.newMeal?.calories != null && (
                          <span className="text-xs font-bold text-text-sub dark:text-gray-400">
                            {mealDiff.newMeal.calories} kcal
                          </span>
                        )}
                      </div>
                      {mealDiff.newMeal ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-bold text-text-main dark:text-white">
                            {mealDiff.newMeal.name}
                          </p>
                          <ul className="text-xs text-text-sub dark:text-gray-400 space-y-0.5 list-disc list-inside">
                            {mealDiff.newMeal.ingredients?.map((ing, i) => (
                              <li key={i}>{ing}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-text-sub italic">Eliminada en el plan actual.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 sm:p-5 border-t border-border-light dark:border-border-dark flex items-center justify-between gap-3 bg-background-light dark:bg-background-dark/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-text-sub dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-semibold transition-colors cursor-pointer focus:ring-2 focus:ring-primary focus-visible:outline-none"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={() => onRestore(version)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer focus:ring-2 focus:ring-primary focus-visible:outline-none"
          >
            <span className="material-symbols-outlined text-[18px]">restore</span>
            Restaurar Versión {versionNumber}
          </button>
        </div>
      </div>
    </div>
  );
};
export default PlanDiffModal;
