import { BISHOPRIC_CALLINGS, KNOWN_CALLINGS, VALID_HUBS, checkSingletonCalling, hubForChurchRole, resetFuturePresidingToBishop } from './access';
import { type Ctx, getSession, json, normEmail, registerEmailDestination } from './core';
import { generateTempPassword, hashPasswordSecure } from './passwords';

// User management (/api/users). Checks its own session.
export async function handleUsers(ctx: Ctx): Promise<Response | null> {
  const { request, env, db, url, routeParts, method } = ctx;
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
      // Guest accounts (guest_yc/guest_sac) aren't real people — they're login shortcuts
      // for the read-only guest views, so they never show up in user management.
      const FULL_FIELDS = 'id, name, email, role, church_role, hub, last_login, last_access, email_verified';
      const MINIMAL_FIELDS = 'id, name, church_role';

      // WC-hub users: full account detail for their own (wc) hub, but only name/calling
      // for the bishopric's ex-officio ward council members — bishopric account details
      // (email, login activity, etc.) aren't Ward Council's data to see.
      if (session.hub === 'wc') {
        const wcUsers = await db.prepare(`SELECT ${FULL_FIELDS} FROM users WHERE hub = 'wc' AND role != 'guest' ORDER BY name ASC`).all();
        const bishopricUsers = await db.prepare(`SELECT ${MINIMAL_FIELDS} FROM users WHERE hub = 'both' ORDER BY name ASC`).all();
        const merged = [...wcUsers.results, ...bishopricUsers.results] as { name: string }[];
        merged.sort((a, b) => a.name.localeCompare(b.name));
        return json(merged);
      }

      // Any other non-bishopric session (Youth Council, Calendar hub, guests): names and
      // callings only, across every hub — enough for assignee/name lookups without
      // exposing anyone's email, account role, hub assignment, or login activity.
      if (session.hub !== 'both') {
        const users = await db.prepare(`SELECT ${MINIMAL_FIELDS} FROM users WHERE role != 'guest' ORDER BY name ASC`).all();
        return json(users.results);
      }

      // Bishopric hub: full directory access.
      const filterHub = url.searchParams.get('hub');
      const users = filterHub === 'wc'
        ? await db.prepare(`SELECT ${FULL_FIELDS} FROM users WHERE hub IN ('wc','both') AND role != 'guest' ORDER BY name ASC`).all()
        : await db.prepare(`SELECT ${FULL_FIELDS} FROM users WHERE role != 'guest' ORDER BY name ASC`).all();
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
      const singletonConflict = await checkSingletonCalling(db, church_role || '', null);
      if (singletonConflict) return singletonConflict;
      const tempPassword = generateTempPassword();
      const hash = await hashPasswordSecure(tempPassword);
      const newRole = role === 'admin' ? 'admin' : 'user';
      try {
        const result = await db.prepare(
          'INSERT INTO users (name, email, password_hash, role, church_role, hub, must_reset_password) VALUES (?, ?, ?, ?, ?, ?, 1)'
        ).bind(name, normEmail(email), hash, newRole, church_role || '', newHub).run();
        const newUser = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
        if (church_role === 'Bishop') await resetFuturePresidingToBishop(db, name);
        if (newHub === 'bh' || newHub === 'both' || newHub === 'wc') await registerEmailDestination(env, email);
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
      const singletonConflict = await checkSingletonCalling(db, church_role || '', userId);
      if (singletonConflict) return singletonConflict;
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
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(userId).first<{ name: string }>();
      if (church_role === 'Bishop' && updated?.name) await resetFuturePresidingToBishop(db, updated.name);
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
        body.email = normEmail(body.email);
        const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').bind(body.email, targetId).first();
        if (existing) return json({ error: 'Email already in use' }, 400);
      }
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (isAdmin && body.name !== undefined) { updates.push('name = ?'); vals.push(body.name); }
      const changingEmail = body.email !== undefined;
      if (changingEmail) { updates.push('email = ?'); updates.push('email_verified = 0'); vals.push(body.email); }
      if (!updates.length) return json({ error: 'Nothing to update' }, 400);
      vals.push(targetId);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
      const updated = await db.prepare('SELECT id, name, email, role, church_role, hub, last_login, last_access FROM users WHERE id = ?').bind(targetId).first<{ hub: string }>();
      if (changingEmail && body.email && (updated?.hub === 'bh' || updated?.hub === 'both' || updated?.hub === 'wc')) await registerEmailDestination(env, body.email);
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
      if (target?.role === 'guest') return json({ error: 'Guest accounts cannot be deleted' }, 400);
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
  return null;
}
