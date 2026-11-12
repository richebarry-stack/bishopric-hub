// Groups LCR callings by the organization they belong to in the General Handbook,
// for the calling filter in the Calling Pipeline. LCR's own section names don't
// line up with that ("Other Callings", "Activities", "Service", "Facilities",
// a class name like "Valiant 9"), so each calling is placed by what it is.
// Used for the Calling Pipeline's Organization field and calling filter, and by
// the LCR sync, so pipeline entries carry the handbook organization rather than
// LCR's section name. Shared by the browser bundle and the API.

/** Handbook organizations, in roughly handbook chapter order. */
export const CALLING_GROUPS = [
  'Bishopric and Clerks',
  'Elders Quorum',
  'Relief Society',
  'Aaronic Priesthood',
  'Young Women',
  'Primary',
  'Sunday School',
  'Young Single Adults',
  'Missionary Work',
  'Temple and Family History',
  'Music',
  'Welfare and Self-Reliance',
  'Communication and Technology',
  'Meetinghouse',
  'Stake',
  'Other',
] as const;
export type CallingGroup = typeof CALLING_GROUPS[number];

const AP: CallingGroup = 'Aaronic Priesthood';

/** LCR section → handbook organization. Sections not listed are placed by calling name. */
const BY_LCR_ORG: Record<string, CallingGroup[]> = {
  'bishopric': ['Bishopric and Clerks'],
  'young men': [AP],
  'ym': [AP],
  'yw': ['Young Women'],
  'technology': ['Communication and Technology'],
  'history': ['Bishopric and Clerks'], // the ward history specialist works under the ward clerk
  'elders quorum': ['Elders Quorum'],
  'relief society': ['Relief Society'],
  'aaronic priesthood quorums': [AP],
  'additional aaronic priesthood quorums callings': [AP],
  'priests quorum adult leaders': [AP],
  'young women': ['Young Women'],
  'additional young women callings': ['Young Women'],
  'builders of faith adult leaders': ['Young Women'],
  'gatherers of light adult leaders': ['Young Women'],
  'messengers of hope adult leaders': ['Young Women'],
  'messengers of hope presidency': ['Young Women'],
  'for the strength of youth': [AP, 'Young Women'],
  'primary': ['Primary'],
  'primary presidency': ['Primary'],
  'sunday school': ['Sunday School'],
  'sunday school presidency': ['Sunday School'],
  'gospel foundations': ['Sunday School'],
  'young single adult': ['Young Single Adults'],
  'ward missionaries': ['Missionary Work'],
  'mission responsibilities': ['Missionary Work'],
  'temple and family history': ['Temple and Family History'],
  'temple workers': ['Temple and Family History'],
  'music': ['Music'],
  'welfare and self-reliance': ['Welfare and Self-Reliance'],
  'facilities': ['Meetinghouse'],
  'high council': ['Stake'],
};

/** Callings LCR files under "Other Callings" (or anywhere) that belong somewhere specific. */
const BY_CALLING: Record<string, CallingGroup[]> = {
  'accompanist': ['Music'],
  'choir accompanist': ['Music'],
  'choir director': ['Music'],
  'music coordinator': ['Music'],
  'assistant baptismal cordinator': ['Missionary Work'],
  'assistant baptismal coordinator': ['Missionary Work'],
  'senior missionary specialist': ['Missionary Work'],
  'auditor': ['Stake'], // auditors serve on the stake auditing committee
  'building cleaning coordinator': ['Meetinghouse'],
  'communication specialist': ['Communication and Technology'],
  'email communication specialist': ['Communication and Technology'],
  'ward social media specialist': ['Communication and Technology'],
  'ward bulletin / website administrator': ['Communication and Technology'],
  'technology specialist': ['Communication and Technology'],
  'emergency response specialist': ['Welfare and Self-Reliance'],
  'emergency response communication specialist': ['Welfare and Self-Reliance'],
  'ham radio operator': ['Welfare and Self-Reliance'],
  'disability specialist': ['Welfare and Self-Reliance'],
  'emotional resilience facilitator': ['Welfare and Self-Reliance'],
  'justserve specialist': ['Welfare and Self-Reliance'],
  'justserve specialist assistant': ['Welfare and Self-Reliance'],
  'young men and young women camp leader': [AP, 'Young Women'],
};

/** Calling-name prefixes that say which organization a calling serves in. */
const BY_PREFIX: [RegExp, CallingGroup][] = [
  [/^stake\b/, 'Stake'],
  [/^(bishop|ward (assistant )?(clerk|executive secretary)|ward assistant)/, 'Bishopric and Clerks'],
  [/^elders quorum\b/, 'Elders Quorum'],
  [/^relief society\b/, 'Relief Society'],
  [/^(aaronic priesthood|young men\b|(deacons|teachers|priests) quorum)/, AP],
  [/^(young women\b|builders of faith|gatherers of light|messengers of hope)/, 'Young Women'],
  [/^(primary|nursery|valiant|ctr|sunbeam)\b/, 'Primary'],
  [/^(sunday school|course \d)/, 'Sunday School'],
  [/^young single adult/, 'Young Single Adults'],
  [/^ward mission/, 'Missionary Work'],
  [/^ward temple and family history/, 'Temple and Family History'],
];

/** The handbook organization(s) a calling belongs to. Usually one; a few youth callings serve two. */
export function callingGroups(calling: string, lcrOrg: string): CallingGroup[] {
  const name = calling.trim().toLowerCase();
  const org = lcrOrg.trim().toLowerCase();
  const out = new Set<CallingGroup>();
  for (const g of BY_CALLING[name] || []) out.add(g);
  for (const g of BY_LCR_ORG[org] || []) out.add(g);
  for (const [re, g] of BY_PREFIX) if (re.test(name)) out.add(g);
  // Stake sections and stake callings are stake-only.
  if (org.startsWith('stake') || name.startsWith('stake ')) return ['Stake'];
  if (out.size === 0) {
    const named = CALLING_GROUPS.find(g => g.toLowerCase() === org);
    out.add(named || 'Other');
  }
  return CALLING_GROUPS.filter(g => out.has(g));
}

/** The single organization to store on a pipeline entry: the first handbook group the calling belongs to. */
export function handbookOrganization(calling: string, lcrOrg: string | null | undefined): CallingGroup {
  return callingGroups(calling, lcrOrg || '')[0];
}

/**
 * Stake leadership callings (presidencies, high council, clerks, secretaries,
 * patriarch). The bishopric doesn't extend these, so the calling picker leaves
 * them out; stake callings that serve in the ward (consultants, specialists,
 * instructors, auditors) stay under Stake.
 */
export function isStakeLeadership(calling: string, lcrOrg: string): boolean {
  const name = calling.trim().toLowerCase();
  const org = lcrOrg.trim().toLowerCase();
  if (org === 'stake presidency' || org === 'high council') return true;
  if (!name.startsWith('stake ')) return false;
  return /\b(presidency|president|counselor|councilor|secretary|clerk|patriarch)\b/.test(name);
}
