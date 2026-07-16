import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  SavedDiet, CustomFood, ClientProgress, Recipe,
  PatientData, CalculatedMetrics, DietResponse, ProgressEntry, PlanVersion,
  Appointment, AppointmentStatus
} from '../types';

// ── Row → app type converters ────────────────────────────────────────────────

const rowToDiet = (r: any): SavedDiet => ({
  id:             r.id,
  timestamp:      r.timestamp,
  patientData:    r.patient_data,
  metrics:        r.metrics,
  plan:           r.plan,
  planVersions:   r.plan_versions ?? [],
  linkedToId:     r.linked_to_id     ?? undefined,
  linkedRole:     r.linked_role      ?? undefined,
  linkedSyncedAt: r.linked_synced_at ?? undefined,
  lockedMeals:    r.locked_meals     ?? [],
  substitutions:  r.substitutions    ?? [],
});

const rowToAppointment = (r: any): Appointment => ({
  id:              r.id,
  clientName:      r.client_name,
  scheduledAt:     new Date(r.scheduled_at).getTime(),
  durationMinutes: r.duration_minutes,
  status:          r.status as AppointmentStatus,
  notes:           r.notes ?? undefined,
  createdAt:       new Date(r.created_at).getTime(),
});

const rowToFood = (r: any): CustomFood => ({
  id:          r.id,
  name:        r.name,
  brand:       r.brand    ?? undefined,
  calories:    r.calories,
  protein:     r.protein,
  carbs:       r.carbs,
  fats:        r.fats,
  portionSize: r.portion_size,
});

export interface PortalToken {
  token: string;
  clientId: string;
  clientName: string;
  enabled: boolean;
  showEquivalences: boolean;
  createdAt: string;
  lastAccessAt: string | null;
}

const rowToPortalToken = (r: any): PortalToken => ({
  token:            r.token,
  clientId:         r.client_id,
  clientName:       r.client_name,
  enabled:          r.enabled,
  showEquivalences: r.show_equivalences,
  createdAt:        r.created_at,
  lastAccessAt:     r.last_access_at ?? null,
});

// Alfabeto sin caracteres ambiguos (0/O, 1/I/l) — el enlace se puede leer o
// dictar por teléfono en consulta sin errores de transcripción.
const PORTAL_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generatePortalToken(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => PORTAL_TOKEN_ALPHABET[b % PORTAL_TOKEN_ALPHABET.length]).join('');
}

const rowToEntry = (r: any): ProgressEntry => ({
  id:              r.id,
  date:            r.date,
  weight:          r.weight,
  imc:             r.imc              ?? undefined,
  bodyFat:         r.body_fat         ?? undefined,
  waterPercent:    r.water_percent    ?? undefined,
  proteinPercent:  r.protein_percent  ?? undefined,
  basalMetabolism: r.basal_metabolism ?? undefined,
  muscleMass:      r.muscle_mass      ?? undefined,
  visceralFat:     r.visceral_fat     ?? undefined,
  boneMass:        r.bone_mass        ?? undefined,
  notes:           r.notes            ?? undefined,
});

// ── hook ─────────────────────────────────────────────────────────────────────

/**
 * MEJORA-020 (iteración 003 — hallazgo "escrituras que se pierden en
 * silencio"): antes, si una escritura a Supabase fallaba (wifi caído,
 * fila bloqueada, etc.), el único rastro era un console.error que nadie
 * ve fuera de las DevTools — el dato desaparecía sin que la usuaria se
 * enterase. `onWriteError` permite avisarla con un toast real.
 */
