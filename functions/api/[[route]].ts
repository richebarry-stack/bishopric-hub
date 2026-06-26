interface Env {
  DB: D1Database;
}

interface Session {
  id: string;
  user_id: number;
  expires_at: string;
}

const TABLES: Record<string, { name: string; orderBy?: string }> = {
  'calling-pipeline': { name: 'calling_pipeline', orderBy: 'id DESC' },
  'interview-pipeline': { name: 'interview_pipeline', orderBy: 'id DESC' },
  'tasks': { name: 'tasks', orderBy: 'done ASC, created_date DESC' },
  'rotating-assignments': { name: 'rotating_assignments', orderBy: 'id ASC' },
  'bishopric-meetings': { name: 'bishopric_meetings', orderBy: 'date DESC' },
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
  'important-links': { name: 'important_links', orderBy: 'id ASC' },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSession(request: Request, db: D1Database): Promise<Session | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];
  const session = await db.prepare(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
  ).bind(sessionId).first<Session>();
  return session;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const routeParts = (params.route as string[]) || [];
  const method = request.method;

  // Auth endpoints
  if (routeParts[0] === 'auth') {
    if (routeParts[1] === 'login' && method === 'POST') {
      const { email, password } = await request.json() as { email: string; password: string };
      const hash = await hashPassword(password);
      const user = await db.prepare(
        'SELECT id, name, email, role, must_reset_password FROM users WHERE email = ? AND password_hash = ?'
      ).bind(email, hash).first<{ id: number; name: string; email: string; role: string; must_reset_password: number }>();
      if (!user) return json({ error: 'Invalid credentials' }, 401);

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionId, user.id, expiresAt).run();

      return new Response(JSON.stringify({ user: { id: user.id, name: user.name, email: user.email, role: user.role, must_reset_password: !!user.must_reset_password } }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
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
        'SELECT id, name, email, role, must_reset_password FROM users WHERE id = ?'
      ).bind(session.user_id).first<{ id: number; name: string; email: string; role: string; must_reset_password: number }>();
      if (!user) return json({ user: null });
      return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, must_reset_password: !!user.must_reset_password } });
    }

    if (routeParts[1] === 'change-password' && method === 'POST') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const { current_password, new_password } = await request.json() as { current_password?: string; new_password: string };
      const user = await db.prepare('SELECT id, password_hash, must_reset_password FROM users WHERE id = ?').bind(session.user_id).first<{ id: number; password_hash: string; must_reset_password: number }>();
      if (!user) return json({ error: 'User not found' }, 404);
      if (!user.must_reset_password && current_password) {
        const currentHash = await hashPassword(current_password);
        if (currentHash !== user.password_hash) return json({ error: 'Current password is incorrect' }, 400);
      }
      const newHash = await hashPassword(new_password);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?').bind(newHash, session.user_id).run();
      return json({ ok: true });
    }

    if (routeParts[1] === 'register' && method === 'POST') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const admin = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (admin?.role !== 'admin') return json({ error: 'Admin only' }, 403);

      const { name, email, password, role } = await request.json() as { name: string; email: string; password: string; role: string };
      const hash = await hashPassword(password);
      try {
        await db.prepare(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        ).bind(name, email, hash, role || 'editor').run();
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

    if (method === 'GET') {
      const users = await db.prepare('SELECT id, name, email, role, church_role FROM users ORDER BY id ASC').all();
      return json(users.results);
    }

    if (method === 'POST') {
      const { name, email, password, role, church_role } = await request.json() as { name: string; email: string; password: string; role: string; church_role?: string };
      const hash = await hashPassword(password);
      try {
        const result = await db.prepare(
          'INSERT INTO users (name, email, password_hash, role, church_role) VALUES (?, ?, ?, ?, ?)'
        ).bind(name, email, hash, role || 'editor', church_role || '').run();
        const newUser = await db.prepare('SELECT id, name, email, role, church_role FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
        return json(newUser, 201);
      } catch {
        return json({ error: 'User already exists' }, 400);
      }
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'church-role') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const { church_role } = await request.json() as { church_role: string };
      await db.prepare('UPDATE users SET church_role = ? WHERE id = ?').bind(church_role ?? '', userId).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role FROM users WHERE id = ?').bind(userId).first();
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
      const updated = await db.prepare('SELECT id, name, email, role, church_role FROM users WHERE id = ?').bind(targetId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'role') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const { role } = await request.json() as { role: string };
      if (role !== 'admin' && role !== 'editor') return json({ error: 'Invalid role' }, 400);
      if (role !== 'admin') {
        const adminCount = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").first<{ cnt: number }>();
        const target = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first<{ role: string }>();
        if (target?.role === 'admin' && adminCount && adminCount.cnt <= 1) {
          return json({ error: 'Must have at least one admin' }, 400);
        }
      }
      await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role FROM users WHERE id = ?').bind(userId).first();
      return json(updated);
    }

    if (method === 'PUT' && routeParts[1] && routeParts[2] === 'reset-password') {
      const caller = await db.prepare('SELECT role FROM users WHERE id = ?').bind(session.user_id).first<{ role: string }>();
      if (caller?.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const userId = Number(routeParts[1]);
      const tempHash = await hashPassword('temp' + userId);
      await db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 1 WHERE id = ?').bind(tempHash, userId).run();
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
      return json({ ok: true, temp_password: 'temp' + userId });
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

  // Sync conducting field on sacrament_themes for the next 12 months from rotating_assignments
  if (routeParts[0] === 'sync-conduct' && method === 'POST') {
    const body = await request.json() as { today?: string };
    const todayStr = body.today || new Date().toISOString().slice(0, 10);

    const assignmentsResult = await db.prepare('SELECT month, plan_conduct FROM rotating_assignments').all();
    const assignmentMap = new Map<string, string>();
    for (const a of assignmentsResult.results as { month: string; plan_conduct: string }[]) {
      if (a.month && a.plan_conduct) {
        const key = a.month.trim().slice(0, 3);
        assignmentMap.set(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(), a.plan_conduct.trim());
      }
    }
    if (assignmentMap.size === 0) return json({ ok: true, created: 0, updated: 0 });

    const themesResult = await db.prepare('SELECT id, meeting_date, conducting FROM sacrament_themes').all();
    const themeMap = new Map<string, { id: number; conducting: string | null }>();
    for (const t of themesResult.results as { id: number; meeting_date: string; conducting: string | null }[]) {
      if (t.meeting_date) themeMap.set(t.meeting_date.slice(0, 10), { id: t.id, conducting: t.conducting });
    }

    const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date().toISOString();
    const [startYear, startMonthNum] = todayStr.split('-').map(Number);

    const stmts: D1PreparedStatement[] = [];
    let created = 0, updated = 0;

    for (let i = 0; i < 12; i++) {
      const monthIdx = (startMonthNum - 1 + i) % 12; // 0-based
      const year = startYear + Math.floor((startMonthNum - 1 + i) / 12);
      const conductor = assignmentMap.get(MONTH_ABBR[monthIdx]);
      if (!conductor) continue;

      // Find first Sunday of month then step by 7
      const firstDay = new Date(year, monthIdx, 1);
      const firstSundayDay = 1 + (7 - firstDay.getDay()) % 7;

      for (let day = firstSundayDay; day <= 37; day += 7) {
        const probe = new Date(year, monthIdx, day);
        if (probe.getMonth() !== monthIdx) break;
        const dateStr = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
        if (dateStr < todayStr) continue;

        const existing = themeMap.get(dateStr);
        if (existing) {
          if (!existing.conducting || !existing.conducting.trim()) {
            stmts.push(db.prepare('UPDATE sacrament_themes SET conducting = ?, updated_at = ? WHERE id = ?').bind(conductor, now, existing.id));
            updated++;
          }
        } else {
          stmts.push(db.prepare('INSERT INTO sacrament_themes (meeting_date, conducting, theme, references_text, meeting_link, stake_business, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(dateStr, conductor, '', '', '', '', now));
          created++;
          themeMap.set(dateStr, { id: -1, conducting: conductor });
        }
      }
    }

    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, created, updated });
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
    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => body[k]);

    const result = await db.prepare(
      `INSERT INTO ${tableConfig.name} (${keys.join(', ')}) VALUES (${placeholders})`
    ).bind(...values).run();

    const newRow = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(result.meta.last_row_id).first();
    return json(newRow, 201);
  }

  if (method === 'PUT' && recordId) {
    const body = await request.json() as Record<string, unknown>;
    body.updated_at = new Date().toISOString();
    const keys = Object.keys(body);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => body[k]);

    await db.prepare(
      `UPDATE ${tableConfig.name} SET ${setClause} WHERE id = ?`
    ).bind(...values, recordId).run();

    const updated = await db.prepare(
      `SELECT * FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).first();
    return json(updated);
  }

  if (method === 'DELETE' && recordId) {
    await db.prepare(
      `DELETE FROM ${tableConfig.name} WHERE id = ?`
    ).bind(recordId).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};
