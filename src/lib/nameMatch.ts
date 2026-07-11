import { stripBold } from './richText';

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
