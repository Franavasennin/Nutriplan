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

// Hooks
import { useTheme }      from './hooks/useTheme';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppData }    from './hooks/useAppData';

// Services
import { exportJSON, exportCSV, importJSON } from './services/exportService';

// Utils & types
import { PatientData, CalculatedMetrics, DietResponse, SavedDiet } from './types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros } from './utils/calculations';
import { generateDietPlan } from './services/geminiService';

type Step = 'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes';

// ─── Inner app (needs Toast + Confirm context) ────────────────────────────────
const AppContent: React.FC = () => {
  const { isDark, toggleTheme }  = useTheme();
  const { canInstall, install, deferredPrompt } = usePWAInstall();
  const {
    savedDiets, customFoods, progressData, uniqueClients,
    saveDiet, deleteDiet, addCustomFood, deleteCustomFood,
    saveProgressEntry, importAll,
  } = useAppData();
  const { toast }    = useToast();
  const { confirm }  = useConfirm();

  // Session state (no need to persist between steps)
  const [currentStep,  setCurrentStep]  = useState<Step>('dashboard');
  const [isLoading,    setIsLoading]    = useState(false);
  const [metrics,      setMetrics]      = useState<CalculatedMetrics | null>(null);
  const [plan,         setPlan]         = useState<DietResponse | null>(null);
  const [patientData,  setPatientData]  = useState<PatientData | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigate = (step: Step) => setCurrentStep(step);

  const handleGoHome = () => {
    setCurrentStep('dashboard');
    setPlan(null);
    setMetrics(null);
    setPatientData(null);
  };

  // ── Diet generation ─────────────────────────────────────────────────────────
  const handleFormSubmit = async (data: PatientData) => {
    setIsLoading(true);
    setPatientData(data);
    try {
      const imc    = calculateIMC(data.weight, data.height);
      const bmr    = calculateBMR(data);
      const tee    = calculateTEE(bmr, data.activity);
      const macros = calculateMacros(tee, data.dietType);
      const calc   = { imc, bmr, tee, macros };

      setMetrics(calc);
      const dietPlan = await generateDietPlan(data, calc, customFoods);
      setPlan(dietPlan);
      saveDiet(data, calc, dietPlan);
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
    setCurrentStep('result');
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importJSON(
      file,
      data => { importAll(data); toast('Base de datos importada con éxito.', 'success'); },
      ()   => toast('Error al importar. Formato no válido.', 'error')
    );
    // Reset input so same file can be re-imported if needed
    e.target.value = '';
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main dark:text-white font-display">
      {isLoading && <LoadingOverlay />}

      <Sidebar
        currentStep={currentStep}
        isDark={isDark}
        onNavigate={navigate}
        onGoHome={handleGoHome}
        onToggleTheme={toggleTheme}
        onExportJSON={handleExportJSON}
        onExportCSV={handleExportCSV}
        onImport={handleImport}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative transition-colors duration-200">

        {currentStep === 'dashboard' && (
          <Dashboard
            stats={{
              totalClients: uniqueClients.length,
              activePlans:  savedDiets.length,
              customFoods:  customFoods.length,
            }}
            recentDiets={savedDiets.slice(0, 8)}
            onNewClient={() => navigate('form')}
            onLoadDiet={handleLoadDiet}
            installEvent={deferredPrompt}
            onInstall={install}
            onExportCSV={handleExportCSV}
          />
        )}

        {currentStep === 'form' && (
          <PatientForm onSubmit={handleFormSubmit} isLoading={isLoading} />
        )}

        {currentStep === 'result' && metrics && plan && (
          <DietPlanDisplay metrics={metrics} plan={plan} patientName={patientData?.name} />
        )}

        {currentStep === 'recipes' && <RecipeSearch />}

        {currentStep === 'progress' && (
          <ProgressTracker
            clients={uniqueClients}
            progressData={progressData}
            onSaveEntry={saveProgressEntry}
          />
        )}

        {currentStep === 'foods' && (
          <FoodDatabase
            foods={customFoods}
            onAdd={addCustomFood}
            onDelete={deleteCustomFood}
          />
        )}

        {currentStep === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <SavedDietsList diets={savedDiets} onLoad={handleLoadDiet} onDelete={handleDeleteDiet} />
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
