import { syncConduct, syncTempleRecommendInterviews } from '../jobs';
import { type Ctx, type Session, json } from './core';

// Manual triggers for the daily jobs, automation status and LCR sync run cleanup.
export async function handleAutomation(ctx: Ctx, session: Session): Promise<Response | null> {
  const { request, db, routeParts, method } = ctx;
  // Sync conducting field on sacrament_themes for the next 12 months from rotating_assignments
  // (also runs automatically once a day — see runDailyJobs below)
  if (routeParts[0] === 'sync-conduct' && method === 'POST') {
    const body = await request.json() as { today?: string };
    const todayStr = body.today || new Date().toISOString().slice(0, 10);
    const result = await syncConduct(db, todayStr);
    return json(result);
  }

  // Manually trigger the same expiring-recommend-to-interview sync that runs daily
  // (also runs automatically once a day — see runDailyJobs below)
  if (routeParts[0] === 'sync-temple-recommends' && method === 'POST') {
    const result = await syncTempleRecommendInterviews(db);
    return json(result);
  }

  // Automation status (admin only) — last daily-jobs run time and per-job results
  if (routeParts[0] === 'automation-status' && method === 'GET') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'daily_jobs'").first<{ value: string }>();
    return json(row ? JSON.parse(row.value) : { last_run: null, results: {} });
  }


  // Clears archived LCR sync runs (admin only), keeping the most recent `keep` runs
  // that the Automation page shows by default. Must be matched before the generic
  // TABLES dispatch below, or "clear-archived" would be parsed as a record id.
  if (routeParts[0] === 'lcr-sync-runs' && routeParts[1] === 'clear-archived' && method === 'POST') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const body = await request.json().catch(() => ({})) as { keep?: number };
    const keep = Math.max(0, Math.min(50, Number.isFinite(body.keep) ? Number(body.keep) : 5));
    const result = await db.prepare(
      'DELETE FROM lcr_sync_runs WHERE id NOT IN (SELECT id FROM lcr_sync_runs ORDER BY id DESC LIMIT ?)'
    ).bind(keep).run();
    return json({ ok: true, deleted: result.meta.changes ?? 0, kept: keep });
  }
  return null;
}
