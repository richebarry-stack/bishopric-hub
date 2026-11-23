// Request plumbing shared by every API module: env/session types, JSON responses,
// session lookup, optimistic-concurrency checks, column filtering and time zone helpers.
import { stripBold } from '../nameMatch';

export interface Env {
  DB: D1Database;
  RECOVERY_KEY?: string;
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
}

// Registers an email as a Cloudflare Email Routing destination address, which is
// what triggers Cloudflare's own verification email to that address — required
// before the action-item mailer can ever send anything to it. Re-registering an
// address that's already added (verified or not) is safe — Cloudflare treats it
// as idempotent and, if still unverified, resends the verification email. Best
// effort: never throws, so a missing token or a Cloudflare-side error never blocks
// whatever caller triggered this.
export async function registerEmailDestination(env: Env, email: string): Promise<{ ok: boolean; error?: string }> {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { ok: false, error: 'CF_API_TOKEN or CF_ACCOUNT_ID not configured' };
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`,
      { method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }
    );
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null) as { errors?: { code: number; message: string }[] } | null;
    const cfError = data?.errors?.[0];
    // Code 2025: a verification email for this address already went out very recently —
    // not a real failure, just tell the admin to wait rather than showing a red error.
    if (cfError?.code === 2025) return { ok: false, error: 'A verification email was already sent to this address recently — try again in a few minutes.' };
    return { ok: false, error: cfError ? `Cloudflare: ${cfError.message}` : `Cloudflare API returned ${res.status}` };
  } catch (err) {
    // Keep internal error details out of the response; they go to the Worker log instead.
    console.error('registerEmailDestination failed:', err);
    return { ok: false, error: 'Could not reach Cloudflare to register this email address. Try again in a few minutes.' };
  }
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  role: string;
  church_role: string;
  hub: string;
  name: string;
  last_access?: string;
}

export function localNow(timeZone: string): { date: string; time: string } {
  const fmt = (tz: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  let parts: Intl.DateTimeFormatPart[];
  try { parts = fmt(timeZone); } catch { parts = fmt(DEFAULT_TIME_ZONE); }
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** "First Last" / "Last, First" compare, for matching a conducting name to a user. */

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) => stripBold(s).trim().toLowerCase().replace(/\s+/g, ' ');
  const flip = (s: string) => {
    if (!s.includes(',')) return s;
    const [last, first] = s.split(',').map(p => p.trim());
    return first ? `${first} ${last}` : s;
  };
  const x = flip(norm(a || ''));
  const y = flip(norm(b || ''));
  return !!x && !!y && x === y;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Returns a 409 response if the row's current updated_at doesn't match the
// client's base version (i.e. someone else saved a change in between), else null.
export async function checkConflict(db: D1Database, tableName: string, recordId: string, baseUpdatedAt: string): Promise<Response | null> {
  const row = await db.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`).bind(recordId).first<{ updated_at: string | null }>();
  if (row && row.updated_at && row.updated_at !== baseUpdatedAt) {
    const current = await db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(recordId).first();
    return json({ error: 'conflict', current }, 409);
  }
  return null;
}

export function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

export function isForeignKeyConstraintError(e: unknown): boolean {
  return e instanceof Error && /FOREIGN KEY constraint failed/i.test(e.message);
}

// The app's configured local time zone (IANA name), used to decide calendar-day
// boundaries for things like "last access". Admin-configurable via ui_settings;
// cached briefly in memory since getSession runs on every request.
let cachedTimeZone: { value: string; expiresAt: number } | null = null;

export const DEFAULT_TIME_ZONE = 'America/Denver';

export async function getAppTimeZone(db: D1Database): Promise<string> {
  if (cachedTimeZone && cachedTimeZone.expiresAt > Date.now()) return cachedTimeZone.value;
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'app_timezone'").first<{ value: string }>();
  const value = row?.value || DEFAULT_TIME_ZONE;
  cachedTimeZone = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}

export function localDateString(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone });
  } catch {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: DEFAULT_TIME_ZONE });
  }
}

export async function getSession(request: Request, db: D1Database): Promise<Session | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];
  const session = await db.prepare(
    `SELECT s.id, s.user_id, s.expires_at, u.role, u.church_role, u.hub, u.name, u.last_access
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).bind(sessionId).first<Session>();
  if (session) {
    // Update once per local calendar day (not just once per rolling 24h) so a
    // login shows up as "today" immediately, even if the previous update was
    // less than 24h ago. Day boundary uses the app's configured time zone.
    const timeZone = await getAppTimeZone(db);
    const nowIso = new Date().toISOString();
    const alreadyUpdatedToday = session.last_access && localDateString(session.last_access, timeZone) === localDateString(nowIso, timeZone);
    if (!alreadyUpdatedToday) {
      await db.prepare('UPDATE users SET last_access = ? WHERE id = ?').bind(nowIso, session.user_id).run();
    }
  }
  return session;
}

// Column names per table, read once per Worker instance.
export const columnCache = new Map<string, Set<string>>();

/**
 * Drops request fields that aren't columns of `table` (and `id`), so field names from a
 * request can't inject SQL when they're used as column names. Unknown fields were never
 * valid anyway: the database would have rejected them.
 */

export async function keepKnownColumns(db: D1Database, table: string, body: Record<string, unknown>): Promise<void> {
  let cols = columnCache.get(table);
  if (!cols) {
    const { results } = await db.prepare('SELECT name FROM pragma_table_info(?)').bind(table).all<{ name: string }>();
    cols = new Set(results.map(r => r.name));
    if (cols.size > 0) columnCache.set(table, cols);
  }
  for (const k of Object.keys(body)) {
    if (k === 'id' || !cols.has(k)) delete body[k];
  }
}

/** Emails are matched ignoring case and surrounding spaces (phones often capitalize the first letter). */

export function normEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Sign-in lockout. Each failed try records one row for the email and one for the
 * network (IP), counted separately: 5 tries per email in 15 minutes, and a looser
 * 20 per network, since a whole household or building can share one IP.
 */

export async function tooManyAttempts(db: D1Database, identifier: string, ip: string): Promise<boolean> {
  const { results } = await db.prepare(
    "SELECT identifier, COUNT(*) as cnt FROM login_attempts WHERE identifier IN (?, ?) AND attempted_at > datetime('now', '-15 minutes') GROUP BY identifier"
  ).bind(identifier, ip).all<{ identifier: string; cnt: number }>();
  const count = (id: string) => results.find(r => r.identifier === id)?.cnt ?? 0;
  return count(identifier) >= 5 || count(ip) >= 20;
}

/** Lets the app-timezone route drop the cached value after an admin changes it. */
export function clearAppTimeZoneCache(): void {
  cachedTimeZone = null;
}

/** Everything a route handler needs from the Pages Functions request context. */
export interface Ctx {
  request: Request;
  env: Env;
  db: D1Database;
  url: URL;
  routeParts: string[];
  method: string;
  waitUntil: (p: Promise<unknown>) => void;
}
