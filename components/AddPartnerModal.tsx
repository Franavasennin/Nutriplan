import React, { useState, useMemo } from 'react';
import { SavedDiet, PatientData, Gender, ActivityLevel, DietType, Duration, CalorieGoal, LinkedPersonRole } from '../types';
import { computeMetrics } from '../utils/calculations';
import { scalePlanToTarget } from '../utils/planScaling';
import { applyAllergenSubstitutions } from '../utils/allergenSubstitution';
import { verifyPlanAgainstAllergens, formatAllergenViolationsMessage } from '../utils/allergenVerification';
import PartnerForm from './PartnerForm';
import { useToast } from './Toast';

interface Props {
  principalDiet: SavedDiet;
  /** Si se pasa, el modal edita los datos personales de una pareja ya vinculada en vez de crear una nueva. */
  existingPartner?: SavedDiet;
  onClose: () => void;
  onCreate: (diet: SavedDiet) => void;
  onUpdatePersonalData: (id: string, data: Partial<PatientData>) => void;
}

const DEFAULT_PARTNER: PatientData = {
  age: 30,
  gender: Gender.Female,
  weight: 60,
  height: 165,
  activity: ActivityLevel.Moderate,
  conditions: [],
  dietType: DietType.Balanced,
  duration: Duration.OneMonth,
  name: '',
  excludedFoods: '',
  calorieGoal: CalorieGoal.Maintenance,
  allergens: [],
};

const AddPartnerModal: React.FC<Props> = ({ principalDiet, existingPartner, onClose, onCreate, onUpdatePersonalData }) => {
  const { toast } = useToast();
  const isEdit = !!existingPartner;
  const [partnerData, setPartnerData] = useState<PatientData>(existingPartner?.patientData ?? { ...DEFAULT_PARTNER });

  // La pareja SIEMPRE come la misma estructura que el principal — dietType,
  // nº de semanas/duración/comidas y protocolo de ayuno se heredan, no se
  // eligen (eso es justo lo que garantiza "los mismos platos, solo cambian
  // las cantidades"). El resto de datos clínicos son propios de la pareja.
  const effectivePartnerData: PatientData = useMemo(() => ({
    ...partnerData,
    dietType: principalDiet.patientData.dietType,
    weeks: principalDiet.patientData.weeks,
    duration: principalDiet.patientData.duration,
    mealCount: principalDiet.patientData.mealCount,
    fastingProtocol: principalDiet.patientData.fastingProtocol,
  }), [partnerData, principalDiet.patientData]);

  const previewMetrics = useMemo(() => computeMetrics(effectivePartnerData), [effectivePartnerData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerData.name?.trim()) return;

    if (isEdit && existingPartner) {
      onUpdatePersonalData(existingPartner.id, partnerData);
      toast('Datos de la pareja actualizados.', 'success');
      onClose();
      return;
    }

    // Motor determinista, sin IA: escala el plan del principal al objetivo
    // ya calculado con el MISMO motor (computeMetrics/calculateMacros) que
    // cualquier paciente, y sustituye alimentos incompatibles por alergia.
    const { plan: scaledPlan, warnings: scaleWarnings } = scalePlanToTarget(principalDiet.plan, previewMetrics);
    const { plan: finalPlan, substitutions, warnings: subWarnings } = applyAllergenSubstitutions(scaledPlan, effectivePartnerData.allergens ?? []);

    // Red de seguridad adicional (mismo verificador que usa la generación
    // normal): por si el mapa de sustituciones dejó algo sin cubrir.
    const violations = verifyPlanAgainstAllergens(finalPlan, effectivePartnerData);
    if (violations.length > 0) {
      toast(formatAllergenViolationsMessage(violations), 'error');
    }

    const now = Date.now();
    const newDiet: SavedDiet = {
      id: crypto.randomUUID(),
      timestamp: now,
      patientData: effectivePartnerData,
      metrics: previewMetrics,
      plan: finalPlan,
      planVersions: [],
      linkedToId: principalDiet.id,
      linkedRole: 'partner' as LinkedPersonRole,
      linkedSyncedAt: now,
      lockedMeals: [],
      substitutions,
    };

    onCreate(newDiet);

    const allWarnings = [...scaleWarnings.map(w => w.message), ...subWarnings];
    if (allWarnings.length > 0) {
      toast(`Dieta de pareja generada con ${allWarnings.length} aviso(s) — revisa el plan: ${allWarnings[0]}`, 'info');
    } else {
      toast('Dieta de pareja generada — mismos platos, cantidades adaptadas.', 'success');
    }
    onClose();
  };

  const hasBasePlan = (principalDiet.plan?.weeklyPlan?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-pink-500 text-2xl">group</span>
            <h2 className="text-xl font-bold text-text-main dark:text-white">{isEdit ? 'Editar Pareja' : 'Añadir Pareja'}</h2>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-text-sub">close</span>
          </button>
        </div>

        {!hasBasePlan ? (
          <div className="p-6 text-center text-sm text-text-sub dark:text-gray-400">
            {principalDiet.patientData.name} todavía no tiene un plan generado — genera primero su dieta antes de añadir una pareja.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 flex flex-col gap-5">
              <p className="text-xs text-text-sub dark:text-gray-500">
                La pareja comerá exactamente los mismos platos que {principalDiet.patientData.name || 'el paciente principal'} — solo se adaptan cantidades y macros a su objetivo.
              </p>
              <PartnerForm value={partnerData} onChange={setPartnerData} />

              {!isEdit && (
                <div className="bg-primary/10 border border-primary/25 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-text-sub dark:text-gray-400 uppercase mb-2">Objetivo calculado automáticamente</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-black text-text-main dark:text-white">{previewMetrics.macros.calories}</p>
                      <p className="text-[10px] text-text-sub dark:text-gray-500">kcal</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-text-main dark:text-white">{previewMetrics.macros.protein}g</p>
                      <p className="text-[10px] text-text-sub dark:text-gray-500">proteína</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-text-main dark:text-white">{previewMetrics.macros.carbs}g</p>
                      <p className="text-[10px] text-text-sub dark:text-gray-500">HC</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-text-main dark:text-white">{previewMetrics.macros.fats}g</p>
                      <p className="text-[10px] text-text-sub dark:text-gray-500">grasa</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-border-light dark:border-border-dark">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark font-bold text-text-main dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-sm">
                Cancelar
              </button>
              <button type="submit"
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-background-dark font-bold hover:brightness-95 transition-all text-sm flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">{isEdit ? 'save' : 'auto_awesome'}</span>
                {isEdit ? 'Guardar cambios' : 'Generar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddPartnerModal;
