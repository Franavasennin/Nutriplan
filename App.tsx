import React, { useState, useEffect } from 'react';
import PatientForm from './components/PatientForm';
import DietPlanDisplay from './components/DietPlanDisplay';
import SavedDietsList from './components/SavedDietsList';
import FoodDatabase from './components/FoodDatabase';
import ProgressTracker from './components/ProgressTracker';
import RecipeSearch from './components/RecipeSearch';
import Dashboard from './components/Dashboard';
import LoadingOverlay from './components/LoadingOverlay';
import { PatientData, CalculatedMetrics, DietResponse, SavedDiet, CustomFood, ClientProgress, ProgressEntry } from './types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros } from './utils/calculations';
import { generateDietPlan } from './services/geminiService';

const STORAGE_KEY_DIETS = 'dietmaster_saved_diets';
const STORAGE_KEY_FOODS = 'dietmaster_custom_foods';
const STORAGE_KEY_PROGRESS = 'dietmaster_client_progress';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'dashboard' | 'form' | 'result' | 'history' | 'foods' | 'progress' | 'recipes'>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  
  // Current Session Data
  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  const [plan, setPlan] = useState<DietResponse | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);

  // Persistence
  const [savedDiets, setSavedDiets] = useState<SavedDiet[]>([]);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [progressData, setProgressData] = useState<ClientProgress[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const storedDiets = localStorage.getItem(STORAGE_KEY_DIETS);
        if (storedDiets) setSavedDiets(JSON.parse(storedDiets));

        const storedFoods = localStorage.getItem(STORAGE_KEY_FOODS);
        if (storedFoods) setCustomFoods(JSON.parse(storedFoods));

        const storedProgress = localStorage.getItem(STORAGE_KEY_PROGRESS);
        if (storedProgress) setProgressData(JSON.parse(storedProgress));
      } catch (e) {
        console.error("Error loading data", e);
      }
    };
    loadData();
  }, []);

  // Theme Toggler
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
  }, [isDark]);

  // Persist Data
  useEffect(() => localStorage.setItem(STORAGE_KEY_DIETS, JSON.stringify(savedDiets)), [savedDiets]);
  useEffect(() => localStorage.setItem(STORAGE_KEY_FOODS, JSON.stringify(customFoods)), [customFoods]);
  useEffect(() => localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progressData)), [progressData]);

  // --- Backup Functions ---
  const exportDatabase = () => {
    const data = {
      diets: savedDiets,
      foods: customFoods,
      progress: progressData,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NutriPlan_Backup_${new Date().toLocaleDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.diets) setSavedDiets(data.diets);
        if (data.foods) setCustomFoods(data.foods);
        if (data.progress) setProgressData(data.progress);
        alert('Base de datos importada con éxito');
      } catch (err) {
        alert('Error al importar el archivo. Formato no válido.');
      }
    };
    reader.readAsText(file);
  };

  // --- Handlers for Diets ---
  const saveDiet = (data: PatientData, met: CalculatedMetrics, response: DietResponse) => {
    const newDiet: SavedDiet = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      patientData: data,
      metrics: met,
      plan: response
    };
    setSavedDiets(prev => [newDiet, ...prev]);

    if (data.name) {
      setProgressData(prev => {
        if (!prev.find(p => p.clientName === data.name)) {
          return [...prev, { clientName: data.name!, entries: [] }];
        }
        return prev;
      });
    }
  };

  const deleteDiet = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta dieta?')) {
      setSavedDiets(prev => prev.filter(d => d.id !== id));
    }
  };

  const loadDiet = (diet: SavedDiet) => {
    setPatientData(diet.patientData);
    setMetrics(diet.metrics);
    setPlan(diet.plan);
    setCurrentStep('result');
  };

  // --- Handlers for Custom Foods ---
  const addCustomFood = (food: CustomFood) => {
    setCustomFoods(prev => [...prev, food]);
  };

  const deleteCustomFood = (id: string) => {
    setCustomFoods(prev => prev.filter(f => f.id !== id));
  };

  // --- Handlers for Progress ---
  const saveProgressEntry = (clientName: string, entry: ProgressEntry) => {
    setProgressData(prev => {
      const existingClient = prev.find(p => p.clientName === clientName);
      if (existingClient) {
        return prev.map(p => 
          p.clientName === clientName 
            ? { ...p, entries: [...p.entries, entry] }
            : p
        );
      } else {
        return [...prev, { clientName, entries: [entry] }];
      }
    });
  };

  const handleFormSubmit = async (data: PatientData) => {
    setIsLoading(true);
    setError(null);
    setPatientData(data);

    try {
      const imc = calculateIMC(data.weight, data.height);
      const bmr = calculateBMR(data);
      const tee = calculateTEE(bmr, data.activity);
      const macros = calculateMacros(tee, data.dietType);
      const calculatedMetrics = { imc, bmr, tee, macros };
      setMetrics(calculatedMetrics);

      const dietPlan = await generateDietPlan(data, calculatedMetrics, customFoods);
      
      setPlan(dietPlan);
      saveDiet(data, calculatedMetrics, dietPlan);
      setCurrentStep('result');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al generar la dieta.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoHome = () => {
    setCurrentStep('dashboard');
    setPlan(null);
    setMetrics(null);
    setError(null);
    setPatientData(null);
  };

  const uniqueClients = Array.from(new Set(savedDiets.map(d => d.patientData.name).filter(Boolean))) as string[];
  const isActive = (step: string) => currentStep === step;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-text-main dark:text-white font-display">
        {isLoading && <LoadingOverlay />}
        
        {/* Sidebar */}
        <aside className="hidden w-64 flex-col border-r border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark lg:flex z-50 transition-colors duration-200 no-print">
            <div className="flex h-full flex-col justify-between p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 px-2 py-2 mb-4 cursor-pointer" onClick={handleGoHome}>
                        <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-2xl font-bold">nutrition</span>
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-text-main dark:text-white text-lg font-black leading-tight">NutriPlan</h1>
                            <p className="text-text-sub dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">Software Clínico</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[50vh]">
                        <button onClick={() => setCurrentStep('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('dashboard') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('dashboard') ? 'active-nav-icon' : ''}`}>dashboard</span>
                            <p className="text-sm">Dashboard</p>
                        </button>
                        <button onClick={() => setCurrentStep('form')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('form') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('form') ? 'active-nav-icon' : ''}`}>person_add</span>
                            <p className="text-sm">Nuevo Cliente</p>
                        </button>
                        <button onClick={() => setCurrentStep('progress')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('progress') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('progress') ? 'active-nav-icon' : ''}`}>monitoring</span>
                            <p className="text-sm">Seguimiento</p>
                        </button>
                        <div className="my-2 border-t border-border-light dark:border-border-dark opacity-50"></div>
                        <button onClick={() => setCurrentStep('recipes')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('recipes') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('recipes') ? 'active-nav-icon' : ''}`}>menu_book</span>
                            <p className="text-sm">Recetas AI</p>
                        </button>
                        <button onClick={() => setCurrentStep('foods')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('foods') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('foods') ? 'active-nav-icon' : ''}`}>database</span>
                            <p className="text-sm">Base de Alimentos</p>
                        </button>
                        <button onClick={() => setCurrentStep('history')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive('history') ? 'bg-primary text-background-dark font-black shadow-lg shadow-primary/20' : 'text-text-sub dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <span className={`material-symbols-outlined ${isActive('history') ? 'active-nav-icon' : ''}`}>history</span>
                            <p className="text-sm">Historial</p>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark space-y-2">
                        <p className="text-[10px] font-bold text-text-sub uppercase text-center">Base de Datos</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={exportDatabase} className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-sm">download</span>
                                <span className="text-[8px] font-bold">Copia</span>
                            </button>
                            <label className="flex flex-col items-center p-2 rounded-lg bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark hover:text-primary transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-sm">upload</span>
                                <span className="text-[8px] font-bold">Cargar</span>
                                <input type="file" className="hidden" accept=".json" onChange={importDatabase} />
                            </label>
                        </div>
                    </div>
                    <button onClick={() => setIsDark(!isDark)} className="flex items-center justify-center gap-2 p-3 rounded-xl bg-background-light dark:bg-background-dark text-text-sub text-xs font-bold border border-border-light dark:border-border-dark hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                        <span className="material-symbols-outlined text-sm">{isDark ? 'light_mode' : 'dark_mode'}</span>
                        {isDark ? 'Luz' : 'Oscuro'}
                    </button>
                    <div className="flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-primary bg-primary/10">
                        <div className="bg-primary rounded-full size-8 flex items-center justify-center text-background-dark font-black text-sm">EC</div>
                        <div className="flex flex-col overflow-hidden">
                            <p className="text-text-main dark:text-white text-xs font-black truncate">Ester Correa</p>
                            <p className="text-text-sub dark:text-gray-400 text-[9px] font-bold uppercase truncate">Dietista-Nutricionista</p>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark relative transition-colors duration-200">
            {error && (
                <div className="absolute top-4 right-4 z-[60] bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-xl flex items-center gap-2 animate-bounce">
                    <span className="material-symbols-outlined">warning</span>
                    <div>
                        <p className="font-black text-sm">ERROR CRÍTICO</p>
                        <p className="text-xs">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="ml-4"><span className="material-symbols-outlined">close</span></button>
                </div>
            )}

            {currentStep === 'dashboard' && (
                <Dashboard 
                    stats={{
                        totalClients: uniqueClients.length,
                        activePlans: savedDiets.length,
                        customFoods: customFoods.length
                    }}
                    recentDiets={savedDiets.slice(0, 8)}
                    onNewClient={() => setCurrentStep('form')}
                    onLoadDiet={loadDiet}
                />
            )}

            {currentStep === 'form' && (
                <PatientForm onSubmit={handleFormSubmit} isLoading={isLoading} />
            )}

            {currentStep === 'result' && metrics && plan && (
                <DietPlanDisplay metrics={metrics} plan={plan} patientName={patientData?.name} />
            )}

            {currentStep === 'recipes' && (
                <RecipeSearch />
            )}

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
                    <SavedDietsList diets={savedDiets} onLoad={loadDiet} onDelete={deleteDiet} />
                </div>
            )}
            
            {/* Mobile Nav */}
            <div className="lg:hidden fixed bottom-0 left-0 w-full bg-surface-light dark:bg-surface-dark border-t-2 border-primary/20 p-2 flex justify-around items-center z-50 no-print">
                 <button onClick={() => setCurrentStep('dashboard')} className={`p-2 rounded-xl flex flex-col items-center ${isActive('dashboard') ? 'text-primary bg-primary/10' : 'text-text-sub'}`}>
                    <span className="material-symbols-outlined">dashboard</span>
                 </button>
                 <button onClick={() => setCurrentStep('form')} className={`p-2 rounded-xl flex flex-col items-center ${isActive('form') ? 'text-primary bg-primary/10' : 'text-text-sub'}`}>
                    <span className="material-symbols-outlined">person_add</span>
                 </button>
                 <button onClick={() => setCurrentStep('result')} className={`p-2 rounded-xl flex flex-col items-center ${isActive('result') ? 'text-primary bg-primary/10' : 'text-text-sub'}`} disabled={!plan}>
                    <span className="material-symbols-outlined">restaurant_menu</span>
                 </button>
                 <button onClick={() => setCurrentStep('progress')} className={`p-2 rounded-xl flex flex-col items-center ${isActive('progress') ? 'text-primary bg-primary/10' : 'text-text-sub'}`}>
                    <span className="material-symbols-outlined">monitoring</span>
                 </button>
            </div>
        </main>
    </div>
  );
};

export default App;