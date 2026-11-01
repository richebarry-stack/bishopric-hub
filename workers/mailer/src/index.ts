import {
  computeActionItems, buildNameIndex,
  type ActionItem, type ActionItemSources, type NameIndexMember,
  type TaskRow, type CallingRow, type InterviewRow, type RotatingRow, type BabyRow, type WcMeetingRow,
} from '../../../shared/actionItems';
import { agedOutMemberIds } from '../../../shared/youth';

export interface Env {
  DB: D1Database;
  EMAIL: SendEmail;
  HUB_BASE_URL: string;
  FROM_ADDRESS: string;
  FROM_NAME: string;
  MAILER_MODE: string; // 'seed' | 'live'
}

const DEFAULT_TIME_ZONE = 'America/Denver';
const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = { weekday: 'Sat', hour: 8 };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface WeeklySchedule {
  weekday: string; // 'Sun'..'Sat', matches Intl's `weekday: 'short'` output
  hour: number;    // 0-23, local to the ward's configured time zone
}

async function getWeeklySchedule(db: D1Database): Promise<WeeklySchedule> {
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'mailer_weekly_schedule'").first<{ value: string }>();
  if (!row?.value) return DEFAULT_WEEKLY_SCHEDULE;
  try {
    const parsed = JSON.parse(row.value) as Partial<WeeklySchedule>;
    if (WEEKDAYS.includes(parsed.weekday || '') && typeof parsed.hour === 'number' && parsed.hour >= 0 && parsed.hour <= 23) {
      return { weekday: parsed.weekday as string, hour: parsed.hour };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_WEEKLY_SCHEDULE;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
  hub: string;
  church_role: string;
}

async function getTimeZone(db: D1Database): Promise<string> {
  const row = await db.prepare("SELECT value FROM ui_settings WHERE key = 'app_timezone'").first<{ value: string }>();
  return row?.value || DEFAULT_TIME_ZONE;
}

async function getRecipients(db: D1Database): Promise<UserRow[]> {
  const { results } = await db.prepare(
    `SELECT id, name, email, hub, church_role
     FROM users
     WHERE hub IN ('bh', 'both', 'wc') AND role <> 'guest' AND email_notifications = 1`
  ).all<UserRow>();
  return results;
}

async function getSources(db: D1Database, todayIso: string): Promise<ActionItemSources> {
  const [tasks, callings, interviews, rotating, babies, wcMeetings] = await Promise.all([
    db.prepare('SELECT id, task, assigned_to, due_date, done, share_with FROM tasks').all<TaskRow>(),
    db.prepare('SELECT id, calling, member, status, assigned_to, type, release_recorded, sustain_recorded, set_apart_recorded FROM calling_pipeline').all<CallingRow>(),
    db.prepare('SELECT id, member, setup_assigned_to, setup_status, status, type_of_interview, ward_member_id FROM interview_pipeline').all<InterviewRow>(),
    db.prepare('SELECT id, month, plan_conduct, primary_message FROM rotating_assignments').all<RotatingRow>(),
    db.prepare('SELECT id, name, status, church_record_created FROM babies').all<BabyRow>(),
    db.prepare('SELECT id, date, opening_prayer, spiritual_thought, closing_prayer FROM wc_meetings WHERE date >= ?').bind(todayIso).all<WcMeetingRow>(),
  ]);
  const { results: roster } = await db.prepare('SELECT id, active, birth_date FROM ward_members').all<{ id: number; active: number; birth_date: string | null }>();
  return {
    agedOutMemberIds: agedOutMemberIds(roster),
    tasks: tasks.results, callings: callings.results, interviews: interviews.results,
    rotating: rotating.results, babies: babies.results,
    wcMeetings: wcMeetings.results, todayIso,
  };
}

async function getWardMemberNameIndex(db: D1Database): Promise<Map<string, NameIndexMember>> {
  const { results } = await db.prepare(
    'SELECT first_name, last_name, preferred_first_name, preferred_last_name FROM ward_members WHERE active = 1'
  ).all<NameIndexMember>();
  return buildNameIndex(results);
}

function permissionsFor(user: UserRow) {
  const isBishopric = user.hub === 'bh' || user.hub === 'both';
  const isWc = isBishopric || user.hub === 'wc';
  const isYc = user.hub === 'yc';
  return {
    canBishopric: isBishopric,
    canWc: isWc,
    canYc: isYc,
    isClerk: isBishopric && /clerk/i.test(user.church_role || ''),
  };
}

// Ward Council-only users can only see tasks shared with Ward Council (the API
// filters the same way), so they're only emailed about those.
function sourcesFor(user: UserRow, sources: ActionItemSources): ActionItemSources {
  if (user.hub !== 'wc') return sources;
  return { ...sources, tasks: sources.tasks.filter(t => (t.share_with || '').includes('Ward Council')) };
}

function hubName(user: UserRow): string {
  return user.hub === 'wc' ? 'Ward Council Hub' : 'Bishopric Hub';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function itemLine(item: ActionItem, baseUrl: string): { text: string; html: string } {
  const bits = [item.label];
  if (item.detail) bits.push(`(${item.detail})`);
  if (item.date) bits.push(`— ${item.date.slice(0, 10)}`);
  const text = `${bits.join(' ')}\n  ${baseUrl}${item.link}`;
  const html = `<li><strong>${escapeHtml(item.label)}</strong>` +
    (item.detail ? ` <span style="color:#666">(${escapeHtml(item.detail)})</span>` : '') +
    (item.date ? ` <span style="color:#666">— ${escapeHtml(item.date.slice(0, 10))}</span>` : '') +
    ` — <a href="${baseUrl}${item.link}">${escapeHtml(item.source)}</a></li>`;
  return { text, html };
}

// Appended to every email so recipients know not to hit "reply" on an unmonitored
// mailbox, and always have a link back into the site.
function footer(baseUrl: string, hub: string): { text: string; html: string } {
  return {
    text: `\n\n---\nOpen ${hub}: ${baseUrl}\nThis mailbox is not monitored — please don't reply to this email.`,
    html: `<hr style="margin-top:24px;border:none;border-top:1px solid #ddd">` +
      `<p style="color:#888;font-size:12px">` +
      `<a href="${baseUrl}">Open ${hub}</a><br>` +
      `This mailbox is not monitored — please don't reply to this email.</p>`,
  };
}

async function sendMail(env: Env, user: UserRow, subject: string, text: string, html: string, headers?: Record<string, string>): Promise<void> {
  const f = footer(env.HUB_BASE_URL, hubName(user));
  await env.EMAIL.send({
    from: { email: env.FROM_ADDRESS, name: env.FROM_NAME },
    to: user.email,
    subject,
    text: text + f.text,
    html: `<div style="font-family:sans-serif">${html}${f.html}</div>`,
    ...(headers ? { headers } : {}),
  });
}

async function sendNewItemsMail(env: Env, user: UserRow, items: ActionItem[]): Promise<void> {
  const subject = items.length === 1 ? `New assignment: ${items[0].label}` : `${items.length} new assignments`;
  const lines = items.map(i => itemLine(i, env.HUB_BASE_URL));
  const hub = hubName(user);
  const text = `You have ${items.length === 1 ? 'a new assignment' : 'new assignments'} in ${hub}:\n\n` +
    lines.map(l => l.text).join('\n\n');
  const html = `<p>You have ${items.length === 1 ? 'a new assignment' : 'new assignments'} in ${hub}:</p><ul>` +
    lines.map(l => l.html).join('') + '</ul>';
  await sendMail(env, user, subject, text, html);
}

async function sendWeeklyMail(env: Env, user: UserRow, items: ActionItem[], dateLabel: string, nextMeetingDate: string): Promise<void> {
  // Only Action Items with a due date carry a date at all — Calling Pipeline, Interview
  // Setup, Clerk, and Bishopric Assignment items don't tie to one particular Sunday, so
  // they can't be "this week's" reminder either way.
  // Ward Council meetings aren't always on Sunday, so their assignments (prayers,
  // spiritual thought) get the reminder whenever the meeting is in the coming week.
  const weekEnd = addDays(nextMeetingDate, 6);
  const isWcMeetingSoon = (i: ActionItem) =>
    i.source === 'Ward Council Meeting' && !!i.date && i.date.slice(0, 10) <= weekEnd;
  const upcoming = items.filter(i => (i.date && i.date.slice(0, 10) === nextMeetingDate) || isWcMeetingSoon(i));
  const onlySunday = upcoming.every(i => i.date?.slice(0, 10) === nextMeetingDate);
  const meetingDateLabel = formatIsoDateLabel(nextMeetingDate);
  const reminderHeading = onlySunday ? `this Sunday, ${meetingDateLabel}` : 'coming up this week';

  const bySource = new Map<string, ActionItem[]>();
  for (const item of items) {
    const list = bySource.get(item.source) || [];
    list.push(item);
    bySource.set(item.source, list);
  }
  const textSections: string[] = [];
  const htmlSections: string[] = [];
  for (const [source, list] of bySource) {
    const lines = list.map(i => itemLine(i, env.HUB_BASE_URL));
    textSections.push(`${source}:\n` + lines.map(l => `- ${l.text}`).join('\n'));
    htmlSections.push(`<h3>${escapeHtml(source)}</h3><ul>${lines.map(l => l.html).join('')}</ul>`);
  }

  let reminderText = '';
  let reminderHtml = '';
  if (upcoming.length > 0) {
    const lines = upcoming.map(i => itemLine(i, env.HUB_BASE_URL));
    reminderText = `⚠ Reminder — ${reminderHeading}:\n` + lines.map(l => `- ${l.text}`).join('\n') + '\n\n';
    reminderHtml = `<p style="background:#fff8e1;border:1px solid #f0d878;border-radius:6px;padding:10px 14px">` +
      `<strong>⚠ Reminder — ${escapeHtml(reminderHeading)}:</strong><ul>${lines.map(l => l.html).join('')}</ul></p>`;
  }

  const subject = upcoming.length > 0
    ? `Your assignments — reminder for ${reminderHeading}`
    : `Your assignments — ${dateLabel}`;
  const hub = hubName(user);
  const text = `${reminderText}Here's everything currently assigned to you in ${hub}:\n\n${textSections.join('\n\n')}`;
  const html = `${reminderHtml}<p>Here's everything currently assigned to you in ${hub}:</p>${htmlSections.join('')}`;
  // Not RFC 8058 one-click (the page requires login to toggle the setting), so we
  // only send List-Unsubscribe as a link, not List-Unsubscribe-Post.
  await sendMail(env, user, subject, text, html, {
    'List-Unsubscribe': `<${env.HUB_BASE_URL}${user.hub === 'wc' ? '/my-actions' : '/email-notifications'}>`,
  });
}

// Next Sunday's calendar date (or today, if today is already Sunday) in `tz` —
// sacrament meeting is always Sunday, so this is "the next meeting."
function upcomingSunday(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const y = Number(parts.find(p => p.type === 'year')!.value);
  const m = Number(parts.find(p => p.type === 'month')!.value);
  const d = Number(parts.find(p => p.type === 'day')!.value);
  const weekday = parts.find(p => p.type === 'weekday')!.value;
  const add = (7 - WEEKDAYS.indexOf(weekday)) % 7;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + add);
  return dt.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Formats a plain YYYY-MM-DD (as stored on ActionItem.date) as "Sun, Aug 9" — no time-zone
// conversion needed since it's already a calendar date, not an instant.
function formatIsoDateLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

// True at most once per matching weekday+hour in `tz` — the caller also checks a 24h
// guard against the last recorded 'weekly' run, so a restart mid-hour can't double-send.
function isWeeklySendWindow(tz: string, schedule: WeeklySchedule): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  return weekday === schedule.weekday && Number(hour) === schedule.hour;
}

function localDateLabel(tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
}

async function recordRun(db: D1Database, kind: 'new-items' | 'weekly' | 'seed', emailsSent: number, itemsNotified: number, errors: { recipient: string; error: string }[]): Promise<void> {
  await db.prepare(
    'INSERT INTO mailer_runs (ran_at, kind, emails_sent, items_notified, errors) VALUES (?, ?, ?, ?, ?)'
  ).bind(new Date().toISOString(), kind, emailsSent, itemsNotified, errors.length > 0 ? JSON.stringify(errors) : null).run();
  // Keep the table small — same pruning pattern as lcr-sync-runs/clear-archived.
  await db.prepare(
    'DELETE FROM mailer_runs WHERE id NOT IN (SELECT id FROM mailer_runs ORDER BY id DESC LIMIT 100)'
  ).run();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(run(env));
  },
} satisfies ExportedHandler<Env>;

async function run(env: Env): Promise<void> {
  const db = env.DB;
  const live = env.MAILER_MODE === 'live';
  const [tz, weeklySchedule] = await Promise.all([getTimeZone(db), getWeeklySchedule(db)]);
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const [recipients, sources, nameIndex, allNotified] = await Promise.all([
    getRecipients(db),
    getSources(db, todayIso),
    getWardMemberNameIndex(db),
    db.prepare('SELECT user_id, item_id FROM action_item_notifications').all<{ user_id: number; item_id: string }>(),
  ]);
  // One query for every recipient's ledger, grouped in memory, instead of one
  // round trip per recipient — keeps this well under the per-invocation CPU budget.
  const notifiedByUser = new Map<number, string[]>();
  for (const row of allNotified.results) {
    const list = notifiedByUser.get(row.user_id) || [];
    list.push(row.item_id);
    notifiedByUser.set(row.user_id, list);
  }

  const currentMonthAbbr = new Date().toLocaleDateString('en-US', { month: 'short' }).toLowerCase();

  const newItemErrors: { recipient: string; error: string }[] = [];
  let newEmailsSent = 0;
  let newItemsNotified = 0;

  const perUserItems = new Map<number, ActionItem[]>();

  for (const user of recipients) {
    const permissions = permissionsFor(user);
    const items = computeActionItems(user.name, permissions, sourcesFor(user, sources), nameIndex, currentMonthAbbr);
    perUserItems.set(user.id, items);

    const existingIds = notifiedByUser.get(user.id) || [];
    const alreadyNotified = new Set(existingIds);
    const currentIds = new Set(items.map(i => i.id));

    const freshItems = items.filter(i => !alreadyNotified.has(i.id));

    if (freshItems.length > 0) {
      // Only record an item as notified once it's actually been sent (or in seed mode,
      // where nothing is sent at all) — a failed send must stay unnotified so the next
      // run retries it, instead of silently giving up after one bad attempt.
      let sendFailed = false;
      if (live && user.email) {
        try {
          await sendNewItemsMail(env, user, freshItems);
          newEmailsSent++;
        } catch (err) {
          sendFailed = true;
          newItemErrors.push({ recipient: user.name, error: err instanceof Error ? err.message : String(err) });
        }
      }
      if (!sendFailed) {
        const now = new Date().toISOString();
        const stmts = freshItems.map(i =>
          db.prepare('INSERT OR IGNORE INTO action_item_notifications (user_id, item_id, sent_at) VALUES (?, ?, ?)')
            .bind(user.id, i.id, now)
        );
        await db.batch(stmts);
        newItemsNotified += freshItems.length;
      }
    }

    // Prune ledger rows for items no longer open, so a re-assigned item can notify again.
    const staleIds = existingIds.filter(id => !currentIds.has(id));
    if (staleIds.length > 0) {
      await db.batch(staleIds.map(id =>
        db.prepare('DELETE FROM action_item_notifications WHERE user_id = ? AND item_id = ?').bind(user.id, id)
      ));
    }
  }

  if (newEmailsSent > 0 || newItemErrors.length > 0) {
    await recordRun(db, 'new-items', newEmailsSent, newItemsNotified, newItemErrors);
  } else if (!live) {
    // Seed mode never emails, so without this the Automation page can't tell "the cron
    // hasn't run yet" from "it's running and correctly sending nothing." Record the
    // current backlog size once — checked against total open items, not just this run's
    // fresh ones, so it still fires on the first run after this code ships even if an
    // earlier (pre-this-code) run already seeded the ledger with nothing left "fresh."
    const totalOpenItems = [...perUserItems.values()].reduce((n, items) => n + items.length, 0);
    if (totalOpenItems > 0) {
      const seeded = await db.prepare("SELECT id FROM mailer_runs WHERE kind = 'seed' LIMIT 1").first();
      if (!seeded) await recordRun(db, 'seed', 0, totalOpenItems, []);
    }
  }

  // Weekly digest — everything currently open, sent once per the admin-configured
  // weekday+hour (defaults to Saturday 08:00, local to the ward's time zone).
  if (isWeeklySendWindow(tz, weeklySchedule)) {
    const lastWeekly = await db.prepare(
      "SELECT ran_at FROM mailer_runs WHERE kind = 'weekly' ORDER BY id DESC LIMIT 1"
    ).first<{ ran_at: string }>();
    const alreadySentToday = lastWeekly && (Date.now() - new Date(lastWeekly.ran_at).getTime()) < 24 * 60 * 60 * 1000;

    if (!alreadySentToday) {
      const dateLabel = localDateLabel(tz);
      const nextMeetingDate = upcomingSunday(tz);
      const weeklyErrors: { recipient: string; error: string }[] = [];
      let weeklyEmailsSent = 0;

      for (const user of recipients) {
        const items = perUserItems.get(user.id) || [];
        if (items.length === 0 || !live || !user.email) continue;
        try {
          await sendWeeklyMail(env, user, items, dateLabel, nextMeetingDate);
          weeklyEmailsSent++;
        } catch (err) {
          weeklyErrors.push({ recipient: user.name, error: err instanceof Error ? err.message : String(err) });
        }
      }

      await recordRun(db, 'weekly', weeklyEmailsSent, 0, weeklyErrors);
    }
  }
}