export function useAppData(onWriteError?: (message: string) => void) {
  const reportError = useCallback((context: string) => (
    { error }: { error: { message: string } | null }
  ) => {
    if (!error) return;
    console.error(`${context}:`, error.message);
    onWriteError?.(`No se pudo guardar (${context}). Comprueba tu conexión y vuelve a intentarlo — el cambio no se ha guardado en la base de datos.`);
  }, [onWriteError]);

  const [savedDiets,   setSavedDiets]   = useState<SavedDiet[]>([]);
  const [customFoods,  setCustomFoods]  = useState<CustomFood[]>([]);
  const [progressData, setProgressData] = useState<ClientProgress[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dbOnline,     setDbOnline]     = useState(true);
  const [isDbLoading,  setIsDbLoading]  = useState(true);

  // dbRecipes: empty — no recipes table yet
  const dbRecipes: Recipe[] = [];

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsDbLoading(true);
      try {
        const [dietsRes, foodsRes, entriesRes, goalsRes] = await Promise.all([
          supabase.from('saved_diets').select('*').order('timestamp', { ascending: false }),
          supabase.from('custom_foods').select('*').order('created_at', { ascending: true }),
          supabase.from('progress_entries').select('*').order('date', { ascending: true }),
          supabase.from('client_goals').select('*'),
        ]);

        if (cancelled) return;

        if (dietsRes.error || foodsRes.error || entriesRes.error || goalsRes.error) {
          const msg = dietsRes.error?.message ?? foodsRes.error?.message ??
                      entriesRes.error?.message ?? goalsRes.error?.message ?? 'DB error';
          throw new Error(msg);
        }

        setSavedDiets((dietsRes.data ?? []).map(rowToDiet));
        setCustomFoods((foodsRes.data ?? []).map(rowToFood));

        // Build ClientProgress[] from entries + goals
        const goalsMap = new Map<string, { weightGoal?: number; goalDate?: number }>();
        for (const g of goalsRes.data ?? []) {
          goalsMap.set(g.client_name, {
            weightGoal: g.weight_goal ?? undefined,
            goalDate:   g.goal_date   ?? undefined,
          });
        }
        const clientMap = new Map<string, ProgressEntry[]>();
        for (const r of entriesRes.data ?? []) {
          if (!clientMap.has(r.client_name)) clientMap.set(r.client_name, []);
          clientMap.get(r.client_name)!.push(rowToEntry(r));
        }
        const progress: ClientProgress[] = [];
        clientMap.forEach((entries, clientName) =>
          progress.push({ clientName, entries, ...goalsMap.get(clientName) })
        );
        for (const [cn, g] of goalsMap) {
          if (!clientMap.has(cn)) progress.push({ clientName: cn, entries: [], ...g });
        }
        setProgressData(progress);
        setDbOnline(true);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[Supabase load]', err.message);
          setDbOnline(false);
        }
      } finally {
        if (!cancelled) setIsDbLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Carga de citas (separada: si la tabla no existe, no rompe el resto) ────
  useEffect(() => {
    let cancelled = false;
    async function loadAppointments() {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .order('scheduled_at', { ascending: true });
        if (cancelled) return;
        if (error) {
          console.warn('[appointments] no disponible:', error.message);
          return;
        }
        setAppointments((data ?? []).map(rowToAppointment));
      } catch (err: any) {
        if (!cancelled) console.warn('[appointments] error:', err?.message);
      }
    }
    loadAppointments();
    return () => { cancelled = true; };
  }, []);

  // ── Diets ─────────────────────────────────────────────────────────────────

  /** Sync return for backward compat — Supabase save fires in background */
  const saveDiet = useCallback((
    data: PatientData,
    metrics: CalculatedMetrics,
    plan: DietResponse
  ): string => {
    const id = crypto.randomUUID();
    const ts = Date.now();
    const newDiet: SavedDiet = { id, timestamp: ts, patientData: data, metrics, plan, planVersions: [] };
    setSavedDiets(prev => [newDiet, ...prev]);
    if (data.name) {
      setProgressData(prev =>
        prev.find(p => p.clientName === data.name)
          ? prev
          : [...prev, { clientName: data.name!, entries: [] }]
      );
    }
    supabase.from('saved_diets').insert({
      id, timestamp: ts, patient_data: data, metrics, plan, plan_versions: [],
    }).then(reportError('saveDiet'));
    return id;
  }, []);

  const updateDietPlan = useCallback((id: string, plan: DietResponse) => {
    setSavedDiets(prev => prev.map(d => d.id === id ? { ...d, plan } : d));
    supabase.from('saved_diets').update({ plan }).eq('id', id)
      .then(reportError('updateDietPlan'));
  }, []);

  /** Update all fields of an existing diet (re-generate) */
  const updateFullDiet = useCallback((
    id: string,
    data: PatientData,
    metrics: CalculatedMetrics,
    plan: DietResponse
  ) => {
    setSavedDiets(prev => prev.map(d =>
      d.id === id ? { ...d, patientData: data, metrics, plan, timestamp: Date.now() } : d
    ));
    supabase.from('saved_diets').update({
      patient_data: data, metrics, plan, timestamp: Date.now(),
    }).eq('id', id)
      .then(reportError('updateFullDiet'));
  }, []);

  const updatePatientData = useCallback((id: string, data: Partial<PatientData>) => {
    setSavedDiets(prev =>
      prev.map(d => d.id === id ? { ...d, patientData: { ...d.patientData, ...data } } : d)
    );
    // Name change → update progress records
    setSavedDiets(current => {
      const original = current.find(d => d.id === id);
      if (data.name !== undefined && original?.patientData.name &&
          original.patientData.name !== data.name) {
        const oldName = original.patientData.name;
        setProgressData(prev =>
          prev.map(p => p.clientName === oldName ? { ...p, clientName: data.name! } : p)
        );
        supabase.from('progress_entries').update({ client_name: data.name }).eq('client_name', oldName)
          .then(reportError('rename entries'));
        supabase.from('client_goals').update({ client_name: data.name }).eq('client_name', oldName)
          .then(reportError('rename goals'));
      }
      const merged = { ...original?.patientData, ...data };
      supabase.from('saved_diets').update({ patient_data: merged }).eq('id', id)
        .then(reportError('updatePatientData'));
      return current;
    });
  }, []);

  const deleteDiet = useCallback((id: string) => {
    setSavedDiets(prev => prev.filter(d => d.id !== id));
    supabase.from('saved_diets').delete().eq('id', id)
      .then(reportError('deleteDiet'));
  }, []);

  /** Append multiple diets (CSV/PDF import) */
  const appendDiets = useCallback((diets: SavedDiet[]) => {
    setSavedDiets(prev => {
      const ids = new Set(prev.map(d => d.id));
      return [...diets.filter(d => !ids.has(d.id)), ...prev];
    });
    supabase.from('saved_diets').upsert(
      diets.map(d => ({
        id: d.id, timestamp: d.timestamp,
        patient_data: d.patientData, metrics: d.metrics, plan: d.plan,
        plan_versions: d.planVersions ?? [],
        linked_to_id: d.linkedToId ?? null,
        linked_role: d.linkedRole ?? null,
        linked_synced_at: d.linkedSyncedAt ?? null,
        locked_meals: d.lockedMeals ?? [],
        substitutions: d.substitutions ?? [],
      }))
    ).then(reportError('appendDiets'));
  }, []);

  const restorePlanVersion = useCallback((id: string, version: PlanVersion) => {
    setSavedDiets(prev => prev.map(d => d.id === id ? { ...d, plan: version.plan } : d));
    supabase.from('saved_diets').update({ plan: version.plan }).eq('id', id)
      .then(reportError('restorePlanVersion'));
  }, []);

  // ── Vínculo Pareja Inteligente ───────────────────────────────────────────────
  // Una pareja/familiar es una fila normal de saved_diets con linkedToId
  // apuntando al principal — no hay tabla aparte (ver docs/supabase/
  // link_saved_diets_migration.sql).

  /** Guarda una nueva SavedDiet vinculada a un principal (pareja recién generada). */
  const saveLinkedDiet = useCallback((diet: SavedDiet): string => {
    setSavedDiets(prev => [diet, ...prev]);
    if (diet.patientData.name) {
      setProgressData(prev =>
        prev.find(p => p.clientName === diet.patientData.name)
          ? prev
          : [...prev, { clientName: diet.patientData.name!, entries: [] }]
      );
    }
    supabase.from('saved_diets').insert({
      id: diet.id, timestamp: diet.timestamp,
      patient_data: diet.patientData, metrics: diet.metrics, plan: diet.plan,
      plan_versions: diet.planVersions ?? [],
      linked_to_id: diet.linkedToId ?? null,
      linked_role: diet.linkedRole ?? null,
      linked_synced_at: diet.linkedSyncedAt ?? null,
      locked_meals: diet.lockedMeals ?? [],
      substitutions: diet.substitutions ?? [],
    }).then(reportError('saveLinkedDiet'));
    return diet.id;
  }, []);

  /** Resincroniza (o guarda una edición manual de) la dieta de una pareja ya vinculada. */
  const updateLinkedDiet = useCallback((
    id: string,
    plan: DietResponse,
    lockedMeals: string[],
    substitutions: SavedDiet['substitutions'],
    linkedSyncedAt: number
  ) => {
    setSavedDiets(prev => prev.map(d =>
      d.id === id ? { ...d, plan, lockedMeals, substitutions, linkedSyncedAt } : d
    ));
    supabase.from('saved_diets').update({
      plan, locked_meals: lockedMeals, substitutions: substitutions ?? [], linked_synced_at: linkedSyncedAt,
    }).eq('id', id)
      .then(reportError('updateLinkedDiet'));
  }, []);

  /** "Convertir en cliente independiente": limpia el vínculo sin borrar la dieta. */
  const unlinkDiet = useCallback((id: string) => {
    setSavedDiets(prev => prev.map(d =>
      d.id === id ? { ...d, linkedToId: undefined, linkedRole: undefined, linkedSyncedAt: undefined, lockedMeals: [] } : d
    ));
    supabase.from('saved_diets').update({
      linked_to_id: null, linked_role: null, linked_synced_at: null, locked_meals: [],
    }).eq('id', id)
      .then(reportError('unlinkDiet'));
  }, []);

  // ── Foods ─────────────────────────────────────────────────────────────────

  const addCustomFood = useCallback((food: CustomFood) => {
    setCustomFoods(prev => [...prev, food]);
    supabase.from('custom_foods').insert({
      id: food.id, name: food.name, brand: food.brand ?? null,
      calories: food.calories, protein: food.protein, carbs: food.carbs,
      fats: food.fats, portion_size: food.portionSize,
    }).then(reportError('addCustomFood'));
  }, []);

  const editCustomFood = useCallback((food: CustomFood) => {
    setCustomFoods(prev => prev.map(f => f.id === food.id ? food : f));
    supabase.from('custom_foods').update({
      name: food.name, brand: food.brand ?? null,
      calories: food.calories, protein: food.protein, carbs: food.carbs,
      fats: food.fats, portion_size: food.portionSize,
    }).eq('id', food.id)
      .then(reportError('editCustomFood'));
  }, []);

  const deleteCustomFood = useCallback((id: string) => {
    setCustomFoods(prev => prev.filter(f => f.id !== id));
    supabase.from('custom_foods').delete().eq('id', id)
      .then(reportError('deleteCustomFood'));
  }, []);

  // ── Progress ──────────────────────────────────────────────────────────────

  const saveProgressEntry = useCallback((clientName: string, entry: ProgressEntry) => {
    setProgressData(prev => {
      const exists = prev.find(p => p.clientName === clientName);
      if (exists) {
        return prev.map(p =>
          p.clientName === clientName ? { ...p, entries: [...p.entries, entry] } : p
        );
      }
      return [...prev, { clientName, entries: [entry] }];
    });
    supabase.from('progress_entries').insert({
      id: entry.id, client_name: clientName, date: entry.date, weight: entry.weight,
      imc:              entry.imc             ?? null,
      body_fat:         entry.bodyFat         ?? null,
      water_percent:    entry.waterPercent    ?? null,
      protein_percent:  entry.proteinPercent  ?? null,
      basal_metabolism: entry.basalMetabolism ?? null,
      muscle_mass:      entry.muscleMass      ?? null,
      visceral_fat:     entry.visceralFat     ?? null,
      bone_mass:        entry.boneMass        ?? null,
      notes:            entry.notes           ?? null,
    }).then(reportError('saveProgressEntry'));
  }, []);

  const deleteProgressEntry = useCallback((clientName: string, entryId: string) => {
    setProgressData(prev =>
      prev.map(p =>
        p.clientName === clientName
          ? { ...p, entries: p.entries.filter(e => e.id !== entryId) }
          : p
      )
    );
    supabase.from('progress_entries').delete().eq('id', entryId)
      .then(reportError('deleteProgressEntry'));
  }, []);

  const updateProgressEntry = useCallback((clientName: string, entry: ProgressEntry) => {
    setProgressData(prev =>
      prev.map(p =>
        p.clientName === clientName
          ? { ...p, entries: p.entries.map(e => e.id === entry.id ? entry : e) }
          : p
      )
    );
    supabase.from('progress_entries').update({
      date:             entry.date,
      weight:           entry.weight,
      imc:              entry.imc             ?? null,
      body_fat:         entry.bodyFat         ?? null,
      water_percent:    entry.waterPercent    ?? null,
      protein_percent:  entry.proteinPercent  ?? null,
      basal_metabolism: entry.basalMetabolism ?? null,
      muscle_mass:      entry.muscleMass      ?? null,
      visceral_fat:     entry.visceralFat     ?? null,
      bone_mass:        entry.boneMass        ?? null,
      notes:            entry.notes           ?? null,
    }).eq('id', entry.id)
      .then(reportError('updateProgressEntry'));
  }, []);

  const updateClientGoal = useCallback((
    clientName: string,
    weightGoal: number,
    goalDate: number
  ) => {
    setProgressData(prev =>
      prev.map(p => p.clientName === clientName ? { ...p, weightGoal, goalDate } : p)
    );
    supabase.from('client_goals').upsert(
      { client_name: clientName, weight_goal: weightGoal, goal_date: goalDate, updated_at: new Date().toISOString() },
      { onConflict: 'client_name' }
    ).then(reportError('updateClientGoal'));
  }, []);

  // ── Agenda / citas ────────────────────────────────────────────────────────

  const saveAppointment = useCallback((appt: Appointment) => {
    setAppointments(prev => [...prev, appt].sort((a, b) => a.scheduledAt - b.scheduledAt));
    supabase.from('appointments').insert({
      id: appt.id, client_name: appt.clientName,
      scheduled_at: new Date(appt.scheduledAt).toISOString(),
      duration_minutes: appt.durationMinutes, status: appt.status,
      notes: appt.notes ?? null,
    }).then(reportError('saveAppointment'));
  }, []);

  const updateAppointment = useCallback((appt: Appointment) => {
    setAppointments(prev =>
      prev.map(a => a.id === appt.id ? appt : a).sort((a, b) => a.scheduledAt - b.scheduledAt)
    );
    supabase.from('appointments').update({
      client_name: appt.clientName,
      scheduled_at: new Date(appt.scheduledAt).toISOString(),
      duration_minutes: appt.durationMinutes, status: appt.status,
      notes: appt.notes ?? null,
    }).eq('id', appt.id)
      .then(reportError('updateAppointment'));
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    supabase.from('appointments').delete().eq('id', id)
      .then(reportError('deleteAppointment'));
  }, []);

  // ── Import (bulk replace) ─────────────────────────────────────────────────

  const importAll = useCallback(async (payload: {
    diets?: SavedDiet[];
    foods?: CustomFood[];
    progress?: ClientProgress[];
  }) => {
    if (payload.diets)    setSavedDiets(payload.diets);
    if (payload.foods)    setCustomFoods(payload.foods);
    if (payload.progress) setProgressData(payload.progress);

    if (payload.diets) {
      await supabase.from('saved_diets').delete().neq('id', '__none__');
      if (payload.diets.length) {
        // Principales (sin linkedToId) primero: linked_to_id tiene una FK a
        // saved_diets(id) — insertar una pareja antes que su principal
        // violaría la restricción.
        const ordered = [...payload.diets].sort((a, b) => (a.linkedToId ? 1 : 0) - (b.linkedToId ? 1 : 0));
        await supabase.from('saved_diets').insert(
          ordered.map(d => ({
            id: d.id, timestamp: d.timestamp,
            patient_data: d.patientData, metrics: d.metrics, plan: d.plan,
            plan_versions: d.planVersions ?? [],
            linked_to_id: d.linkedToId ?? null,
            linked_role: d.linkedRole ?? null,
            linked_synced_at: d.linkedSyncedAt ?? null,
            locked_meals: d.lockedMeals ?? [],
            substitutions: d.substitutions ?? [],
          }))
        );
      }
    }
    if (payload.foods) {
      await supabase.from('custom_foods').delete().neq('id', '__none__');
      if (payload.foods.length) {
        await supabase.from('custom_foods').insert(
          payload.foods.map(f => ({
            id: f.id, name: f.name, brand: f.brand ?? null,
            calories: f.calories, protein: f.protein, carbs: f.carbs,
            fats: f.fats, portion_size: f.portionSize,
          }))
        );
      }
    }
    if (payload.progress) {
      await supabase.from('progress_entries').delete().neq('id', '__none__');
      await supabase.from('client_goals').delete().neq('client_name', '__none__');
      for (const cp of payload.progress) {
        if (cp.entries.length) {
          await supabase.from('progress_entries').insert(
            cp.entries.map(e => ({
              id: e.id, client_name: cp.clientName, date: e.date, weight: e.weight,
              imc: e.imc ?? null, body_fat: e.bodyFat ?? null,
              water_percent: e.waterPercent ?? null, protein_percent: e.proteinPercent ?? null,
              basal_metabolism: e.basalMetabolism ?? null, muscle_mass: e.muscleMass ?? null,
              visceral_fat: e.visceralFat ?? null, bone_mass: e.boneMass ?? null,
              notes: e.notes ?? null,
            }))
          );
        }
        if (cp.weightGoal != null) {
          await supabase.from('client_goals').upsert(
            { client_name: cp.clientName, weight_goal: cp.weightGoal, goal_date: cp.goalDate ?? null },
            { onConflict: 'client_name' }
          );
        }
      }
    }
  }, []);

  // ── Portal del paciente (Fase 4) ────────────────────────────────────────────
  // Consultas puntuales, no estado global: el modal que las usa las pide bajo
  // demanda al abrirse (patrón acordado en el plan aprobado).

  const getOrCreatePortalToken = useCallback(async (
    clientId: string, clientName: string
  ): Promise<PortalToken | null> => {
    const { data: existing, error: findError } = await supabase
      .from('portal_tokens').select('*').eq('client_id', clientId).limit(1).maybeSingle();
    if (findError) { reportError('getOrCreatePortalToken')({ error: findError }); return null; }
    if (existing) return rowToPortalToken(existing);

    const { data: created, error: insertError } = await supabase
      .from('portal_tokens')
      .insert({ token: generatePortalToken(), client_id: clientId, client_name: clientName })
      .select().single();
    if (insertError) { reportError('getOrCreatePortalToken')({ error: insertError }); return null; }
    return rowToPortalToken(created);
  }, [reportError]);

  const updatePortalToken = useCallback(async (
    token: string, patch: Partial<{ enabled: boolean; showEquivalences: boolean }>
  ): Promise<void> => {
    const dbPatch: Record<string, boolean> = {};
    if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
    if (patch.showEquivalences !== undefined) dbPatch.show_equivalences = patch.showEquivalences;
    const { error } = await supabase.from('portal_tokens').update(dbPatch).eq('token', token);
    reportError('updatePortalToken')({ error });
  }, [reportError]);

  const regeneratePortalToken = useCallback(async (
    oldToken: string, clientId: string, clientName: string
  ): Promise<PortalToken | null> => {
    // El borrado en cascada (FK portal_meal_completions → portal_tokens)
    // elimina también el historial de "realizadas" del enlace revocado.
    const { error: deleteError } = await supabase.from('portal_tokens').delete().eq('token', oldToken);
    if (deleteError) { reportError('regeneratePortalToken')({ error: deleteError }); return null; }

    const { data: created, error: insertError } = await supabase
      .from('portal_tokens')
      .insert({ token: generatePortalToken(), client_id: clientId, client_name: clientName })
      .select().single();
    if (insertError) { reportError('regeneratePortalToken')({ error: insertError }); return null; }
    return rowToPortalToken(created);
  }, [reportError]);

  const getPortalWeeklyAdherence = useCallback(async (token: string): Promise<number> => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from('portal_meal_completions')
      .select('*', { count: 'exact', head: true })
      .eq('token', token)
      .gte('meal_date', weekAgo);
    if (error) { reportError('getPortalWeeklyAdherence')({ error }); return 0; }
    return count ?? 0;
  }, [reportError]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueClients = Array.from(
    new Set(savedDiets.map(d => d.patientData.name).filter(Boolean))
  ) as string[];

  return {
    savedDiets,
    customFoods,
    progressData,
    appointments,
    dbRecipes,
    uniqueClients,
    dbOnline,
    isDbLoading,
    saveDiet,
    updateDietPlan,
    updateFullDiet,
    updatePatientData,
    deleteDiet,
    appendDiets,
    restorePlanVersion,
    saveLinkedDiet,
    updateLinkedDiet,
    unlinkDiet,
    saveAppointment,
    updateAppointment,
    deleteAppointment,
    addCustomFood,
    editCustomFood,
    deleteCustomFood,
    saveProgressEntry,
    deleteProgressEntry,
    updateProgressEntry,
    updateClientGoal,
    importAll,
    getOrCreatePortalToken,
    updatePortalToken,
    regeneratePortalToken,
    getPortalWeeklyAdherence,
  };
}
