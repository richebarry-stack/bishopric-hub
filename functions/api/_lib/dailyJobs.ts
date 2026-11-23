import { runDailyJobs } from '../jobs';
import { type Ctx, type Session } from './core';

// Lazy daily cron, piggybacking on authenticated requests.
export async function maybeRunDailyJobs(ctx: Ctx, session: Session): Promise<void> {
  const { db, waitUntil } = ctx;
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
}
