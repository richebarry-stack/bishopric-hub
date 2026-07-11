import { legalName } from './displayName';
import { buildNameIndex, matchMember, type NameIndexMember } from './nameMatch';

/**
 * Resolves a user-entered name to the canonical "Lastname, Firstname" format
 * used in the database by matching against the ward members list.
 *
 * Accepts "Firstname Lastname", "Lastname, Firstname", and preferred-name
 * variants of either order.
 * Returns the matched member's legal name, or the original trimmed string if
 * no match (e.g. missionaries, visitors).
 */
export function resolveMemberName(raw: string, members: NameIndexMember[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const index = buildNameIndex(members);
  const match = matchMember(index, trimmed);
  return match ? legalName(match) : trimmed;
}
