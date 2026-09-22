import { DietResponse, CalculatedMetrics, DietType, FastingProtocol, Allergen } from '../types';

/**
 * Cliente del Portal del Paciente — NUNCA usa la clave anónima de Supabase
 * (esa tiene acceso total a todas las tablas). Habla exclusivamente con las
 * Edge Functions portal-diet/portal-complete, que validan el token con la
 * service role en el servidor y devuelven solo la dieta de esa persona, ya
 * saneada (ver supabase/functions/portal-diet/index.ts).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function functionsBaseUrl(): string | null {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/functions/v1`;
}

export interface PortalPatientData {
  name?: string;
  mealCount?: number;
  fastingProtocol?: FastingProtocol;
  dietType?: DietType;
  allergens: Allergen[];
  excludedFoods: string;
}

export interface PortalCompletion {
  dayNumber: number;
  mealKey: string;
  date: string; // YYYY-MM-DD
}

export interface PortalDietPayload {
  patientData: PortalPatientData;
  /** Solo los macros objetivo — la Edge Function no envía métricas clínicas. */
  metrics: Pick<CalculatedMetrics, 'macros'>;
  plan: DietResponse;
  showEquivalences: boolean;
  completions: PortalCompletion[];
}

export type PortalFetchResult =
  | { ok: true; data: PortalDietPayload }
  | { ok: false; reason: 'not_found' | 'no_backend' | 'network_error' };

export async function fetchPortalDiet(token: string): Promise<PortalFetchResult> {
  const base = functionsBaseUrl();
  if (!base) return { ok: false, reason: 'no_backend' };
  try {
    const res = await fetch(`${base}/portal-diet?token=${encodeURIComponent(token)}`);
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'network_error' };
    const data = (await res.json()) as PortalDietPayload;
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/** Best-effort: si falla, la UI ya aplicó el cambio de forma optimista. */
export async function postMealCompletion(
  token: string,
  dayNumber: number,
  mealKey: string,
  date: string,
  completed: boolean
): Promise<boolean> {
  const base = functionsBaseUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/portal-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dayNumber, mealKey, date, completed }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
