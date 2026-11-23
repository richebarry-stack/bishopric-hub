import { WC_FULL_CRUD, WC_READABLE } from './access';
import { type Ctx, type Session, checkConflict, json, keepKnownColumns } from './core';

// Per-hub access rules (Ward Council, Youth Council, Calendar) and hub-scoped tasks and suggestions. Returns null to fall through to the generic CRUD handler.
export async function handleHubAccess(ctx: Ctx, session: Session): Promise<Response | null> {
  const { request, db, url, routeParts, method } = ctx;
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
        await keepKnownColumns(db, 'member_needs', body);
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
          await keepKnownColumns(db, 'member_needs', body);
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
          await keepKnownColumns(db, 'tasks', body);
          const keys = Object.keys(body);
          const result = await db.prepare(
            `INSERT INTO tasks (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
          ).bind(...keys.map(k => body[k])).run();
          const newRow = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(result.meta.last_row_id).first();
          return json(newRow, 201);
        }
      }
      // hub-suggestions: WC users only see/modify suggestions submitted from Ward Council
      if (tbl === 'hub-suggestions') {
        if (method === 'GET' && !routeParts[1]) {
          const results = await db.prepare(
            "SELECT * FROM hub_suggestions WHERE hub = 'Ward Council' ORDER BY id DESC"
          ).all();
          return json(results.results);
        }
        if (routeParts[1] && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
          const row = await db.prepare('SELECT hub FROM hub_suggestions WHERE id = ?').bind(routeParts[1]).first<{ hub: string }>();
          if (!row || row.hub !== 'Ward Council') return json({ error: 'Forbidden' }, 403);
        }
        if (method === 'POST') {
          const body = await request.json() as Record<string, unknown>;
          body.hub = 'Ward Council';
          delete body.id;
          await keepKnownColumns(db, 'hub_suggestions', body);
          const keys = Object.keys(body);
          const result = await db.prepare(
            `INSERT INTO hub_suggestions (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
          ).bind(...keys.map(k => body[k])).run();
          const newRow = await db.prepare('SELECT * FROM hub_suggestions WHERE id = ?').bind(result.meta.last_row_id).first();
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
            'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, no_meeting, updated_at FROM sacrament_themes ORDER BY meeting_date DESC'
          ).all();
          return json(results.results);
        }
        const row = await db.prepare(
          'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, no_meeting, updated_at FROM sacrament_themes WHERE id = ?'
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
              'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, no_meeting, updated_at FROM sacrament_themes ORDER BY meeting_date DESC'
            ).all();
            return json(results.results);
          }
          const row = await db.prepare(
            'SELECT id, meeting_date, theme, references_text, conducting, meeting_link, no_meeting, updated_at FROM sacrament_themes WHERE id = ?'
          ).bind(routeParts[1]).first();
          if (!row) return json({ error: 'Not found' }, 404);
          return json(row);
        }
      } else {
        return json({ error: 'Forbidden' }, 403);
      }
      // fall through to generic TABLES handler
    } else {
      if (tbl !== 'youth-activities' && tbl !== 'yc-meetings' && tbl !== 'yc-discussion-topics' && tbl !== 'tasks') return json({ error: 'Forbidden' }, 403);
      // tasks: YC users only see/modify items shared with Youth Council
      if (tbl === 'tasks') {
        if (method === 'GET' && !routeParts[1]) {
          const results = await db.prepare(
            "SELECT * FROM tasks WHERE share_with LIKE '%Youth Council%' ORDER BY done ASC, id DESC"
          ).all();
          return json(results.results);
        }
        if (routeParts[1] && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
          const taskRow = await db.prepare('SELECT share_with FROM tasks WHERE id = ?').bind(routeParts[1]).first<{ share_with: string }>();
          if (!taskRow || !taskRow.share_with?.includes('Youth Council')) return json({ error: 'Forbidden' }, 403);
        }
        if (method === 'POST') {
          const body = await request.json() as Record<string, unknown>;
          if (!String(body.share_with || '').includes('Youth Council')) {
            body.share_with = body.share_with ? body.share_with + ',Youth Council' : 'Youth Council';
          }
          body.updated_by = session.name;
          delete body.id;
          await keepKnownColumns(db, 'tasks', body);
          const keys = Object.keys(body);
          const result = await db.prepare(
            `INSERT INTO tasks (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
          ).bind(...keys.map(k => body[k])).run();
          const newRow = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(result.meta.last_row_id).first();
          return json(newRow, 201);
        }
      }
    }
    // fall through to generic TABLES handler
  }

  // Bishopric hub: only show/modify tasks that aren't scoped to another hub's list.
  // Dual-access ('both') accounts can also be actively viewing WC or YC in the client
  // (selectedHub) — the client tells us via ?viewHub= since the session itself only
  // knows the account's fixed hub, not which view is currently open.
  if (session.hub === 'both' && routeParts[0] === 'tasks') {
    const viewHub = url.searchParams.get('viewHub');
    if (method === 'GET' && !routeParts[1]) {
      if (viewHub === 'wc') {
        const results = await db.prepare(
          "SELECT * FROM tasks WHERE share_with LIKE '%Ward Council%' ORDER BY done ASC, id DESC"
        ).all();
        return json(results.results);
      }
      if (viewHub === 'yc') {
        const results = await db.prepare(
          "SELECT * FROM tasks WHERE share_with LIKE '%Youth Council%' ORDER BY done ASC, id DESC"
        ).all();
        return json(results.results);
      }
      const results = await db.prepare(
        "SELECT * FROM tasks WHERE (share_with IS NULL OR (share_with NOT LIKE '%Ward Council%' AND share_with NOT LIKE '%Youth Council%')) ORDER BY done ASC, id DESC"
      ).all();
      return json(results.results);
    }
    if (method === 'POST') {
      const body = await request.json() as Record<string, unknown>;
      if (!String(body.share_with || '').includes('Bishopric') && !String(body.share_with || '').includes('Ward Council') && !String(body.share_with || '').includes('Youth Council')) {
        body.share_with = body.share_with ? body.share_with + ',Bishopric' : 'Bishopric';
      }
      body.updated_by = session.name;
      delete body.id;
      await keepKnownColumns(db, 'tasks', body);
      const keys = Object.keys(body);
      const result = await db.prepare(
        `INSERT INTO tasks (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
      ).bind(...keys.map(k => body[k])).run();
      const newRow = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(result.meta.last_row_id).first();
      return json(newRow, 201);
    }
    // fall through to generic TABLES handler for single GET/PUT/DELETE — bishopric keeps full access to any task
  }

  // Bishopric hub: hub-suggestions scoped the same way as tasks — dual-access accounts
  // pass ?viewHub= for whichever view is currently open, so WC and Bishopric each only
  // see suggestions submitted from their own hub.
  if (session.hub === 'both' && routeParts[0] === 'hub-suggestions') {
    const viewHub = url.searchParams.get('viewHub');
    if (method === 'GET' && !routeParts[1]) {
      if (viewHub === 'wc') {
        const results = await db.prepare(
          "SELECT * FROM hub_suggestions WHERE hub = 'Ward Council' ORDER BY id DESC"
        ).all();
        return json(results.results);
      }
      const results = await db.prepare(
        "SELECT * FROM hub_suggestions WHERE hub IS NULL OR hub != 'Ward Council' ORDER BY id DESC"
      ).all();
      return json(results.results);
    }
    if (method === 'POST') {
      const body = await request.json() as Record<string, unknown>;
      if (!body.hub) body.hub = viewHub === 'wc' ? 'Ward Council' : 'Bishopric';
      delete body.id;
      await keepKnownColumns(db, 'hub_suggestions', body);
      const keys = Object.keys(body);
      const result = await db.prepare(
        `INSERT INTO hub_suggestions (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
      ).bind(...keys.map(k => body[k])).run();
      const newRow = await db.prepare('SELECT * FROM hub_suggestions WHERE id = ?').bind(result.meta.last_row_id).first();
      return json(newRow, 201);
    }
    // fall through to generic TABLES handler for single GET/PUT/DELETE — bishopric keeps full access to any suggestion
  }

  // Sacrament Music page: each Sunday's fast-Sunday / no-meeting flags and theme, so the
  // page can label its rows. A narrow read so the Music Coordinator never needs the full
  // sacrament_themes rows (ward and stake business).
  if (routeParts[0] === 'music-sundays' && method === 'GET') {
    const isMusic = session.hub === 'cal' && session.church_role === 'Music Coordinator';
    if (!isMusic && session.hub !== 'both' && session.hub !== 'bh') return json({ error: 'Forbidden' }, 403);
    const year = String(url.searchParams.get('year') || '').replace(/\D/g, '').slice(0, 4);
    if (year.length !== 4) return json({ error: 'year is required' }, 400);
    const { results } = await db.prepare(
      'SELECT substr(meeting_date, 1, 10) AS date, is_fast_sunday, no_meeting, theme FROM sacrament_themes WHERE substr(meeting_date, 1, 4) = ? ORDER BY meeting_date'
    ).bind(year).all();
    return json(results);
  }

  // Calendar hub: the Music Coordinator gets the sacrament music only; everyone else
  // (the Ward Bulletin Specialist) gets calendaring only.
  if (session.hub === 'cal') {
    const allowed = session.church_role === 'Music Coordinator' ? 'sacrament-music' : 'calendaring';
    if (routeParts[0] !== allowed) return json({ error: 'Forbidden' }, 403);
    // fall through to generic TABLES handler
  }
  return null;
}
