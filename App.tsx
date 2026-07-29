import React, { useState, useMemo, useRef, lazy, Suspense } from 'react';

// Views — carga diferida (code-splitting): cada vista es un chunk aparte,
// se descarga solo cuando el usuario navega a ella.
const PatientForm     = lazy(() => import('./components/PatientForm'));
const DietPlanDisplay = lazy(() => import('./components/DietPlanDisplay'));
const SavedDietsList  = lazy(() => import('./components/SavedDietsList'));
const FoodDatabase    = lazy(() => import('./components/FoodDatabase'));
const ProgressTracker = lazy(() => import('./components/ProgressTracker'));
const AgendaView      = lazy(() => import('./components/AgendaView'));
const AddPartnerModal    = lazy(() => import('./components/AddPartnerModal'));
const PortalLinkModal    = lazy(() => import('./components/PortalLinkModal'));
const LinkedPartnerPanel = lazy(() => import('./components/LinkedPartnerPanel'));
const RecipeSearch    = lazy(() => import('./components/RecipeSearch'));
const Dashboard       = lazy(() => import('./components/Dashboard'));
import LoadingOverlay   from './components/LoadingOverlay';

// New components
import { Sidebar }         from './components/Sidebar';
import { MobileNav }       from './components/MobileNav';
import { ToastProvider, useToast }       from './components/Toast';
import { ConfirmProvider, useConfirm }   from './components/ConfirmDialog';
import { FoodVocabularyProvider }        from './components/FoodVocabularyContext';
import NotificationSettings              from './components/NotificationSettings';

// Hooks
import { useTheme }      from './hooks/useTheme';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppData }    from './hooks/useAppData';

// Services
import { exportJSON, exportCSV, importJSON, importCSV } from './services/exportService';
import { parseDietFromPDF, regenerateSingleDay, getMealSwap, applyPlanInstructions } from './services/geminiService';
import { mergeInstructionChanges, findDaysOffTarget } from './utils/planInstructions';
import { readPDFAsBase64 } from './services/pdfService';

// Utils & types
import { PatientData, CalculatedMetrics, DietResponse, SavedDiet, DietType, Meal, PlanVersion } from './types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros, calculateIdealWeight, calculateAdjustedWeight, calculateAdjustedWeightFromBodyFat, computeMetrics } from './utils/calculations';
import { enforceClinicalSafety } from './utils/clinicalSafety';
import { getClinicalTargets } from './utils/clinicalTargets';
import { verifyPlanAgainstAllergens, verifyDayAgainstAllergens, verifyMealAgainstAllergens, formatAllergenViolationsMessage } from './utils/allergenVerification';
import { generateDietPlan } from './services/geminiService';
import { scalePlanToTarget } from './utils/planScaling';
import { applyAllergenSubstitutions } from './utils/allergenSubstitution';

type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes' | 'agenda';

