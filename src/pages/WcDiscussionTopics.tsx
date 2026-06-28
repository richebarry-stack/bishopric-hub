import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import type { WcMeeting, WcDiscussionTopic } from '../lib/api';

const COL_SETTINGS_KEY = 'wc_discussion_col_widths';
const DEFAULT_COL_WIDTHS = { status: 220, next_steps: 220, help_needed: 220 };
type ColWidths = typeof DEFAULT_COL_WIDTHS;

async function fetchColWidths(): Promise<ColWidths> {
  try {
    const res = await fetch(`/api/ui-settings/${COL_SETTINGS_KEY}`);
    if (!res.ok) return DEFAULT_COL_WIDTHS;
    const data = await res.json() as Partial<ColWidths>;
    return { ...DEFAULT_COL_WIDTHS, ...data };
  } catch { return DEFAULT_COL_WIDTHS; }
}

async function saveColWidths(widths: ColWidths): Promise<void> {
  await fetch(`/api/ui-settings/${COL_SETTINGS_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(widths),
  });
}

const TODAY = new Date().toISOString().slice(0, 10);

const ORGS = [
  'Missionary', 'Primary', 'Young Men', 'Young Women',
  'Sunday School', 'Relief Society', 'Elders Quorum', 'Stake',
];

const ORG_ORDER_KEY = (userId: number) => `wc_discussion_org_order_${userId}`;

function loadOrgOrder(userId: number): string[] {
  try {
    const stored = localStorage.getItem(ORG_ORDER_KEY(userId));
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      const valid = parsed.filter(o => ORGS.includes(o));
      const added = ORGS.filter(o => !valid.includes(o));
      return [...valid, ...added];
    }
  } catch { /* ignore */ }
  return [...ORGS];
}

function saveOrgOrder(userId: number, order: string[]): void {
  localStorage.setItem(ORG_ORDER_KEY(userId), JSON.stringify(order));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function renderLine(line: string, _key: number): React.ReactNode {
  if (!line.trim()) return null;
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.length >= 4 && p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function renderRichContent(text: string): React.ReactNode {
  if (!text?.trim()) return <span className="text-gray-300">—</span>;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (idx: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${idx}`} className="list-disc list-inside space-y-0.5">
        {bullets.map((b, j) => <li key={j} className="text-sm text-gray-700">{renderLine(b, j)}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(line.slice(2));
    } else {
      flushBullets(i);
      const rendered = renderLine(line, i);
      if (rendered) out.push(<p key={`p-${i}`} className="text-sm text-gray-700">{rendered}</p>);
    }
  });
  flushBullets(lines.length);
  return out.length ? <div className="space-y-1 px-2 py-1.5">{out}</div> : <span className="text-gray-300">—</span>;
}

function AutoTextarea({ value, onSave, readOnly, placeholder }: {
  value: string; onSave?: (v: string) => void; readOnly?: boolean; placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [local]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = local.lastIndexOf('\n', pos - 1) + 1;
    const line = local.slice(lineStart, pos);
    if (line === '- ' || line === '* ') {
      // Empty bullet line — remove it and insert normal newline
      e.preventDefault();
      const next = local.slice(0, lineStart) + '\n' + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = lineStart + 1; }, 0);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Continue bullet on next line
      e.preventDefault();
      const prefix = line.startsWith('- ') ? '- ' : '* ';
      const insert = '\n' + prefix;
      const next = local.slice(0, pos) + insert + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = pos + insert.length; }, 0);
    }
  };

  if (readOnly) {
    return <div className="min-h-[2rem]">{renderRichContent(value)}</div>;
  }

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value && onSave) onSave(local); }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={1}
      className="w-full resize-none overflow-hidden bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:outline-none rounded px-2 py-1.5 text-sm placeholder-gray-300 min-h-[2rem]"
      style={{ overflow: 'hidden' }}
    />
  );
}

interface OrgRow {
  existingId: number | null;
  status: string;
  next_steps: string;
  help_needed: string;
}

