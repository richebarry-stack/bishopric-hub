/**
 * Resolves a user-entered name to the canonical "Lastname, Firstname" format
 * used in the database by matching against the ward members list.
 *
 * Accepts both "Firstname Lastname" and "Lastname, Firstname" input.
 * Returns the matched member name, or the original trimmed string if no match
 * (e.g. missionaries, visitors).
 */
export function resolveMemberName(raw: string, members: { name: string }[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  // Already in "Lastname, Firstname" format or exact match
  const exact = members.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact.name;

  // Try treating input as "Firstname Lastname" → flip to "Lastname, Firstname"
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const flipped = `${parts.slice(1).join(' ')}, ${parts[0]}`;
    const flippedMatch = members.find(m => m.name.toLowerCase() === flipped.toLowerCase());
    if (flippedMatch) return flippedMatch.name;
  }

  return trimmed;
}
