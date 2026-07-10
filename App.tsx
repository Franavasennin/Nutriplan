import React, { useState, useMemo, lazy, Suspense } from 'react';

// Views — carga diferida (code-splitting): cada vista es un chunk aparte,
// se descarga solo cuando el usuario navega a ella.
const PatientForm     = lazy(() => import('./components/PatientForm'));
const DietPlanDisplay = lazy(() => import('./components/DietPlanDisplay'));
const CouplesDietView = lazy(() => import('./components/CouplesDietView'));
const SavedDietsList  = lazy(() => import('./components/SavedDietsList'));
const FoodDatabase    = lazy(() => import('./components/FoodDatabase'));
const ProgressTracker = lazy(() => import('./components/ProgressTracker'));
const RecipeSearch    = lazy(() => import('./components/RecipeSearch'));
const Dashboard       = lazy(() => import('./components/Dashboard'));
import LoadingOverlay   from './components/LoadingOverlay';

// New components
import { Sidebar }         from './components/Sidebar';
import { MobileNav }       from './components/MobileNav';
import { ToastProvider, useToast }       from './components/Toast';
import { ConfirmProvider, useConfirm }   from './components/ConfirmDialog';
import NotificationSettings              from './components/NotificationSettings';

// Hooks
import { useTheme }      from './hooks/useTheme';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppData }    from './hooks/useAppData';

// Services
import { exportJSON, exportCSV, importJSON, importCSV } from './services/exportService';
import { parseDietFromPDF, regenerateSingleDay, getMealSwap } from './services/geminiService';
import { readPDFAsBase64 } from './services/pdfService';

// Utils & types
import { PatientData, CalculatedMetrics, DietResponse, SavedDiet, DietType, Meal, PlanVersion, CouplesDiet } from './types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros, calculateIdealWeight, calculateAdjustedWeight, calculateAdjustedWeightFromBodyFat } from './utils/calculations';
import { enforceClinicalSafety } from './utils/clinicalSafety';
import { getClinicalTargets } from './utils/clinicalTargets';
import { verifyPlanAgainstAllergens, verifyDayAgainstAllergens, verifyMealAgainstAllergens, formatAllergenViolationsMessage } from './utils/allergenVerification';
import { generateDietPlan, adaptPlanToPartner } from './services/geminiService';

type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes' | 'couples';

