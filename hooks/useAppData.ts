import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  SavedDiet, CustomFood, ClientProgress, Recipe,
  PatientData, CalculatedMetrics, DietResponse, ProgressEntry, PlanVersion,
  CouplesDiet
} from '../types';

// ── Row → app type converters ────────────────────────────────────────────────

const rowToDiet = (r: any): SavedDiet => ({
  id:           r.id,
  timestamp:    r.timestamp,
  patientData:  r.patient_data,
  metrics:      r.metrics,
  plan:         r.plan,
  planVersions: r.plan_versions ?? [],
});

const rowToCouples = (r: any): CouplesDiet => ({
  id:        r.id,
  timestamp: r.timestamp,
  personA:   r.person_a,
  personB:   r.person_b,
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

export function useAppData() {
  const [savedDiets,   setSavedDiets]   = useState<SavedDiet[]>([]);
  const [customFoods,  setCustomFoods]  = useState<CustomFood[]>([]);
  const [progressData, setProgressData] = useState<ClientProgress[]>([]);
  const [couplesDiets, setCouplesDiets] = useState<CouplesDiet[]>([]);
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

  // ── Carga de dietas de pareja (separada: si la tabla no existe, no rompe el resto) ──
  useEffect(() => {
    let cancelled = false;
    async function loadCouples() {
      try {
        const { data, error } = await supabase
          .from('couples_diets')
          .select('*')
          .order('timestamp', { ascending: false });
        if (cancelled) return;
        if (error) {
          console.warn('[couples_diets] no disponible:', error.message);
          return;
        }
        setCouplesDiets((data ?? []).map(rowToCouples));
      } catch (err: any) {
        if (!cancelled) console.warn('[couples_diets] error:', err?.message);
      }
    }
    loadCouples();
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
    }).then(({ error }) => { if (error) console.error('saveDiet:', error.message); });
    return id;
  }, []);

  const updateDietPlan = useCallback((id: string, plan: DietResponse) => {
    setSavedDiets(prev => prev.map(d => d.id === id ? { ...d, plan } : d));
    supabase.from('saved_diets').update({ plan }).eq('id', id)
      .then(({ error }) => { if (error) console.error('updateDietPlan:', error.message); });
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
      .then(({ error }) => { if (error) console.error('updateFullDiet:', error.message); });
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
          .then(({ error }) => { if (error) console.error('rename entries:', error.message); });
        supabase.from('client_goals').update({ client_name: data.name }).eq('client_name', oldName)
          .then(({ error }) => { if (error) console.error('rename goals:', error.message); });
      }
      const merged = { ...original?.patientData, ...data };
      supabase.from('saved_diets').update({ patient_data: merged }).eq('id', id)
        .then(({ error }) => { if (error) console.error('updatePatientData:', error.message); });
      return current;
    });
  }, []);

  const deleteDiet = useCallback((id: string) => {
    setSavedDiets(prev => prev.filter(d => d.id !== id));
    supabase.from('saved_diets').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteDiet:', error.message); });
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
      }))
    ).then(({ error }) => { if (error) console.error('appendDiets:', error.message); });
  }, []);

  const restorePlanVersion = useCallback((id: string, version: PlanVersion) => {
    setSavedDiets(prev => prev.map(d => d.id === id ? { ...d, plan: version.plan } : d));
    supabase.from('saved_diets').update({ plan: version.plan }).eq('id', id)
      .then(({ error }) => { if (error) console.error('restorePlanVersion:', error.message); });
  }, []);

  // ── Couples diets ───────────────────────────────────────────────────────────

  /** Guarda dos SavedDiet vinculadas como una dieta de pareja. Devuelve el id. */
  const saveCouplesDiet = useCallback((personA: SavedDiet, personB: SavedDiet): string => {
    const id = crypto.randomUUID();
    const ts = Date.now();
    const couples: CouplesDiet = { id, timestamp: ts, personA, personB };
    setCouplesDiets(prev => [couples, ...prev]);
    supabase.from('couples_diets').insert({
      id, timestamp: ts, person_a: personA, person_b: personB,
    }).then(({ error }) => { if (error) console.error('saveCouplesDiet:', error.message); });
    return id;
  }, []);

  const deleteCouplesDiet = useCallback((id: string) => {
    setCouplesDiets(prev => prev.filter(c => c.id !== id));
    supabase.from('couples_diets').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteCouplesDiet:', error.message); });
  }, []);

  // ── Foods ─────────────────────────────────────────────────────────────────

  const addCustomFood = useCallback((food: CustomFood) => {
    setCustomFoods(prev => [...prev, food]);
    supabase.from('custom_foods').insert({
      id: food.id, name: food.name, brand: food.brand ?? null,
      calories: food.calories, protein: food.protein, carbs: food.carbs,
      fats: food.fats, portion_size: food.portionSize,
    }).then(({ error }) => { if (error) console.error('addCustomFood:', error.message); });
  }, []);

  const editCustomFood = useCallback((food: CustomFood) => {
    setCustomFoods(prev => prev.map(f => f.id === food.id ? food : f));
    supabase.from('custom_foods').update({
      name: food.name, brand: food.brand ?? null,
      calories: food.calories, protein: food.protein, carbs: food.carbs,
      fats: food.fats, portion_size: food.portionSize,
    }).eq('id', food.id)
      .then(({ error }) => { if (error) console.error('editCustomFood:', error.message); });
  }, []);

  const deleteCustomFood = useCallback((id: string) => {
    setCustomFoods(prev => prev.filter(f => f.id !== id));
    supabase.from('custom_foods').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('deleteCustomFood:', error.message); });
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
    }).then(({ error }) => { if (error) console.error('saveProgressEntry:', error.message); });
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
      .then(({ error }) => { if (error) console.error('deleteProgressEntry:', error.message); });
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
    ).then(({ error }) => { if (error) console.error('updateClientGoal:', error.message); });
  }, []);

  // ── Import (bulk replace) ─────────────────────────────────────────────────

  const importAll = useCallback(async (payload: {
    diets?: SavedDiet[];
    foods?: CustomFood[];
    progress?: ClientProgress[];
    couples?: CouplesDiet[];
  }) => {
    if (payload.diets)    setSavedDiets(payload.diets);
    if (payload.foods)    setCustomFoods(payload.foods);
    if (payload.progress) setProgressData(payload.progress);
    if (payload.couples)  setCouplesDiets(payload.couples);

    if (payload.couples) {
      await supabase.from('couples_diets').delete().neq('id', '__none__');
      if (payload.couples.length) {
        await supabase.from('couples_diets').insert(
          payload.couples.map(c => ({
            id: c.id, timestamp: c.timestamp, person_a: c.personA, person_b: c.personB,
          }))
        );
      }
    }

    if (payload.diets) {
      await supabase.from('saved_diets').delete().neq('id', '__none__');
      if (payload.diets.length) {
        await supabase.from('saved_diets').insert(
          payload.diets.map(d => ({
            id: d.id, timestamp: d.timestamp,
            patient_data: d.patientData, metrics: d.metrics, plan: d.plan,
            plan_versions: d.planVersions ?? [],
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

  // ── Derived ───────────────────────────────────────────────────────────────

  const uniqueClients = Array.from(
    new Set(savedDiets.map(d => d.patientData.name).filter(Boolean))
  ) as string[];

  return {
    savedDiets,
    customFoods,
    progressData,
    couplesDiets,
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
    saveCouplesDiet,
    deleteCouplesDiet,
    addCustomFood,
    editCustomFood,
    deleteCustomFood,
    saveProgressEntry,
    deleteProgressEntry,
    updateClientGoal,
    importAll,
  };
}
