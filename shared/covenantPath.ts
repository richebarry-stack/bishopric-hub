// Builds the Covenant Path page's lists: members who may be ready for their next
// ordinance or blessing. Pure functions over ward roster data (synced from LCR),
// so they can be tested and reused.

export interface CovenantMember {
  id: number;
  first_name: string;
  last_name: string;
  preferred_first_name?: string | null;
  preferred_last_name?: string | null;
  active: number;
  out_of_ward?: number | null;
  birth_date: string | null;
  gender: string | null;
  baptized: number | null;
  priesthood_office: string | null;
  endowed: number | null;
  recommend_type?: string | null;
  recommend_expires?: string | null;
  spouse_name?: string | null;
  sealed_to_current_spouse?: number | null;
  head_of_house?: string | null;
  returned_missionary?: number | null;
  pb_status?: string | null;
}

export interface CovenantSettings {
  /** Minimum age for the patriarchal blessing list. */
  pbAge: number;
  /** Minimum age for the not-baptized list (LCR uses 9 and over). */
  unbaptizedAge: number;
  /** Minimum age for the not-endowed list. */
  endowmentAge: number;
}

export const DEFAULT_COVENANT_SETTINGS: CovenantSettings = { pbAge: 18, unbaptizedAge: 9, endowmentAge: 21 };

export const PB_STATUSES = ['Not received', 'Recommend issued', 'Received'] as const;

export interface CovenantItem {
  /** "member:<id>", "couple:<id>-<id>" or "household:<name>" — what an exclusion hides. */
  key: string;
  name: string;
  detail: string;
  memberId?: number;
}

export interface CovenantCategory {
  id: string;
  title: string;
  description: string;
  items: CovenantItem[];
}

export interface PartMemberHousehold { household: string; relationships: string }

/**
 * The neutral topic the ward council sees for each list, so sensitive wording
 * (not baptized, expired recommend, ages) stays with the bishopric.
 */
export const COUNCIL_TOPICS: Record<string, string> = {
  'patriarchal-blessing': 'Patriarchal blessing',
  'approaching-baptism': 'Baptism preparation',
  'not-baptized': 'Gospel learning and support',
  'priesthood': 'Priesthood preparation',
  'not-endowed': 'Temple preparation',
  'married-not-sealed': 'Temple preparation',
  'no-recommend': 'Temple preparation',
  'mission-age': 'Mission preparation',
  'part-member': 'Family support',
  'no-mp-holder': 'Ministering support',
};

/** An agenda entry as the bishopric sees it (still on its list). */
export interface CovenantAgendaEntry {
  id: number;
  category: string;
  categoryTitle: string;
  subject_key: string;
  subject_name: string;
  detail: string;
  topic: string;
  note: string;
  for_bishopric: number;
  for_ward_council: number;
}

/** What ward council members get: no list name, detail or flags. */
export interface CouncilAgendaEntry { id: number; subject_name: string; topic: string; note: string }

/** Age in whole years on `today` (YYYY-MM-DD), or null without a full birth date. */
export function ageOn(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** The age someone turns during `today`'s calendar year (youth are ordained in the year they turn 12, 14, 16). */
function ageThisYear(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate || !/^\d{4}/.test(birthDate)) return null;
  return Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
}

