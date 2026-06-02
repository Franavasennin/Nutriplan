import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️  NUNCA escribas credenciales aquí.
// Copia .env.local.example → .env.local y rellena VITE_SUPABASE_URL y VITE_SUPABASE_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/**
 * Stub seguro: cuando faltan credenciales, todas las operaciones de Supabase
 * son no-ops que resuelven a `{ data: [], error: null }`. Así las mutaciones
 * (saveDiet, updateDietPlan, etc.) NO lanzan `null.from(...)` y la app sigue
 * funcionando en modo local (los datos viven en el estado de React).
 */
function createSupabaseStub(): SupabaseClient {
  const result = Promise.resolve({ data: [], error: null });
  const chain: any = new Proxy(result, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      // Cualquier método (select, insert, update, delete, eq, order, upsert…)
      // devuelve la misma cadena thenable.
      return () => chain;
    },
  });
  return { from: () => chain } as unknown as SupabaseClient;
}

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
  supabase = createSupabaseStub();
}

export { supabase };
