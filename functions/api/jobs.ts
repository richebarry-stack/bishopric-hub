// Shared daily automation jobs, run via a "lazy cron" (functions/api/[[route]].ts
// triggers this once per 24h on any authenticated request, since Cloudflare Pages
// Functions don't support scheduled/cron triggers directly).

interface JobResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Regenerates the `conducting` field on sacrament_themes for the next 12 months from rotating_assignments. */
export async function syncConduct(db: D1Database, todayStr: string): Promise<JobResult> {
  const usersResult = await db.prepare('SELECT name, church_role FROM users').all();
  const roleByLastName = new Map<string, string>();
  for (const u of usersResult.results as { name: string; church_role: string }[]) {
    if (!u.name) continue;
    const lastName = u.name.trim().split(/\s+/).pop();
    if (lastName) roleByLastName.set(lastName, u.church_role || '');
  }
  const formatConductor = (rawName: string): string => {
    const lastName = rawName.trim().split(/\s+/).pop() || rawName;
    const title = roleByLastName.get(lastName) === 'Bishop' ? 'Bishop' : 'Brother';
    return `${title} ${lastName}`;
  };

  const assignmentMap = new Map<string, string>(); // month abbr -> formatted name
  const assignmentsResult = await db.prepare('SELECT month, plan_conduct FROM rotating_assignments').all();
  for (const a of assignmentsResult.results as { month: string; plan_conduct: string }[]) {
    if (a.month && a.plan_conduct) {
      const key = a.month.trim().slice(0, 3);
      assignmentMap.set(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(), formatConductor(a.plan_conduct.trim()));
    }
  }
  if (assignmentMap.size === 0) return { ok: true, created: 0, updated: 0 };
  const TITLED_RE = /^(Bishop|Brother|Sister)\s/i;

  const themesResult = await db.prepare('SELECT id, meeting_date, conducting FROM sacrament_themes').all();
  const themeMap = new Map<string, { id: number; conducting: string | null }>();
  for (const t of themesResult.results as { id: number; meeting_date: string; conducting: string | null }[]) {
    if (t.meeting_date) themeMap.set(t.meeting_date.slice(0, 10), { id: t.id, conducting: t.conducting });
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date().toISOString();
  const [startYear, startMonthNum] = todayStr.split('-').map(Number);

  const stmts: D1PreparedStatement[] = [];
  let created = 0, updated = 0;

  for (let i = 0; i < 12; i++) {
    const monthIdx = (startMonthNum - 1 + i) % 12; // 0-based
    const year = startYear + Math.floor((startMonthNum - 1 + i) / 12);
    const assignment = assignmentMap.get(MONTH_ABBR[monthIdx]);
    if (!assignment) continue;

    const firstDay = new Date(year, monthIdx, 1);
    const firstSundayDay = 1 + (7 - firstDay.getDay()) % 7;

    for (let day = firstSundayDay; day <= 37; day += 7) {
      const probe = new Date(year, monthIdx, day);
      if (probe.getMonth() !== monthIdx) break;
      const dateStr = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
      if (dateStr < todayStr) continue;

      const existing = themeMap.get(dateStr);
      if (existing) {
        const cur = (existing.conducting || '').trim();
        if (!cur) {
          stmts.push(db.prepare('UPDATE sacrament_themes SET conducting = ?, updated_at = ? WHERE id = ?').bind(assignment, now, existing.id));
          updated++;
        } else if (!TITLED_RE.test(cur)) {
          stmts.push(db.prepare('UPDATE sacrament_themes SET conducting = ?, updated_at = ? WHERE id = ?').bind(formatConductor(cur), now, existing.id));
          updated++;
        }
      } else {
        stmts.push(db.prepare('INSERT INTO sacrament_themes (meeting_date, conducting, theme, references_text, meeting_link, stake_business, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(dateStr, assignment, '', '', '', '', now));
        created++;
        themeMap.set(dateStr, { id: -1, conducting: assignment });
      }
    }
  }

  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, created, updated };
}

/** Purges expired login sessions. */
export async function cleanupSessions(db: D1Database): Promise<JobResult> {
  const result = await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return { ok: true, deleted: result.meta.changes ?? 0 };
}

export async function runDailyJobs(db: D1Database): Promise<Record<string, JobResult>> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const results: Record<string, JobResult> = {};

  try { results.syncConduct = await syncConduct(db, todayStr); }
  catch (e) { results.syncConduct = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.cleanupSessions = await cleanupSessions(db); }
  catch (e) { results.cleanupSessions = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  return results;
}
