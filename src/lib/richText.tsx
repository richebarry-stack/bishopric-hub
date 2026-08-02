import { type ReactNode } from 'react';

export { stripBold } from '../../shared/text';

// Lightweight inline bold using **...** markers (markdown-style).
// Used for fields where the user can bold a portion of the text, e.g. the
// Calling Pipeline member field.

export function renderRichText(text: string): ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.length >= 4 && p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}