/** "2026-11-13" + n months, as YYYY-MM-DD (day clamped is fine for comparisons). */
function addMonths(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const OFFICE_RANK: Record<string, number> = { deacon: 1, teacher: 2, priest: 3 };
/** Deacon 1, Teacher 2, Priest 3, any Melchizedek office 4, none 0. */
export function officeRank(office: string | null | undefined): number {
  const o = (office || '').trim().toLowerCase();
  if (!o) return 0;
  if (OFFICE_RANK[o]) return OFFICE_RANK[o];
  return /elder|high priest|seventy|patriarch|apostle|bishop/.test(o) ? 4 : 0;
}
const RANK_NAME = ['', 'Deacon', 'Teacher', 'Priest', 'Elder'];

const displayName = (m: CovenantMember) =>
  `${(m.preferred_last_name || m.last_name).trim()}, ${(m.preferred_first_name || m.first_name).trim()}`;

/** Keys LCR might use for someone in "Last, First" form (legal and preferred names). */
function nameKeys(m: CovenantMember): string[] {
  const keys = [`${m.last_name}, ${m.first_name}`];
  if (m.preferred_first_name || m.preferred_last_name) keys.push(displayName(m));
  return keys.map(k => k.trim().toLowerCase());
}

export function buildCovenantPath(
  allMembers: CovenantMember[],
  partMemberHouseholds: PartMemberHousehold[],
  inMissionaryPipeline: Set<number>,
  settings: CovenantSettings,
  today: string,
): CovenantCategory[] {
  const members = allMembers.filter(m => m.active && !m.out_of_ward);
  const sorted = (items: CovenantItem[]) => items.sort((a, b) => a.name.localeCompare(b.name));
  const item = (m: CovenantMember, detail: string): CovenantItem => ({ key: `member:${m.id}`, name: displayName(m), detail, memberId: m.id });
  const withAge = members.map(m => ({ m, age: ageOn(m.birth_date, today) }));
  const thisMonth = today.slice(0, 7);

  const pb = withAge.filter(({ m, age }) => m.baptized === 1 && age !== null && age >= settings.pbAge && m.pb_status !== 'Received')
    .map(({ m, age }) => item(m, `${age} · ${m.pb_status === 'Recommend issued' ? 'Recommend issued' : 'Not received'}`));

  const soon = addMonths(today, 3);
  const approachingBaptism = withAge.filter(({ m, age }) => m.baptized === 0 && age !== null && age < settings.unbaptizedAge && m.birth_date &&
    (age >= 8 || addMonths(m.birth_date.slice(0, 10), 96) <= soon))
    .map(({ m, age }) => item(m, age !== null && age >= 8 ? `Age ${age}` : `Turns 8 on ${addMonths(m.birth_date!.slice(0, 10), 96)}`));

  const unbaptized = withAge.filter(({ m, age }) => m.baptized === 0 && age !== null && age >= settings.unbaptizedAge)
    .map(({ m, age }) => item(m, `Age ${age}`));

  const priesthood = withAge.filter(({ m }) => m.gender === 'M' && m.baptized === 1).flatMap(({ m, age }) => {
    const turning = ageThisYear(m.birth_date, today);
    if (turning === null || age === null) return [];
    const expected = age >= 18 ? 4 : turning >= 16 ? 3 : turning >= 14 ? 2 : turning >= 12 ? 1 : 0;
    const has = officeRank(m.priesthood_office);
    if (expected === 0 || has >= expected) return [];
    return [item(m, `Age ${age} · ${m.priesthood_office || 'No office'} → ${RANK_NAME[expected]}`)];
  });

  const notEndowed = withAge.filter(({ m, age }) => m.baptized === 1 && m.endowed === 0 && age !== null && age >= settings.endowmentAge)
    .map(({ m, age }) => item(m, `Age ${age}`));

  // Married but not sealed: both spouses on the roster (otherwise it's a part-member household).
  const byNameKey = new Map<string, CovenantMember>();
  for (const m of members) for (const k of nameKeys(m)) byNameKey.set(k, m);
  const seenCouples = new Set<string>();
  const marriedNotSealed: CovenantItem[] = [];
  for (const m of members) {
    if (!m.spouse_name || m.sealed_to_current_spouse !== 0) continue;
    const spouse = byNameKey.get(m.spouse_name.trim().toLowerCase());
    if (!spouse || spouse.sealed_to_current_spouse === 1) continue;
    const [a, b] = [m, spouse].sort((x, y) => x.id - y.id);
    const key = `couple:${a.id}-${b.id}`;
    if (seenCouples.has(key)) continue;
    seenCouples.add(key);
    const unendowed = [a, b].filter(p => p.endowed !== 1).map(p => (p.preferred_first_name || p.first_name).trim());
    marriedNotSealed.push({
      key,
      name: `${displayName(a)} & ${(b.preferred_first_name || b.first_name).trim()}${a.last_name !== b.last_name ? ` ${b.last_name}` : ''}`,
      detail: unendowed.length === 0 ? 'Both endowed' : `Not endowed: ${unendowed.join(', ')}`,
      memberId: a.id,
    });
  }

  const noRecommend = withAge.filter(({ m }) => m.endowed === 1 && (!m.recommend_expires || m.recommend_expires.slice(0, 7) < thisMonth))
    .map(({ m }) => item(m, m.recommend_expires ? `Expired ${m.recommend_expires.slice(0, 7)}` : 'No recommend on record'));

  const turning18Soon = addMonths(today, 12);
  const missionAge = withAge.filter(({ m, age }) => m.gender === 'M' && m.baptized === 1 && age !== null && !inMissionaryPipeline.has(m.id) && m.birth_date && (
    (age < 18 && addMonths(m.birth_date.slice(0, 10), 216) <= turning18Soon) ||
    (age >= 18 && age <= 25 && !m.spouse_name && m.returned_missionary === 0)
  )).map(({ m, age }) => item(m, age! < 18 ? `Turns 18 on ${addMonths(m.birth_date!.slice(0, 10), 216)}` : `Age ${age}, single, hasn't served`));

  // Households: everyone sharing a head of house. No Melchizedek Priesthood holder among them.
  const households = new Map<string, CovenantMember[]>();
  for (const m of members) {
    if (!m.head_of_house) continue;
    const list = households.get(m.head_of_house) || [];
    list.push(m);
    households.set(m.head_of_house, list);
  }
  const noMp: CovenantItem[] = [...households.entries()]
    .filter(([, list]) => !list.some(p => officeRank(p.priesthood_office) === 4))
    .map(([head, list]) => ({ key: `household:${head}`, name: head, detail: `${list.length} ${list.length === 1 ? 'member' : 'members'}` }));

  const partMember: CovenantItem[] = partMemberHouseholds.map(h => ({
    key: `household:${h.household}`, name: h.household, detail: `Non-member: ${h.relationships || 'not listed'}`,
  }));

  return [
    { id: 'patriarchal-blessing', title: 'Patriarchal blessing', description: `Baptized members ${settings.pbAge} and older who haven't received their blessing.`, items: sorted(pb) },
    { id: 'approaching-baptism', title: 'Children approaching baptism', description: 'Not yet baptized and turning 8 within 3 months, or already 8.', items: sorted(approachingBaptism) },
    { id: 'not-baptized', title: 'Not baptized', description: `Members ${settings.unbaptizedAge} and older without a baptism. Hide anyone who isn't accountable.`, items: sorted(unbaptized) },
    { id: 'priesthood', title: 'Priesthood office behind age', description: 'Young men in the year they turn 12, 14 or 16, and men 18 and older without the Melchizedek Priesthood.', items: sorted(priesthood) },
    { id: 'not-endowed', title: 'Not endowed', description: `Baptized members ${settings.endowmentAge} and older who haven't received their endowment.`, items: sorted(notEndowed) },
    { id: 'married-not-sealed', title: 'Married but not sealed', description: 'Couples with both spouses in the ward who aren’t sealed to each other.', items: sorted(marriedNotSealed) },
    { id: 'no-recommend', title: 'Endowed without a current recommend', description: 'Endowed members whose recommend has expired or isn’t on record.', items: sorted(noRecommend) },
    { id: 'mission-age', title: 'Mission-age young men', description: 'Turning 18 within a year, or single men 18–25 who haven’t served. People already on the Missionary Pipeline aren’t listed.', items: sorted(missionAge) },
    { id: 'part-member', title: 'Part-member households', description: 'From LCR’s Part-Member Households report.', items: sorted(partMember) },
    { id: 'no-mp-holder', title: 'Households without a Melchizedek Priesthood holder', description: 'Useful for ministering assignments.', items: sorted(noMp) },
  ];
}
