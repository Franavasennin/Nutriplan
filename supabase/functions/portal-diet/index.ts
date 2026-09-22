// Edge Function: portal-diet
// GET /portal-diet?token=XXXX
//
// Devuelve la dieta de UN paciente, saneada, a partir de un token público del
// Portal del Paciente. Nunca toca las tablas con la clave anónima del panel —
// usa la service role (solo disponible en el entorno de la función) para que
// la clave privilegiada nunca salga al navegador del paciente.
//
// Saneamiento explícito: de patientData solo se devuelven los campos que el
// propio paciente puede ver de sí mismo y que el motor de equivalencias
// necesita (allergens/excludedFoods). NUNCA clinicalNotes, conditions,
// bodyFatPercent, gdprConsent, peso/altura/edad ni métricas clínicas.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) return jsonResponse({ error: 'not_found' }, 404);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: tokenRow, error: tokenError } = await supabase
    .from('portal_tokens')
    .select('token, client_id, client_name, enabled, show_equivalences')
    .eq('token', token)
    .maybeSingle();

  // Error genérico para token inexistente Y para deshabilitado — no dar pistas.
  if (tokenError || !tokenRow || !tokenRow.enabled) {
    return jsonResponse({ error: 'not_found' }, 404);
  }

  const { data: dietRow, error: dietError } = await supabase
    .from('saved_diets')
    .select('patient_data, metrics, plan, timestamp')
    .eq('patient_data->>clientId', tokenRow.client_id)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dietError || !dietRow) {
    return jsonResponse({ error: 'not_found' }, 404);
  }

  const pd = dietRow.patient_data ?? {};
  const sanitizedPatientData = {
    name: pd.name ?? tokenRow.client_name,
    mealCount: pd.mealCount,
    fastingProtocol: pd.fastingProtocol,
    dietType: pd.dietType,
    allergens: pd.allergens ?? [],
    excludedFoods: pd.excludedFoods ?? '',
  };

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: completions } = await supabase
    .from('portal_meal_completions')
    .select('day_number, meal_key, meal_date')
    .eq('token', token)
    .gte('meal_date', since.toISOString().slice(0, 10));

  // Fire-and-forget: no bloquea la respuesta al paciente si falla.
  supabase
    .from('portal_tokens')
    .update({ last_access_at: new Date().toISOString() })
    .eq('token', token)
    .then(() => {}, () => {});

  return jsonResponse({
    patientData: sanitizedPatientData,
    // Solo los macros objetivo: imc/bmr/tee son métricas clínicas (el IMC
    // deriva de peso y altura) y el portal no las usa. Detectado por los E2E.
    metrics: { macros: dietRow.metrics?.macros },
    plan: dietRow.plan,
    showEquivalences: tokenRow.show_equivalences,
    completions: (completions ?? []).map(c => ({
      dayNumber: c.day_number,
      mealKey: c.meal_key,
      date: c.meal_date,
    })),
  });
});
