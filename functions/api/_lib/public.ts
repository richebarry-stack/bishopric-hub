import { type IcsEvent, buildIcs } from '../../../shared/ics';
import { type Ctx, getAppTimeZone, json, localNow, sameName } from './core';
import { BISHOP_ENTRY_OVERLAPS_SLOT, INTERVIEW_CALENDARS, INTERVIEW_SLOT_BUSY, RESERVED_SLOT_OVERLAPS_SLOT } from './domain';

// No-login endpoints: tithing declaration and interview booking pages, and calendar subscription feeds.
export async function handlePublic(ctx: Ctx): Promise<Response | null> {
  const { request, db, url, routeParts, method } = ctx;
  // Public tithing-declaration slot browsing/reservation — no login required (hub
  // suggestion #27). Only the two endpoints below bypass the session gate; managing
  // slot definitions (create/move/delete) still goes through the generic, authenticated
  // 'tithing-declarations' CRUD table further down.
  if (routeParts[0] === 'tithing-declarations' && routeParts[1] === 'public' && method === 'GET') {
    const today = new Date().toISOString().slice(0, 10);
    // Includes already-booked slots (with who booked them) so visitors can see what's
    // taken, not just what's open — but never exposes reserved_contact (phone/email).
    // An open slot is hidden while a Bishop appointment or another reserved slot covers
    // it (hub suggestion #32), without revealing what the Bishop's appointment is.
    const results = await db.prepare(
      `SELECT s.id, s.date, s.start_time, s.end_time, s.location, s.notes, s.reserved_by FROM tithing_declaration_slots s
       WHERE s.date >= ?
         AND (s.reserved_by IS NOT NULL OR (NOT ${BISHOP_ENTRY_OVERLAPS_SLOT('s')} AND NOT ${RESERVED_SLOT_OVERLAPS_SLOT('s')}))
       ORDER BY s.date ASC, s.start_time ASC`
    ).bind(today).all();
    return json(results.results);
  }

  if (routeParts[0] === 'tithing-declarations' && routeParts[1] && routeParts[2] === 'reserve' && method === 'POST') {
    const id = Number(routeParts[1]);
    if (!id) return json({ error: 'Invalid slot' }, 400);
    const body = await request.json() as { name?: string; contact?: string };
    const name = (body.name || '').trim();
    if (!name) return json({ error: 'Name is required' }, 400);
    const now = new Date().toISOString();
    // The overlap checks live in the same UPDATE so a booking made a moment earlier on
    // the Bishop's calendar (or an overlapping slot) can't slip through.
    const result = await db.prepare(
      `UPDATE tithing_declaration_slots SET reserved_by = ?, reserved_contact = ?, reserved_at = ?, updated_at = ?
       WHERE id = ? AND reserved_by IS NULL
         AND NOT ${BISHOP_ENTRY_OVERLAPS_SLOT('tithing_declaration_slots')}
         AND NOT ${RESERVED_SLOT_OVERLAPS_SLOT('tithing_declaration_slots')}`
    ).bind(name, (body.contact || '').trim() || null, now, now, id).run();
    if (result.meta.changes === 0) return json({ error: 'That slot is no longer available — please pick another.' }, 409);
    return json({ ok: true });
  }

  // Public interview booking (/book-interview): open slots on the Bishop's and
  // counselors' calendars, no login. Never returns who booked what or why.
  if (routeParts[0] === 'interview-booking' && routeParts[1] === 'public' && method === 'GET') {
    const tz = await getAppTimeZone(db);
    const { date: today, time: nowTime } = localNow(tz);
    const which = url.searchParams.get('with') || '';
    const calendars = INTERVIEW_CALENDARS.includes(which) ? [which] : INTERVIEW_CALENDARS;
    const { results } = await db.prepare(
      `SELECT s.id, s.calendar, substr(s.date, 1, 10) AS date, s.start_time, s.end_time, s.location, s.notes FROM interview_slots s
       WHERE s.reserved_by IS NULL AND s.calendar IN (${calendars.map(() => '?').join(', ')})
         AND (substr(s.date, 1, 10) > ? OR (substr(s.date, 1, 10) = ? AND s.start_time > ?))
         AND NOT ${INTERVIEW_SLOT_BUSY('s')}
       ORDER BY s.date ASC, s.start_time ASC LIMIT 500`
    ).bind(...calendars, today, today, nowTime).all();
    return json(results);
  }

  if (routeParts[0] === 'interview-booking' && routeParts[1] && routeParts[2] === 'reserve' && method === 'POST') {
    const id = Number(routeParts[1]);
    if (!id) return json({ error: 'Invalid slot' }, 400);
    const body = await request.json().catch(() => ({})) as { name?: string; contact?: string; purpose?: string };
    const name = String(body.name || '').trim().slice(0, 120);
    const contact = String(body.contact || '').trim().slice(0, 200);
    const purpose = String(body.purpose || '').trim().slice(0, 60);
    if (!name) return json({ error: 'Name is required' }, 400);
    if (!contact) return json({ error: 'A phone number or email is required' }, 400);
    const tz = await getAppTimeZone(db);
    const { date: today, time: nowTime } = localNow(tz);
    const now = new Date().toISOString();
    // The availability checks live in the same UPDATE so a booking made a moment
    // earlier (or a new appointment on that calendar) can't slip through.
    const result = await db.prepare(
      `UPDATE interview_slots SET reserved_by = ?, reserved_contact = ?, reserved_purpose = ?, reserved_at = ?, updated_at = ?, updated_by = 'Online booking'
       WHERE id = ? AND reserved_by IS NULL
         AND (substr(date, 1, 10) > ? OR (substr(date, 1, 10) = ? AND start_time > ?))
         AND NOT ${INTERVIEW_SLOT_BUSY('interview_slots')}`
    ).bind(name, contact, purpose || null, now, now, id, today, today, nowTime).run();
    if (result.meta.changes === 0) return json({ error: 'That time is no longer available — please pick another.' }, 409);
    const slot = await db.prepare('SELECT calendar, date, start_time, end_time, location FROM interview_slots WHERE id = ?').bind(id)
      .first<{ calendar: string; date: string; start_time: string; end_time: string; location: string | null }>();
    if (slot) {
      const notes = [`Booked online${purpose ? ` — ${purpose}` : ''}`, `Contact: ${contact}`, slot.location ? `Location: ${slot.location}` : '']
        .filter(Boolean).join('\n');
      const entry = await db.prepare(
        `INSERT INTO schedule_entries (calendars, date, start_time, end_time, title, notes, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Online booking')`
      ).bind(JSON.stringify([slot.calendar]), slot.date.slice(0, 10), slot.start_time, slot.end_time,
        `Interview: ${name}${purpose ? ` (${purpose})` : ''}`, notes, now).run();
      await db.prepare('UPDATE interview_slots SET schedule_entry_id = ? WHERE id = ?').bind(entry.meta.last_row_id, id).run();
    }
    return json({ ok: true });
  }

  // Private calendar subscription feed (Google/Apple/Outlook "subscribe by URL"). The
  // unguessable token in the path is the only credential, so it can be reset anytime.
  if (routeParts[0] === 'calendar-feed' && routeParts[1] === 'ics' && routeParts[2] && method === 'GET') {
    const token = routeParts[2].replace(/\.ics$/i, '');
    const feed = await db.prepare(
      'SELECT f.calendars, u.name, u.hub FROM calendar_feeds f JOIN users u ON u.id = f.user_id WHERE f.token = ?'
    ).bind(token).first<{ calendars: string; name: string; hub: string | null }>();
    if (!feed || !['both', 'bh'].includes(feed.hub || 'both')) return new Response('Not found', { status: 404 });
    let calendars: string[] = [];
    try { calendars = (JSON.parse(feed.calendars) as string[]).filter(c => INTERVIEW_CALENDARS.includes(c)); } catch { /* none */ }
    const tz = await getAppTimeZone(db);
    const { date: today } = localNow(tz);
    const from = new Date(Date.parse(today + 'T00:00:00Z') - 60 * 86400000).toISOString().slice(0, 10);
    const events: IcsEvent[] = [];
    if (calendars.length > 0) {
      const { results } = await db.prepare(
        `SELECT id, calendars, substr(date, 1, 10) AS date, start_time, end_time, title, notes FROM schedule_entries
         WHERE substr(date, 1, 10) >= ? AND (${calendars.map(() => 'calendars LIKE ?').join(' OR ')})
         ORDER BY date, start_time LIMIT 3000`
      ).bind(from, ...calendars.map(c => `%"${c}"%`)).all<{ id: number; calendars: string; date: string; start_time: string; end_time: string; title: string; notes: string | null }>();
      for (const r of results) {
        let cals: string[] = [];
        try { cals = JSON.parse(r.calendars); } catch { /* ignore */ }
        const shown = cals.filter(c => calendars.includes(c));
        events.push({
          uid: `schedule-${r.id}@bishopric-hub`, date: r.date, start: r.start_time, end: r.end_time,
          summary: calendars.length > 1 && shown.length ? `${r.title} (${shown.join(', ')})` : r.title,
          description: r.notes || undefined,
        });
      }
    }
    // Sundays this person is conducting sacrament meeting.
    const { results: conducting } = await db.prepare(
      `SELECT id, substr(meeting_date, 1, 10) AS date, conducting FROM sacrament_themes
       WHERE substr(meeting_date, 1, 10) >= ? AND conducting IS NOT NULL AND conducting <> '' AND (no_meeting IS NULL OR no_meeting = '')`
    ).bind(from).all<{ id: number; date: string; conducting: string }>();
    for (const c of conducting) {
      if (sameName(c.conducting, feed.name)) {
        events.push({ uid: `conducting-${c.id}@bishopric-hub`, date: c.date, summary: 'Conducting sacrament meeting' });
      }
    }
    const ics = buildIcs({ name: `Bishopric Hub — ${feed.name}`, timeZone: tz, events });
    return new Response(ics, {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
    });
  }
  return null;
}
