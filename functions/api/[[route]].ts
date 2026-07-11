import { syncConduct, runDailyJobs, syncSettingApartInterviews } from './jobs';

interface Env {
  DB: D1Database;
  RECOVERY_KEY?: string;
}

interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  role: string;
  church_role: string;
  hub: string;
  name: string;
  last_access?: string;
}

const TABLES: Record<string, { name: string; orderBy?: string }> = {
  'calling-pipeline': { name: 'calling_pipeline', orderBy: 'id DESC' },
  'interview-pipeline': { name: 'interview_pipeline', orderBy: 'id DESC' },
  'tasks': { name: 'tasks', orderBy: 'done ASC, created_date DESC' },
  'rotating-assignments': { name: 'rotating_assignments', orderBy: 'id ASC' },
  'bishopric-meetings': { name: 'bishopric_meetings', orderBy: 'date DESC' },
  'bishopric-agenda-items': { name: 'bishopric_agenda_items', orderBy: 'meeting_date ASC, position ASC, id ASC' },
  'out-of-town': { name: 'out_of_town', orderBy: 'start_date ASC' },
  'sacrament-speakers': { name: 'sacrament_speakers', orderBy: 'meeting_date DESC, speaking_order ASC' },
  'prayers': { name: 'prayers', orderBy: 'meeting_date DESC' },
  'sacrament-music': { name: 'sacrament_music', orderBy: 'meeting_date DESC' },
  'sacrament-themes': { name: 'sacrament_themes', orderBy: 'meeting_date DESC' },
  'member-needs': { name: 'member_needs', orderBy: 'resolved ASC, id DESC' },
  'calendaring': { name: 'calendaring', orderBy: 'dates DESC' },
  'missionary-pipeline': { name: 'missionary_pipeline', orderBy: 'id DESC' },
  'babies': { name: 'babies', orderBy: 'due_birth_date ASC' },
  'bishop-schedule': { name: '"bishop-schedule"', orderBy: 'date ASC, start_time ASC' },
  'members-without-callings': { name: 'members_without_callings', orderBy: 'name ASC' },
  'sacrament-announcements': { name: 'sacrament_announcements', orderBy: 'meeting_date DESC' },
  'prayer-others': { name: 'prayer_others', orderBy: 'id ASC' },
  'sacrament-agenda-notes': { name: 'sacrament_agenda_notes', orderBy: 'position ASC' },
  'sacrament-ward-business': { name: 'sacrament_ward_business', orderBy: 'meeting_date DESC' },
  'sacrament-agenda-exclusions': { name: 'sacrament_agenda_exclusions', orderBy: 'id ASC' },
  'important-links': { name: 'important_links', orderBy: 'id ASC' },
  'ward-members': { name: 'ward_members', orderBy: 'name ASC' },
  'youth-activities': { name: 'youth_activities', orderBy: 'date ASC' },
  'wc-meetings': { name: 'wc_meetings', orderBy: 'date ASC' },
  'wc-wins': { name: 'wc_wins', orderBy: 'date DESC' },
  'wc-family-needs': { name: 'wc_family_needs', orderBy: 'id ASC' },
  'wc-discussion-topics': { name: 'wc_discussion_topics', orderBy: 'meeting_date DESC, organization ASC' },
  'hub-suggestions': { name: 'hub_suggestions', orderBy: 'id DESC' },
  'ordinances': { name: 'ordinances', orderBy: 'status ASC, target_date ASC' },
  'annual-duties': { name: 'annual_duties', orderBy: 'sort_order ASC, id ASC' },
  'yc-meetings': { name: 'yc_meetings', orderBy: 'date ASC' },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Returns a 409 response if the row's current updated_at doesn't match the
// client's base version (i.e. someone else saved a change in between), else null.
async function checkConflict(db: D1Database, tableName: string, recordId: string, baseUpdatedAt: string): Promise<Response | null> {
  const row = await db.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`).bind(recordId).first<{ updated_at: string | null }>();
  if (row && row.updated_at && row.updated_at !== baseUpdatedAt) {
    const current = await db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(recordId).first();
    return json({ error: 'conflict', current }, 409);
  }
  return null;
}

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Error && /UNIQUE constraint failed/i.test(e.message);
}

// Legacy unsalted SHA-256 — kept only to recognize old password/security-answer hashes
// so they can be transparently upgraded to PBKDF2 the next time they're verified.
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PBKDF2_ITERATIONS = 100_000;
const bufToBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base64ToBuf = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// Current password hash format: pbkdf2$<iterations>$<saltB64>$<hashB64> (PBKDF2-HMAC-SHA256).
async function hashPasswordSecure(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToBase64(salt.buffer as ArrayBuffer)}$${bufToBase64(bits)}`;
}

async function verifyPasswordSecure(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = base64ToBuf(parts[2]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return bufToBase64(bits) === parts[3];
}

// Verifies against either format; returns whether it matched the legacy (unsalted SHA-256)
// format so the caller can transparently rehash on successful legacy login.
async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
  if (stored.startsWith('pbkdf2$')) {
    return { valid: await verifyPasswordSecure(password, stored), legacy: false };
  }
  const legacyHash = await hashPassword(password);
  return { valid: legacyHash === stored, legacy: true };
}

// Same legacy/secure dual-check as verifyPassword, for security-question answers.
async function verifyAnswer(answer: string, stored: string): Promise<{ valid: boolean; legacy: boolean }> {
  const normalized = answer.trim().toLowerCase();
  if (stored.startsWith('pbkdf2$')) {
    return { valid: await verifyPasswordSecure(normalized, stored), legacy: false };
  }
  const legacyHash = await hashPassword(normalized);
  return { valid: legacyHash === stored, legacy: true };
}

// The app's configured local time zone (IANA name), used to decide calendar-day
// boundaries for things like "last access". Admin-configurable via ui_settings;
// cached briefly in memory since getSession runs on every request.
let cachedTimeZone: { value: string; expiresAt: number } | null = null;
const DEFAULT_TIME_ZONE = 'America/Denver';

async function getAppTimeZone(db: D1Database): Promise<string> {
  if (cachedTimeZone && cachedTimeZone.expiresAt > Date.now()) return cachedTimeZone.value;
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'app_timezone'").first<{ value: string }>();
  const value = row?.value || DEFAULT_TIME_ZONE;
  cachedTimeZone = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
  return value;
}

function localDateString(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone });
  } catch {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: DEFAULT_TIME_ZONE });
  }
}

