// Lightweight inline bold using **...** markers (markdown-style).
// Used for fields where the user can bold a portion of the text, e.g. the
// Calling Pipeline member field. Shared between the browser bundle
// (src/lib/richText.tsx re-exports this) and server/worker code
// (functions/api/nameMatch.ts, workers/mailer) so there is one implementation.
export function stripBold(text: string): string {
  return (text || '').replace(/\*\*/g, '');
}
