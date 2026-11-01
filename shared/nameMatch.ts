import { stripBold } from './text';

export interface NameIndexMember {
  first_name: string;
  last_name: string;
  preferred_first_name?: string | null;
  preferred_last_name?: string | null;
}

export function normalizeNameKey(raw: string | null | undefined): string {
  return stripBold(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Builds a lookup from every normalized name variant (legal/preferred, both "First Last"
 * and "Last, First" orders) to the member, so free-text history rows can be matched
 * regardless of which name/order was typed. */
export function buildNameIndex<T extends NameIndexMember>(members: T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const m of members) {
    const legalFirst = m.first_name || '';
    const legalLast = m.last_name || '';
    const prefFirst = m.preferred_first_name?.trim() || legalFirst;
    const prefLast = m.preferred_last_name?.trim() || legalLast;
    const variants = new Set<string>();
    if (legalLast) {
      variants.add(normalizeNameKey(legalFirst ? `${legalFirst} ${legalLast}` : legalLast));
      variants.add(normalizeNameKey(legalFirst ? `${legalLast}, ${legalFirst}` : legalLast));
    }
    if (prefLast) {
      variants.add(normalizeNameKey(prefFirst ? `${prefFirst} ${prefLast}` : prefLast));
      variants.add(normalizeNameKey(prefFirst ? `${prefLast}, ${prefFirst}` : prefLast));
    }
    for (const v of variants) {
      if (v && !index.has(v)) index.set(v, m);
    }
  }
  return index;
}

export function matchMember<T extends NameIndexMember>(index: Map<string, T>, raw: string | null | undefined): T | undefined {
  const key = normalizeNameKey(raw);
  return key ? index.get(key) : undefined;
}

const TITLE_WORDS = new Set(['brother', 'bro', 'sister', 'sis', 'elder', 'bishop', 'president', 'pres', 'mr', 'mrs', 'ms', 'dr']);

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** "First Last" form of a typed name, with punctuation and titles like "Sister" removed
 * and "Last, First" flipped, for spelling comparisons. */
function comparableName(raw: string): string {
  let s = normalizeNameKey(raw);
  const comma = s.indexOf(',');
  if (comma > 0) s = `${s.slice(comma + 1)} ${s.slice(0, comma)}`;
  return s.replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w && !TITLE_WORDS.has(w)).join(' ');
}

/** For a typed name that matchMember couldn't find, the ward member whose legal or
 * preferred name is closest in spelling, if it's close enough to likely be a typo. */
export function closestMember<T extends NameIndexMember>(members: T[], raw: string | null | undefined): T | undefined {
  const typed = comparableName(raw || '');
  if (!typed) return undefined;
  const limit = Math.max(1, Math.min(3, Math.floor(typed.length / 4)));
  let best: T | undefined;
  let bestDist = Infinity;
  for (const m of members) {
    const names = new Set([
      `${m.first_name || ''} ${m.last_name || ''}`,
      `${m.preferred_first_name?.trim() || m.first_name || ''} ${m.preferred_last_name?.trim() || m.last_name || ''}`,
    ]);
    for (const n of names) {
      const d = editDistance(typed, comparableName(n));
      if (d < bestDist) { bestDist = d; best = m; }
    }
  }
  return bestDist <= limit ? best : undefined;
}
