import { type Ctx, type Session, json, randomToken } from './core';
import { INTERVIEW_CALENDARS } from './domain';

// Per-user and shared lightweight settings: notes & to-dos, presence, nav labels, calendar feed, UI settings, speaker notes.
export async function handleAccount(ctx: Ctx, session: Session): Promise<Response | null> {
  const { request, db, routeParts, method } = ctx;
  // Private notes & to-dos (hub suggestion #36): every query is scoped to the
  // caller's own user_id, so nobody else — admins included — can see them.
  if (routeParts[0] === 'personal-items') {
    if (session.role === 'guest') return json({ error: 'Forbidden' }, 403);
    const id = routeParts[1];
    const pick = (b: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      if ('kind' in b) out.kind = b.kind === 'note' ? 'note' : 'todo';
      if ('title' in b) out.title = String(b.title ?? '').slice(0, 500);
      if ('details' in b) out.details = b.details == null ? null : String(b.details).slice(0, 10000);
      if ('due_date' in b) out.due_date = typeof b.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.due_date) ? b.due_date : null;
      if ('importance' in b) out.importance = ['High', 'Medium', 'Low'].includes(String(b.importance)) ? b.importance : 'Medium';
      if ('done' in b) { out.done = b.done ? 1 : 0; out.done_at = b.done ? new Date().toISOString() : null; }
      return out;
    };
    if (method === 'GET' && !id) {
      const r = await db.prepare('SELECT * FROM personal_items WHERE user_id = ? ORDER BY done ASC, id DESC').bind(session.user_id).all();
      return json(r.results);
    }
    if (method === 'POST' && !id) {
      const data = pick(await request.json() as Record<string, unknown>);
      data.user_id = session.user_id;
      data.updated_at = new Date().toISOString();
      const keys = Object.keys(data);
      const res = await db.prepare(`INSERT INTO personal_items (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
        .bind(...keys.map(k => data[k])).run();
      return json(await db.prepare('SELECT * FROM personal_items WHERE id = ?').bind(res.meta.last_row_id).first(), 201);
    }
    if (method === 'PUT' && id) {
      const data = pick(await request.json() as Record<string, unknown>);
      data.updated_at = new Date().toISOString();
      const keys = Object.keys(data);
      const res = await db.prepare(`UPDATE personal_items SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ? AND user_id = ?`)
        .bind(...keys.map(k => data[k]), id, session.user_id).run();
      if (res.meta.changes === 0) return json({ error: 'Not found' }, 404);
      return json(await db.prepare('SELECT * FROM personal_items WHERE id = ?').bind(id).first());
    }
    if (method === 'DELETE' && id) {
      await db.prepare('DELETE FROM personal_items WHERE id = ? AND user_id = ?').bind(id, session.user_id).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
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

  // The caller's own calendar subscription link: which calendars it carries and its token.
  if (routeParts[0] === 'calendar-feed' && !routeParts[1]) {
    if (session.role === 'guest' || !['both', 'bh'].includes(session.hub || 'both')) return json({ error: 'Forbidden' }, 403);
    const current = await db.prepare('SELECT token, calendars FROM calendar_feeds WHERE user_id = ?').bind(session.user_id)
      .first<{ token: string; calendars: string }>();
    const parse = (raw: string | undefined) => {
      try { return (JSON.parse(raw || '[]') as string[]).filter(c => INTERVIEW_CALENDARS.includes(c)); } catch { return []; }
    };
    if (method === 'GET') return json({ token: current?.token ?? null, calendars: parse(current?.calendars) });
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({})) as { calendars?: unknown; reset?: boolean };
      const calendars = Array.isArray(body.calendars)
        ? body.calendars.filter((c): c is string => typeof c === 'string' && INTERVIEW_CALENDARS.includes(c))
        : [];
      const token = !current || body.reset ? randomToken() : current.token;
      await db.prepare(
        `INSERT INTO calendar_feeds (user_id, token, calendars, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, calendars = excluded.calendars`
      ).bind(session.user_id, token, JSON.stringify(calendars), new Date().toISOString()).run();
      return json({ token, calendars });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM calendar_feeds WHERE user_id = ?').bind(session.user_id).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Shared UI settings (any authenticated user reads; any authenticated user writes)
  if (routeParts[0] === 'ui-settings' && routeParts[1]) {
    const key = routeParts[1];
    // Only page-layout settings go through here, each for the hubs that use it. Everything
    // else (time zone, mailer schedule, email settings, ward name, job logs) has its own
    // admin-checked endpoint, so it can't be read or overwritten from this one.
    const UI_SETTING_HUBS: Record<string, string[]> = {
      covenant_path_settings: ['both', 'bh'],
      wc_discussion_col_widths: ['both', 'bh', 'wc'],
      wc_discussion_orgs: ['both', 'bh', 'wc'],
      speaking_invitation_settings: ['both', 'bh'],
      yc_discussion_orgs: ['both', 'bh', 'yc', 'wc'],
    };
    const allowedHubs = UI_SETTING_HUBS[key];
    if (!allowedHubs || !allowedHubs.includes(session.hub || 'both')) return json({ error: 'Forbidden' }, 403);
    if (method === 'PUT' && session.role === 'guest') return json({ error: 'Forbidden' }, 403);
    // The Ward Council can read the Youth Council's group list but not change it.
    if (method === 'PUT' && key === 'yc_discussion_orgs' && session.hub === 'wc') return json({ error: 'Forbidden' }, 403);
    if (method === 'GET') {
      const row = await db.prepare('SELECT value FROM ui_settings WHERE key = ?').bind(key).first<{ value: string }>();
      return json(row ? JSON.parse(row.value) : {});
    }
    if (method === 'PUT') {
      const body = await request.json() as Record<string, unknown>;
      const value = JSON.stringify(body);
      if (value.length > 20000) return json({ error: 'Setting is too large' }, 413);
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO ui_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ).bind(key, value, now).run();
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
  return null;
}
