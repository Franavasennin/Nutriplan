import { SavedDiet, CustomFood, ClientProgress, PatientData, Gender, ActivityLevel, DietType, Duration } from '../types';
import { calculateIMC, calculateBMR, calculateTEE, calculateMacros, calculateIdealWeight, calculateAdjustedWeight } from '../utils/calculations';

export interface BackupPayload {
  diets: SavedDiet[];
  foods: CustomFood[];
  progress: ClientProgress[];
  exportDate: string;
}

// --- Helpers ---
const today = () => new Date().toLocaleDateString('es-ES').replaceAll('/', '-');

/**
 * Escapa un valor para CSV:
 * - Envuelve en comillas si contiene comas, comillas o saltos de línea
 * - Antepone comilla simple si empieza por = + - @ (inyección de fórmulas en Excel)
 */
function csvEscape(value: string | number): string {
  const str = String(value ?? '');
  // Neutralizar inyección de fórmulas Excel/Google Sheets
  const sanitized = /^[=+\-@|]/.test(str) ? `'${str}` : str;
  // Envolver en comillas si contiene caracteres especiales CSV
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

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
  try {
    const payload: BackupPayload = { diets, foods, progress, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(URL.createObjectURL(blob), `NutriPlan_Backup_${today()}.json`);
  } catch (err) {
    console.error('exportJSON failed:', err);
    throw new Error('No se pudo exportar el backup JSON.');
  }
};

export const exportCSV = (diets: SavedDiet[]) => {
  try {
    const header = 'ID,Nombre,Edad,Peso,Altura,IMC,Dieta,Fecha_Creacion';
    const rows = diets.map(d =>
      [
        csvEscape(d.id),
        csvEscape(d.patientData.name ?? 'Sin Nombre'),
        csvEscape(d.patientData.age),
        csvEscape(d.patientData.weight),
        csvEscape(d.patientData.height),
        csvEscape(d.metrics.imc.toFixed(2)),
        csvEscape(d.patientData.dietType),
        csvEscape(new Date(d.timestamp).toLocaleDateString('es-ES')),
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(URL.createObjectURL(blob), `Clientes_NutriPlan_${today()}.csv`);
  } catch (err) {
    console.error('exportCSV failed:', err);
    throw new Error('No se pudo exportar el CSV.');
  }
};

export const downloadCSVTemplate = () => {
  const header = 'Nombre,Edad,Peso,Altura,Dieta,Genero,Actividad';
  const example1 = 'Juan García,35,85,175,equilibrada,hombre,moderado';
  const example2 = 'María López,28,62,162,mediterranea,mujer,ligero';
  const note = '# Dietas válidas: equilibrada | baja_en_carbohidratos | cetogenica | vegetariana | vegana | mediterranea | paleo | proteica | atleta';
  const note2 = '# Géneros válidos: hombre | mujer   |   Actividades: sedentario | ligero | moderado | intenso | muy_intenso';
  const blob = new Blob([[header, example1, example2, note, note2].join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(URL.createObjectURL(blob), 'Plantilla_Clientes_NutriPlan.csv');
};

export const importCSV = (
  file: File,
  onSuccess: (diets: SavedDiet[]) => void,
  onError: (msg: string) => void
) => {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = e.target?.result as string;
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));

      if (lines.length < 2) throw new Error('El CSV no tiene filas de datos.');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const col = (row: string[], name: string) => {
        const idx = headers.findIndex(h => h.includes(name));
        return idx >= 0 ? (row[idx] ?? '').trim() : '';
      };

      const diets: SavedDiet[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');

        const name       = col(cols, 'nombre') || `Paciente ${i}`;
        const age        = parseInt(col(cols, 'edad'))   || 30;
        const weight     = parseFloat(col(cols, 'peso')) || 70;
        const height     = parseFloat(col(cols, 'altura')) || 165;
        const dietRaw    = col(cols, 'dieta').toLowerCase().replace(/ /g, '_');
        const genderRaw  = col(cols, 'gen').toLowerCase();
        const activityRaw = col(cols, 'activ').toLowerCase();

        const gender   = genderRaw === 'hombre' ? Gender.Male : Gender.Female;
        const activity = (Object.values(ActivityLevel) as string[]).includes(activityRaw)
          ? (activityRaw as ActivityLevel)
          : ActivityLevel.Moderate;
        const dietType = (Object.values(DietType) as string[]).includes(dietRaw)
          ? (dietRaw as DietType)
          : DietType.Balanced;

        const patientData: PatientData = {
          name, age, gender, weight, height, activity,
          dietType, conditions: [], duration: Duration.OneMonth,
        };

        const imc         = calculateIMC(weight, height);
        const bmr         = calculateBMR(patientData);
        const tee         = calculateTEE(bmr, activity);
        const idealWeight = calculateIdealWeight(height, gender);
        const refWeight   = imc > 30 ? calculateAdjustedWeight(weight, idealWeight) : weight;
        const macros      = calculateMacros(tee, dietType, refWeight, undefined, imc);

        diets.push({
          id: `csv_${Date.now()}_${i}`,
          timestamp: Date.now(),
          patientData,
          metrics: { imc, bmr, tee, macros },
          plan: { weeklyPlan: [], generalGuidelines: ['Plan pendiente de generar'], durationText: '—' },
        });
      }

      if (diets.length === 0) throw new Error('No se encontraron clientes válidos en el CSV.');
      onSuccess(diets);
    } catch (err: any) {
      onError(err.message || 'Error al leer el CSV.');
    }
  };
  reader.readAsText(file, 'UTF-8');
};

// --- Import ---

/** Valida que el payload tenga la estructura mínima esperada antes de cargarlo */
function validateBackupPayload(data: unknown): data is BackupPayload {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  // Debe tener al menos uno de los arrays esperados
  const hasDiets    = Array.isArray(d.diets);
  const hasFoods    = Array.isArray(d.foods);
  const hasProgress = Array.isArray(d.progress);
  if (!hasDiets && !hasFoods && !hasProgress) return false;
  // Validar estructura mínima de cada dieta
  if (hasDiets) {
    for (const diet of d.diets as unknown[]) {
      if (!diet || typeof diet !== 'object') return false;
      const item = diet as Record<string, unknown>;
      if (typeof item.id !== 'string') return false;
      if (typeof item.timestamp !== 'number') return false;
      if (!item.patientData || typeof item.patientData !== 'object') return false;
      if (!item.metrics || typeof item.metrics !== 'object') return false;
      if (!item.plan || typeof item.plan !== 'object') return false;
    }
  }
  return true;
}

export const importJSON = (
  file: File,
  onSuccess: (data: BackupPayload) => void,
  onError: () => void
) => {
  // Rechazar archivos > 50 MB para evitar DoS en el navegador
  if (file.size > 50 * 1024 * 1024) { onError(); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const raw  = e.target?.result as string;
      const data = JSON.parse(raw);
      if (!validateBackupPayload(data)) { onError(); return; }
      onSuccess(data as BackupPayload);
    } catch {
      onError();
    }
  };
  reader.readAsText(file);
};