// ─── Inner app (needs Toast + Confirm context) ────────────────────────────────
const AppContent: React.FC = () => {
  const { isDark, toggleTheme }  = useTheme();
  const { canInstall, install, deferredPrompt } = usePWAInstall();
  const { toast }    = useToast();
  const { confirm }  = useConfirm();
  // MEJORA-020: las escrituras fallidas ahora avisan con un toast real en
  // vez de perderse en la consola del navegador.
  const {
    savedDiets, customFoods, progressData, appointments, dbRecipes, uniqueClients, dbOnline,
    saveDiet, updateDietPlan, updateDietPlanWithSnapshot, updateFullDiet, updatePatientData, deleteDiet, restorePlanVersion,
    saveLinkedDiet, updateLinkedDiet, unlinkDiet,
    saveAppointment, updateAppointment, deleteAppointment,
    addCustomFood, editCustomFood, deleteCustomFood,
    addRecipe, editRecipe, deleteRecipe,
    saveProgressEntry, deleteProgressEntry, updateProgressEntry, updateClientGoal, importAll, appendDiets,
    getOrCreatePortalToken, updatePortalToken, regeneratePortalToken, getPortalWeeklyAdherence,
  } = useAppData(msg => toast(msg, 'error'));

  // Datos iniciales del paciente (edad, altura, sexo) por cliente — se toman
  // de la dieta más reciente, para mostrarlos en Seguimiento (antes no
  // aparecían en ningún sitio fuera del formulario/PDF del plan).
  const patientInfoByClient = useMemo(() => {
    const map: Record<string, { age: number; height: number; gender: PatientData['gender'] }> = {};
    const byTimestamp = [...savedDiets].sort((a, b) => a.timestamp - b.timestamp);
    for (const diet of byTimestamp) {
      const name = diet.patientData.name;
      if (!name) continue;
      map[name] = {
        age:    diet.patientData.age,
        height: diet.patientData.height,
        gender: diet.patientData.gender,
      };
    }
    return map;
  }, [savedDiets]);

  // Session state (no need to persist between steps)
  const [currentStep,    setCurrentStep]    = useState<Step>('dashboard');
  const [isLoading,      setIsLoading]      = useState(false);
  const [metrics,        setMetrics]        = useState<CalculatedMetrics | null>(null);
  const [plan,           setPlan]           = useState<DietResponse | null>(null);
  const [patientData,    setPatientData]    = useState<PatientData | null>(null);
  const [currentDietId,  setCurrentDietId]  = useState<string | null>(null);
  // Pareja Inteligente: modal de alta/edición de pareja vinculada. `existingPartner`
  // presente = modo edición de datos personales; ausente = crear pareja nueva.
  const [partnerModal, setPartnerModal] = useState<{ principal: SavedDiet; existingPartner?: SavedDiet } | null>(null);

  // Portal del Paciente: modal de enlace + QR para el cliente seleccionado.
  const [portalLinkDiet, setPortalLinkDiet] = useState<SavedDiet | null>(null);

  // Pareja Inteligente: si el plan que se está viendo pertenece a un
  // principal con pareja vinculada, se muestra el panel de resumen.
  const linkedPartner = useMemo(
    () => currentDietId ? savedDiets.find(d => d.linkedToId === currentDietId) : undefined,
    [savedDiets, currentDietId]
  );
  // Si el plan que se está viendo ES el de una pareja (no el del principal),
  // se activa el bloqueo de comidas editadas manualmente.
  const viewingDiet = useMemo(
    () => currentDietId ? savedDiets.find(d => d.id === currentDietId) : undefined,
    [savedDiets, currentDietId]
  );
  // Impresión "Dieta de Pareja": resolución simétrica de "la otra persona" —
  // a diferencia de linkedPartner (que solo resuelve viendo al principal),
  // funciona tanto si se está viendo al principal como a la pareja. Alcance
  // explícito: solo se contempla un vínculo por principal (el esquema N-a-1
  // soportaría varios; esta función de impresión toma el primero que haya).
  const otherPersonDiet = useMemo(() => {
    if (!viewingDiet) return undefined;
    if (viewingDiet.linkedToId) {
      return savedDiets.find(d => d.id === viewingDiet.linkedToId);
    }
    return savedDiets.find(d => d.linkedToId === viewingDiet.id);
  }, [savedDiets, viewingDiet]);

  // Pareja Inteligente: marca una comida como editada manualmente (bloqueada
  // frente a futuras resincronizaciones) — solo aplica si lo que se está
  // viendo es la dieta de una pareja, no la del principal.
  const handleMealManuallyEdited = (day: number, mealKey: string, updatedPlan: DietResponse) => {
    if (!viewingDiet?.linkedToId) return;
    const key = `${day}-${mealKey}`;
    const next = [...new Set([...(viewingDiet.lockedMeals ?? []), key])];
    // updatedPlan viene de DietPlanDisplay YA con el cambio aplicado —
    // viewingDiet.plan (derivado de savedDiets) todavía está desactualizado
    // en este mismo tick, así que no sirve como fuente del plan a guardar.
    updateLinkedDiet(viewingDiet.id, updatedPlan, next, viewingDiet.substitutions ?? [], viewingDiet.linkedSyncedAt ?? Date.now());
    setPlan(updatedPlan);
  };

  // "Volver a sincronizar con la dieta principal" — recalcula SOLO esa
  // comida con el factor de escala vigente, sin tocar el resto del plan.
  const handleUnlockMeal = (day: number, mealKey: string) => {
    if (!viewingDiet?.linkedToId) return;
    const principal = savedDiets.find(d => d.id === viewingDiet.linkedToId);
    if (!principal) return;
    const key = `${day}-${mealKey}`;
    const nextLocked = (viewingDiet.lockedMeals ?? []).filter(k => k !== key);
    const { plan: rescaled } = scalePlanToTarget(principal.plan, viewingDiet.metrics, {
      lockedMeals: nextLocked, currentPartnerPlan: viewingDiet.plan,
    });
    const rescaledDay = rescaled.weeklyPlan.find(d => d.day === day);
    const rescaledMeal = rescaledDay?.meals[mealKey as keyof typeof rescaledDay.meals];
    if (!rescaledMeal) return;
    const updatedPlan: DietResponse = {
      ...viewingDiet.plan,
      weeklyPlan: viewingDiet.plan.weeklyPlan.map(d =>
        d.day === day ? { ...d, meals: { ...d.meals, [mealKey]: rescaledMeal } } : d
      ),
    };
    updateLinkedDiet(viewingDiet.id, updatedPlan, nextLocked, viewingDiet.substitutions ?? [], viewingDiet.linkedSyncedAt ?? Date.now());
    if (currentDietId === viewingDiet.id) setPlan(updatedPlan);
    toast('Comida resincronizada con la dieta principal.', 'success');
  };

  // "Actualizar dieta de la pareja" — vuelve a copiar la estructura del
  // principal y recalcula cantidades, respetando las comidas bloqueadas.
  const handleRegeneratePartner = (partner: SavedDiet) => {
    const principal = savedDiets.find(d => d.id === partner.linkedToId);
    if (!principal) return;
    const freshMetrics = computeMetrics(partner.patientData);
    const { plan: scaledPlan, warnings: scaleWarnings } = scalePlanToTarget(principal.plan, freshMetrics, {
      lockedMeals: partner.lockedMeals ?? [], currentPartnerPlan: partner.plan,
    });
    const { plan: finalPlan, substitutions, warnings: subWarnings } = applyAllergenSubstitutions(scaledPlan, partner.patientData.allergens ?? []);
    const now = Date.now();
    updateLinkedDiet(partner.id, finalPlan, partner.lockedMeals ?? [], substitutions, now);
    if (currentDietId === partner.id) { setPlan(finalPlan); setMetrics(freshMetrics); }
    const allWarnings = [...scaleWarnings.map(w => w.message), ...subWarnings];
    toast(
      allWarnings.length > 0
        ? `Dieta de la pareja actualizada con ${allWarnings.length} aviso(s) — revisa el plan.`
        : 'Dieta de la pareja actualizada — comidas bloqueadas conservadas.',
      allWarnings.length > 0 ? 'info' : 'success'
    );
  };
  // MEJORA-019 (iteración 003, "papelera / deshacer borrado"): las dietas
  // marcadas para borrar se ocultan al instante pero el DELETE real a
  // Supabase se retrasa unos segundos, con un botón "Deshacer" en el toast.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // MEJORA-019: oculta las dietas con borrado pendiente (ventana de deshacer)
  // sin haberlas eliminado todavía de verdad en Supabase.
  const visibleSavedDiets = useMemo(
    () => pendingDeleteIds.size ? savedDiets.filter(d => !pendingDeleteIds.has(d.id)) : savedDiets,
    [savedDiets, pendingDeleteIds]
  );

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = (step: Step) => setCurrentStep(step);

  const handleGoHome = () => {
    setCurrentStep('dashboard');
    setPlan(null);
    setMetrics(null);
    setPatientData(null);
    setCurrentDietId(null);
  };

  // ── Diet generation ─────────────────────────────────────────────────────────
  const handleFormSubmit = async (rawData: PatientData) => {
    setIsLoading(true);
    // MEJORA-018 (iteración 003): ID estable del paciente — se genera solo
    // la primera vez (rawData.clientId ausente); si ya existe (edición de
    // un cliente vía handleEditClient, que precarga patientData completo),
    // se conserva sin regenerar.
    const withClientId: PatientData = rawData.clientId
      ? rawData
      : { ...rawData, clientId: crypto.randomUUID() };
    // Seguridad clínica (auditoría): fuerza mantenimiento/sin ayuno en perfiles
    // vulnerables aunque el formulario no lo haya aplicado (defensa en profundidad).
    const data = enforceClinicalSafety(withClientId);
    setPatientData(data);
    try {
      const imc         = calculateIMC(data.weight, data.height);
      const bmr         = calculateBMR(data);
      const tee         = calculateTEE(bmr, data.activity);
      const idealWeight = calculateIdealWeight(data.height, data.gender);
      // Auditoría (mejora #11): si hay % graso medido (viene del seguimiento
      // del cliente), usar masa magra real en vez de estimarla por IMC —
      // detecta también obesidad sarcopénica (IMC normal, % graso alto).
      const refWeight   = data.bodyFatPercent != null
        ? calculateAdjustedWeightFromBodyFat(data.weight, data.bodyFatPercent)
        : (imc > 30 ? calculateAdjustedWeight(data.weight, idealWeight) : data.weight);
      const macros      = calculateMacros(tee, data.dietType, refWeight, data.athleteGoal, imc, data.conditions, data.calorieGoal, {
        isMinor: data.age < 18, isPregnant: data.isPregnant, isLactating: data.isLactating,
      });
      const clinicalTargets = getClinicalTargets(data, macros.calories);
      const calc        = {
        imc, bmr, tee, macros,
        targets: { fiberG: clinicalTargets.fiberGMin, addedSugarG: clinicalTargets.addedSugarGMax, sodiumMg: clinicalTargets.sodiumMgMax },
      };

      // Aviso clínico si el floor de 1.500 kcal se ha aplicado
      if (data.dietType === DietType.Athlete && macros.calories === 1500 && tee - 350 < 1500) {
        toast('Aviso: el déficit calculado caía por debajo de 1.500 kcal/día. El plan se ha ajustado al mínimo clínico recomendado.', 'info');
      }

      setMetrics(calc);
      const dietPlan = await generateDietPlan(data, calc, customFoods);
      // Verificador determinista post-generación (auditoría iteración 002,
      // MEJORA-010): red de seguridad adicional por si el modelo no respetó
      // la Regla 0 (prioridad absoluta de exclusiones) del prompt.
      const allergenViolations = verifyPlanAgainstAllergens(dietPlan, data);
      if (allergenViolations.length > 0) {
        toast(formatAllergenViolationsMessage(allergenViolations), 'error');
      }
      setPlan(dietPlan);
      // Siempre crea un registro nuevo → historial automático por cliente
      const savedId = saveDiet(data, calc, dietPlan);
      setCurrentDietId(savedId);
      setCurrentStep('result');
      toast('Plan nutricional generado con éxito.', 'success');
    } catch (err: any) {
      toast(err.message || 'Error al generar la dieta.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // computeMetrics (IMC→peso de referencia→BMR→TEE→macros→targets) ahora vive
  // en utils/calculations.ts, reutilizada también por AddPartnerModal.tsx.

  // ── Diet management ─────────────────────────────────────────────────────────
  const UNDO_WINDOW_MS = 6000;

  const handleDeleteDiet = async (id: string) => {
    const ok = await confirm({
      title:        'Eliminar dieta',
      message:      'Se ocultará al momento. Tendrás unos segundos para deshacerlo antes de que se borre de verdad.',
      confirmLabel: 'Eliminar',
      danger:       true,
    });
    if (!ok) return;

    setPendingDeleteIds(prev => new Set(prev).add(id));
    const timeoutId = setTimeout(() => {
      deleteDiet(id);
      setPendingDeleteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      deleteTimeouts.current.delete(id);
    }, UNDO_WINDOW_MS);
    deleteTimeouts.current.set(id, timeoutId);

    toast('Dieta eliminada.', 'success', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          const t = deleteTimeouts.current.get(id);
          if (t) { clearTimeout(t); deleteTimeouts.current.delete(id); }
          setPendingDeleteIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        },
      },
    });
  };

  const handleLoadDiet = (diet: SavedDiet) => {
    setPatientData(diet.patientData);
    setMetrics(diet.metrics);
    setPlan(diet.plan);
    setCurrentDietId(diet.id);
    setCurrentStep('result');
  };

  // Pre-carga datos del cliente actualizados con su último seguimiento
  const handleEditClient = (diet: SavedDiet) => {
    const clientName = diet.patientData.name;
    const progress   = progressData.find(p => p.clientName === clientName);
    const latest     = progress?.entries.length
      ? [...progress.entries].sort((a, b) => b.date - a.date)[0]
      : null;

    let merged = { ...diet.patientData };
    let notice = '';

    if (latest) {
      const dateStr = new Date(latest.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      // Actualiza peso con el último registro de la báscula
      if (latest.weight && latest.weight !== diet.patientData.weight) {
        merged = { ...merged, weight: latest.weight };
        notice += `Peso actualizado a ${latest.weight} kg (seguimiento del ${dateStr}). `;
      }
      // Auditoría (mejora #11): si la báscula registró % graso, realimenta el
      // cálculo de macros con la composición corporal real en vez de estimarla.
      if (latest.bodyFat != null && latest.bodyFat !== diet.patientData.bodyFatPercent) {
        merged = { ...merged, bodyFatPercent: latest.bodyFat };
        notice += `Composición corporal actualizada (${latest.bodyFat}% grasa, seguimiento del ${dateStr}). `;
      }
      // Si tiene objetivo de peso guardado en el seguimiento, lo aplica
      if (progress?.weightGoal && progress.weightGoal !== diet.patientData.targetWeight) {
        merged = { ...merged, targetWeight: progress.weightGoal };
        notice += `Objetivo de peso: ${progress.weightGoal} kg. `;
      }
    }

    setPatientData(merged);
    setCurrentDietId(null); // Siempre genera un registro nuevo
    setCurrentStep('form');
    if (notice) {
      toast(`📊 Datos actualizados del seguimiento: ${notice}Nueva dieta se guardará como historial.`, 'info');
    } else {
      toast(`Editando plan de ${clientName ?? 'paciente'}. Se generará como nueva entrada del historial.`, 'info');
    }
  };

  // ── Per-day regeneration ────────────────────────────────────────────────────
  const handleRegenerateDay = async (dayNumber: number) => {
    if (!patientData || !metrics || !plan) return;
    setIsLoading(true);
    try {
      const newDay = await regenerateSingleDay(patientData, metrics, dayNumber, customFoods);
      // MEJORA-011 (iteración 003): verificación de alérgenos del día regenerado.
      const dayViolations = verifyDayAgainstAllergens(newDay, patientData);
      if (dayViolations.length > 0) toast(formatAllergenViolationsMessage(dayViolations), 'error');
      const updatedPlan: DietResponse = {
        ...plan,
        weeklyPlan: plan.weeklyPlan.map(d => d.day === dayNumber ? newDay : d),
      };
      setPlan(updatedPlan);
      if (currentDietId) updateDietPlan(currentDietId, updatedPlan);
      toast(`Día ${dayNumber} regenerado.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Error al regenerar el día.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pautas de la nutricionista sobre el plan ya generado ────────────────────
  const handleApplyInstructions = async (instructions: string) => {
    if (!patientData || !metrics || !plan) return;
    setIsLoading(true);
    try {
      const { changes } = await applyPlanInstructions(plan, instructions, patientData, metrics);
      const { plan: mergedPlan, applied, skipped } = mergeInstructionChanges(plan, changes);

      // Prioridad absoluta: exclusiones/alérgenos ganan siempre a la pauta,
      // igual que en handleRegenerateDay. Vía de mayor riesgo de reintroducir
      // un alérgeno sin querer.
      const violations = verifyPlanAgainstAllergens(mergedPlan, patientData);
      if (violations.length > 0) toast(formatAllergenViolationsMessage(violations), 'error');

      const offTargetDays = findDaysOffTarget(mergedPlan, metrics);
      if (offTargetDays.length > 0) {
        toast(`Aviso: el día ${offTargetDays.join(', ')} se desvía más de un 10% del objetivo calórico.`, 'error');
      }
      if (skipped.length > 0) {
        console.warn('Cambios de pauta descartados:', skipped);
      }

      setPlan(mergedPlan);
      if (currentDietId) {
        updateDietPlanWithSnapshot(currentDietId, mergedPlan);
        updatePatientData(currentDietId, { planInstructions: instructions });
      }
      toast(applied > 0
        ? `Pauta aplicada: ${applied} comida${applied === 1 ? '' : 's'} ajustada${applied === 1 ? '' : 's'}.`
        : 'La pauta no requería cambios en este plan.', 'success');
    } catch (err: any) {
      toast(err.message || 'Error al aplicar la pauta.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Meal swap ────────────────────────────────────────────────────────────────
  const handleSwapMeal = async (_dayNumber: number, mealKey: string, currentMeal: Meal): Promise<Meal> => {
    if (!patientData || !metrics) throw new Error('No hay datos del paciente');
    const swapped = await getMealSwap(currentMeal, mealKey, patientData, metrics);
    // MEJORA-011 (iteración 003): verificación de alérgenos de la comida sustituida.
    const mealViolations = verifyMealAgainstAllergens(swapped, patientData, _dayNumber);
    if (mealViolations.length > 0) toast(formatAllergenViolationsMessage(mealViolations), 'error');
    return swapped;
  };

  // ── Restore plan version ─────────────────────────────────────────────────────
  const handleRestoreVersion = (version: PlanVersion) => {
    if (!currentDietId) return;
    restorePlanVersion(currentDietId, version);
    setPlan(version.plan);
    toast('Versión anterior restaurada.', 'success');
  };

  // ── Export / Import ─────────────────────────────────────────────────────────
  const LAST_BACKUP_KEY = 'nutriplan_last_backup_at';
  const [lastBackupAt, setLastBackupAt] = useState<number>(
    () => Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0)
  );
  const lastBackupLabel = lastBackupAt
    ? `Último backup: hace ${Math.max(0, Math.floor((Date.now() - lastBackupAt) / (1000 * 60 * 60 * 24)))} día(s)`
    : 'Aún sin backups';

  const handleExportJSON = () => {
    exportJSON(savedDiets, customFoods, progressData);
    const now = Date.now();
    localStorage.setItem(LAST_BACKUP_KEY, String(now));
    setLastBackupAt(now);
    toast('Backup JSON descargado.', 'success');
  };

  // Recordatorio de backup — el plan gratuito de Supabase pausa el proyecto
  // tras un periodo de inactividad, y no hay backups automáticos del lado
  // servidor en ese plan. El único backup real es el manual (botón "Backup"
  // del menú lateral), pero nadie se acuerda de hacerlo solo — este aviso
  // aparece si nunca se ha exportado o si pasaron más de 14 días, y solo si
  // ya hay datos que merezca la pena respaldar.
  const BACKUP_REMINDER_DAYS = 14;
  const backupReminderShown = useRef(false);
  React.useEffect(() => {
    // savedDiets/progressData llegan async desde Supabase — hasta que no hay
    // algo que respaldar (o de verdad no hay nada tras cargar) no tiene
    // sentido avisar, y solo se muestra una vez por sesión.
    if (backupReminderShown.current) return;
    if (savedDiets.length === 0 && progressData.length === 0) return;
    backupReminderShown.current = true;
    const lastBackup = Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
    const daysSince = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
    if (daysSince < BACKUP_REMINDER_DAYS) return;
    toast(
      lastBackup
        ? `Han pasado más de ${BACKUP_REMINDER_DAYS} días desde tu último backup. Los proyectos gratuitos de Supabase se pausan por inactividad — exporta uno por seguridad.`
        : 'Aún no has hecho ningún backup. Los proyectos gratuitos de Supabase se pausan por inactividad — exporta uno por seguridad.',
      'info',
      { action: { label: 'Exportar ahora', onClick: handleExportJSON } }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedDiets.length, progressData.length]);

  const handleExportCSV = () => {
    exportCSV(savedDiets);
    toast('Exportación CSV descargada.', 'success');
  };

  const handleImportCSV = (newDiets: SavedDiet[]) => {
    appendDiets(newDiets);
    toast(`${newDiets.length} cliente(s) importado(s) desde CSV.`, 'success');
  };

  const handleImportPDF = async (file: File) => {
    setIsLoading(true);
    try {
      const pdfBase64 = await readPDFAsBase64(file);
      const diet      = await parseDietFromPDF(pdfBase64);
      appendDiets([diet]);
      toast(`Dieta de "${diet.patientData.name}" importada desde PDF.`, 'success');
    } catch (err: any) {
      console.error('[PDF Import Error]', err);
      toast(err.message || 'Error al importar el PDF.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input early so the same file can be re-selected if needed
    e.target.value = '';

    const ok = await confirm({
      title:        'Cargar base de datos',
      message:      `¿Cargar el archivo "${file.name}"? Esto SUSTITUIRÁ todos los pacientes, alimentos y progresos actuales. Exporta un backup antes si quieres conservar los datos actuales.`,
      confirmLabel: 'Sí, cargar',
      danger:       true,
    });
    if (!ok) return;

    importJSON(
      file,
      data => { importAll(data); toast(`Base de datos cargada: ${(data.diets ?? []).length} pacientes importados.`, 'success'); },
      ()   => toast('Error al importar. Asegúrate de que el archivo es un backup JSON de NutriPlan.', 'error')
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <FoodVocabularyProvider customFoods={customFoods}>
    <div className="flex h-screen w-full overflow-auto bg-background-light dark:bg-background-dark text-text-main dark:text-white font-display">
      {isLoading && <LoadingOverlay />}

      <Sidebar
        currentStep={currentStep}
        isDark={isDark}
        dbOnline={dbOnline}
        onNavigate={navigate}
        onGoHome={handleGoHome}
        onToggleTheme={toggleTheme}
        onExportJSON={handleExportJSON}
        onExportCSV={handleExportCSV}
        onImport={handleImport}
        lastBackupLabel={lastBackupLabel}
      />

      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-background-light dark:bg-background-dark relative transition-colors duration-200">

       <Suspense fallback={<LoadingOverlay />}>
        {currentStep === 'dashboard' && (
          <>
            <Dashboard
              stats={{
                totalClients: uniqueClients.length,
                activePlans:  savedDiets.length,
                customFoods:  customFoods.length,
              }}
              allDiets={visibleSavedDiets}
              onNewClient={() => { setPatientData(null); setCurrentDietId(null); navigate('form'); }}
              onLoadDiet={handleLoadDiet}
              onDeleteDiet={handleDeleteDiet}
              onEditClient={handleEditClient}
              onUpdatePatientData={updatePatientData}
              installEvent={deferredPrompt}
              onInstall={install}
              onExportCSV={handleExportCSV}
              onAddPartner={(diet) => setPartnerModal({ principal: diet })}
              onOpenPortalLink={(diet) => setPortalLinkDiet(diet)}
            />
            <div className="px-6 pb-8 max-w-xl">
              <NotificationSettings />
            </div>
          </>
        )}

        {currentStep === 'form' && (
          <PatientForm onSubmit={handleFormSubmit} isLoading={isLoading} initialData={patientData ?? undefined} />
        )}

        {currentStep === 'result' && metrics && plan && (
          <>
            {linkedPartner && (
              <div className="px-4 md:px-8 pt-4">
                <LinkedPartnerPanel
                  partner={linkedPartner}
                  onEdit={() => {
                    const principal = savedDiets.find(d => d.id === currentDietId);
                    if (principal) setPartnerModal({ principal, existingPartner: linkedPartner });
                  }}
                  onRegenerate={() => handleRegeneratePartner(linkedPartner)}
                  onUnlink={() => { unlinkDiet(linkedPartner.id); toast('Pareja convertida en cliente independiente.', 'success'); }}
                  onDeletePartner={() => { deleteDiet(linkedPartner.id); toast('Pareja eliminada.', 'success'); }}
                  onViewPartner={() => handleLoadDiet(linkedPartner)}
                />
              </div>
            )}
          <DietPlanDisplay
            metrics={metrics}
            plan={plan}
            patientName={patientData?.name}
            mealCount={patientData?.mealCount}
            fastingProtocol={patientData?.fastingProtocol}
            patientData={patientData ?? undefined}
            isLoading={isLoading}
            dietId={currentDietId ?? undefined}
            planVersions={currentDietId ? savedDiets.find(d => d.id === currentDietId)?.planVersions : undefined}
            onUpdatePlan={(updatedPlan) => {
              setPlan(updatedPlan);
              if (currentDietId) { updateDietPlan(currentDietId, updatedPlan); }
              toast('Plan actualizado y guardado.', 'success');
            }}
            onRegenerate={(newDietType: DietType) => {
              if (!patientData) return;
              handleFormSubmit({ ...patientData, dietType: newDietType });
            }}
            onRegenerateDay={handleRegenerateDay}
            onApplyInstructions={handleApplyInstructions}
            onSwapMeal={handleSwapMeal}
            onRestoreVersion={handleRestoreVersion}
            lockedMeals={viewingDiet?.lockedMeals}
            substitutions={viewingDiet?.substitutions}
            onMealManuallyEdited={handleMealManuallyEdited}
            onUnlockMeal={handleUnlockMeal}
            otherPersonDiet={otherPersonDiet}
          />
          </>
        )}

        {currentStep === 'recipes' && (
          <RecipeSearch recipes={dbRecipes} onAdd={addRecipe} onEdit={editRecipe} onDelete={deleteRecipe} />
        )}

        {currentStep === 'progress' && (
          <ProgressTracker
            clients={uniqueClients}
            progressData={progressData}
            patientInfo={patientInfoByClient}
            onSaveEntry={saveProgressEntry}
            onDeleteEntry={deleteProgressEntry}
            onUpdateEntry={updateProgressEntry}
            onUpdateGoal={updateClientGoal}
          />
        )}

        {currentStep === 'agenda' && (
          <AgendaView
            clients={uniqueClients}
            appointments={appointments}
            onSave={saveAppointment}
            onUpdate={updateAppointment}
            onDelete={deleteAppointment}
          />
        )}

        {currentStep === 'foods' && (
          <FoodDatabase
            foods={customFoods}
            onAdd={addCustomFood}
            onDelete={deleteCustomFood}
            onEdit={editCustomFood}
          />
        )}

        {currentStep === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            <SavedDietsList
            diets={visibleSavedDiets}
            onLoad={handleLoadDiet}
            onDelete={handleDeleteDiet}
            onImportCSV={handleImportCSV}
            onImportError={(msg) => toast(msg, 'error')}
            onImportPDF={handleImportPDF}
          />
          </div>
        )}

        {partnerModal && (
          <AddPartnerModal
            principalDiet={partnerModal.principal}
            existingPartner={partnerModal.existingPartner}
            onClose={() => setPartnerModal(null)}
            onCreate={(diet) => { saveLinkedDiet(diet); setPartnerModal(null); }}
            onUpdatePersonalData={(id, data) => updatePatientData(id, data)}
          />
        )}

        {portalLinkDiet && (
          <PortalLinkModal
            diet={portalLinkDiet}
            onClose={() => setPortalLinkDiet(null)}
            getOrCreatePortalToken={getOrCreatePortalToken}
            updatePortalToken={updatePortalToken}
            regeneratePortalToken={regeneratePortalToken}
            getPortalWeeklyAdherence={getPortalWeeklyAdherence}
          />
        )}

       </Suspense>

        <MobileNav currentStep={currentStep} onNavigate={navigate} hasPlan={!!plan} />
      </main>
    </div>
    </FoodVocabularyProvider>
  );
};

// ─── Root: providers wrapping ─────────────────────────────────────────────────
const App: React.FC = () => (
  <ToastProvider>
    <ConfirmProvider>
      <AppContent />
    </ConfirmProvider>
  </ToastProvider>
);

export default App;
