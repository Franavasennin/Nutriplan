import { createClient } from '@supabase/supabase-js';

// ⚠️  NUNCA escribas credenciales aquí.
// Copia .env.local.example → .env.local y rellena VITE_SUPABASE_URL y VITE_SUPABASE_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env.local.\n' +
    'Copia .env.local.example a .env.local y rellena los valores reales.'
  );
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '');
