import { KNOWN_CALLINGS, VALID_HUBS, checkSingletonCalling, hubForChurchRole, resetFuturePresidingToBishop } from './access';
import { type Ctx, DEFAULT_TIME_ZONE, type Session, clearAppTimeZoneCache, json, normEmail, registerEmailDestination } from './core';
import { activeCovenantAgenda } from './domain';

// Admin settings and email tools, registration requests and the covenant path agenda.
export async function handleAdmin(ctx: Ctx, session: Session): Promise<Response | null> {
  const { request, env, db, routeParts, method } = ctx;
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
      clearAppTimeZoneCache();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // When the weekly action-item digest goes out (workers/mailer reads this each run;
  // defaults to Saturday 08:00 in the ward's time zone if never set).
  if (routeParts[0] === 'mailer-settings') {
    const WEEKDAYS = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    if (method === 'GET') {
      const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'mailer_weekly_schedule'").first<{ value: string }>();
      const parsed = row?.value ? JSON.parse(row.value) : null;
      return json({ weekday: parsed?.weekday || 'Sat', hour: typeof parsed?.hour === 'number' ? parsed.hour : 8 });
    }
    if (method === 'PUT') {
      if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const body = await request.json() as { weekday?: string; hour?: number };
      if (!WEEKDAYS.has(body.weekday || '')) return json({ error: 'weekday must be one of Sun..Sat' }, 400);
      if (typeof body.hour !== 'number' || body.hour < 0 || body.hour > 23) return json({ error: 'hour must be 0-23' }, 400);
      const now = new Date().toISOString();
      await db.prepare(
        "INSERT INTO ui_settings (key, value, updated_at) VALUES ('mailer_weekly_schedule', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      ).bind(JSON.stringify({ weekday: body.weekday, hour: body.hour }), now).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // Registers an address with Cloudflare Email Routing, which is what actually
  // triggers the verification email — creating a user here never does this on its
  // own. Best-effort: a missing token or a Cloudflare-side failure (e.g. the address
  // is already registered) is swallowed so it never blocks the caller.
  if (routeParts[0] === 'email-verification-status' && routeParts[1] === 'resend' && method === 'POST') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const { user_id } = await request.json() as { user_id: number };
    const target = await db.prepare("SELECT email FROM users WHERE id = ? AND hub IN ('bh','both','wc')").bind(user_id).first<{ email: string }>();
    if (!target) return json({ error: 'User not found' }, 404);
    const result = await registerEmailDestination(env, target.email);
    return json(result);
  }

  // Checks each bishopric and Ward Council account's email address against Cloudflare's verified
  // destination-address list (required before the mailer can send it anything).
  // Verification is one-way — once true it stays true — so only accounts still
  // marked unverified in our own DB are re-checked against Cloudflare each call.
  if (routeParts[0] === 'email-verification-status' && method === 'GET') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);

    const users = await db.prepare(
      "SELECT id, email, email_verified FROM users WHERE hub IN ('bh','both','wc') AND role != 'guest'"
    ).all<{ id: number; email: string; email_verified: number }>();

    const pending = users.results.filter(u => !u.email_verified);
    let cf_check_error: string | undefined;
    if (pending.length > 0) {
      if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
        cf_check_error = 'CF_API_TOKEN or CF_ACCOUNT_ID not configured';
      } else {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses?per_page=50`,
          { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } }
        );
        if (cfRes.ok) {
          const cfData = await cfRes.json() as { result: { email: string; verified: string | null }[] };
          const verifiedEmails = new Set(
            cfData.result.filter(a => a.verified).map(a => a.email.toLowerCase())
          );
          const newlyVerified = pending.filter(u => verifiedEmails.has(u.email.toLowerCase()));
          for (const u of newlyVerified) {
            await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(u.id).run();
            u.email_verified = 1;
          }
        } else {
          cf_check_error = `Cloudflare API returned ${cfRes.status}: ${(await cfRes.text()).slice(0, 300)}`;
        }
      }
    }

    return json({
      statuses: users.results.map(u => ({ user_id: u.id, verified: !!u.email_verified })),
      cf_check_error,
    });
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
      const singletonConflict = await checkSingletonCalling(db, req.church_role || '', null);
      if (singletonConflict) return singletonConflict;
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
      ).bind(req.name, normEmail(req.email), req.password_hash, req.church_role, hub).run();
      await db.prepare('DELETE FROM registration_requests WHERE id = ?').bind(reqId).run();
      if (req.church_role === 'Bishop') await resetFuturePresidingToBishop(db, req.name);
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

  // Covenant Path agenda as each group sees it. The ward council only gets entries the
  // bishopric opted in, with the name, a neutral topic and the note — nothing else.
  if (routeParts[0] === 'covenant-path-agenda' && routeParts[1] === 'active' && method === 'GET') {
    const hub = session.hub || 'both';
    if (hub !== 'both' && hub !== 'bh' && hub !== 'wc') return json({ error: 'Forbidden' }, 403);
    const entries = await activeCovenantAgenda(db);
    if (hub === 'wc') {
      return json(entries.filter(e => e.for_ward_council).map(e => ({ id: e.id, subject_name: e.subject_name, topic: e.topic, note: e.note })));
    }
    return json(entries);
  }
  return null;
}
