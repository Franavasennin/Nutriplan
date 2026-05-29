import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️  NUNCA escribas credenciales aquí.
// Copia .env.local.example → .env.local y rellena VITE_SUPABASE_URL y VITE_SUPABASE_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

// Si faltan credenciales la app arranca en modo local (sin sincronización BD)
let supabase: SupabaseClient;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.warn(
    '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env.local.\n' +
    'La app funciona en modo local sin sincronización con la base de datos.\n' +
    'Añade las variables a .env.local para habilitar la BD.'
  );
  supabase = null as unknown as SupabaseClient;
}

export { supabase };
