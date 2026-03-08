import { useLocalStorage } from './useLocalStorage';
import {
  SavedDiet, CustomFood, ClientProgress,
  PatientData, CalculatedMetrics, DietResponse, ProgressEntry
} from '../types';

const KEYS = {
  diets: 'dietmaster_saved_diets',
  foods: 'dietmaster_custom_foods',
  progress: 'dietmaster_client_progress',
} as const;

interface ImportPayload {
  diets?: SavedDiet[];
  foods?: CustomFood[];
  progress?: ClientProgress[];
}

export function useAppData() {
  const [savedDiets, setSavedDiets] = useLocalStorage<SavedDiet[]>(KEYS.diets, []);
  const [customFoods, setCustomFoods] = useLocalStorage<CustomFood[]>(KEYS.foods, []);
  const [progressData, setProgressData] = useLocalStorage<ClientProgress[]>(KEYS.progress, []);

  // --- Diets ---
  const saveDiet = (data: PatientData, metrics: CalculatedMetrics, plan: DietResponse) => {
    const newDiet: SavedDiet = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      patientData: data,
      metrics,
      plan,
    };
    setSavedDiets(prev => [newDiet, ...prev]);

    if (data.name) {
      setProgressData(prev => {
        if (prev.find(p => p.clientName === data.name)) return prev;
        return [...prev, { clientName: data.name!, entries: [] }];
      });
    }
  };

  const deleteDiet = (id: string) => {
    setSavedDiets(prev => prev.filter(d => d.id !== id));
  };

  // --- Foods ---
  const addCustomFood = (food: CustomFood) => {
    setCustomFoods(prev => [...prev, food]);
  };

  const deleteCustomFood = (id: string) => {
    setCustomFoods(prev => prev.filter(f => f.id !== id));
  };

  // --- Progress ---
  const saveProgressEntry = (clientName: string, entry: ProgressEntry) => {
    setProgressData(prev => {
      const exists = prev.find(p => p.clientName === clientName);
      if (exists) {
        return prev.map(p =>
          p.clientName === clientName
            ? { ...p, entries: [...p.entries, entry] }
            : p
        );
      }
      return [...prev, { clientName, entries: [entry] }];
    });
  };

  // --- Import (replaces all data) ---
  const importAll = (payload: ImportPayload) => {
    if (payload.diets) setSavedDiets(payload.diets);
    if (payload.foods) setCustomFoods(payload.foods);
    if (payload.progress) setProgressData(payload.progress);
  };

  const uniqueClients = Array.from(
    new Set(savedDiets.map(d => d.patientData.name).filter(Boolean))
  ) as string[];

  return {
    savedDiets,
    customFoods,
    progressData,
    uniqueClients,
    saveDiet,
    deleteDiet,
    addCustomFood,
    deleteCustomFood,
    saveProgressEntry,
    importAll,
  };
}
