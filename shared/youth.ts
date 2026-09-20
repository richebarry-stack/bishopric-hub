export function computeAge(birthDate: string, asOf?: Date): number {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ref = asOf ?? new Date();
  let age = ref.getFullYear() - bd.getFullYear();
  const m = ref.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < bd.getDate())) age--;
  return age;
}

// Returns current age if the member is still youth-eligible, otherwise null.
// Youth eligibility ends September 1 of the year they turn 18, so members
// who turn 18 any time during the year remain youth through August.
export function computeYouthAge(birthDate: string): number | null {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ageOutDate = new Date(bd.getFullYear() + 18, 8, 1); // Sep 1 of 18th year
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today >= ageOutDate) return null;
  return computeAge(birthDate);
}

/** Ids of roster members who are no longer current youth (inactive, or aged out). Youth
 * interview rows linked to one of these shouldn't generate setup action items. */
export function agedOutMemberIds(members: { id: number; active: number | boolean; birth_date?: string | null }[]): Set<number> {
  const s = new Set<number>();
  for (const m of members) {
    if (!m.active || !m.birth_date || computeYouthAge(m.birth_date) === null) s.add(m.id);
  }
  return s;
}
