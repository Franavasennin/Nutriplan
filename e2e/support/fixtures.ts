import { test as base, expect, type Route } from '@playwright/test';
import { FakeSupabase, type Tables } from './fakeSupabase';
import { FakeAi, type AiProvider } from './fakeAi';
import { loadEdgeFunction, type EdgeHandler } from './edgeFunction';

/**
 * Fixtures comunes de los E2E.
 *
 * AISLAMIENTO (lo más importante de esta capa): .env.local apunta al Supabase
 * de PRODUCCIÓN, con pacientes reales, y a claves reales de IA. El servidor de
 * los E2E (playwright.config.ts) arranca con URLs y claves falsas, y aquí
 * TODA petición que salga del navegador pasa por un único handler:
 *  - localhost (la propia app)          → pasa
 *  - supabase.e2e.test                   → PostgREST en memoria / Edge Function real en Node
 *  - Gemini / Mistral                    → IA simulada
 *  - cualquier otra cosa                 → se aborta y se registra
 * Al acabar cada test se comprueba que nada intentó llegar a un Supabase real
 * ni a otro proveedor de IA. Si eso pasa, el test falla.
 */

export const FAKE_SUPABASE_URL = 'http://supabase.e2e.test';
export const FAKE_ANON_KEY = 'e2e-anon-key';

const FORBIDDEN_HOSTS = /(^|\.)supabase\.(co|in|com)$|groq\.com$|openai\.com$|anthropic\.com$/;
const ICON_BOX_CSS = `.material-symbols-outlined{display:inline-block;width:1em;height:1em;overflow:hidden;white-space:nowrap;line-height:1;color:transparent;}`;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

export interface BrowserRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

interface Fixtures {
  /** Filas iniciales de la BD falsa — sobrescribible con test.use({ seed }). */
  seed: Tables;
  db: FakeSupabase;
  ai: FakeAi;
  /** Peticiones del navegador a supabase.e2e.test (REST y Functions). */
  supabaseRequests: BrowserRequest[];
  /** Respuestas de la Edge Function portal-diet tal y como las recibió el navegador. */
  portalResponses: unknown[];
  backend: void;
}

export const test = base.extend<Fixtures>({
  seed: [{}, { option: true }],

  db: async ({ seed }, use) => {
    await use(new FakeSupabase(seed));
  },

  ai: async ({}, use) => {
    await use(new FakeAi());
  },

  supabaseRequests: async ({}, use) => {
    await use([]);
  },

  portalResponses: async ({}, use) => {
    await use([]);
  },

  backend: [async ({ context, db, ai, supabaseRequests, portalResponses }, use) => {
    const blocked: string[] = [];
    const pageErrors: string[] = [];
    let portalServer: { url: string; close: () => Promise<void> } | undefined;
    let portalHandler: EdgeHandler | undefined;

    const fulfillAi = async (route: Route, provider: AiProvider) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      const body = req.postDataJSON();
      const systemPrompt = provider === 'gemini'
        ? body.systemInstruction?.parts?.[0]?.text ?? ''
        : body.messages?.find((m: any) => m.role === 'system')?.content ?? '';
      const userPrompt = provider === 'gemini'
        ? body.contents?.[0]?.parts?.[0]?.text ?? ''
        : body.messages?.find((m: any) => m.role === 'user')?.content ?? '';

      if (provider === 'gemini' && ai.geminiStatus !== 200) {
        ai.calls.push({ provider, kind: 'failed', systemPrompt, userPrompt });
        return route.fulfill({
          status: ai.geminiStatus, headers: CORS, contentType: 'application/json',
          body: JSON.stringify({ error: { code: ai.geminiStatus, message: 'Fallo simulado de Gemini', status: 'UNAVAILABLE' } }),
        });
      }

      let text: string;
      try {
        text = ai.respond(provider, systemPrompt, userPrompt);
      } catch (err: any) {
        return route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: JSON.stringify({ message: err.message }) });
      }
      const payload = provider === 'gemini'
        ? { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }
        : { choices: [{ message: { content: text } }] };
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(payload) });
    };

    const fulfillSupabase = async (route: Route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() !== 'OPTIONS') {
        supabaseRequests.push({ method: req.method(), url: req.url(), headers: await req.allHeaders() });
      }

      if (url.pathname.startsWith('/rest/v1/')) {
        const out = db.handle(req.method(), req.url(), await req.allHeaders(), req.postData());
        return route.fulfill({ status: out.status, headers: out.headers, body: out.body });
      }

      if (url.pathname === '/functions/v1/portal-diet') {
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        if (!portalHandler) {
          portalServer = await db.listen();
          portalHandler = await loadEdgeFunction('portal-diet', {
            SUPABASE_URL: portalServer.url,
            SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',
          });
        }
        const res = await portalHandler(new Request(`http://edge.local${url.pathname}${url.search}`, { method: req.method() }));
        const text = await res.text();
        try { portalResponses.push(JSON.parse(text)); } catch { portalResponses.push(text); }
        return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: text });
      }

      if (url.pathname === '/functions/v1/portal-complete') {
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{"ok":true}' });
      }

      return route.fulfill({ status: 404, headers: CORS, contentType: 'application/json', body: '{"message":"no simulado"}' });
    };

    // Estado de una clínica que hace sus backups: sin esto, el toast de
    // "Aún no has hecho ningún backup" (App.tsx) tapa botones de la cabecera.
    await context.addInitScript(() => {
      try { localStorage.setItem('nutriplan_last_backup_at', String(Date.now())); } catch { /* sin storage */ }
    });

    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
      // Google Fonts: tests herméticos, sin internet. En su lugar, una hoja
      // que reserva a cada icono de Material Symbols la caja de 1em que
      // ocuparía su glifo real — sin fuente, el nombre del icono ("menu_book")
      // se pinta como texto ancho y se solapa con los botones vecinos.
      if (url.hostname === 'fonts.googleapis.com') {
        return route.fulfill({ status: 200, contentType: 'text/css', body: ICON_BOX_CSS });
      }
      if (url.hostname === 'fonts.gstatic.com') return route.abort('blockedbyclient');
      if (url.origin === FAKE_SUPABASE_URL) return fulfillSupabase(route);
      if (url.hostname === 'generativelanguage.googleapis.com') return fulfillAi(route, 'gemini');
      if (url.hostname === 'api.mistral.ai') return fulfillAi(route, 'mistral');
      blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    });

    const watchErrors = (p: import('@playwright/test').Page) => p.on('pageerror', err => pageErrors.push(err.message));
    context.pages().forEach(watchErrors);
    context.on('page', watchErrors);

    await use();

    await portalServer?.close();

    const leaks = blocked.filter(u => FORBIDDEN_HOSTS.test(new URL(u).hostname));
    expect(leaks, 'Ninguna petición debe intentar llegar a un Supabase real ni a otro proveedor de IA').toEqual([]);
    expect(pageErrors, 'La app no debe lanzar excepciones no controladas').toEqual([]);
  }, { auto: true }],
});

export { expect };
