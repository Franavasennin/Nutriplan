import React, { useState, useMemo } from 'react';
import { ClientProgress, ProgressEntry, Gender } from '../types';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

interface Props {
  clients: string[];
  progressData: ClientProgress[];
  patientInfo?: Record<string, { age: number; height: number; gender: Gender }>;
  onSaveEntry: (clientName: string, entry: ProgressEntry) => void;
  onUpdateGoal: (clientName: string, weightGoal: number, goalDate: number) => void;
  onDeleteEntry?: (clientName: string, entryId: string) => void;
  onUpdateEntry?: (clientName: string, entry: ProgressEntry) => void;
}

type EmptyEntry = Omit<ProgressEntry, 'id' | 'date'>;
type NumericKey = 'weight' | 'imc' | 'bodyFat' | 'waterPercent' | 'proteinPercent' | 'muscleMass' | 'visceralFat' | 'boneMass' | 'basalMetabolism';

const EMPTY: EmptyEntry = {
  weight: 0,
  imc: undefined,
  bodyFat: undefined,
  waterPercent: undefined,
  proteinPercent: undefined,
  basalMetabolism: undefined,
  muscleMass: undefined,
  visceralFat: undefined,
  boneMass: undefined,
  notes: '',
};

// Adherencia autopercibida por visita. No existe columna propia en
// progress_entries (tabla con columnas tipadas, no JSONB) -- crear una
// exigiría una migración de esquema de producción sujeta a aprobación
// (ver docs/supabase/add_adherence_migration.sql, preparada sin aplicar).
// Mientras tanto se codifica como un prefijo legible dentro de la propia
// nota, que ya persiste sin tocar el esquema.
const ADHERENCE_LEVELS: { value: number; label: string; color: string }[] = [
  { value: 1, label: 'Muy baja', color: '#ef4444' },
  { value: 2, label: 'Baja',     color: '#f97316' },
  { value: 3, label: 'Media',    color: '#eab308' },
  { value: 4, label: 'Alta',     color: '#84cc16' },
  { value: 5, label: 'Muy alta', color: '#22c55e' },
];
const ADHERENCE_PREFIX_RE = /^\[Adherencia: (Muy baja|Baja|Media|Alta|Muy alta)\]\s*/;

const parseAdherence = (notes?: string): { level: number | null; text: string } => {
  if (!notes) return { level: null, text: '' };
  const m = notes.match(ADHERENCE_PREFIX_RE);
  if (!m) return { level: null, text: notes };
  const level = ADHERENCE_LEVELS.find(a => a.label === m[1])?.value ?? null;
  return { level, text: notes.slice(m[0].length) };
};

const formatAdherence = (level: number | null, text: string): string => {
  const found = ADHERENCE_LEVELS.find(a => a.value === level);
  return found ? `[Adherencia: ${found.label}] ${text}`.trim() : text;
};

const SERIES_CONFIG: { key: NumericKey; label: string; unit: string; color: string }[] = [
  { key: 'weight',          label: 'Peso',        unit: 'kg',   color: '#3b82f6' },
  { key: 'imc',             label: 'IMC',         unit: '',     color: '#8b5cf6' },
  { key: 'bodyFat',         label: '% Grasa',     unit: '%',    color: '#f97316' },
  { key: 'waterPercent',    label: '% Agua',      unit: '%',    color: '#06b6d4' },
  { key: 'proteinPercent',  label: '% Proteína',  unit: '%',    color: '#22c55e' },
  { key: 'muscleMass',      label: 'Músculo',     unit: 'kg',   color: '#84cc16' },
  { key: 'visceralFat',     label: 'G. Visceral', unit: '',     color: '#ec4899' },
  { key: 'boneMass',        label: 'Hueso',       unit: 'kg',   color: '#eab308' },
  { key: 'basalMetabolism', label: 'Met. Basal',  unit: 'kcal', color: '#ef4444' },
];

const SVG_W = 800, SVG_H = 240;
const PL = 10, PR = 10, PT = 16, PB = 40;
const CW = SVG_W - PL - PR;
const CH = SVG_H - PT - PB;

