import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { CLINIC } from '../../config/clinic';
import { ALLERGEN_LABELS, DIET_TYPE_LABELS, FASTING_LABELS, FastingProtocol, DayPlan, Meal } from '../../types';
import { fetchPortalDiet, postMealCompletion, PortalDietPayload, PortalCompletion } from '../../services/portalClient';
import { generateShoppingList, SUPERMARKET_AISLES } from '../../utils/shoppingList';
import { normalizeIngredient } from '../../utils/macroValidation';
import { getMealSections, MealSectionConfig } from '../../utils/mealSchedule';
import { getMealEquivalents } from '../../utils/equivalences';
import { VEGETABLE_PORTION_GUIDANCE, VEGETABLE_MODERATE_MAX_GRAMS } from '../../data/nutritionistRules';

/**
 * Portal del Paciente — vista pública de solo lectura, servida en /p/TOKEN
 * (ver index.tsx). Deliberadamente NO reutiliza components/DietPlanDisplay.tsx
 * (1600+ líneas, acoplado a la edición del panel) — es una vista nueva y
 * ligera sobre los mismos datos, montada en su propio bundle (code-splitting:
 * el panel de la nutricionista nunca se descarga aquí).
 */

interface Props {
  token: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Día del plan (1-7, Lunes=1) correspondiente a hoy, acotado a los días que tenga el plan. */
function defaultDayNumber(totalDays: number): number {
  const jsDay = new Date().getDay(); // 0=domingo..6=sábado
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return isoDay <= totalDays ? isoDay : 1;
}

const PatientPortal: React.FC<Props> = ({ token }) => {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; reason: string }
    | { status: 'ready'; data: PortalDietPayload }
  >({ status: 'loading' });
  const [activeDay, setActiveDay] = useState<number>(1);
  const [completions, setCompletions] = useState<PortalCompletion[]>([]);
  const [query, setQuery] = useState('');

