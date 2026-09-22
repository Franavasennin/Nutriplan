import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * PostgREST en memoria — lo justo para que supabase-js funcione contra él.
 *
 * Los E2E NUNCA hablan con el Supabase real (tiene pacientes reales): el
 * navegador llega aquí vía page.route y la Edge Function real del portal
 * (ejecutada en Node, ver edgeFunction.ts) vía un servidor HTTP local que
 * comparte la misma base de datos.
 *
 * Cubre lo que usa la app: select/insert/upsert/update/delete, filtros
 * eq/neq/gt/gte/lt/lte/in/is (incluidas rutas JSON `col->>campo`), order,
 * limit y la cabecera Accept de objeto único (.single()).
 */

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

export interface RecordedRequest {
  method: string;
  table: string;
  params: Record<string, string>;
  body: unknown;
}

export interface FakeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range',
};

/** Lee `patient_data->>clientId` o una columna simple. */
function readColumn(row: Row, column: string): unknown {
  const parts = column.split(/->>?/);
  let value: any = row[parts[0]];
  for (const key of parts.slice(1)) value = value == null ? undefined : value[key];
  return value;
}

function compare(value: unknown, raw: string): number {
  if (typeof value === 'number') return value - Number(raw);
  return String(value).localeCompare(raw);
}

function matchesFilter(row: Row, column: string, expr: string): boolean {
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const raw = expr.slice(dot + 1);
  const value = readColumn(row, column);
  switch (op) {
    case 'eq':  return value != null && String(value) === raw;
    case 'neq': return value == null || String(value) !== raw;
    case 'gt':  return value != null && compare(value, raw) > 0;
    case 'gte': return value != null && compare(value, raw) >= 0;
    case 'lt':  return value != null && compare(value, raw) < 0;
    case 'lte': return value != null && compare(value, raw) <= 0;
    case 'is':  return raw === 'null' ? value == null : String(value) === raw;
    case 'in': {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
      return value != null && list.includes(String(value));
    }
    default:
      throw new Error(`[fakeSupabase] operador de filtro no soportado: ${op} (${column}=${expr})`);
  }
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let result = rows;
  for (const [key, expr] of params) {
    if (RESERVED_PARAMS.has(key)) continue;
    result = result.filter(r => matchesFilter(r, key, expr));
  }
  return result;
}

function applyOrder(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const clauses = order.split(',').map(c => {
    const [column, ...mods] = c.split('.');
    return { column, desc: mods.includes('desc') };
  });
  return [...rows].sort((a, b) => {
    for (const { column, desc } of clauses) {
      const va = readColumn(a, column);
      const vb = readColumn(b, column);
      if (va === vb) continue;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return desc ? -cmp : cmp;
    }
    return 0;
  });
}

function json(status: number, data: unknown): FakeResponse {
  return {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data),
  };
}

function empty(status: number): FakeResponse {
  return { status, headers: { ...CORS_HEADERS }, body: '' };
}

export class FakeSupabase {
  readonly tables: Tables = {};
  readonly requests: RecordedRequest[] = [];

  constructor(seed: Tables = {}) {
    for (const [name, rows] of Object.entries(seed)) {
      this.tables[name] = rows.map(r => structuredClone(r));
    }
  }

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  /** Atiende una petición a `/rest/v1/...`; `url` debe ser absoluta. */
  handle(method: string, url: string, headers: Record<string, string>, rawBody: string | null): FakeResponse {
    if (method === 'OPTIONS') return empty(204);

    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (!match) return json(404, { message: `ruta no simulada: ${parsed.pathname}` });

    const tableName = decodeURIComponent(match[1]);
    const params = parsed.searchParams;
    const body = rawBody ? JSON.parse(rawBody) : null;
    this.requests.push({ method, table: tableName, params: Object.fromEntries(params), body });

    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const prefer = lower['prefer'] ?? '';
    const wantsObject = (lower['accept'] ?? '').includes('application/vnd.pgrst.object+json');
    const wantsRepresentation = prefer.includes('return=representation');
    const rows = this.table(tableName);

    const respondRows = (result: Row[], okStatus: number): FakeResponse => {
      if (wantsObject) {
        if (result.length !== 1) {
          return json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        }
        return json(okStatus, result[0]);
      }
      return json(okStatus, result);
    };

    switch (method) {
      case 'GET':
      case 'HEAD': {
        let result = applyOrder(applyFilters(rows, params), params.get('order'));
        const offset = Number(params.get('offset') ?? 0);
        const limit = params.get('limit');
        result = result.slice(offset, limit != null ? offset + Number(limit) : undefined);
        return respondRows(result.map(r => structuredClone(r)), 200);
      }
      case 'POST': {
        const incoming: Row[] = Array.isArray(body) ? body : [body];
        const isUpsert = prefer.includes('resolution=merge-duplicates');
        const conflictCols = (params.get('on_conflict') ?? 'id').split(',');
        const written: Row[] = [];
        for (const item of incoming) {
          const row: Row = { created_at: new Date().toISOString(), ...structuredClone(item) };
          const existing = isUpsert
            ? rows.find(r => conflictCols.every(c => r[c] != null && r[c] === row[c]))
            : undefined;
          if (existing) {
            Object.assign(existing, row);
            written.push(existing);
          } else {
            rows.push(row);
            written.push(row);
          }
        }
        return wantsRepresentation ? respondRows(written.map(r => structuredClone(r)), 201) : empty(201);
      }
      case 'PATCH': {
        const targets = applyFilters(rows, params);
        for (const r of targets) Object.assign(r, structuredClone(body));
        return wantsRepresentation ? respondRows(targets.map(r => structuredClone(r)), 200) : empty(204);
      }
      case 'DELETE': {
        const targets = new Set(applyFilters(rows, params));
        this.tables[tableName] = rows.filter(r => !targets.has(r));
        return wantsRepresentation ? respondRows([...targets], 200) : empty(204);
      }
      default:
        return json(405, { message: `método no simulado: ${method}` });
    }
  }

  /**
   * Expone esta misma base de datos por HTTP real en 127.0.0.1, para
   * clientes que no pasan por el navegador (la Edge Function en Node).
   */
  async listen(): Promise<{ url: string; close: () => Promise<void> }> {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const headers = Object.fromEntries(
          Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])
        );
        const raw = chunks.length ? Buffer.concat(chunks).toString('utf8') : null;
        const out = this.handle(req.method ?? 'GET', `http://127.0.0.1${req.url}`, headers, raw);
        res.writeHead(out.status, out.headers);
        res.end(out.body);
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
      url: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  }
}
