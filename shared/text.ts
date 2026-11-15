// Lightweight inline bold using **...** markers (markdown-style).
// Used for fields where the user can bold a portion of the text, e.g. the
// Calling Pipeline member field. Shared between the browser bundle
// (src/lib/richText.tsx re-exports this) and server/worker code
// (functions/api/nameMatch.ts, workers/mailer) so there is one implementation.
export function stripBold(text: string): string {
  return (text || '').replace(/\*\*/g, '');
}

/** "Last, First" → "First Last" for display (sacrament agendas). Keeps a
 * whole-name **bold** wrapper; text without exactly one comma is left as is. */
export function toFirstLast(raw: string | null | undefined): string {
  const s = (raw || '').trim();
  const bold = s.length > 4 && s.startsWith('**') && s.endsWith('**');
  const inner = bold ? s.slice(2, -2).trim() : s;
  const parts = inner.split(',');
  if (parts.length !== 2) return raw || '';
  const last = parts[0].trim();
  const first = parts[1].trim();
  if (!last || !first) return raw || '';
  const flipped = `${first} ${last}`;
  return bold ? `**${flipped}**` : flipped;
}
