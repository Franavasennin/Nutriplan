import React, { useState } from 'react';

// Views
import PatientForm      from './components/PatientForm';
import DietPlanDisplay  from './components/DietPlanDisplay';
import SavedDietsList   from './components/SavedDietsList';
import FoodDatabase     from './components/FoodDatabase';
import ProgressTracker  from './components/ProgressTracker';
import RecipeSearch     from './components/RecipeSearch';
import Dashboard        from './components/Dashboard';
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
import { PatientData, CalculatedMetrics, DietResponse, SavedDiet, DietType, Meal, PlanVersion } from './types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros, calculateIdealWeight, calculateAdjustedWeight } from './utils/calculations';
import { generateDietPlan } from './services/geminiService';

type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes';

// ─── Inner app (needs Toast + Confirm context) ────────────────────────────────
const AppContent: React.FC = () => {
  const { isDark, toggleTheme }  = useTheme();
  const { canInstall, install, deferredPrompt } = usePWAInstall();
  const {
    savedDiets, customFoods, progressData, dbRecipes, uniqueClients, dbOnline,
    saveDiet, updateDietPlan, updateFullDiet, updatePatientData, deleteDiet, restorePlanVersion,
    addCustomFood, editCustomFood, deleteCustomFood,
    saveProgressEntry, updateClientGoal, importAll, appendDiets,
  } = useAppData();
  const { toast }    = useToast();
  const { confirm }  = useConfirm();

  // Session state (no need to persist between steps)
  const [currentStep,    setCurrentStep]    = useState<Step>('dashboard');
  const [isLoading,      setIsLoading]      = useState(false);
  const [metrics,        setMetrics]        = useState<CalculatedMetrics | null>(null);
  const [plan,           setPlan]           = useState<DietResponse | null>(null);
  const [patientData,    setPatientData]    = useState<PatientData | null>(null);
  const [currentDietId,  setCurrentDietId]  = useState<string | null>(null);

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
  const handleFormSubmit = async (data: PatientData) => {
    setIsLoading(true);
    setPatientData(data);
    try {
      const imc         = calculateIMC(data.weight, data.height);
      const bmr         = calculateBMR(data);
      const tee         = calculateTEE(bmr, data.activity);
      const idealWeight = calculateIdealWeight(data.height, data.gender);
      const refWeight   = imc > 30 ? calculateAdjustedWeight(data.weight, idealWeight) : data.weight;
      const macros      = calculateMacros(tee, data.dietType, refWeight, data.athleteGoal, imc, data.conditions, data.calorieGoal);
      const calc        = { imc, bmr, tee, macros };

      // Aviso clínico si el floor de 1.500 kcal se ha aplicado
      if (data.dietType === DietType.Athlete && macros.calories === 1500 && tee - 350 < 1500) {
        toast('Aviso: el déficit calculado caía por debajo de 1.500 kcal/día. El plan se ha ajustado al mínimo clínico recomendado.', 'info');
      }

      setMetrics(calc);
      const dietPlan = await generateDietPlan(data, calc, customFoods);
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
    return getMealSwap(currentMeal, mealKey, patientData, metrics);
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
    exportJSON(savedDiets, customFoods, progressData);
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
          <PatientForm onSubmit={handleFormSubmit} isLoading={isLoading} initialData={patientData ?? undefined} />
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
            onSaveEntry={saveProgressEntry}
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
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
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
