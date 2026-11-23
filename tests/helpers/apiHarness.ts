// Runs the real API (functions/api/[[route]].ts) in Node against an in-memory SQLite
// database built from every file in migrations/, through a small D1-compatible shim.
// Lets tests exercise routing, sessions, hub access rules and SQL without Wrangler.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { onRequest } from '../../functions/api/[[route]]';

type Row = Record<string, unknown>;

function toSqlValue(v: unknown): SQLInputValue {
  if (v === undefined) throw new Error('D1_TYPE_ERROR: undefined is not a supported bind value');
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as SQLInputValue;
}

class Statement {
  private db: DatabaseSync;
  private sql: string;
  private params: SQLInputValue[];
  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...values: unknown[]) { return new Statement(this.db, this.sql, values.map(toSqlValue)); }
  private prepared() { return this.db.prepare(this.sql); }
  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.prepared().get(...this.params) as Row | undefined;
    if (!row) return null;
    return (column ? row[column] ?? null : row) as T;
  }
  async all<T = Row>() { return this.exec<T>(); }
  async run<T = Row>() { return this.exec<T>(); }
  exec<T>() {
    const stmt = this.prepared();
    if (stmt.columns().length > 0) {
      const results = stmt.all(...this.params) as T[];
      return { results, success: true, meta: { changes: 0, last_row_id: 0 } };
    }
    const r = stmt.run(...this.params);
    return { results: [] as T[], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

function createD1() {
  const db = new DatabaseSync(':memory:');
  const dir = join(import.meta.dirname, '..', '..', 'migrations');
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`, { cause: e });
    }
  }
  const d1 = {
    raw: db,
    prepare: (sql: string) => new Statement(db, sql),
    async batch(stmts: Statement[]) {
      db.exec('BEGIN');
      try {
        const out = stmts.map(s => s.exec());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return d1;
}

export interface TestUser { id: number; cookie: string }

export function createApi() {
  const DB = createD1();
  const pending: Promise<unknown>[] = [];
  let nextUser = 1;

  async function call(method: string, path: string, opts: { user?: TestUser; body?: unknown } = {}) {
    const url = new URL(path, 'https://hub.test');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.user) headers.Cookie = opts.user.cookie;
    const request = new Request(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const route = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const context = {
      request,
      env: { DB },
      params: { route },
      waitUntil: (p: Promise<unknown>) => { pending.push(p.catch(() => {})); },
    } as unknown as Parameters<typeof onRequest>[0];
    const res = await onRequest(context);
    await Promise.all(pending.splice(0));
    const text = await res.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* not JSON (e.g. an .ics feed) */ }
    return { status: res.status, data: data as any, headers: res.headers }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /** Adds a user with a live session; hub is 'both' (Bishopric), 'wc', 'yc' or 'cal'. */
  function addUser(fields: { name?: string; role?: string; church_role?: string; hub?: string; email?: string; password_hash?: string } = {}): TestUser {
    const n = nextUser++;
    const r = DB.raw.prepare(
      'INSERT INTO users (name, email, password_hash, role, church_role, hub) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(fields.name ?? `User ${n}`, fields.email ?? `user${n}@example.test`, fields.password_hash ?? 'x',
      fields.role ?? 'member', fields.church_role ?? '', fields.hub ?? 'both');
    const id = Number(r.lastInsertRowid);
    const sid = `session-${n}`;
    // Mark daily jobs as just run so requests don't kick off the background cron.
    DB.raw.prepare(`INSERT OR IGNORE INTO ui_settings (key, value, updated_at) VALUES ('daily_jobs', '{}', ?)`).run(new Date().toISOString());
    DB.raw.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sid, id, '2999-01-01 00:00:00');
    return { id, cookie: `session=${sid}` };
  }

  return { DB, call, addUser };
}