async function getSession(request: Request, db: D1Database): Promise<Session | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];
  const session = await db.prepare(
    `SELECT s.id, s.user_id, s.expires_at, u.role, u.church_role, u.hub, u.name, u.last_access
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime("now")`
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

const WC_FULL_CRUD = new Set([
  'wc-wins', 'wc-family-needs', 'wc-discussion-topics',
  'tasks', 'calendaring', 'youth-activities', 'babies', 'hub-suggestions',
]);
const WC_READABLE = new Set([
  'wc-meetings',
  'sacrament-speakers', 'prayers', 'sacrament-music', 'sacrament-themes',
  'sacrament-agenda-notes', 'sacrament-announcements', 'sacrament-ward-business',
  'missionary-pipeline', 'yc-meetings',
]);

// Church role → hub mapping (duplicated from frontend constants for backend use)
const BISHOPRIC_CALLINGS = new Set([
  'Bishop', 'First Counselor', 'Second Counselor', 'Clerk',
  'Executive Secretary', 'Assistant Executive Secretary', 'Assistant Clerk', 'High Councilor',
]);
const YC_CALLINGS = new Set([
  // Advisers
  'Builders of Faith Adviser', 'Builders of Faith Second Adviser',
  'Messengers of Hope Adviser', 'Messengers of Hope Second Adviser',
  'Gatherers of Light Adviser', 'Gatherers of Light Second Adviser',
  'Priests Quorum Adviser', 'Priests Quorum Second Adviser',
  'Teachers Quorum Adviser', 'Teachers Quorum Second Adviser',
  'Deacons Quorum Adviser', 'Deacons Quorum Second Adviser',
  'Young Women Secretary',
  // Young Women class presidencies
  'Builders of Faith President', 'Builders of Faith First Counselor', 'Builders of Faith Second Counselor', 'Builders of Faith Secretary',
  'Messengers of Hope President', 'Messengers of Hope First Counselor', 'Messengers of Hope Second Counselor', 'Messengers of Hope Secretary',
  'Gatherers of Light President', 'Gatherers of Light First Counselor', 'Gatherers of Light Second Counselor', 'Gatherers of Light Secretary',
  // Priests Quorum presidency
  'Priests Quorum First Assistant', 'Priests Quorum Second Assistant', 'Priests Quorum Secretary',
  // Teachers Quorum presidency
  'Teachers Quorum President', 'Teachers Quorum First Counselor', 'Teachers Quorum Second Counselor', 'Teachers Quorum Secretary',
  // Deacons Quorum presidency
  'Deacons Quorum President', 'Deacons Quorum First Counselor', 'Deacons Quorum Second Counselor', 'Deacons Quorum Secretary',
]);
const CAL_CALLINGS = new Set(['Music Coordinator', 'Ward Bulletin Specialist']);
const WC_CALLINGS = new Set([
  'Elders Quorum President', 'Elders Quorum First Counselor', 'Elders Quorum Second Counselor',
  'Relief Society President', 'Relief Society First Counselor', 'Relief Society Second Counselor',
  'Young Women President', 'Young Women First Counselor', 'Young Women Second Counselor',
  'Primary President', 'Primary First Counselor', 'Primary Second Counselor',
  'Sunday School President', 'Sunday School First Counselor', 'Sunday School Second Counselor',
  'Ward Mission Leader', 'Ward Temple and Family History Leader',
]);
const KNOWN_CALLINGS = new Set([...BISHOPRIC_CALLINGS, ...WC_CALLINGS, ...YC_CALLINGS, ...CAL_CALLINGS]);
const VALID_HUBS = new Set(['both', 'wc', 'yc', 'cal']);

function hubForChurchRole(role: string): string {
  if (BISHOPRIC_CALLINGS.has(role)) return 'both';
  if (YC_CALLINGS.has(role)) return 'yc';
  if (CAL_CALLINGS.has(role)) return 'cal';
  return 'wc';
}

function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 10);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params, waitUntil } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const routeParts = (params.route as string[]) || [];
  const method = request.method;

  // Auth endpoints
  if (routeParts[0] === 'auth') {
    if (routeParts[1] === 'login' && method === 'POST') {
      const { email, password } = await request.json() as { email: string; password: string };
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const emailLower = email.toLowerCase();
      const attempts = await db.prepare(
        "SELECT COUNT(*) as cnt FROM login_attempts WHERE identifier IN (?, ?) AND attempted_at > datetime('now', '-15 minutes')"
      ).bind(emailLower, ip).first<{ cnt: number }>();
      if (attempts && attempts.cnt >= 5) {
        return json({ error: 'Too many attempts — please try again in a few minutes.' }, 429);
      }

      const user = await db.prepare(
        'SELECT id, name, email, role, church_role, hub, must_reset_password, password_hash FROM users WHERE email = ?'
      ).bind(email).first<{ id: number; name: string; email: string; role: string; church_role: string; hub: string; must_reset_password: number; password_hash: string }>();
      const check = user ? await verifyPassword(password, user.password_hash) : { valid: false, legacy: false };
      if (!user || !check.valid) {
        await db.prepare('INSERT INTO login_attempts (identifier) VALUES (?)').bind(emailLower).run();
        await db.prepare('INSERT INTO login_attempts (identifier) VALUES (?)').bind(ip).run();
        return json({ error: 'Invalid credentials' }, 401);
      }
      await db.prepare('DELETE FROM login_attempts WHERE identifier IN (?, ?)').bind(emailLower, ip).run();
      if (check.legacy) {
        const upgraded = await hashPasswordSecure(password);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgraded, user.id).run();
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
      await db.prepare(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionId, user.id, expiresAt).run();

      const sq = await db.prepare('SELECT user_id FROM security_questions WHERE user_id = ?').bind(user.id).first();
      return new Response(JSON.stringify({ user: { id: user.id, name: user.name, email: user.email, role: user.role, church_role: user.church_role, hub: user.hub ?? 'both', must_reset_password: !!user.must_reset_password, has_security_questions: !!sq } }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
        },
      });
    }

    if (routeParts[1] === 'guest' && method === 'POST') {
      const guestType = routeParts[2]; // 'yc' or 'sac'
      if (guestType !== 'yc' && guestType !== 'sac') return json({ error: 'Invalid guest type' }, 400);
      const guestEmail = guestType === 'yc' ? 'guest_yc' : 'guest_sac';
      const user = await db.prepare(
        'SELECT id, name, email, role, church_role, hub FROM users WHERE email = ? AND role = ?'
      ).bind(guestEmail, 'guest').first<{ id: number; name: string; email: string; role: string; church_role: string; hub: string }>();
      if (!user) return json({ error: 'Guest access not configured' }, 503);
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sessionId, user.id, expiresAt).run();
      return new Response(JSON.stringify({ user: { id: user.id, name: user.name, email: user.email, role: user.role, church_role: user.church_role ?? '', hub: user.hub ?? 'yc', must_reset_password: false, has_security_questions: true } }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
        },
      });
    }

    if (routeParts[1] === 'logout' && method === 'POST') {
      const session = await getSession(request, db);
      if (session) {
        await db.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run();
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0',
        },
      });
    }

    if (routeParts[1] === 'me') {
      const session = await getSession(request, db);
      if (!session) return json({ user: null });
      const user = await db.prepare(
        'SELECT id, name, email, role, church_role, hub, must_reset_password FROM users WHERE id = ?'
      ).bind(session.user_id).first<{ id: number; name: string; email: string; role: string; church_role: string; hub: string; must_reset_password: number }>();
      if (!user) return json({ user: null });
      const sq2 = await db.prepare('SELECT user_id FROM security_questions WHERE user_id = ?').bind(user.id).first();
      return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, church_role: user.church_role, hub: user.hub ?? 'both', must_reset_password: !!user.must_reset_password, has_security_questions: !!sq2 } });
    }

    if (routeParts[1] === 'change-password' && method === 'POST') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const { current_password, new_password } = await request.json() as { current_password?: string; new_password: string };
      const user = await db.prepare('SELECT id, password_hash, must_reset_password FROM users WHERE id = ?').bind(session.user_id).first<{ id: number; password_hash: string; must_reset_password: number }>();
      if (!user) return json({ error: 'User not found' }, 404);
      if (!user.must_reset_password && current_password) {
        const check = await verifyPassword(current_password, user.password_hash);
        if (!check.valid) return json({ error: 'Current password is incorrect' }, 400);
      }
      const newHash = await hashPasswordSecure(new_password);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?').bind(newHash, session.user_id).run();
      return json({ ok: true });
    }

    // Public: get security questions for an email (for forgot-password flow)
    if (routeParts[1] === 'security-questions' && method === 'GET') {
      const email = url.searchParams.get('email');
      if (!email) return json({ error: 'Email required' }, 400);
      const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>();
      if (!user) return json({ error: 'No account found for that email' }, 404);
      const sq = await db.prepare('SELECT question1, question2 FROM security_questions WHERE user_id = ?').bind(user.id).first<{ question1: string; question2: string }>();
      if (!sq) return json({ error: 'This account has no security questions set up' }, 404);
      return json({ question1: sq.question1, question2: sq.question2 });
    }

    // Authenticated: save/update security questions
    if (routeParts[1] === 'security-questions' && method === 'POST') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const { question1, answer1, question2, answer2 } = await request.json() as { question1: string; answer1: string; question2: string; answer2: string };
      if (!question1 || !answer1 || !question2 || !answer2) return json({ error: 'All fields required' }, 400);
      if (question1 === question2) return json({ error: 'Questions must be different' }, 400);
      const a1hash = await hashPasswordSecure(answer1.trim().toLowerCase());
      const a2hash = await hashPasswordSecure(answer2.trim().toLowerCase());
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO security_questions (user_id, question1, answer1_hash, question2, answer2_hash, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          question1 = excluded.question1, answer1_hash = excluded.answer1_hash,
          question2 = excluded.question2, answer2_hash = excluded.answer2_hash,
          updated_at = excluded.updated_at
      `).bind(session.user_id, question1, a1hash, question2, a2hash, now).run();
      return json({ ok: true });
    }

    // Public: verify answers and reset password
    if (routeParts[1] === 'reset-by-questions' && method === 'POST') {
      const { email, answer1, answer2, new_password } = await request.json() as { email: string; answer1: string; answer2: string; new_password: string };
      const emailLower = email.toLowerCase();
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const attempts = await db.prepare(
        "SELECT COUNT(*) as cnt FROM login_attempts WHERE identifier IN (?, ?) AND attempted_at > datetime('now', '-15 minutes')"
      ).bind('rbq:' + emailLower, ip).first<{ cnt: number }>();
      if (attempts && attempts.cnt >= 5) return json({ error: 'Too many attempts — please try again in a few minutes.' }, 429);

      if (!new_password || new_password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>();
      const sq = user ? await db.prepare('SELECT answer1_hash, answer2_hash FROM security_questions WHERE user_id = ?').bind(user.id).first<{ answer1_hash: string; answer2_hash: string }>() : null;
      const check1 = sq ? await verifyAnswer(answer1, sq.answer1_hash) : { valid: false, legacy: false };
      const check2 = sq ? await verifyAnswer(answer2, sq.answer2_hash) : { valid: false, legacy: false };
      if (!user || !sq || !check1.valid || !check2.valid) {
        await db.prepare('INSERT INTO login_attempts (identifier) VALUES (?)').bind('rbq:' + emailLower).run();
        await db.prepare('INSERT INTO login_attempts (identifier) VALUES (?)').bind(ip).run();
        return json({ error: !user ? 'No account found for that email' : !sq ? 'This account has no security questions set up' : 'One or more answers are incorrect' }, user && sq ? 400 : 404);
      }
      await db.prepare('DELETE FROM login_attempts WHERE identifier IN (?, ?)').bind('rbq:' + emailLower, ip).run();
      if (check1.legacy || check2.legacy) {
        const upgradedA1 = check1.legacy ? await hashPasswordSecure(answer1.trim().toLowerCase()) : sq.answer1_hash;
        const upgradedA2 = check2.legacy ? await hashPasswordSecure(answer2.trim().toLowerCase()) : sq.answer2_hash;
        await db.prepare('UPDATE security_questions SET answer1_hash = ?, answer2_hash = ? WHERE user_id = ?').bind(upgradedA1, upgradedA2, user.id).run();
      }
      const newHash = await hashPasswordSecure(new_password);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?').bind(newHash, user.id).run();
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
      return json({ ok: true });
    }

    if (routeParts[1] === 'emergency-reset' && method === 'POST') {
      const { email, new_password, recovery_key } = await request.json() as { email: string; new_password: string; recovery_key: string };
      if (!env.RECOVERY_KEY || recovery_key !== env.RECOVERY_KEY) return json({ error: 'Invalid recovery key' }, 403);
      const user = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>();
      if (!user) return json({ error: 'User not found' }, 404);
      if (!new_password || new_password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      const newHash = await hashPasswordSecure(new_password);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?').bind(newHash, user.id).run();
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
      return json({ ok: true });
    }

    // Public: submit a registration request (no session required)
    if (routeParts[1] === 'register-request' && method === 'POST') {
      const { name, email, password, church_role } = await request.json() as { name: string; email: string; password: string; church_role: string };
      if (!name || !email || !password || !church_role) return json({ error: 'All fields are required' }, 400);
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind(email).first();
      if (existing) return json({ error: 'An account with this email already exists' }, 409);
      const alreadyPending = await db.prepare('SELECT id FROM registration_requests WHERE LOWER(email) = LOWER(?)').bind(email).first();
      if (alreadyPending) return json({ error: 'A request for this email is already awaiting approval' }, 409);
      const hash = await hashPasswordSecure(password);
      await db.prepare(
        'INSERT INTO registration_requests (name, email, church_role, password_hash, requested_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(name, email, church_role, hash, new Date().toISOString()).run();
      return json({ ok: true });
    }

    if (routeParts[1] === 'register' && method === 'POST') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const admin = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (admin?.role !== 'admin') return json({ error: 'Admin only' }, 403);

      const { name, email, password, role } = await request.json() as { name: string; email: string; password: string; role: string };
      const hash = await hashPasswordSecure(password);
      try {
        await db.prepare(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).bind(name, email, hash, role || 'user').run();
        return json({ ok: true });
      } catch {
        return json({ error: 'User already exists' }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  }

  // All other endpoints require auth
  // (session checked below)

  // User management endpoints
  if (routeParts[0] === 'users') {
    const session = await getSession(request, db);
    if (!session) return json({ error: 'Unauthorized' }, 401);

    // WC admins: only reset-password and profile mutations on WC users
    const isWcAdmin = session.hub === 'wc' && session.role === 'admin';
    if (isWcAdmin && method !== 'GET') {
      const wcAllowed = routeParts[2] === 'reset-password' || routeParts[2] === 'profile';
      if (!wcAllowed) return json({ error: 'Forbidden' }, 403);
      const targetId = Number(routeParts[1]);
      const target = await db.prepare("SELECT hub FROM users WHERE id = ?").bind(targetId).first<{ hub: string }>();
      if (!target || !['wc', 'both'].includes(target.hub)) return json({ error: 'Forbidden' }, 403);
    }

    // Non-admins: read-only access to user list
    if (session.role !== 'admin' && method !== 'GET') {
      return json({ error: 'Forbidden' }, 403);
    }

    if (method === 'GET') {
      // WC-hub users only see WC users
      if (session.hub === 'wc') {
        const users = await db.prepare("SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE hub IN ('wc','both') ORDER BY name ASC").all();
        return json(users.results);
      }
      const filterHub = url.searchParams.get('hub');
      const users = filterHub === 'wc'
        ? await db.prepare("SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE hub IN ('wc','both') ORDER BY name ASC").all()
        : await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users ORDER BY name ASC').all();
      return json(users.results);
    }

    if (method === 'POST') {
      const { name, email, role, church_role, hub } = await request.json() as { name: string; email: string; role: string; church_role?: string; hub?: string };
      let newHub: string;
      if (church_role && !KNOWN_CALLINGS.has(church_role)) {
        if (!hub || !VALID_HUBS.has(hub)) return json({ error: 'This calling is not on the standard list — please choose a hub for this person.' }, 400);
        newHub = hub;
      } else {
        newHub = hubForChurchRole(church_role || '');
      }
      const tempPassword = generateTempPassword();
      const hash = await hashPasswordSecure(tempPassword);
      const newRole = role === 'admin' ? 'admin' : 'user';
      try {
        const result = await db.prepare(
          'INSERT INTO users (name, email, password_hash, role, church_role, hub, must_reset_password) VALUES (?, ?, ?, ?, ?, ?, 1)'
        ).bind(name, email, hash, newRole, church_role || '', newHub).run();
        const newUser = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
        return json({ ...newUser as object, temp_password: tempPassword }, 201);
      } catch {
        return json({ error: 'User already exists' }, 400);
      }
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'hub') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const { hub } = await request.json() as { hub: string };
      if (!VALID_HUBS.has(hub)) return json({ error: 'Invalid hub' }, 400);
      const target = await db.prepare('SELECT church_role FROM users WHERE id = ?').bind(userId).first<{ church_role: string }>();
      const requiredHub = target?.church_role && KNOWN_CALLINGS.has(target.church_role) ? hubForChurchRole(target.church_role) : null;
      if (requiredHub && requiredHub !== hub) return json({ error: `Users with the calling "${target!.church_role}" must be assigned to the ${requiredHub === 'both' ? 'Bishopric' : requiredHub === 'cal' ? 'Calendar' : requiredHub === 'yc' ? 'Youth Council' : 'Ward Council'} hub.` }, 400);
      await db.prepare('UPDATE users SET hub = ? WHERE id = ?').bind(hub, userId).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(userId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'church-role') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const { church_role, hub } = await request.json() as { church_role: string; hub?: string };
      let newHub: string;
      if (church_role && !KNOWN_CALLINGS.has(church_role)) {
        // Custom calling: use an explicitly supplied hub, or fall back to whatever hub this
        // user already has (never silently reassign an existing user to Ward Council).
        if (hub && VALID_HUBS.has(hub)) {
          newHub = hub;
        } else {
          const current = await db.prepare('SELECT hub FROM users WHERE id = ?').bind(userId).first<{ hub: string }>();
          newHub = current?.hub && VALID_HUBS.has(current.hub) ? current.hub : 'wc';
        }
      } else {
        newHub = hubForChurchRole(church_role || '');
      }
      await db.prepare('UPDATE users SET church_role = ?, hub = ? WHERE id = ?').bind(church_role ?? '', newHub, userId).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(userId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'profile') {
      const targetId = Number(routeParts[1]);
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      const isAdmin = caller?.role === 'admin';
      const isSelf = session.user_id === targetId;
      if (!isAdmin && !isSelf) return json({ error: 'Unauthorized' }, 403);
      const body = await request.json() as { name?: string; email?: string };
      if (!isAdmin && body.name !== undefined) return json({ error: 'Only admins can change names' }, 403);
      if (body.email) {
        const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(body.email, targetId).first();
        if (existing) return json({ error: 'Email already in use' }, 400);
      }
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (isAdmin && body.name !== undefined) { updates.push('name = ?'); vals.push(body.name); }
      if (body.email !== undefined) { updates.push('email = ?'); vals.push(body.email); }
      if (!updates.length) return json({ error: 'Nothing to update' }, 400);
      vals.push(targetId);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(targetId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'role') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const { role } = await request.json() as { role: string };
      if (!['admin', 'user'].includes(role)) return json({ error: 'Invalid role' }, 400);
      const target = await db.prepare('SELECT role, church_role FROM users WHERE id = ?').bind(userId).first<{ role: string; church_role: string }>();
      if (role === 'admin' && !BISHOPRIC_CALLINGS.has(target?.church_role ?? '')) {
        return json({ error: 'Only users with a bishopric calling can be administrators.' }, 400);
      }
      if (role !== 'admin') {
        const adminCount = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").first<{ cnt: number }>();
        if (target?.role === 'admin' && adminCount && adminCount.cnt <= 1) {
          return json({ error: 'Must have at least one admin' }, 400);
        }
      }
      await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(userId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'reset-password') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const tempPassword = generateTempPassword();
      const tempHash = await hashPasswordSecure(tempPassword);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?').bind(tempHash, userId).run();
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
      return json({ ok: true, temp_password: tempPassword });
    }

    if (method === 'DELETE' && routeParts[1]) {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      if (userId === session.user_id) return json({ error: 'Cannot delete yourself' }, 400);
      const target = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first<{ role: string }>();
      if (target?.role === 'admin') {
        const adminCount = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").first<{ cnt: number }>();
        if (adminCount && adminCount.cnt <= 1) return json({ error: 'Must have at least one admin' }, 400);
      }
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
      await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  }
  const session = await getSession(request, db);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  // Lazy cron: Pages Functions have no scheduled triggers, so once a day, whichever
  // authenticated (non-guest) request happens to land here claims and runs the daily
  // jobs in the background. The conditional UPDATE ensures only one request wins the
  // claim even if several land at once.
  if (session.role !== 'guest') {
    const nowIso = new Date().toISOString();
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const claim = await db.prepare(
      `INSERT INTO ui_settings (key, value, updated_at) VALUES ('daily_jobs', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
       WHERE ui_settings.updated_at < ?`
    ).bind(JSON.stringify({ last_run: nowIso, results: {}, status: 'running' }), nowIso, cutoffIso).run();
    if (claim.meta.changes === 1) {
      waitUntil((async () => {
        const results = await runDailyJobs(db);
        await db.prepare("UPDATE ui_settings SET value = ?, updated_at = ? WHERE key = 'daily_jobs'")
          .bind(JSON.stringify({ last_run: nowIso, results }), new Date().toISOString()).run();
      })());
    }
  }

  // Presence heartbeat: upserts the caller's own row, then returns everyone else's
  // fresh (<90s old) presence in the same request — piggybacks on the client's
  // existing 30s polling instead of adding a separate channel.
  if (routeParts[0] === 'presence' && method === 'POST') {
    if (session.role === 'guest') return json({ others: [] });
    const { path, editing } = await request.json() as { path: string; editing?: boolean };
    const nowIso = new Date().toISOString();
    await db.prepare(
      `INSERT INTO presence (user_id, user_name, path, editing, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET user_name = excluded.user_name, path = excluded.path,
         editing = excluded.editing, updated_at = excluded.updated_at`
    ).bind(session.user_id, session.name, path || '', editing ? 1 : 0, nowIso).run();
    const cutoffIso = new Date(Date.now() - 90 * 1000).toISOString();
    const others = await db.prepare(
      'SELECT user_id, user_name, path, editing FROM presence WHERE user_id != ? AND updated_at > ?'
    ).bind(session.user_id, cutoffIso).all();
    return json({ others: others.results });
  }

  // Nav label customisation (admin writes, all authenticated users read)
  if (routeParts[0] === 'nav-labels') {
    if (method === 'GET') {
      const rows = await db.prepare('SELECT path, label FROM nav_labels ORDER BY path ASC').all();
      return json(rows.results);
    }
    if (method === 'POST') {
      if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const body = await request.json() as Record<string, string>;
      const now = new Date().toISOString();
      const stmts: D1PreparedStatement[] = Object.entries(body).map(([path, label]) =>
        db.prepare('INSERT INTO nav_labels (path, label, updated_at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at')
          .bind(path, label, now)
      );
      if (stmts.length > 0) await db.batch(stmts);
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Shared UI settings (any authenticated user reads; any authenticated user writes)
  if (routeParts[0] === 'ui-settings' && routeParts[1]) {
    const key = routeParts[1];
    if (method === 'GET') {
      const row = await db.prepare('SELECT value FROM ui_settings WHERE key = ?').bind(key).first<{ value: string }>();
      return json(row ? JSON.parse(row.value) : {});
    }
    if (method === 'PUT') {
      const body = await request.json() as Record<string, unknown>;
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ).bind(key, JSON.stringify(body), now).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Speaker / prayer notes — readable + writable by all authenticated users
  if (routeParts[0] === 'speaker-notes') {
    if (method === 'GET') {
      const rows = await db.prepare('SELECT person_name, category, notes FROM speaker_notes ORDER BY person_name').all<{ person_name: string; category: string; notes: string }>();
      return json(rows.results);
    }
    if (method === 'POST') {
      const body = await request.json() as { person_name: string; category: string; notes: string };
      if (!body.person_name?.trim()) return json({ error: 'person_name required' }, 400);
      const category = body.category === 'prayer' ? 'prayer' : 'speaker';
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO speaker_notes (person_name, category, notes, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(person_name, category) DO UPDATE SET notes = excluded.notes, updated_at = excluded.updated_at'
      ).bind(body.person_name.trim(), category, body.notes ?? '', now).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Email settings — admin only
  if (routeParts[0] === 'email-settings') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    if (method === 'GET') {
      const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'email_settings'").first<{ value: string }>();
      return json(row ? JSON.parse(row.value) : {});
    }
    if (method === 'PUT') {
      const body = await request.json() as Record<string, unknown>;
      const now = new Date().toISOString();
      await db.prepare(
        "INSERT INTO ui_settings (key, value, updated_at) VALUES ('email_settings', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      ).bind(JSON.stringify(body), now).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // App time zone (used for "same day" calculations like Last Access, and for
  // deciding Annual Duties windows). Readable by any authenticated user; admin-only to change.
  if (routeParts[0] === 'app-timezone') {
    if (method === 'GET') {
      const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'app_timezone'").first<{ value: string }>();
      return json({ timeZone: row?.value || DEFAULT_TIME_ZONE });
    }
    if (method === 'PUT') {
      if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const body = await request.json() as { timeZone?: string };
      const timeZone = (body.timeZone || '').trim();
      if (!timeZone) return json({ error: 'timeZone is required' }, 400);
      try {
        Intl.DateTimeFormat('en-US', { timeZone });
      } catch {
        return json({ error: 'Invalid IANA time zone' }, 400);
      }
      const now = new Date().toISOString();
      await db.prepare(
        "INSERT INTO ui_settings (key, value, updated_at) VALUES ('app_timezone', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      ).bind(timeZone, now).run();
      cachedTimeZone = null;
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Email preview — returns recipients + rendered data for each email type (admin only)
  if (routeParts[0] === 'email-preview' && method === 'POST') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const body = await request.json() as { type: string };

    if (body.type === 'actionItems') {
      const rows = await db.prepare(
        "SELECT assigned_to, task FROM tasks WHERE done = 0 AND assigned_to IS NOT NULL AND assigned_to != '' ORDER BY assigned_to, id"
      ).all<{ assigned_to: string; task: string }>();
      const grouped = new Map<string, string[]>();
      for (const t of rows.results) {
        if (!grouped.has(t.assigned_to)) grouped.set(t.assigned_to, []);
        grouped.get(t.assigned_to)!.push(t.task);
      }
      const recipients = await Promise.all([...grouped.entries()].map(async ([name, tasks]) => {
        const user = await db.prepare("SELECT name, email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").bind(name).first<{ name: string; email: string }>();
        return { name, email: user?.email ?? null, tasks };
      }));
      return json({ recipients });
    }

    if (body.type === 'spiritualThought') {
      const wc = await db.prepare(
        "SELECT date, spiritual_thought FROM wc_meetings WHERE date >= date('now') AND spiritual_thought IS NOT NULL AND spiritual_thought != '' ORDER BY date ASC LIMIT 1"
      ).first<{ date: string; spiritual_thought: string }>();
      const bh = await db.prepare(
        "SELECT date, spiritual_thought FROM bishopric_meetings WHERE date >= date('now') AND no_meeting = 0 AND spiritual_thought IS NOT NULL AND spiritual_thought != '' ORDER BY date ASC LIMIT 1"
      ).first<{ date: string; spiritual_thought: string }>();
      const meetings = await Promise.all([
        wc ? (async () => {
          const u = await db.prepare("SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").bind(wc.spiritual_thought).first<{ email: string }>();
          return { meetingType: 'Ward Council', date: wc.date, name: wc.spiritual_thought, email: u?.email ?? null };
        })() : null,
        bh ? (async () => {
          const u = await db.prepare("SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").bind(bh.spiritual_thought).first<{ email: string }>();
          return { meetingType: 'Bishopric', date: bh.date, name: bh.spiritual_thought, email: u?.email ?? null };
        })() : null,
      ]);
      return json({ meetings: meetings.filter(Boolean) });
    }

    if (body.type === 'handbookTopic') {
      const row = await db.prepare(
        "SELECT date, handbook_training, handbook_section FROM bishopric_meetings WHERE date >= date('now') AND no_meeting = 0 AND handbook_training IS NOT NULL AND handbook_training != '' ORDER BY date ASC LIMIT 1"
      ).first<{ date: string; handbook_training: string; handbook_section: string }>();
      if (!row) return json({ assignment: null });
      const u = await db.prepare("SELECT email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))").bind(row.handbook_training).first<{ email: string }>();
      return json({ assignment: { date: row.date, name: row.handbook_training, section: row.handbook_section, email: u?.email ?? null } });
    }

    return json({ error: 'Unknown type' }, 400);
  }

  // Registration requests — admin only
  if (routeParts[0] === 'registration-requests') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const reqId = routeParts[1] ? parseInt(routeParts[1]) : null;

    if (!reqId) {
      if (method === 'GET') {
        const rows = await db.prepare('SELECT id, name, email, church_role, requested_at FROM registration_requests ORDER BY requested_at ASC').all();
        return json(rows.results);
      }
      return json({ error: 'Method not allowed' }, 405);
    }

    if (routeParts[2] === 'approve' && method === 'POST') {
      const req = await db.prepare('SELECT * FROM registration_requests WHERE id = ?').bind(reqId).first<{ name: string; email: string; church_role: string; password_hash: string }>();
      if (!req) return json({ error: 'Not found' }, 404);
      const conflict = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').bind(req.email).first();
      if (conflict) return json({ error: 'Email already in use by an existing account' }, 409);
      let hub: string;
      if (req.church_role && !KNOWN_CALLINGS.has(req.church_role)) {
        const body = await request.json().catch(() => ({})) as { hub?: string };
        if (!body.hub || !VALID_HUBS.has(body.hub)) return json({ error: 'This calling is not on the standard list — please choose a hub for this person.' }, 400);
        hub = body.hub;
      } else {
        hub = hubForChurchRole(req.church_role);
      }
      await db.prepare(
        "INSERT INTO users (name, email, password_hash, role, church_role, hub, last_login, last_access) VALUES (?, ?, ?, 'user', ?, ?, '', '')"
      ).bind(req.name, req.email, req.password_hash, req.church_role, hub).run();
      await db.prepare('DELETE FROM registration_requests WHERE id = ?').bind(reqId).run();
      return json({ ok: true });
    }

    if (method === 'PUT') {
      const body = await request.json() as { name?: string; email?: string; church_role?: string };
      const fields: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name); }
      if (body.email !== undefined) { fields.push('email = ?'); vals.push(body.email); }
      if (body.church_role !== undefined) { fields.push('church_role = ?'); vals.push(body.church_role); }
      if (fields.length > 0) {
        await db.prepare(`UPDATE registration_requests SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, reqId).run();
      }
      const updated = await db.prepare('SELECT id, name, email, church_role, requested_at FROM registration_requests WHERE id = ?').bind(reqId).first();
      return json(updated);
    }

    if (method === 'DELETE') {
      await db.prepare('DELETE FROM registration_requests WHERE id = ?').bind(reqId).run();
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  // WC-only users: full CRUD on WC-owned tables; read-only on shared tables
  if (session.hub === 'wc') {
    const tbl = routeParts[0];
    if (tbl === 'member-needs') {
      // WC users get full CRUD on member needs scoped to shared_with_wc=1
      if (method === 'GET' && !routeParts[1]) {
        const results = await db.prepare('SELECT * FROM member_needs WHERE shared_with_wc = 1 ORDER BY resolved ASC, id DESC').all();
        return json(results.results);
      }
      if (method === 'POST') {
        const body = await request.json() as Record<string, unknown>;
        body.shared_with_wc = 1;
        body.updated_by = session.name;
        delete body.id;
        const keys = Object.keys(body);
        const result = await db.prepare(
          `INSERT INTO member_needs (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
        ).bind(...keys.map(k => body[k])).run();
        const newRow = await db.prepare('SELECT * FROM member_needs WHERE id = ?').bind(result.meta.last_row_id).first();
        return json(newRow, 201);
      }
      const needId = routeParts[1];
      if (needId && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
        const row = await db.prepare('SELECT shared_with_wc FROM member_needs WHERE id = ?').bind(needId).first<{ shared_with_wc: number }>();
        if (!row || !row.shared_with_wc) return json({ error: 'Forbidden' }, 403);
        if (method === 'PUT') {
          const body = await request.json() as Record<string, unknown>;
          const baseUpdatedAt = body._base_updated_at as string | null | undefined;
          delete body._base_updated_at;
          if (baseUpdatedAt) {
            const conflictCheck = await checkConflict(db, 'member_needs', needId, baseUpdatedAt);
            if (conflictCheck) return conflictCheck;
          }
          body.shared_with_wc = 1;
          body.updated_at = new Date().toISOString();
          body.updated_by = session.name;
          const keys = Object.keys(body);
          await db.prepare(`UPDATE member_needs SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`)
            .bind(...keys.map(k => body[k]), needId).run();
          const updated = await db.prepare('SELECT * FROM member_needs WHERE id = ?').bind(needId).first();
          return json(updated);
        }
        // GET single and DELETE fall through to generic TABLES handler (record is confirmed scoped)
      }
    } else if (WC_FULL_CRUD.has(tbl)) {
      // tasks: WC users only see/modify items shared with Ward Council
      if (tbl === 'tasks') {
        if (method === 'GET' && !routeParts[1]) {
          const results = await db.prepare(
            "SELECT * FROM tasks WHERE share_with LIKE '%Ward Council%' ORDER BY done ASC, id DESC"
          ).all();
          return json(results.results);
        }
        if (routeParts[1] && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
          const taskRow = await db.prepare('SELECT share_with FROM tasks WHERE id = ?').bind(routeParts[1]).first<{ share_with: string }>();
          if (!taskRow || !taskRow.share_with?.includes('Ward Council')) return json({ error: 'Forbidden' }, 403);
        }
        if (method === 'POST') {
          const body = await request.json() as Record<string, unknown>;
          if (!String(body.share_with || '').includes('Ward Council')) {
            body.share_with = body.share_with ? body.share_with + ',Ward Council' : 'Ward Council';
          }
          body.updated_by = session.name;
          delete body.id;
          const keys = Object.keys(body);
          const result = await db.prepare(
            `INSERT INTO tasks (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
          ).bind(...keys.map(k => body[k])).run();
          const newRow = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(result.meta.last_row_id).first();
          return json(newRow, 201);
        }
      }
      // fall through to generic TABLES handler — full CRUD allowed
    } else if (WC_READABLE.has(tbl)) {
      if (method !== 'GET') return json({ error: 'Forbidden' }, 403);
      // sacrament-themes: strip ward_business and stake_business for WC users
      if (tbl === 'sacrament-themes') {
        if (!routeParts[1]) {
          const results = await db.prepare(
            'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, updated_at FROM sacrament_themes ORDER BY meeting_date DESC'
          ).all();
          return json(results.results);
        }
        const row = await db.prepare(
          'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, updated_at FROM sacrament_themes WHERE id = ?'
        ).bind(routeParts[1]).first();
        if (!row) return json({ error: 'Not found' }, 404);
        return json(row);
      }
      // fall through to generic TABLES handler for read
    } else {
      return json({ error: 'Forbidden' }, 403);
    }
  }

  // Youth Council hub: full CRUD on youth-activities; guests get read-only on their permitted tables
  if (session.hub === 'yc') {
    const tbl = routeParts[0];
    if (session.role === 'guest') {
      if (method !== 'GET') return json({ error: 'Forbidden' }, 403);
      const guestKind = session.church_role; // 'yc' = youth calendar, 'sac' = sacrament program
      const SAC_TABLES = new Set(['sacrament-speakers', 'prayers', 'sacrament-music', 'sacrament-themes', 'sacrament-announcements']);
      if (guestKind === 'yc') {
        if (tbl !== 'youth-activities') return json({ error: 'Forbidden' }, 403);
      } else if (guestKind === 'sac') {
        if (!SAC_TABLES.has(tbl)) return json({ error: 'Forbidden' }, 403);
        // Strip ward/stake business columns from sacrament-themes
        if (tbl === 'sacrament-themes') {
          if (!routeParts[1]) {
            const results = await db.prepare(
              'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, updated_at FROM sacrament_themes ORDER BY meeting_date DESC'
            ).all();
            return json(results.results);
          }
          const row = await db.prepare(
            'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, updated_at FROM sacrament_themes WHERE id = ?'
          ).bind(routeParts[1]).first();
          if (!row) return json({ error: 'Not found' }, 404);
          return json(row);
        }
      } else {
        return json({ error: 'Forbidden' }, 403);
      }
      // fall through to generic TABLES handler
    } else {
      if (tbl !== 'youth-activities' && tbl !== 'yc-meetings') return json({ error: 'Forbidden' }, 403);
    }
    // fall through to generic TABLES handler
  }

  // Calendar hub: full CRUD on calendaring only
  if (session.hub === 'cal') {
    if (routeParts[0] !== 'calendaring') return json({ error: 'Forbidden' }, 403);
    // fall through to generic TABLES handler
  }

  // Sync conducting field on sacrament_themes for the next 12 months from rotating_assignments
  // (also runs automatically once a day — see runDailyJobs below)
  if (routeParts[0] === 'sync-conduct' && method === 'POST') {
    const body = await request.json() as { today?: string };
    const todayStr = body.today || new Date().toISOString().slice(0, 10);
    const result = await syncConduct(db, todayStr);
    return json(result);
  }

  // Automation status (admin only) — last daily-jobs run time and per-job results
  if (routeParts[0] === 'automation-status' && method === 'GET') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'daily_jobs'").first<{ value: string }>();
    return json(row ? JSON.parse(row.value) : { last_run: null, results: {} });
  }

  // Bulk ward-roster import from a CSV upload (admin only). Must be matched before the
  // generic TABLES dispatch below, or "import" would be parsed as a record id.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'import' && method === 'POST') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const body = await request.json() as {
      updates?: { id: number; birth_date: string }[];
      creates?: { name: string; birth_date: string | null }[];
      deactivate?: number[];
    };
    const updates = (body.updates || []).slice(0, 1000);
    const creates = (body.creates || []).slice(0, 1000);
    const deactivate = (body.deactivate || []).slice(0, 1000);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const u of updates) {
      if (!u.birth_date || !dateRe.test(u.birth_date)) return json({ error: `Invalid birth_date for id ${u.id}` }, 400);
    }
    for (const c of creates) {
      if (c.birth_date && !dateRe.test(c.birth_date)) return json({ error: `Invalid birth_date for "${c.name}"` }, 400);
      if (!c.name || !c.name.trim()) return json({ error: 'Name required for new member' }, 400);
    }

    const now = new Date().toISOString();
    const stmts = [
      ...updates.map(u => db.prepare('UPDATE ward_members SET birth_date = ?, updated_at = ? WHERE id = ?').bind(u.birth_date, now, u.id)),
      ...creates.map(c => db.prepare('INSERT INTO ward_members (name, active, birth_date, updated_at) VALUES (?, 1, ?, ?)').bind(c.name.trim(), c.birth_date || null, now)),
      ...deactivate.map(id => db.prepare('UPDATE ward_members SET active = 0, updated_at = ? WHERE id = ?').bind(now, id)),
    ];
    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, updated: updates.length, created: creates.length, deactivated: deactivate.length });
  }

  // CRUD endpoints: /api/{table} and /api/{table}/{id}
  const tableName = routeParts[0];
  const recordId = routeParts[1];
  const tableConfig = TABLES[tableName];

  if (!tableConfig) return json({ error: 'Unknown table' }, 404);

  if (method === 'GET' && !recordId) {
    const results = await db.prepare(
      `SELECT * FROM ${tableConfig.name} ORDER BY ${tableConfig.orderBy || 'id DESC'}`
    ).all();
    return json(results.results);
  }

  if (method === 'GET' && recordId) {
    const row = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).first();
    if (!row) return json({ error: 'Not found' }, 404);
    return json(row);
  }

  if (method === 'POST') {
    const body = await request.json() as Record<string, unknown>;
    delete body.updated_by;
    body.updated_by = session.name;
    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => body[k]);

    let result;
    try {
      result = await db.prepare(
        `INSERT INTO ${tableConfig.name} (${keys.join(', ')}) VALUES (${placeholders})`
      ).bind(...values).run();
    } catch (e) {
      if (isUniqueConstraintError(e)) return json({ error: 'A record already exists for this person — edit the existing one instead.' }, 409);
      throw e;
    }

    const newRow = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(result.meta.last_row_id).first();
    if (tableName === 'calling-pipeline') waitUntil(syncSettingApartInterviews(db).catch(() => {}));
    return json(newRow, 201);
  }

  if (method === 'PUT' && recordId) {
    const body = await request.json() as Record<string, unknown>;
    const baseUpdatedAt = body._base_updated_at as string | null | undefined;
    delete body._base_updated_at;
    delete body.updated_at;
    delete body.updated_by;

    if (baseUpdatedAt) {
      const conflictCheck = await checkConflict(db, tableConfig.name, recordId, baseUpdatedAt);
      if (conflictCheck) return conflictCheck;
    }

    body.updated_at = new Date().toISOString();
    body.updated_by = session.name;
    const keys = Object.keys(body);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => body[k]);

    try {
      await db.prepare(
        `UPDATE ${tableConfig.name} SET ${setClause} WHERE id = ?`
      ).bind(...values, recordId).run();
    } catch (e) {
      if (isUniqueConstraintError(e)) return json({ error: 'A record already exists for this person — edit the existing one instead.' }, 409);
      throw e;
    }

    const updated = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).first();
    if (tableName === 'calling-pipeline') waitUntil(syncSettingApartInterviews(db).catch(() => {}));
    return json(updated);
  }

  if (method === 'DELETE' && recordId) {
    await db.prepare(
      `DELETE FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).run();
    if (tableName === 'calling-pipeline') waitUntil(syncSettingApartInterviews(db).catch(() => {}));
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};
