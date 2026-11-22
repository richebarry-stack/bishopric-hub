// Aaronic Priesthood candidates are presented in sacrament meeting for a sustaining
// vote before ordination (General Handbook 18.10.3). These helpers write and detect
// that line in a Sunday's free-text Ward Business.

export const AARONIC_OFFICES = ['Deacon', 'Teacher', 'Priest'];

export function isAaronicOffice(ordinanceType: string | null | undefined): boolean {
  return AARONIC_OFFICES.includes(ordinanceType || '');
}

/** The sustaining proposal read from the pulpit for a Deacon, Teacher or Priest candidate. */
export function sustainingLine(name: string, office: string): string {
  const lower = office.toLowerCase();
  const proposal = office === 'Deacon'
    ? `We propose that ${name} receive the Aaronic Priesthood and be ordained a deacon.`
    : `We propose that ${name} be ordained ${lower === 'priest' ? 'a priest' : 'a teacher'} in the Aaronic Priesthood.`;
  return `${proposal} Those in favor may manifest it. Any opposed may manifest it.`;
}

/** Whether `wardBusiness` already contains the sustaining line for this person and office. */
export function hasSustainingLine(wardBusiness: string | null | undefined, name: string, office: string): boolean {
  const text = (wardBusiness || '').toLowerCase();
  if (!text || !name.trim()) return false;
  const n = name.trim().toLowerCase();
  const o = office.toLowerCase();
  return text.split('\n').some(line => line.includes(n) && line.includes(o));
}

/** Appends the sustaining line to `wardBusiness` unless it is already there. */
export function appendSustainingLine(wardBusiness: string | null | undefined, name: string, office: string): string {
  const current = wardBusiness || '';
  if (hasSustainingLine(current, name, office)) return current;
  const line = sustainingLine(name, office);
  return current.trim() ? `${current.replace(/\s+$/, '')}\n${line}` : line;
}

/** Removes this person's sustaining line for `office` from `wardBusiness` (e.g. when the Sunday moves). */
export function removeSustainingLine(wardBusiness: string | null | undefined, name: string, office: string): string {
  const n = name.trim().toLowerCase();
  const o = office.toLowerCase();
  if (!n) return wardBusiness || '';
  return (wardBusiness || '')
    .split('\n')
    .filter(line => !(line.toLowerCase().includes(n) && line.toLowerCase().includes(o) && /we propose that/i.test(line)))
    .join('\n');
}