// ─── Inner app (needs Toast + Confirm context) ────────────────────────────────
const AppContent: React.FC = () => {
  const { isDark, toggleTheme }  = useTheme();
  const { canInstall, install, deferredPrompt } = usePWAInstall();
  const { toast }    = useToast();
  const { confirm }  = useConfirm();
  // MEJORA-020: las escrituras fallidas ahora avisan con un toast real en
  // vez de perderse en la consola del navegador.
  const {
    savedDiets, customFoods, progressData, couplesDiets, dbRecipes, uniqueClients, dbOnline,
    saveDiet, updateDietPlan, updateFullDiet, updatePatientData, deleteDiet, restorePlanVersion,
    saveCouplesDiet, deleteCouplesDiet, updateCouplesDiet,
    addCustomFood, editCustomFood, deleteCustomFood,
    saveProgressEntry, deleteProgressEntry, updateProgressEntry, updateClientGoal, importAll, appendDiets,
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
  const [currentCouples, setCurrentCouples] = useState<CouplesDiet | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = (step: Step) => setCurrentStep(step);

  const handleGoHome = () => {
    setCurrentStep('dashboard');
    setPlan(null);
    setMetrics(null);
    setPatientData(null);
    setCurrentDietId(null);
    setCurrentCouples(null);
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

  // ── Cálculo de métricas reutilizable ──────────────────────────────────────────
  // Nota: se asume que `data` ya ha pasado por enforceClinicalSafety en el
  // llamador (handleFormSubmit / handleCoupleSubmit). Aun así, se pasan las
  // flags de seguridad a calculateMacros como defensa adicional.
  const computeMetrics = (data: PatientData): CalculatedMetrics => {
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

  // ── Generación de dieta para pareja ───────────────────────────────────────────
  const handleCoupleSubmit = async (rawA: PatientData, rawB: PatientData) => {
    setIsLoading(true);
    try {
      // MEJORA-018: ID estable por persona (ver handleFormSubmit).
      const withIdA: PatientData = rawA.clientId ? rawA : { ...rawA, clientId: crypto.randomUUID() };
      const withIdB: PatientData = rawB.clientId ? rawB : { ...rawB, clientId: crypto.randomUUID() };
      // Seguridad clínica (auditoría): aplica el cribado a cada persona antes de calcular
      const a = enforceClinicalSafety(withIdA);
      const b = enforceClinicalSafety(withIdB);
      const metricsA = computeMetrics(a);
      const metricsB = computeMetrics(b);
      // 1) Genera el menú base completo con la persona A (todos los días según semanas).
      const planA = await generateDietPlan(a, metricsA, customFoods);
      // 2) La persona B come LO MISMO: se adapta el menú de A a sus macros (mismos platos,
      //    porciones distintas). Así B sale siempre con TODOS los días que tiene A.
      const planB = await adaptPlanToPartner(planA, b, metricsB);
      // MEJORA-011 (iteración 003): verificación de alérgenos también en
      // planes de pareja — cada plan contra los alérgenos de su persona.
      const violationsA = verifyPlanAgainstAllergens(planA, a);
      const violationsB = verifyPlanAgainstAllergens(planB, b);
      if (violationsA.length > 0) toast(`[${a.name || 'Persona A'}] ${formatAllergenViolationsMessage(violationsA)}`, 'error');
      if (violationsB.length > 0) toast(`[${b.name || 'Persona B'}] ${formatAllergenViolationsMessage(violationsB)}`, 'error');
      const now = Date.now();
      const savedA: SavedDiet = { id: crypto.randomUUID(), timestamp: now, patientData: a, metrics: metricsA, plan: planA, planVersions: [] };
      const savedB: SavedDiet = { id: crypto.randomUUID(), timestamp: now, patientData: b, metrics: metricsB, plan: planB, planVersions: [] };
      const couplesId = saveCouplesDiet(savedA, savedB);
      setCurrentCouples({ id: couplesId, timestamp: now, personA: savedA, personB: savedB });
      setCurrentStep('couples');
      toast('Planes de pareja generados con éxito.', 'success');
    } catch (err: any) {
      toast(err.message || 'Error al generar los planes de pareja.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Diet management ─────────────────────────────────────────────────────────
  const handleDeleteDiet = async (id: string) => {
    const ok = await confirm({
      title:        'Eliminar dieta',
      message:      '¿Estás seguro? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger:       true,
    });
    if (ok) {
      deleteDiet(id);
      toast('Dieta eliminada.', 'success');
    }
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
  const handleExportJSON = () => {
    exportJSON(savedDiets, customFoods, progressData, couplesDiets);
    toast('Backup JSON descargado.', 'success');
  };

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
              allDiets={savedDiets}
              onNewClient={() => { setPatientData(null); setCurrentDietId(null); navigate('form'); }}
              onLoadDiet={handleLoadDiet}
              onDeleteDiet={handleDeleteDiet}
              onEditClient={handleEditClient}
              onUpdatePatientData={updatePatientData}
              installEvent={deferredPrompt}
              onInstall={install}
              onExportCSV={handleExportCSV}
            />
            <div className="px-6 pb-8 max-w-xl">
              <NotificationSettings />
            </div>
          </>
        )}

        {currentStep === 'form' && (
          <PatientForm onSubmit={handleFormSubmit} onSubmitCouple={handleCoupleSubmit} isLoading={isLoading} initialData={patientData ?? undefined} />
        )}

        {currentStep === 'couples' && currentCouples && (
          <CouplesDietView
            couplesDiet={currentCouples}
            customFoods={customFoods}
            onUpdateCouplesDiet={(personA, personB) => {
              updateCouplesDiet(currentCouples.id, personA, personB);
              setCurrentCouples(prev => prev ? { ...prev, personA, personB } : prev);
            }}
          />
        )}

        {currentStep === 'result' && metrics && plan && (
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
            onSwapMeal={handleSwapMeal}
            onRestoreVersion={handleRestoreVersion}
          />
        )}

        {currentStep === 'recipes' && <RecipeSearch recipes={dbRecipes} />}

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
            {/* Sección de planes de pareja */}
            {couplesDiets.length > 0 && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-primary/30 p-5">
                <h3 className="flex items-center gap-2 font-bold text-text-main dark:text-white mb-4">
                  <span className="material-symbols-outlined text-primary">group</span>
                  Planes de Pareja ({couplesDiets.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {couplesDiets.map(cd => (
                    <div key={cd.id} className="flex items-center justify-between p-3 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
                      <button
                        onClick={() => { setCurrentCouples(cd); setCurrentStep('couples'); }}
                        className="flex-1 text-left">
                        <p className="text-sm font-bold text-text-main dark:text-white">
                          {cd.personA.patientData.name || 'Persona A'} &amp; {cd.personB.patientData.name || 'Persona B'}
                        </p>
                        <p className="text-xs text-text-sub dark:text-gray-400">
                          {new Date(cd.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: 'Eliminar plan de pareja', message: '¿Seguro? Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true });
                          if (ok) { deleteCouplesDiet(cd.id); toast('Plan de pareja eliminado.', 'success'); }
                        }}
                        className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all"
                        title="Eliminar">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SavedDietsList
            diets={savedDiets}
            onLoad={handleLoadDiet}
            onDelete={handleDeleteDiet}
            onImportCSV={handleImportCSV}
            onImportError={(msg) => toast(msg, 'error')}
            onImportPDF={handleImportPDF}
          />
          </div>
        )}

       </Suspense>

        <MobileNav currentStep={currentStep} onNavigate={navigate} hasPlan={!!plan} />
      </main>
    </div>
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
