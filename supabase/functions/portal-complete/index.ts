// Edge Function: portal-complete
// POST /portal-complete  { token, dayNumber, mealKey, date, completed }
//
// Única escritura que el Portal del Paciente puede hacer: marcar/desmarcar una
// comida como realizada. Valida el token con la service role antes de tocar
// portal_meal_completions — igual que portal-diet, la clave privilegiada no
// sale de la función.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface CompleteBody {
  token?: string;
  dayNumber?: number;
  mealKey?: string;
  date?: string; // YYYY-MM-DD
  completed?: boolean;
}

const MEAL_KEYS = new Set(['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let body: CompleteBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const { token, dayNumber, mealKey, date, completed } = body;
  if (
    !token || typeof token !== 'string' ||
    typeof dayNumber !== 'number' || !Number.isInteger(dayNumber) || dayNumber < 1 ||
    !mealKey || !MEAL_KEYS.has(mealKey) ||
    !date || !DATE_RE.test(date) ||
    typeof completed !== 'boolean'
  ) {
    return jsonResponse({ error: 'invalid_body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: tokenRow, error: tokenError } = await supabase
    .from('portal_tokens')
    .select('token, enabled')
    .eq('token', token)
    .maybeSingle();

  if (tokenError || !tokenRow || !tokenRow.enabled) {
    return jsonResponse({ error: 'not_found' }, 404);
  }

  if (completed) {
    const { error } = await supabase
      .from('portal_meal_completions')
      .upsert(
        { id: `${token}-${date}-${mealKey}`, token, day_number: dayNumber, meal_key: mealKey, meal_date: date },
        { onConflict: 'token,meal_date,meal_key' }
      );
    if (error) return jsonResponse({ error: 'write_failed' }, 500);
  } else {
    const { error } = await supabase
      .from('portal_meal_completions')
      .delete()
      .eq('token', token)
      .eq('meal_date', date)
      .eq('meal_key', mealKey);
    if (error) return jsonResponse({ error: 'write_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});