  // ─── Hidratación diaria ───────────────────────────────────────────────────
  const todayStr = todayIsoDate();
  const WATER_KEY = `portal_water_${token}_${todayStr}`;
  const [waterGlasses, setWaterGlasses] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(WATER_KEY);
      const parsed = stored ? parseInt(stored, 10) : 0;
      return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    } catch {
      return 0;
    }
  });

  const handleWaterChange = (delta: number) => {
    setWaterGlasses(prev => {
      const updated = Math.max(0, Math.min(16, prev + delta));
      try {
        localStorage.setItem(WATER_KEY, updated.toString());
      } catch {
        /* silent */
      }
      return updated;
    });
  };

  // ─── Sensaciones y Bienestar diario ───────────────────────────────────────
  const WELLNESS_KEY = `portal_wellness_${token}_${todayStr}`;
  interface WellnessData {
    energy?: 'alta' | 'normal' | 'baja';
    digestion?: 'buena' | 'pesada' | 'molestias';
    satiety?: 'adecuada' | 'hambre' | 'excesiva';
    note?: string;
  }

  const [wellness, setWellness] = useState<WellnessData>(() => {
    try {
      const raw = localStorage.getItem(WELLNESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [wellnessSaved, setWellnessSaved] = useState(false);

  const handleWellnessUpdate = (field: keyof WellnessData, val: string) => {
    setWellness(prev => {
      const updated = { ...prev, [field]: val };
      try {
        localStorage.setItem(WELLNESS_KEY, JSON.stringify(updated));
        setWellnessSaved(true);
        setTimeout(() => setWellnessSaved(false), 2000);
      } catch {
        /* silent */
      }
      return updated;
    });
  };

  // ─── Lista de compra interactiva ──────────────────────────────────────────
  const SHOP_KEY = `portal_shop_${token}`;
  const [checkedShopItems, setCheckedShopItems] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SHOP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const togglePortalShopItem = (itemName: string) => {
    setCheckedShopItems(prev => {
      const updated = { ...prev, [itemName]: !prev[itemName] };
      try {
        localStorage.setItem(SHOP_KEY, JSON.stringify(updated));
      } catch {
        /* silent */
      }
      return updated;
    });
  };

  const [portalAisle, setPortalAisle] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    fetchPortalDiet(token).then(res => {
      if (cancelled) return;
      if (res.ok === false) {
        // Fallback para pruebas locales / modo offline si la Edge Function no está activa
        try {
          const raw = localStorage.getItem('saved_diets');
          if (raw) {
            const diets = JSON.parse(raw);
            const found = diets.find((d: any) => d.id === token || d.patientData?.clientId === token) || diets[0];
            if (found && found.plan) {
              const payload: PortalDietPayload = {
                patientData: found.patientData,
                metrics: found.metrics,
                plan: found.plan,
                showEquivalences: true,
                completions: [],
              };
              setState({ status: 'ready', data: payload });
              setActiveDay(defaultDayNumber(payload.plan.weeklyPlan.length || 7));
              return;
            }
          }
        } catch {
          /* ignore */
        }

        setState({ status: 'error', reason: res.reason });
        return;
      }
      const payload = res.data;
      setState({ status: 'ready', data: payload });
      setCompletions(payload.completions);
      setActiveDay(defaultDayNumber(payload.plan.weeklyPlan.length || 7));
    });
    return () => { cancelled = true; };
  }, [token]);

  const data = state.status === 'ready' ? state.data : null;
  const plan = data?.plan;
  const patientData = data?.patientData;

  const mealSections = useMemo<MealSectionConfig[]>(
    () => getMealSections(patientData?.mealCount ?? 5, patientData?.fastingProtocol),
    [patientData?.mealCount, patientData?.fastingProtocol]
  );

  const activeDayPlan: DayPlan | undefined = useMemo(
    () => plan?.weeklyPlan.find(d => d.day === activeDay),
    [plan, activeDay]
  );

  const coupleShoppingList = useMemo(() => (plan ? generateShoppingList(plan) : []), [plan]);

  const isCompleted = useCallback(
    (mealKey: string) => {
      const today = todayIsoDate();
      return completions.some(c => c.dayNumber === activeDay && c.mealKey === mealKey && c.date === today);
    },
    [completions, activeDay]
  );

  const toggleCompleted = useCallback(
    (mealKey: string) => {
      const today = todayIsoDate();
      const wasCompleted = completions.some(c => c.dayNumber === activeDay && c.mealKey === mealKey && c.date === today);
      // Optimista: refleja el cambio de inmediato, sin esperar a la red.
      setCompletions(prev =>
        wasCompleted
          ? prev.filter(c => !(c.dayNumber === activeDay && c.mealKey === mealKey && c.date === today))
          : [...prev, { dayNumber: activeDay, mealKey, date: today }]
      );
      postMealCompletion(token, activeDay, mealKey, today, !wasCompleted);
    },
    [completions, activeDay, token]
  );

  const searchResults = useMemo(() => {
    if (!plan || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const hits: { day: number; title: string; meal: Meal }[] = [];
    for (const day of plan.weeklyPlan) {
      for (const section of mealSections) {
        const meal = day.meals[section.key];
        if (!meal) continue;
        const haystack = [meal.name, meal.description, ...(meal.ingredients ?? [])].join(' ').toLowerCase();
        if (haystack.includes(q)) hits.push({ day: day.day, title: section.title, meal });
      }
    }
    return hits.slice(0, 20);
  }, [plan, mealSections, query]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6faf7]">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#13ec5b]">progress_activity</span>
      </div>
    );
  }

  if (state.status === 'error') {
    const message = state.reason === 'no_backend'
      ? 'El portal no está disponible en este momento. Contacta con tu nutricionista.'
      : 'Este enlace no es válido o ha sido desactivado. Contacta con tu nutricionista para obtener uno nuevo.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6faf7] p-6">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">error</span>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Enlace no disponible</h1>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
      </div>
    );
  }

  if (!plan || !patientData) return null;

  const dietTypeLabel = patientData.dietType ? DIET_TYPE_LABELS[patientData.dietType] : undefined;
  const fastingLabel = patientData.fastingProtocol && patientData.fastingProtocol !== FastingProtocol.None
    ? FASTING_LABELS[patientData.fastingProtocol]
    : undefined;

  return (
    <div className="min-h-screen bg-[#f6faf7] text-[#102216]">
      {/* Cabecera */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 no-print">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#13ec5b]">{CLINIC.appName}</p>
            <h1 className="text-xl font-black">{patientData.name || 'Tu dieta'}</h1>
            <p className="text-xs text-gray-500">
              {dietTypeLabel ?? 'Plan nutricional'}{fastingLabel ? ` · ${fastingLabel}` : ''} · {plan.durationText}
            </p>
          </div>
          <div className="flex gap-4 text-center">
            <div><p className="text-lg font-black">{data!.metrics.macros.calories}</p><p className="text-[10px] text-gray-400 uppercase">kcal</p></div>
            <div><p className="text-lg font-black">{data!.metrics.macros.protein}g</p><p className="text-[10px] text-gray-400 uppercase">Prot</p></div>
            <div><p className="text-lg font-black">{data!.metrics.macros.carbs}g</p><p className="text-[10px] text-gray-400 uppercase">HC</p></div>
            <div><p className="text-lg font-black">{data!.metrics.macros.fats}g</p><p className="text-[10px] text-gray-400 uppercase">Grasas</p></div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-[#13ec5b] text-[#102216] text-sm font-bold hover:brightness-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Descargar PDF
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {patientData.allergens.length > 0 && (
          <div className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
            ⚠ Alérgenos declarados: {patientData.allergens.map(a => ALLERGEN_LABELS[a]).join(', ')}
          </div>
        )}

        {/* Buscador */}
        <div className="no-print relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar una comida o ingrediente en toda la semana..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#13ec5b] transition-colors"
          />
          {query.trim() && (
            <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-sm max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin resultados.</p>
              ) : (
                searchResults.map((hit, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveDay(hit.day); setQuery(''); }}
                    className="w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-[10px] font-bold uppercase text-gray-400">Día {hit.day} · {hit.title}</p>
                    <p className="text-sm font-semibold">{hit.meal.name}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selector de días */}
        <div className="no-print flex gap-2 overflow-x-auto pb-1">
          {plan.weeklyPlan.map(day => (
            <button
              key={day.day}
              onClick={() => setActiveDay(day.day)}
              className={`shrink-0 px-4 h-10 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                activeDay === day.day ? 'bg-[#13ec5b] text-[#102216]' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              Día {day.day}
            </button>
          ))}
        </div>

        {/* 💧 Módulo de Hidratación Diaria */}
        <div className="no-print bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500 text-2xl">water_drop</span>
              <div>
                <h2 className="text-sm font-black text-gray-800">Hidratación de Hoy</h2>
                <p className="text-xs text-gray-500">
                  {waterGlasses} / 8 vasos ({((waterGlasses * 250) / 1000).toFixed(2)} L de 2.0 L objetivo)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleWaterChange(-1)}
                disabled={waterGlasses === 0}
                className="size-11 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-base transition-colors"
                title="Quitar un vaso de agua"
                aria-label="Quitar un vaso de agua"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleWaterChange(1)}
                className="px-3 h-11 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-sm"
                title="Sumar 250ml de agua"
                aria-label="Sumar un vaso de agua de 250 mililitros"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>250 ml</span>
              </button>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="w-full h-2 rounded-full bg-blue-50 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (waterGlasses / 8) * 100)}%` }}
            />
          </div>

          {/* Fila interactiva de vasos de agua */}
          <div className="flex items-center justify-between gap-1 pt-1">
            {Array.from({ length: 8 }).map((_, idx) => {
              const isFilled = idx < waterGlasses;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleWaterChange(isFilled && idx === waterGlasses - 1 ? -1 : (idx + 1) - waterGlasses)}
                  className={`flex-1 py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isFilled
                      ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                      : 'bg-gray-50 text-gray-300 border border-gray-100 hover:text-blue-300'
                  }`}
                  title={`Vaso ${idx + 1} (250 ml)`}
                  aria-label={`Vaso ${idx + 1} de agua`}
                >
                  <span className="material-symbols-outlined text-[18px]">water_drop</span>
                  <span className="text-[9px] font-black">{idx + 1}</span>
                </button>
              );
            })}
          </div>

          {waterGlasses >= 8 && (
            <p className="text-xs font-bold text-blue-700 bg-blue-50 py-1.5 px-3 rounded-lg text-center flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              ¡Meta cumplida! Has alcanzado tus 2 litros de agua diarios recomendados.
            </p>
          )}
        </div>

        {/* ⚡ Módulo de Registro de Sensaciones / Bienestar */}
        <div className="no-print bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-2xl">sentiment_satisfied</span>
              <div>
                <h2 className="text-sm font-black text-gray-800">Sensaciones y Bienestar</h2>
                <p className="text-xs text-gray-500">¿Cómo te has sentido con tus comidas de hoy?</p>
              </div>
            </div>
            {wellnessSaved && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full animate-fade-in flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">check</span> Guardado
              </span>
            )}
          </div>

          {/* Selectores de estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Energía */}
            <div>
              <p className="text-[11px] font-bold text-gray-600 mb-1">Nivel de Energía:</p>
              <div className="flex gap-1">
                {[
                  { id: 'alta', label: '⚡ Alta' },
                  { id: 'normal', label: '😊 Normal' },
                  { id: 'baja', label: '🥱 Baja' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleWellnessUpdate('energy', opt.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      wellness.energy === opt.id
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Digestión */}
            <div>
              <p className="text-[11px] font-bold text-gray-600 mb-1">Digestión:</p>
              <div className="flex gap-1">
                {[
                  { id: 'buena', label: '🟢 Ligera' },
                  { id: 'pesada', label: '🟡 Pesada' },
                  { id: 'molestias', label: '🔴 Molestias' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleWellnessUpdate('digestion', opt.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      wellness.digestion === opt.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Saciedad */}
            <div>
              <p className="text-[11px] font-bold text-gray-600 mb-1">Saciedad:</p>
              <div className="flex gap-1">
                {[
                  { id: 'adecuada', label: '🍽️ Bien' },
                  { id: 'hambre', label: '🤤 Hambre' },
                  { id: 'excesiva', label: '🫄 Lleno' },
                ].map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => handleWellnessUpdate('satiety', opt.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      wellness.satiety === opt.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nota opcional */}
          <div>
            <textarea
              rows={2}
              value={wellness.note ?? ''}
              onChange={e => handleWellnessUpdate('note', e.target.value)}
              placeholder="Notas del día (ej. buenas sensaciones entrenando, me costó terminar la comida...)"
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Comidas del día activo */}
        <div className="flex flex-col gap-3">
          {mealSections.map(section => {
            const meal = activeDayPlan?.meals[section.key];
            if (!meal) return null;
            const done = isCompleted(section.key);
            const equivalents = data!.showEquivalences
              ? getMealEquivalents(meal, { allergens: patientData.allergens, excludedFoods: patientData.excludedFoods })
              : [];
            return (
              <div key={section.key} className="bg-white rounded-xl border border-gray-100 p-4 break-inside-avoid">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#13ec5b]">{section.icon}</span>
                    <div>
                      <p className="text-sm font-black">{section.title}</p>
                      <p className="text-[11px] text-gray-400">{section.time}</p>
                    </div>
                  </div>
                  <label className="no-print flex items-center gap-1.5 text-xs font-bold text-gray-500 cursor-pointer shrink-0">
                    <input type="checkbox" checked={done} onChange={() => toggleCompleted(section.key)} className="size-4 accent-[#13ec5b]" />
                    Realizada
                  </label>
                </div>
                <p className="text-sm font-bold">{meal.name}</p>
                <p className="text-xs text-gray-500 italic mb-2">{meal.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(meal.ingredients ?? []).map((ing, i) => (
                    <span key={i} className="text-[11px] bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 text-gray-600">
                      {normalizeIngredient(ing)}
                    </span>
                  ))}
                </div>
                {equivalents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1">
                    <p className="text-[10px] font-black uppercase text-gray-400">🔄 Alternativas equivalentes</p>
                    {equivalents.map((e, i) => (
                      <p key={i} className="text-[11px] text-gray-500">
                        <span className="font-semibold text-gray-600">{normalizeIngredient(e.ing)}</span>
                        {' → '}
                        {e.options.map(o => o.label).join(' · ')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Observaciones de la nutricionista */}
        {plan.generalGuidelines.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-black mb-2">Recomendaciones</p>
            <ul className="flex flex-col gap-1.5">
              {plan.generalGuidelines.map((g, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="text-[#13ec5b] font-bold shrink-0">•</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Guía de verduras de la nutricionista */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-black mb-2">🥦 Guía de verduras</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Sin límite</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {VEGETABLE_PORTION_GUIDANCE.filter(v => v.criterion === 'sin_limite').map(v => v.name).join(', ')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">
                Con moderación (máx. {VEGETABLE_MODERATE_MAX_GRAMS}g/día)
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {VEGETABLE_PORTION_GUIDANCE.filter(v => v.criterion === 'con_moderacion').map(v => v.name).join(', ')}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de la compra interactiva */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-xl">shopping_cart</span>
                Lista de la compra interactiva
              </h2>
              <p className="text-xs text-gray-400">Marca los ingredientes a medida que los compres en el supermercado</p>
            </div>

            {/* Píldoras de pasillos */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setPortalAisle('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  portalAisle === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              {SUPERMARKET_AISLES.map(aisle => {
                const isSelected = portalAisle === aisle.id;
                return (
                  <button
                    type="button"
                    key={aisle.id}
                    onClick={() => setPortalAisle(aisle.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {aisle.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {coupleShoppingList
              .filter(cat => {
                if (portalAisle === 'all') return true;
                const aisle = SUPERMARKET_AISLES.find(a => a.id === portalAisle);
                return aisle ? aisle.categoryNames.includes(cat.category) : true;
              })
              .map(cat => (
                <div key={cat.category} className="p-2.5 rounded-xl bg-gray-50/60 border border-gray-100">
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1.5">{cat.category}</p>
                  <ul className="flex flex-col gap-1">
                    {cat.items.map(item => {
                      const isChecked = !!checkedShopItems[item.name];
                      return (
                        <li key={item.name} className="text-xs text-gray-700 flex items-start gap-1.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePortalShopItem(item.name)}
                            className="mt-0.5 size-3.5 accent-emerald-600 cursor-pointer shrink-0"
                            id={`shop-${item.name}`}
                          />
                          <label
                            htmlFor={`shop-${item.name}`}
                            className={`cursor-pointer leading-tight ${
                              isChecked ? 'line-through text-gray-400' : ''
                            }`}
                          >
                            <span>{item.name}</span>
                            {item.amounts.length > 0 && (
                              <span className="text-[10px] text-gray-400 ml-1 font-semibold">
                                ({item.amounts.join('/')})
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center pb-6">{CLINIC.disclaimer}</p>
      </main>
    </div>
  );
};

export default PatientPortal;
