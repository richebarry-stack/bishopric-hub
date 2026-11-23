import { type Ctx, getSession, json, normEmail, tooManyAttempts } from './core';
import { hashPasswordSecure, verifyAnswer, verifyPassword } from './passwords';

// Sign-in, sign-out, password and security-question endpoints, plus the public ward name.
export async function handleAuth(ctx: Ctx): Promise<Response | null> {
  const { request, env, db, url, routeParts, method } = ctx;
  // Auth endpoints
  if (routeParts[0] === 'auth') {
    if (routeParts[1] === 'login' && method === 'POST') {
      const { email, password } = await request.json() as { email: string; password: string };
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const emailLower = normEmail(email);
      if (await tooManyAttempts(db, emailLower, ip)) {
        return json({ error: 'Too many attempts — please try again in a few minutes.' }, 429);
      }

      const user = await db.prepare(
        'SELECT id, name, email, role, church_role, hub, must_reset_password, email_notifications, password_hash FROM users WHERE LOWER(email) = ?'
      ).bind(emailLower).first<{ id: number; name: string; email: string; role: string; church_role: string; hub: string; must_reset_password: number; email_notifications: number; password_hash: string }>();
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
      return new Response(JSON.stringify({ user: { id: user.id, name: user.name, email: user.email, role: user.role, church_role: user.church_role, hub: user.hub ?? 'both', must_reset_password: !!user.must_reset_password, email_notifications: !!user.email_notifications, has_security_questions: !!sq } }), {
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
        'SELECT id, name, email, role, church_role, hub, must_reset_password, email_notifications FROM users WHERE id = ?'
      ).bind(session.user_id).first<{ id: number; name: string; email: string; role: string; church_role: string; hub: string; must_reset_password: number; email_notifications: number }>();
      if (!user) return json({ user: null });
      const sq2 = await db.prepare('SELECT user_id FROM security_questions WHERE user_id = ?').bind(user.id).first();
      return json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, church_role: user.church_role, hub: user.hub ?? 'both', must_reset_password: !!user.must_reset_password, email_notifications: !!user.email_notifications, has_security_questions: !!sq2 } });
    }

    if (routeParts[1] === 'email-preference' && method === 'PUT') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      const body = await request.json() as { enabled?: boolean };
      await db.prepare('UPDATE users SET email_notifications = ? WHERE id = ?').bind(body.enabled ? 1 : 0, session.user_id).run();
      return json({ ok: true });
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
      const user = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').bind(normEmail(email)).first<{ id: number }>();
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
      const emailLower = normEmail(email);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await tooManyAttempts(db, 'rbq:' + emailLower, ip)) return json({ error: 'Too many attempts — please try again in a few minutes.' }, 429);

      if (!new_password || new_password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      const user = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').bind(emailLower).first<{ id: number }>();
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
      const user = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').bind(normEmail(email)).first<{ id: number }>();
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
      ).bind(name, normEmail(email), church_role, hash, new Date().toISOString()).run();
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
        ).bind(name, normEmail(email), hash, role || 'user').run();
        return json({ ok: true });
      } catch {
        return json({ error: 'User already exists' }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  }

  // Ward name — shown as "<ward name> Ward Leadership Hub" on the login page and
  // sidebar, so it must be readable without a session. Admin-only to change.
  if (routeParts[0] === 'ward-name') {
    if (method === 'GET') {
      const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'ward_name'").first<{ value: string }>();
      return json({ wardName: row?.value || '' });
    }
    if (method === 'PUT') {
      const session = await getSession(request, db);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
      const body = await request.json() as { wardName?: string };
      const wardName = (body.wardName || '').trim();
      const now = new Date().toISOString();
      await db.prepare(
        "INSERT INTO ui_settings (key, value, updated_at) VALUES ('ward_name', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      ).bind(wardName, now).run();
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }
  return null;
}