export default function WcDiscussionTopics() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [orgOrder, setOrgOrder] = useState<string[]>(() => user ? loadOrgOrder(user.id) : [...ORGS]);

  // Column resizing
  const [colWidths, setColWidths] = useState<ColWidths>(DEFAULT_COL_WIDTHS);
  const resizeRef = useRef<{ col: keyof ColWidths; startX: number; startW: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchColWidths().then(setColWidths); }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { col, startX, startW } = resizeRef.current;
      const newW = Math.max(80, startW + e.clientX - startX);
      setColWidths(prev => ({ ...prev, [col]: newW }));
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setColWidths(prev => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveColWidths(prev), 400);
        return prev;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const startResize = (col: keyof ColWidths, e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { col, startX: e.clientX, startW: colWidths[col] };
  };
  const [dragOverOrg, setDragOverOrg] = useState<string | null>(null);
  const dragOrgRef = useRef<string | null>(null);

  const handleDragStart = (org: string) => { dragOrgRef.current = org; };
  const handleDragOver = (e: React.DragEvent, org: string) => { e.preventDefault(); setDragOverOrg(org); };
  const handleDrop = (targetOrg: string) => {
    const from = dragOrgRef.current;
    if (!from || from === targetOrg) { setDragOverOrg(null); return; }
    setOrgOrder(prev => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(targetOrg);
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      if (user) saveOrgOrder(user.id, next);
      return next;
    });
    setDragOverOrg(null);
    dragOrgRef.current = null;
  };

  const { rows: meetings, isLoading: loadingMeetings } = useTable<WcMeeting>('wc-meetings');
  const { rows: topics, isLoading: loadingTopics, create, update } = useTable<WcDiscussionTopic>('wc-discussion-topics');

  const upcomingMeetings = useMemo(() =>
    meetings.filter(m => m.date.slice(0, 10) >= TODAY).sort((a, b) => a.date.localeCompare(b.date)),
    [meetings]);

  const pastMeetings = useMemo(() =>
    meetings.filter(m => m.date.slice(0, 10) < TODAY).sort((a, b) => b.date.localeCompare(a.date)),
    [meetings]);

  const nextMeeting = upcomingMeetings[0] ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeMeetingDate = selectedDate ?? nextMeeting?.date?.slice(0, 10) ?? null;
  const isPastMeeting = activeMeetingDate !== null && activeMeetingDate < TODAY;

  const activeTopics = useMemo(() =>
    topics.filter(t => t.meeting_date?.slice(0, 10) === activeMeetingDate),
    [topics, activeMeetingDate]);

  const prevMeetingDate = pastMeetings[0]?.date?.slice(0, 10) ?? null;
  const prevTopics = useMemo(() =>
    prevMeetingDate ? topics.filter(t => t.meeting_date?.slice(0, 10) === prevMeetingDate) : [],
    [topics, prevMeetingDate]);

  const getOrgRow = useCallback((org: string): OrgRow => {
    const found = activeTopics.find(t => t.organization === org);
    if (found) {
      return { existingId: found.id, status: found.status ?? '', next_steps: found.next_steps ?? '', help_needed: found.help_needed ?? '' };
    }
    return { existingId: null, status: '', next_steps: '', help_needed: '' };
  }, [activeTopics]);

  const [copyingPrior, setCopyingPrior] = useState(false);

  const handleCopyFromPrior = useCallback(async () => {
    if (!activeMeetingDate || prevTopics.length === 0) return;
    const hasContent = activeTopics.some(t => t.status || t.next_steps || t.help_needed);
    if (hasContent && !window.confirm('This will replace existing content for this meeting. Continue?')) return;
    setCopyingPrior(true);
    try {
      for (const org of orgOrder) {
        const prev = prevTopics.find(t => t.organization === org);
        if (!prev) continue;
        const current = activeTopics.find(t => t.organization === org);
        const payload = { status: prev.status ?? '', next_steps: prev.next_steps ?? '', help_needed: prev.help_needed ?? '' };
        if (current) {
          await update(current.id, payload);
        } else {
          await create({ meeting_date: activeMeetingDate, organization: org, topic: '', ...payload });
        }
      }
    } finally {
      setCopyingPrior(false);
    }
  }, [activeMeetingDate, prevTopics, activeTopics, orgOrder, create, update]);

  const handleSave = useCallback(async (org: string, field: 'status' | 'next_steps' | 'help_needed', value: string) => {
    if (!activeMeetingDate) return;
    const current = getOrgRow(org);
    const payload = { ...current, [field]: value, meeting_date: activeMeetingDate, organization: org };
    if (current.existingId) {
      await update(current.existingId, { [field]: value });
    } else {
      await create({ meeting_date: activeMeetingDate, organization: org, topic: '', status: payload.status, next_steps: payload.next_steps, help_needed: payload.help_needed });
    }
  }, [activeMeetingDate, getOrgRow, create, update]);

  const isLoading = loadingMeetings || loadingTopics;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Discussion Topics</h1>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : !nextMeeting ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">No upcoming WC meetings scheduled.</p>
          <p className="text-sm text-gray-400">Add a meeting in <a href="/wc-meetings" className="text-emerald-600 hover:underline">WC Meeting Assignments</a> first.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Meeting:</label>
            <select
              value={activeMeetingDate ?? ''}
              onChange={e => setSelectedDate(e.target.value || null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {upcomingMeetings.map(m => (
                <option key={m.id} value={m.date.slice(0, 10)}>
                  {formatDate(m.date)}{m.date.slice(0, 10) === nextMeeting?.date?.slice(0, 10) ? ' (next)' : ''}
                </option>
              ))}
              {pastMeetings.length > 0 && <option disabled>── Past Meetings ──</option>}
              {pastMeetings.map(m => (
                <option key={m.id} value={m.date.slice(0, 10)}>{formatDate(m.date)}</option>
              ))}
            </select>
            {isPastMeeting && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Read-only — past meeting</span>
            )}
            {!isPastMeeting && prevTopics.length > 0 && (
              <button
                type="button"
                onClick={handleCopyFromPrior}
                disabled={copyingPrior}
                className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100 disabled:opacity-50">
                {copyingPrior ? 'Copying…' : 'Copy from prior meeting'}
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                {isAdmin && <col style={{ width: 28 }} />}
                <col style={{ width: 144 }} />
                <col style={{ width: colWidths.status }} />
                <col style={{ width: colWidths.next_steps }} />
                <col style={{ width: colWidths.help_needed }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {isAdmin && <th className="px-2" />}
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Organization</th>
                  {(['status', 'next_steps', 'help_needed'] as const).map((col, i) => (
                    <th key={col} className="text-left px-3 py-2 font-semibold text-gray-600 relative select-none"
                      style={{ width: colWidths[col] }}>
                      {['Status', 'Next Steps', 'Help Needed'][i]}
                      <div
                        onMouseDown={e => startResize(col, e)}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group"
                        title="Drag to resize">
                        <div className="absolute inset-y-2 right-0.5 w-0.5 rounded bg-gray-200 group-hover:bg-emerald-400 transition-colors" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgOrder.map((org, i) => {
                  const row = getOrgRow(org);
                  const isDragOver = dragOverOrg === org;
                  return (
                    <tr key={org}
                      className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${isDragOver ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-50/30' : ''}`}
                      draggable={isAdmin}
                      onDragStart={isAdmin ? () => handleDragStart(org) : undefined}
                      onDragOver={isAdmin ? e => handleDragOver(e, org) : undefined}
                      onDrop={isAdmin ? () => handleDrop(org) : undefined}
                      onDragLeave={isAdmin ? () => setDragOverOrg(null) : undefined}>
                      {isAdmin && (
                        <td className="pl-3 pr-1 py-2 align-top text-gray-300 cursor-grab select-none">⠿</td>
                      )}
                      <td className="px-4 py-2 font-medium text-gray-800 align-top whitespace-nowrap">{org}</td>
                      <td className="px-2 py-1 align-top">
                        <AutoTextarea value={row.status} onSave={v => handleSave(org, 'status', v)}
                          readOnly={isPastMeeting} placeholder="Status…" />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <AutoTextarea value={row.next_steps} onSave={v => handleSave(org, 'next_steps', v)}
                          readOnly={isPastMeeting} placeholder="Next steps…" />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <AutoTextarea value={row.help_needed} onSave={v => handleSave(org, 'help_needed', v)}
                          readOnly={isPastMeeting} placeholder="Help needed…" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
