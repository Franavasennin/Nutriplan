import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

/**
 * Ejecuta el código REAL de una Supabase Edge Function (Deno) dentro de Node,
 * para probar su saneamiento sin desplegar nada ni necesitar Deno/Docker.
 *
 * Únicas adaptaciones, ambas de entorno (la lógica no se toca):
 *  - `jsr:@supabase/supabase-js@2` → `@supabase/supabase-js` (mismo paquete, vía npm)
 *  - `Deno.serve` / `Deno.env` → sustitutos que capturan el handler y leen
 *    las variables de entorno que le pasemos (URL del PostgREST falso).
 */

export type EdgeHandler = (req: Request) => Promise<Response>;

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'e2e-edge');
const JSR_IMPORT = "from 'jsr:@supabase/supabase-js@2'";
let loadCounter = 0;

export async function loadEdgeFunction(name: string, env: Record<string, string>): Promise<EdgeHandler> {
  const source = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', name, 'index.ts'), 'utf8');
  if (!source.includes(JSR_IMPORT)) {
    throw new Error(`[edgeFunction] ${name}: ya no importa ${JSR_IMPORT} — revisa este cargador.`);
  }

  const { outputText } = ts.transpileModule(source.replace(JSR_IMPORT, "from '@supabase/supabase-js'"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Nombre único por carga: import() cachea por URL y cada test quiere su
  // propio handler (con su propio entorno).
  const file = path.join(CACHE_DIR, `${name}-${process.pid}-${++loadCounter}.mjs`);
  fs.writeFileSync(file, outputText);

  let handler: EdgeHandler | undefined;
  const fakeDeno = {
    serve: (h: EdgeHandler) => { handler = h; return { finished: Promise.resolve() }; },
    env: { get: (key: string) => env[key] },
  };

  const g = globalThis as any;
  g.Deno = fakeDeno;
  await import(pathToFileURL(file).href);
  if (!handler) throw new Error(`[edgeFunction] ${name}: no llamó a Deno.serve al cargarse.`);

  const captured = handler;
  // El handler lee Deno.env en cada petición: se reinstala nuestro Deno antes
  // de cada llamada por si otra carga lo sustituyó entretanto.
  return (req: Request) => {
    g.Deno = fakeDeno;
    return captured(req);
  };
}