const ProgressTracker: React.FC<Props> = ({ clients, progressData, patientInfo, onSaveEntry, onUpdateGoal, onDeleteEntry, onUpdateEntry }) => {
  const { confirm } = useConfirm();
  const { toast }   = useToast();

  const handleEditEntry = (entry: ProgressEntry) => {
    setEditingId(entry.id);
    setEntryDate(new Date(entry.date).toISOString().split('T')[0]);
    const { level, text } = parseAdherence(entry.notes);
    setAdherenceLevel(level);
    setNewEntry({
      weight:          entry.weight,
      imc:             entry.imc,
      bodyFat:         entry.bodyFat,
      waterPercent:    entry.waterPercent,
      proteinPercent:  entry.proteinPercent,
      basalMetabolism: entry.basalMetabolism,
      muscleMass:      entry.muscleMass,
      visceralFat:     entry.visceralFat,
      boneMass:        entry.boneMass,
      notes:           text,
    });
    // Scroll al formulario
    document.getElementById('progress-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setAdherenceLevel(null);
    setNewEntry({ ...EMPTY, weight: latestEntry?.weight ?? 0 });
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteEntry = async (entryId: string, dateLabel: string) => {
    if (!onDeleteEntry || !selectedClient) return;
    const ok = await confirm({
      title:        'Eliminar registro',
      message:      `¿Eliminar el registro del ${dateLabel}? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel:  'Cancelar',
      danger:       true,
    });
    if (!ok) return;
    onDeleteEntry(selectedClient, entryId);
    toast('Registro eliminado.', 'success');
  };

  // editing state: null = new entry mode, string = id of entry being edited
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [newEntry, setNewEntry] = useState<EmptyEntry>({ ...EMPTY });
  const [adherenceLevel, setAdherenceLevel] = useState<number | null>(null);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeSeries, setActiveSeries] = useState<Set<NumericKey>>(new Set(SERIES_CONFIG.map(s => s.key)));
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [goalWeight, setGoalWeight] = useState<string>('');
  const [goalDate, setGoalDate] = useState<string>('');
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const clientData = progressData.find(c => c.clientName === selectedClient);
  const sortedEntries = clientData ? [...clientData.entries].sort((a, b) => a.date - b.date) : [];
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;
  const previousEntry = sortedEntries.length > 1 ? sortedEntries[sortedEntries.length - 2] : null;

  // Load saved goal when client changes
  React.useEffect(() => {
    if (clientData?.weightGoal) setGoalWeight(String(clientData.weightGoal));
    else setGoalWeight('');
    if (clientData?.goalDate) setGoalDate(new Date(clientData.goalDate).toISOString().split('T')[0]);
    else setGoalDate('');
    // Precarga el peso con el último registrado — permite anotar una visita de
    // seguimiento (solo notas, sin repesaje) sin obligar a inventar un peso.
    setNewEntry({ ...EMPTY, weight: latestEntry?.weight ?? 0 });
    setAdherenceLevel(null);
  }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveGoal = () => {
    if (!selectedClient || !goalWeight) return;
    const gDate = goalDate ? new Date(goalDate).getTime() : Date.now() + 90 * 24 * 60 * 60 * 1000;
    onUpdateGoal(selectedClient, Number(goalWeight), gDate);
  };

  // Goal progress calculation
  const startWeight = sortedEntries.length > 0 ? sortedEntries[0].weight : null;
  const savedGoalWeight = clientData?.weightGoal ?? null;
  const goalProgress = startWeight && savedGoalWeight && latestEntry
    ? Math.round(Math.min(100, Math.max(0,
        Math.abs(startWeight - latestEntry.weight) /
        Math.max(0.1, Math.abs(startWeight - savedGoalWeight)) * 100
      )))
    : null;
  const daysToGoal = clientData?.goalDate
    ? Math.ceil((clientData.goalDate - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // ── Calendar data ─────────────────────────────────────────────────────────
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const entryByDate = useMemo(() => {
    const map = new Map<string, ProgressEntry>();
    sortedEntries.forEach(e => {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, e);
    });
    return map;
  }, [sortedEntries]);

  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1);
    const last  = new Date(calYear, calMonth + 1, 0);
    const startDow = (first.getDay() + 6) % 7; // Mon = 0
    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    for (let i = startDow; i > 0; i--) {
      cells.push({ date: new Date(calYear, calMonth, 1 - i), isCurrentMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ date: new Date(calYear, calMonth, d), isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(calYear, calMonth + 1, i), isCurrentMonth: false });
    }
    return cells;
  }, [calYear, calMonth]);

  const navCal = (delta: number) => {
    const d = new Date(calYear, calMonth + delta);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const goalDateStr = clientData?.goalDate ? (() => {
    const g = new Date(clientData.goalDate);
    return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
  })() : null;

  // ── Weight velocity analysis ──────────────────────────────────────────────
  const firstEntry  = sortedEntries.length > 0 ? sortedEntries[0] : null;
  const daySpan = firstEntry && latestEntry && firstEntry.id !== latestEntry.id
    ? (latestEntry.date - firstEntry.date) / (1000 * 60 * 60 * 24) : 0;
  const totalWeightChange = firstEntry && latestEntry
    ? parseFloat((latestEntry.weight - firstEntry.weight).toFixed(1)) : null;
  const weeklyRate = daySpan >= 7 && totalWeightChange !== null
    ? parseFloat((totalWeightChange / (daySpan / 7)).toFixed(2)) : null;
  const projectedGoalDate: Date | null = (() => {
    if (!weeklyRate || weeklyRate >= 0 || !latestEntry || !savedGoalWeight) return null;
    const weeksNeeded = (latestEntry.weight - savedGoalWeight) / Math.abs(weeklyRate);
    if (weeksNeeded <= 0) return null;
    return new Date(latestEntry.date + weeksNeeded * 7 * 24 * 60 * 60 * 1000);
  })();

  // ── Sugerencias para el profesional ─────────────────────────────────────────
  // Recomendaciones accionables cuando el ritmo es lento, va a contrarritmo del
  // objetivo, o el plazo pactado no se va a cumplir al ritmo actual. No
  // sustituyen el criterio clínico — son un apoyo para priorizar la revisión.
  const KCAL_PER_KG = 7700;
  type Suggestion = { icon: string; tone: 'warn' | 'info' | 'success'; text: string; tips?: string[] };
  // Palancas de estilo de vida con respaldo en evidencia para mejorar la
  // pérdida de peso sin necesidad de bajar más las calorías (que ya tiene
  // un límite de seguridad, ver SAFE_MAX_WEEKLY_RATE más abajo).
  const HEALTHY_PACE_TIPS = [
    'Dormir 7–9h/noche: la falta de sueño eleva el hambre (grelina) y reduce la adherencia.',
    'Proteína en cada comida: mayor saciedad y protege la masa muscular en déficit.',
    'Verdura/fibra al inicio de cada comida: más volumen y saciedad con las mismas calorías.',
    'Entrenamiento de fuerza 2–3×/semana: preserva músculo y sostiene el metabolismo.',
    'Aumentar pasos diarios (NEAT): pequeños incrementos de actividad no estructurada suman sin necesidad de más restricción.',
    'Revisar alcohol y ultraprocesados de picoteo: suelen ser la brecha entre lo planificado y lo real.',
    'Registrar todas las comidas (incluidos fines de semana): la adherencia percibida suele ser mayor que la real.',
    'Gestión del estrés y horarios regulares de comida: el cortisol elevado dificulta la pérdida y favorece retención de líquidos.',
  ];
  const pickTips = (seed: string, n: number) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const start = h % HEALTHY_PACE_TIPS.length;
    return Array.from({ length: n }, (_, i) => HEALTHY_PACE_TIPS[(start + i) % HEALTHY_PACE_TIPS.length]);
  };
  const suggestions: Suggestion[] = (() => {
    if (weeklyRate === null || !latestEntry) return [];
    const list: Suggestion[] = [];

    // Estancamiento: últimos registros (≥14 días) con variación mínima de peso.
    const recentSpanEntries = sortedEntries.filter(e => latestEntry.date - e.date <= 21 * 24 * 60 * 60 * 1000);
    if (recentSpanEntries.length >= 3) {
      const span = (latestEntry.date - recentSpanEntries[0].date) / (1000 * 60 * 60 * 24);
      const weights = recentSpanEntries.map(e => e.weight);
      const range = Math.max(...weights) - Math.min(...weights);
      if (span >= 14 && range <= 0.3) {
        list.push({
          icon: 'trending_flat', tone: 'warn',
          text: 'Estancamiento: el peso apenas varía desde hace 2+ semanas (normal tras varias semanas de déficit — el metabolismo se adapta). Antes de bajar más las calorías, revisa estos hábitos:',
          tips: pickTips(selectedClient + 'plateau', 3),
        });
      }
    }

    if (!savedGoalWeight) {
      list.push({
        icon: 'flag', tone: 'info',
        text: 'Este paciente no tiene un objetivo de peso y fecha definidos — sin ellos no se puede calcular el ritmo necesario ni avisar si va con retraso.',
      });
      return list;
    }

    const wantsToLose = savedGoalWeight < latestEntry.weight;
    const wantsToGain = savedGoalWeight > latestEntry.weight;

    if (wantsToLose && weeklyRate >= 0) {
      list.push({
        icon: 'priority_high', tone: 'warn',
        text: 'El peso no baja pese al objetivo de pérdida. Antes de tocar el plan, revisa adherencia real y estos hábitos (si la adherencia es buena, el GET probablemente ha bajado con el peso ya perdido y toca recalcularlo):',
        tips: pickTips(selectedClient + 'stuck', 3),
      });
    } else if (wantsToLose && Math.abs(weeklyRate) < 0.3) {
      list.push({
        icon: 'speed', tone: 'warn',
        text: `Ritmo lento (${weeklyRate} kg/semana, rango saludable 0,3–1 kg/semana). Antes de recortar más calorías, prueba a reforzar:`,
        tips: pickTips(selectedClient + 'slow', 3),
      });
    } else if (wantsToLose && Math.abs(weeklyRate) > 1) {
      list.push({
        icon: 'warning', tone: 'warn',
        text: 'Ritmo muy rápido (>1 kg/semana): riesgo de pérdida de masa muscular. Revisa que la proteína esté cubierta y considera reducir ligeramente el déficit.',
      });
    } else if (wantsToGain && weeklyRate <= 0) {
      list.push({
        icon: 'priority_high', tone: 'warn',
        text: 'El peso no sube pese al objetivo de ganancia. Confirma que el superávit sea real (+150–300 kcal/día) y refuerza el entrenamiento de fuerza para priorizar masa magra.',
      });
    } else if (wantsToGain && weeklyRate > 0.5) {
      list.push({
        icon: 'warning', tone: 'warn',
        text: 'Ganancia rápida (>0,5 kg/semana): parte probablemente es grasa. Considera moderar el superávit calórico.',
      });
    }

    // Retraso respecto a la fecha objetivo pactada.
    const SAFE_MAX_WEEKLY_RATE = 1; // kg/semana — límite clínico razonable (ISSN/ACSM)
    if (clientData?.goalDate && weeklyRate < 0 && savedGoalWeight) {
      const weeksRemaining = (clientData.goalDate - Date.now()) / (1000 * 60 * 60 * 24 * 7);
      if (weeksRemaining > 0) {
        const requiredWeeklyRate = (latestEntry.weight - savedGoalWeight) / weeksRemaining;
        if (Math.abs(requiredWeeklyRate) > SAFE_MAX_WEEKLY_RATE) {
          // La fecha pactada exige un ritmo clínicamente no recomendable — el
          // problema es la fecha, no el déficit. Sugerir un ajuste de plazo en
          // vez de un déficit calórico extremo.
          const weeksAtSafeRate = Math.abs(latestEntry.weight - savedGoalWeight) / SAFE_MAX_WEEKLY_RATE;
          const realisticDate = new Date(Date.now() + weeksAtSafeRate * 7 * 24 * 60 * 60 * 1000);
          list.push({
            icon: 'event_busy', tone: 'warn',
            text: `La fecha objetivo pactada exige un ritmo de ~${Math.abs(requiredWeeklyRate).toFixed(1)} kg/semana, por encima del máximo recomendado (~1 kg/semana). No es la dieta la que falla — conviene renegociar la fecha con el paciente; a ritmo saludable se alcanzaría hacia el ${realisticDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}.`,
          });
        } else if (Math.abs(requiredWeeklyRate) > Math.abs(weeklyRate) + 0.05) {
          const extraKcal = Math.round(((Math.abs(requiredWeeklyRate) - Math.abs(weeklyRate)) * KCAL_PER_KG / 7) / 50) * 50;
          const daysLate = projectedGoalDate ? Math.round((projectedGoalDate.getTime() - clientData.goalDate) / (1000 * 60 * 60 * 24)) : null;
          list.push({
            icon: 'schedule', tone: 'warn',
            text: `Al ritmo actual llegaría${daysLate && daysLate > 0 ? ` ~${daysLate} días tarde` : ''} a la fecha objetivo (equivaldría a ~${extraKcal} kcal/día extra de déficit). Antes de recortar más calorías, prueba a reforzar hábitos — o ajusta la fecha a algo más realista:`,
            tips: pickTips(selectedClient + 'late', 3),
          });
        }
      }
    }

    return list.slice(0, 3);
  })();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newEntry.weight) return;

    const entry: ProgressEntry = {
      id:              editingId ?? crypto.randomUUID(),
      date:            entryDate ? new Date(entryDate).getTime() : Date.now(),
      weight:          Number(newEntry.weight),
      imc:             newEntry.imc             ? Number(newEntry.imc)             : undefined,
      bodyFat:         newEntry.bodyFat         ? Number(newEntry.bodyFat)         : undefined,
      waterPercent:    newEntry.waterPercent    ? Number(newEntry.waterPercent)    : undefined,
      proteinPercent:  newEntry.proteinPercent  ? Number(newEntry.proteinPercent)  : undefined,
      basalMetabolism: newEntry.basalMetabolism ? Number(newEntry.basalMetabolism) : undefined,
      muscleMass:      newEntry.muscleMass      ? Number(newEntry.muscleMass)      : undefined,
      visceralFat:     newEntry.visceralFat     ? Number(newEntry.visceralFat)     : undefined,
      boneMass:        newEntry.boneMass        ? Number(newEntry.boneMass)        : undefined,
      notes:           formatAdherence(adherenceLevel, newEntry.notes ?? ''),
    };

    if (editingId) {
      onUpdateEntry?.(selectedClient, entry);
      toast('Registro actualizado.', 'success');
      setEditingId(null);
    } else {
      onSaveEntry(selectedClient, entry);
    }

    setAdherenceLevel(null);
    setNewEntry({ ...EMPTY, weight: entry.weight });
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  const set = (field: keyof EmptyEntry, val: string) =>
    setNewEntry(prev => ({ ...prev, [field]: val === '' ? undefined : val }));

  const getChange = (field: 'weight' | 'bodyFat' | 'muscleMass') => {
    if (!latestEntry || !previousEntry) return null;
    const curr = latestEntry[field];
    const prev = previousEntry[field];
    if (curr == null || prev == null) return null;
    const diff = curr - prev;
    return { diff: diff.toFixed(1), positive: diff > 0 };
  };

  const weightChange = getChange('weight');
  const fatChange = getChange('bodyFat');
  const muscleChange = getChange('muscleMass');

  const toX = (i: number) =>
    PL + (sortedEntries.length <= 1 ? CW / 2 : (i / (sortedEntries.length - 1)) * CW);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (sortedEntries.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W;
    const idx = Math.round(((svgX - PL) / CW) * (sortedEntries.length - 1));
    setHoverIdx(Math.max(0, Math.min(sortedEntries.length - 1, idx)));
  };

  const inputCls = "w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-3 outline-none focus:border-primary dark:text-white text-sm";
  const labelCls = "block text-xs font-semibold text-text-sub dark:text-gray-400 uppercase mb-1";

  return (
    <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-text-main dark:text-white text-3xl font-black leading-tight tracking-tight mb-2">Progreso y Composición Corporal</h1>
            <p className="text-text-sub dark:text-gray-400 text-base">Registra los datos de la pesa inteligente y visualiza la evolución.</p>
          </div>
          <div className="w-full md:w-72">
            <select
              aria-label="Seleccionar cliente"
              className="w-full h-12 px-4 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark rounded-lg outline-none focus:ring-2 focus:ring-primary dark:text-white"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">-- Seleccionar Cliente --</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {selectedClient ? (
          <>
            {/* Datos iniciales del paciente (edad, altura, sexo) — tomados
                del registro del paciente, no cambian con el seguimiento. */}
            {patientInfo?.[selectedClient] && (
              <div className="mb-4 flex flex-wrap gap-4 text-sm text-text-sub dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">cake</span>
                  {patientInfo[selectedClient].age} años
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">height</span>
                  {patientInfo[selectedClient].height} cm
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">wc</span>
                  {patientInfo[selectedClient].gender === Gender.Male ? 'Hombre' : 'Mujer'}
                </span>
              </div>
            )}

            {/* Goal Card */}
            <div className="mb-4 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-xs font-bold text-text-sub dark:text-gray-400 uppercase flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-primary">flag</span>
                  Objetivo de peso
                </span>
                {savedGoalWeight && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-lg font-black text-text-main dark:text-white">{savedGoalWeight} kg</span>
                    {daysToGoal !== null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${daysToGoal > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {daysToGoal > 0 ? `${daysToGoal} días` : 'Vencido'}
                        {clientData?.goalDate ? ` · ${new Date(clientData.goalDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}` : ''}
                      </span>
                    )}
                    {goalProgress !== null && (
                      <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
                        </div>
                        <span className="text-xs font-bold text-primary-accessible dark:text-primary">{goalProgress}%</span>
                      </div>
                    )}
                  </div>
                )}
                {!savedGoalWeight && <span className="text-sm text-text-sub dark:text-gray-500 italic">Sin objetivo definido</span>}
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-sub uppercase font-bold">Kg objetivo</span>
                  <input type="number" step="0.1" placeholder="Ej. 72"
                    className="h-9 w-24 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 text-sm dark:text-white outline-none focus:border-primary"
                    value={goalWeight} onChange={e => setGoalWeight(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-text-sub uppercase font-bold">Fecha límite</span>
                  <input type="date"
                    className="h-9 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 text-sm dark:text-white outline-none focus:border-primary"
                    value={goalDate} onChange={e => setGoalDate(e.target.value)} />
                </div>
                <button onClick={handleSaveGoal}
                  className="h-9 px-4 rounded-lg bg-primary text-background-dark text-xs font-black hover:brightness-90 transition-all">
                  Guardar
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="flex flex-col p-4 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-text-sub dark:text-gray-400 text-xs font-medium">Peso</span>
                  <span className="material-symbols-outlined text-gray-300 text-lg">monitor_weight</span>
                </div>
                <span className="text-2xl font-bold text-text-main dark:text-white">{latestEntry?.weight ?? '-'} <span className="text-sm font-normal text-text-sub">kg</span></span>
                {weightChange && (
                  <span className={`text-xs font-bold mt-1 ${Number(weightChange.diff) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Number(weightChange.diff) < 0 ? '▼' : '▲'} {Math.abs(Number(weightChange.diff))} kg
                  </span>
                )}
              </div>
              <div className="flex flex-col p-4 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-text-sub dark:text-gray-400 text-xs font-medium">% Grasa</span>
                  <span className="material-symbols-outlined text-gray-300 text-lg">water_drop</span>
                </div>
                <span className="text-2xl font-bold text-text-main dark:text-white">{latestEntry?.bodyFat ?? '-'} <span className="text-sm font-normal text-text-sub">%</span></span>
                {fatChange && (
                  <span className={`text-xs font-bold mt-1 ${Number(fatChange.diff) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Number(fatChange.diff) < 0 ? '▼' : '▲'} {Math.abs(Number(fatChange.diff))}%
                  </span>
                )}
              </div>
              <div className="flex flex-col p-4 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-text-sub dark:text-gray-400 text-xs font-medium">Músculo</span>
                  <span className="material-symbols-outlined text-gray-300 text-lg">fitness_center</span>
                </div>
                <span className="text-2xl font-bold text-text-main dark:text-white">{latestEntry?.muscleMass ?? '-'} <span className="text-sm font-normal text-text-sub">kg</span></span>
                {muscleChange && (
                  <span className={`text-xs font-bold mt-1 ${Number(muscleChange.diff) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Number(muscleChange.diff) > 0 ? '▲' : '▼'} {Math.abs(Number(muscleChange.diff))} kg
                  </span>
                )}
              </div>
              <div className="flex flex-col p-4 bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-text-sub dark:text-gray-400 text-xs font-medium">Met. Basal</span>
                  <span className="material-symbols-outlined text-gray-300 text-lg">local_fire_department</span>
                </div>
                <span className="text-2xl font-bold text-text-main dark:text-white">{latestEntry?.basalMetabolism ?? '-'} <span className="text-sm font-normal text-text-sub">kcal</span></span>
              </div>
            </div>

            {/* Calendar + Weight velocity row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

              {/* ── Revision Calendar ── */}
              <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
                    Días de Revisión
                  </h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navCal(-1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-text-sub dark:text-gray-400">chevron_left</span>
                    </button>
                    <span className="text-sm font-bold text-text-main dark:text-white w-32 text-center">
                      {new Date(calYear, calMonth).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => navCal(1)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <span className="material-symbols-outlined text-[18px] text-text-sub dark:text-gray-400">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 mb-1">
                  {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-text-sub dark:text-gray-500 uppercase py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map(({ date, isCurrentMonth }, idx) => {
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const hasEntry  = entryByDate.has(key);
                    const isToday   = key === todayStr;
                    const isGoalDay = key === goalDateStr;
                    const entry     = entryByDate.get(key);
                    return (
                      <div key={idx}
                        title={hasEntry ? `${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${entry?.weight} kg${entry?.bodyFat != null ? ` · ${entry.bodyFat}% grasa` : ''}` : undefined}
                        className={[
                          'relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs transition-colors',
                          isCurrentMonth ? 'text-text-main dark:text-white' : 'text-gray-300 dark:text-gray-600',
                          isToday   ? 'ring-2 ring-primary bg-primary/10' : '',
                          isGoalDay ? 'ring-2 ring-blue-500 bg-blue-500/10' : '',
                          hasEntry  ? 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20' : '',
                        ].join(' ')}
                      >
                        <span className={`font-semibold text-[11px] ${isToday ? 'text-primary-accessible dark:text-primary' : ''}`}>{date.getDate()}</span>
                        {hasEntry && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5 absolute bottom-1" />
                        )}
                        {isGoalDay && !hasEntry && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5 absolute bottom-1" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border-light dark:border-border-dark">
                  <div className="flex items-center gap-1.5 text-[11px] text-text-sub dark:text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Revisión registrada
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-sub dark:text-gray-400">
                    <span className="w-4 h-4 rounded flex items-center justify-center ring-2 ring-primary bg-primary/10 text-[9px] font-bold text-primary-accessible dark:text-primary">H</span> Hoy
                  </div>
                  {goalDateStr && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-sub dark:text-gray-400">
                      <span className="w-4 h-4 rounded flex items-center justify-center ring-2 ring-blue-500 bg-blue-500/10 text-[9px] font-bold text-blue-500">O</span> Objetivo
                    </div>
                  )}
                </div>
              </div>

              {/* ── Weight velocity card ── */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4 flex flex-col gap-3">
                <h3 className="font-bold text-text-main dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">speed</span>
                  Ritmo de Pérdida
                </h3>

                {sortedEntries.length < 2 ? (
                  <p className="text-sm text-text-sub dark:text-gray-400 italic mt-2">Necesitas al menos 2 registros para calcular el ritmo.</p>
                ) : (
                  <>
                    {/* Total change */}
                    <div className="flex flex-col bg-background-light dark:bg-background-dark rounded-lg p-3">
                      <span className="text-[10px] uppercase font-bold text-text-sub dark:text-gray-500 mb-1">Cambio total</span>
                      <span className={`text-2xl font-black ${totalWeightChange !== null && totalWeightChange < 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {totalWeightChange !== null ? (totalWeightChange > 0 ? '+' : '') + totalWeightChange : '—'} kg
                      </span>
                      <span className="text-[11px] text-text-sub dark:text-gray-500 mt-0.5">
                        desde {firstEntry ? new Date(firstEntry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        {' '}({daySpan >= 1 ? `${Math.round(daySpan)} días` : '< 1 día'})
                      </span>
                    </div>

                    {/* Weekly / monthly rate */}
                    {weeklyRate !== null && (
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark rounded-lg p-3">
                          <span className="text-[10px] uppercase font-bold text-text-sub dark:text-gray-500 mb-1">Semanal</span>
                          <span className={`text-lg font-black ${weeklyRate < 0 ? 'text-green-500' : 'text-orange-500'}`}>
                            {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark rounded-lg p-3">
                          <span className="text-[10px] uppercase font-bold text-text-sub dark:text-gray-500 mb-1">Mensual</span>
                          <span className={`text-lg font-black ${weeklyRate < 0 ? 'text-green-500' : 'text-orange-500'}`}>
                            {(weeklyRate * 4.33 > 0 ? '+' : '')}{(weeklyRate * 4.33).toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Projected goal date */}
                    {projectedGoalDate ? (
                      <div className="flex flex-col bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Meta estimada al ritmo actual</span>
                        <span className="text-base font-black text-blue-700 dark:text-blue-300">
                          {projectedGoalDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        {clientData?.goalDate && (
                          <span className={`text-[11px] font-semibold mt-1 ${projectedGoalDate.getTime() <= clientData.goalDate ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {projectedGoalDate.getTime() <= clientData.goalDate
                              ? '✓ A tiempo para el objetivo'
                              : `⚠ ${Math.round((projectedGoalDate.getTime() - clientData.goalDate) / (1000 * 60 * 60 * 24))} días tarde`}
                          </span>
                        )}
                      </div>
                    ) : savedGoalWeight && weeklyRate !== null && weeklyRate >= 0 ? (
                      <div className="flex flex-col bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                        <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">El peso está subiendo — ajusta el plan para alcanzar el objetivo.</span>
                      </div>
                    ) : null}

                    {/* Velocity recommendation */}
                    {weeklyRate !== null && (
                      <p className="text-[11px] text-text-sub dark:text-gray-500 leading-relaxed">
                        {Math.abs(weeklyRate) > 1
                          ? '⚠ Ritmo elevado (>1 kg/sem). Considera revisar el déficit para evitar pérdida de músculo.'
                          : Math.abs(weeklyRate) >= 0.3
                          ? '✓ Ritmo saludable (0,3–1 kg/sem).'
                          : weeklyRate < 0
                          ? 'Ritmo muy lento. Podrías aumentar ligeramente el déficit.'
                          : ''}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Sugerencias para el profesional */}
            {suggestions.length > 0 && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4 mb-6">
                <h3 className="font-bold text-text-main dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">tips_and_updates</span>
                  Sugerencias para alcanzar la meta
                </h3>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                      s.tone === 'warn'
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                    }`}>
                      <span className="material-symbols-outlined text-[18px] mt-0.5">{s.icon}</span>
                      <div className="leading-relaxed">
                        {s.text}
                        {s.tips && (
                          <ul className="mt-1.5 space-y-1 list-disc list-inside">
                            {s.tips.map((tip, ti) => <li key={ti}>{tip}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-sub dark:text-gray-500 mt-3 italic">
                  Sugerencias orientativas basadas en la evolución registrada — no sustituyen el criterio clínico.
                </p>
              </div>
            )}

            {/* Body composition breakdown — visible with any single entry that has composition data */}
            {latestEntry && (latestEntry.bodyFat != null || latestEntry.muscleMass != null || latestEntry.waterPercent != null) && (() => {
              const w = latestEntry.weight;
              const fatPct    = latestEntry.bodyFat      ?? 0;
              const musclePct = latestEntry.muscleMass   != null ? (latestEntry.muscleMass / w * 100) : 0;
              const waterPct  = latestEntry.waterPercent ?? 0;
              const bonePct   = latestEntry.boneMass     != null ? (latestEntry.boneMass   / w * 100) : 0;
              const otherPct  = Math.max(0, 100 - fatPct - musclePct - waterPct - bonePct);
              const bars = [
                { label: 'Agua',    pct: waterPct,  color: '#06b6d4', kg: (waterPct  / 100 * w) },
                { label: 'Músculo', pct: musclePct, color: '#22c55e', kg: latestEntry.muscleMass ?? (musclePct / 100 * w) },
                { label: 'Grasa',   pct: fatPct,    color: '#f97316', kg: (fatPct    / 100 * w) },
                { label: 'Hueso',   pct: bonePct,   color: '#eab308', kg: latestEntry.boneMass   ?? (bonePct   / 100 * w) },
                { label: 'Otro',    pct: otherPct,  color: '#94a3b8', kg: (otherPct  / 100 * w) },
              ].filter(b => b.pct > 0.5);
              return (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4 mb-6">
                  <h3 className="font-bold text-text-main dark:text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">pie_chart</span>
                    Composición Corporal — {w} kg
                  </h3>
                  <div className="flex rounded-full overflow-hidden h-5 mb-4 w-full">
                    {bars.map(b => (
                      <div key={b.label}
                        style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                        title={`${b.label}: ${b.pct.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {bars.map(b => (
                      <div key={b.label} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
                        <span className="text-xs font-semibold text-text-main dark:text-white">{b.label}</span>
                        <span className="text-xs text-text-sub dark:text-gray-400">{b.pct.toFixed(1)}% · {b.kg.toFixed(1)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Hint when only 1 entry exists */}
            {sortedEntries.length === 1 && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-5 mb-6 flex items-center gap-4">
                <span className="material-symbols-outlined text-3xl text-primary/40">show_chart</span>
                <div>
                  <p className="font-semibold text-sm text-text-main dark:text-white">Gráfica de evolución</p>
                  <p className="text-xs text-text-sub dark:text-gray-400 mt-0.5">Registra un segundo pesaje para ver la tendencia en el tiempo.</p>
                </div>
              </div>
            )}

            {/* Multi-entry trend chart */}
            {sortedEntries.length >= 2 && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm p-4 mb-6">
                <h3 className="font-bold text-text-main dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">show_chart</span>
                  Evolución
                </h3>

                {/* Legend / toggles */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {SERIES_CONFIG.map(s => {
                    const hasData = sortedEntries.some(e => e[s.key] != null);
                    if (!hasData) return null;
                    const active = activeSeries.has(s.key);
                    return (
                      <button
                        type="button"
                        key={s.key}
                        onClick={() => setActiveSeries(prev => {
                          const next = new Set(prev);
                          active ? next.delete(s.key) : next.add(s.key);
                          return next;
                        })}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all"
                        style={{
                          borderColor: s.color,
                          color: s.color,
                          backgroundColor: active ? `${s.color}18` : 'transparent',
                          opacity: active ? 1 : 0.4,
                        }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* SVG */}
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full cursor-crosshair"
                  style={{ height: 240 }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {/* Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(t => (
                    <line key={t}
                      x1={PL} y1={PT + (1 - t) * CH}
                      x2={PL + CW} y2={PT + (1 - t) * CH}
                      stroke="currentColor" strokeOpacity={0.07} strokeWidth={1}
                    />
                  ))}

                  {/* X axis labels */}
                  {sortedEntries.map((entry, i) => {
                    const skip = sortedEntries.length > 10 &&
                      i % Math.ceil(sortedEntries.length / 8) !== 0 &&
                      i !== sortedEntries.length - 1;
                    if (skip) return null;
                    return (
                      <text key={entry.id}
                        x={toX(i)} y={SVG_H - 6}
                        textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.45}
                      >
                        {new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </text>
                    );
                  })}

                  {/* Series lines */}
                  {SERIES_CONFIG.map(s => {
                    if (!activeSeries.has(s.key)) return null;
                    const points = sortedEntries
                      .map((e, i) => ({ val: e[s.key] as number | undefined, i }))
                      .filter((p): p is { val: number; i: number } => p.val != null);
                    if (points.length < 1) return null;

                    const vals = points.map(p => p.val);
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const range = Math.max(max - min, mean * 0.05);
                    const padding = range * 0.2;
                    const paddedMin = min - padding;
                    const paddedRange = range + 2 * padding;
                    const toY = (v: number) => PT + (1 - (v - paddedMin) / paddedRange) * CH;

                    const d = points.map((p, idx) =>
                      `${idx === 0 ? 'M' : 'L'}${toX(p.i).toFixed(1)},${toY(p.val).toFixed(1)}`
                    ).join(' ');

                    return (
                      <g key={s.key}>
                        <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                        {points.map(p => (
                          <circle key={p.i} cx={toX(p.i)} cy={toY(p.val)} r={hoverIdx === p.i ? 5 : 3.5}
                            fill={s.color} stroke="white" strokeWidth={1.5}
                            style={{ transition: 'r 0.1s' }}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Goal weight line (only on weight series) */}
                  {savedGoalWeight && activeSeries.has('weight') && (() => {
                    const weightPoints = sortedEntries
                      .map((e, i) => ({ val: e.weight, i }));
                    if (weightPoints.length < 1) return null;
                    const vals = weightPoints.map(p => p.val);
                    const allVals = [...vals, savedGoalWeight];
                    const min = Math.min(...allVals);
                    const max = Math.max(...allVals);
                    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const range = Math.max(max - min, mean * 0.05);
                    const padding = range * 0.2;
                    const paddedMin = min - padding;
                    const paddedRange = range + 2 * padding;
                    const toY = (v: number) => PT + (1 - (v - paddedMin) / paddedRange) * CH;
                    const goalY = toY(savedGoalWeight);
                    return (
                      <g>
                        <line x1={PL} y1={goalY} x2={PL + CW} y2={goalY}
                          stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity={0.7} />
                        <text x={PL + CW - 2} y={goalY - 4} textAnchor="end"
                          fontSize={9} fill="#3b82f6" fillOpacity={0.9} fontWeight="600">
                          Objetivo {savedGoalWeight} kg
                        </text>
                      </g>
                    );
                  })()}

                  {/* Hover line + tooltip */}
                  {hoverIdx != null && (() => {
                    const entry = sortedEntries[hoverIdx];
                    const x = toX(hoverIdx);
                    const activeRows = SERIES_CONFIG.filter(s => activeSeries.has(s.key) && entry[s.key] != null);
                    const tipW = 148;
                    const tipH = 14 + activeRows.length * 17;
                    const tipX = x > SVG_W / 2 ? x - tipW - 8 : x + 8;
                    const tipY = PT;

                    return (
                      <g>
                        <line x1={x} y1={PT} x2={x} y2={PT + CH}
                          stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="4 3" />
                        {activeRows.length > 0 && (
                          <>
                            <rect x={tipX} y={tipY} width={tipW} height={tipH}
                              rx={5} fill="#111" fillOpacity={0.88} />
                            <text x={tipX + 8} y={tipY + 11} fontSize={9} fill="white" fillOpacity={0.6}>
                              {new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </text>
                            {activeRows.map((s, i) => (
                              <text key={s.key} x={tipX + 8} y={tipY + 24 + i * 17} fontSize={11} fill={s.color} fontWeight="600">
                                {s.label}: {entry[s.key]}{s.unit}
                              </text>
                            ))}
                          </>
                        )}
                      </g>
                    );
                  })()}
                </svg>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form */}
              <div id="progress-form" className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm h-fit">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-text-main dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{editingId ? 'edit' : 'edit_calendar'}</span>
                    {editingId ? 'Editar Registro' : 'Nuevo Registro'}
                  </h3>
                  {editingId && (
                    <button type="button" onClick={handleCancelEdit}
                      className="text-xs font-semibold text-text-sub hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 flex items-center gap-1 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">close</span> Cancelar
                    </button>
                  )}
                </div>
                {editingId && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Editando registro existente. Los cambios se guardarán sobre el original.
                  </div>
                )}
                <form onSubmit={handleSave} className="space-y-3">
                  <div>
                    <label className={labelCls}>Fecha *</label>
                    <input aria-label="Fecha del registro" type="date" required className={inputCls}
                      value={entryDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setEntryDate(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Peso (kg) *</label>
                    <input aria-label="Peso" type="number" step="0.1" required className={inputCls}
                      value={newEntry.weight || ''}
                      onChange={e => set('weight', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>IMC</label>
                      <input aria-label="IMC" type="number" step="0.1" className={inputCls}
                        placeholder="—" value={newEntry.imc ?? ''}
                        onChange={e => set('imc', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>% Grasa</label>
                      <input aria-label="Grasa corporal" type="number" step="0.1" className={inputCls}
                        placeholder="—" value={newEntry.bodyFat ?? ''}
                        onChange={e => set('bodyFat', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>% Agua</label>
                      <input aria-label="Porcentaje de agua" type="number" step="0.1" className={inputCls}
                        placeholder="—" value={newEntry.waterPercent ?? ''}
                        onChange={e => set('waterPercent', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>% Proteína</label>
                      <input aria-label="Porcentaje de proteína" type="number" step="0.1" className={inputCls}
                        placeholder="—" value={newEntry.proteinPercent ?? ''}
                        onChange={e => set('proteinPercent', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Metabolismo Basal (kcal)</label>
                    <input aria-label="Metabolismo basal" type="number" step="1" className={inputCls}
                      placeholder="—" value={newEntry.basalMetabolism ?? ''}
                      onChange={e => set('basalMetabolism', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Músculo (kg)</label>
                      <input aria-label="Masa muscular" type="number" step="0.1" className={inputCls}
                        placeholder="—" value={newEntry.muscleMass ?? ''}
                        onChange={e => set('muscleMass', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Grasa Visceral</label>
                      <input aria-label="Grasa visceral" type="number" step="1" className={inputCls}
                        placeholder="nivel 1-20" value={newEntry.visceralFat ?? ''}
                        onChange={e => set('visceralFat', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Masa Ósea (kg)</label>
                    <input aria-label="Masa ósea" type="number" step="0.01" className={inputCls}
                      placeholder="—" value={newEntry.boneMass ?? ''}
                      onChange={e => set('boneMass', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Adherencia percibida</label>
                    <div className="flex gap-1.5">
                      {ADHERENCE_LEVELS.map(a => {
                        const active = adherenceLevel === a.value;
                        return (
                          <button
                            type="button"
                            key={a.value}
                            title={a.label}
                            onClick={() => setAdherenceLevel(active ? null : a.value)}
                            className="flex-1 h-9 rounded-lg text-[11px] font-bold border transition-all"
                            style={{
                              borderColor: a.color,
                              color: active ? 'white' : a.color,
                              backgroundColor: active ? a.color : 'transparent',
                            }}
                          >
                            {a.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Notas</label>
                    <textarea aria-label="Notas" className={inputCls} rows={2}
                      placeholder="Ej. Visita de control sin repesaje: refiere buena adherencia..."
                      value={newEntry.notes ?? ''}
                      onChange={e => set('notes', e.target.value)} />
                    <span className="text-[10px] text-text-sub dark:text-gray-500">El peso se precarga con el último registrado — puedes anotar una visita solo de seguimiento sin cambiarlo.</span>
                  </div>
                  <button type="submit"
                    className={`w-full hover:brightness-95 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all ${editingId ? 'bg-amber-400 shadow-amber-400/20' : 'bg-primary shadow-primary/20'}`}>
                    <span className="material-symbols-outlined text-[20px]">{editingId ? 'update' : 'save'}</span>
                    {editingId ? 'Actualizar Registro' : 'Guardar Registro'}
                  </button>
                </form>
              </div>

              {/* History Table */}
              <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-[#1A2C20]">
                  <h3 className="font-bold text-text-main dark:text-white">Historial de Registros</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="bg-background-light dark:bg-background-dark text-text-sub dark:text-gray-400 uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3 text-center">Peso</th>
                        <th className="p-3 text-center">IMC</th>
                        <th className="p-3 text-center">% Grasa</th>
                        <th className="p-3 text-center">% Agua</th>
                        <th className="p-3 text-center">% Prot.</th>
                        <th className="p-3 text-center">Met.B</th>
                        <th className="p-3 text-center">Músculo</th>
                        <th className="p-3 text-center">Visc.</th>
                        <th className="p-3 text-center">Hueso</th>
                        <th className="p-3">Notas</th>
                        {(onDeleteEntry || onUpdateEntry) && <th className="p-3 text-center">Acción</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {sortedEntries.length === 0 ? (
                        <tr><td colSpan={onDeleteEntry ? 12 : 11} className="p-8 text-center text-gray-400">Sin registros aún</td></tr>
                      ) : (
                        [...sortedEntries].reverse().map(entry => (
                          <tr key={entry.id}
                            className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${editingId === entry.id ? 'bg-amber-50 dark:bg-amber-900/10 ring-1 ring-inset ring-amber-300 dark:ring-amber-700' : ''}`}>
                            <td className="p-3 font-medium text-text-main dark:text-gray-300 whitespace-nowrap">{new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                            <td className="p-3 text-center font-bold text-text-main dark:text-white">{entry.weight} kg</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.imc ?? '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.bodyFat != null ? `${entry.bodyFat}%` : '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.waterPercent != null ? `${entry.waterPercent}%` : '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.proteinPercent != null ? `${entry.proteinPercent}%` : '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.basalMetabolism != null ? `${entry.basalMetabolism}` : '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.muscleMass != null ? `${entry.muscleMass} kg` : '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.visceralFat ?? '-'}</td>
                            <td className="p-3 text-center text-text-sub dark:text-gray-400">{entry.boneMass != null ? `${entry.boneMass} kg` : '-'}</td>
                            <td className="p-3 text-text-sub dark:text-gray-500 max-w-[160px]" title={entry.notes || undefined}>
                              {(() => {
                                const { level, text } = parseAdherence(entry.notes);
                                const adh = ADHERENCE_LEVELS.find(a => a.value === level);
                                return (
                                  <div className="flex items-center gap-1.5">
                                    {adh && (
                                      <span
                                        className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
                                        style={{ backgroundColor: adh.color }}
                                      >
                                        {adh.value}
                                      </span>
                                    )}
                                    <span className="truncate">{text || (adh ? '' : '-')}</span>
                                  </div>
                                );
                              })()}
                            </td>
                            {(onDeleteEntry || onUpdateEntry) && (
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {onUpdateEntry && (
                                    <button
                                      onClick={() => handleEditEntry(entry)}
                                      title="Editar registro"
                                      className={`size-8 inline-flex items-center justify-center rounded-lg transition-all ${editingId === entry.id ? 'bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-300' : 'text-text-sub hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600'}`}
                                    >
                                      <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                  )}
                                  {onDeleteEntry && (
                                    <button
                                      onClick={() => handleDeleteEntry(entry.id, new Date(entry.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }))}
                                      title="Eliminar registro"
                                      className="size-8 inline-flex items-center justify-center rounded-lg text-text-sub hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark border-dashed">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">search</span>
            <p className="text-text-sub dark:text-gray-400 text-lg">Selecciona un cliente para ver su progreso</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;
