import { SavedDiet, CustomFood, ClientProgress } from '../types';

export interface BackupPayload {
  diets: SavedDiet[];
  foods: CustomFood[];
  progress: ClientProgress[];
  exportDate: string;
}

// --- Helpers ---
const today = () => new Date().toLocaleDateString('es-ES').replaceAll('/', '-');

const triggerDownload = (url: string, filename: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- Exports ---
export const exportJSON = (
  diets: SavedDiet[],
  foods: CustomFood[],
  progress: ClientProgress[]
) => {
  const payload: BackupPayload = { diets, foods, progress, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(URL.createObjectURL(blob), `NutriPlan_Backup_${today()}.json`);
};

export const exportCSV = (diets: SavedDiet[]) => {
  const header = 'ID,Nombre,Edad,Peso,Altura,IMC,Dieta,Fecha_Creacion';
  const rows = diets.map(d =>
    [
      d.id,
      d.patientData.name ?? 'Sin Nombre',
      d.patientData.age,
      d.patientData.weight,
      d.patientData.height,
      d.metrics.imc.toFixed(2),
      d.patientData.dietType,
      new Date(d.timestamp).toLocaleDateString('es-ES'),
    ].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), `Clientes_NutriPlan_${today()}.csv`);
};

// --- Import ---
export const importJSON = (
  file: File,
  onSuccess: (data: BackupPayload) => void,
  onError: () => void
) => {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target?.result as string) as BackupPayload;
      onSuccess(data);
    } catch {
      onError();
    }
  };
  reader.readAsText(file);
};
