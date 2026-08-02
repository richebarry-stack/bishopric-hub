// Mirrors the client-side matching logic in src/components/WardMemberImport.tsx so
// server-side bulk imports (e.g. the LCR recommend-status sync) resolve names the same way.

export interface RosterMember {
  id: number;
  first_name: string;
  last_name: string;
}

/** Strips **bold** markdown markers (src/lib/richText.tsx's client-side twin) so
 * free-text fields like calling_pipeline.member can be matched against a roster name. */
export function stripBold(text: string): string {
  return (text || '').replace(/\*\*/g, '');
}

/** Normalizes "First Last" or "First Middle Last" into "Last, First". */
export function toLastFirst(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  if (s.includes(',')) {
    const [last, first] = s.split(',').map(p => p.trim());
    return first ? `${last}, ${first}` : last;
  }
  const parts = s.split(' ');
  if (parts.length < 2) return s;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

function splitLastFirst(name: string): { last: string; first: string } {
  const [last = '', first = ''] = name.split(',').map(p => p.trim());
  return { last: last.toLowerCase(), first: first.toLowerCase() };
}

/** Same split as splitLastFirst but preserving case, for actual creates. */
export function splitLastFirstCased(name: string): { last: string; first: string } {
  const [last = '', first = ''] = name.split(',').map(p => p.trim());
  return { last, first };
}

function firstToken(s: string): string {
  return s.split(/\s+/)[0] || '';
}

export interface RosterMemberNames extends RosterMember {
  preferred_first_name?: string | null;
  preferred_last_name?: string | null;
}

/** Exact-variant resolver (src/lib/nameMatch.ts's server-side twin): matches a typed
 * name against every spelling the roster knows for a member — legal or preferred,
 * "First Last" or "Last, First" — and nothing looser. Unlike matchRosterMember it
 * never guesses from a partial first name, so it's safe to run over free text that
 * may not be a member name at all (e.g. "Replacement for Jane Doe"). Returns null
 * when nothing matches or when two members share the same spelling. */
export function matchRosterMemberExact(rawName: string, roster: RosterMemberNames[]): RosterMemberNames | null {
  const key = stripBold(rawName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const index = new Map<string, RosterMemberNames | null>();
  const add = (variant: string, m: RosterMemberNames) => {
    const k = variant.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!k) return;
    const existing = index.get(k);
    // Two different members answering to the same spelling is ambiguous — resolve to
    // neither rather than picking whichever was loaded first.
    if (existing === undefined) index.set(k, m);
    else if (existing && existing.id !== m.id) index.set(k, null);
  };
  for (const m of roster) {
    const pairs: [string, string][] = [[m.first_name || '', m.last_name || '']];
    const pf = (m.preferred_first_name || '').trim() || m.first_name || '';
    const pl = (m.preferred_last_name || '').trim() || m.last_name || '';
    pairs.push([pf, pl]);
    for (const [first, last] of pairs) {
      if (!last) continue;
      add(first ? `${first} ${last}` : last, m);
      add(first ? `${last}, ${first}` : last, m);
    }
  }
  return index.get(key) || null;
}

/** Resolves a raw LCR name string to a single roster member, or null if ambiguous/no match. */
export function matchRosterMember(rawName: string, roster: RosterMember[]): RosterMember | null {
  const normalized = toLastFirst(rawName);
  const byExact = new Map(roster.map(m => [`${m.last_name}, ${m.first_name}`.toLowerCase(), m]));
  const exact = byExact.get(normalized.toLowerCase());
  if (exact) return exact;

  const { last, first } = splitLastFirst(normalized);
  const sameLastName = roster.filter(m => m.last_name.toLowerCase() === last);
  const firstTokenMatch = sameLastName.find(m => firstToken(m.first_name.toLowerCase()) === firstToken(first));
  if (firstTokenMatch) return firstTokenMatch;

  const prefixMatch = sameLastName.filter(m => {
    const mf = m.first_name.toLowerCase();
    return mf.startsWith(firstToken(first)) || firstToken(first).startsWith(firstToken(mf));
  });
  if (prefixMatch.length === 1) return prefixMatch[0];

  return null;
}
