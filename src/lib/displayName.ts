export interface Nameable {
  first_name: string;
  last_name: string;
  preferred_first_name?: string | null;
  preferred_last_name?: string | null;
}

/** The legal "Lastname, Firstname" form — the canonical name used for matching/storage. */
export function legalName(m: Nameable): string {
  return m.first_name ? `${m.last_name}, ${m.first_name}` : m.last_name;
}

/** "PrefLastname, PrefFirstname" — for list/table contexts, falling back to the legal name. */
export function displayName(m: Nameable): string {
  const first = m.preferred_first_name?.trim() || m.first_name;
  const last = m.preferred_last_name?.trim() || m.last_name;
  return first ? `${last}, ${first}` : last;
}

/** "PrefFirstname PrefLastname" — for prose contexts, falling back to the legal name. */
export function displayFirstLast(m: Nameable): string {
  const first = m.preferred_first_name?.trim() || m.first_name;
  const last = m.preferred_last_name?.trim() || m.last_name;
  return first ? `${first} ${last}` : last;
}
