import { displayName } from './displayName';
import { buildNameIndex, matchMember, type NameIndexMember } from './nameMatch';

/**
 * Resolves a user-entered name to the canonical "Lastname, Firstname" format
 * used in the database by matching against the ward members list.
 *
 * Accepts "Firstname Lastname", "Lastname, Firstname", and preferred-name
 * variants of either order.
 * Returns the matched member's display name (preferred name if set, else legal
 * name) so typing a preferred-name variant doesn't get normalized back to the
 * legal name — see hub suggestion #26. Returns the original trimmed string if
 * no match (e.g. missionaries, visitors).
 */
export function resolveMemberName(raw: string, members: NameIndexMember[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const index = buildNameIndex(members);
  const match = matchMember(index, trimmed);
  return match ? displayName(match) : trimmed;
}
