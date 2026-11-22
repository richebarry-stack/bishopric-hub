import { useEffect, useRef, useState } from 'react';

// Click-to-edit text box used by the council agenda pages: shows **bold** and "- "
// bullets formatted, saves on blur, Ctrl/Cmd+B toggles bold, Enter continues a bullet.

function renderLine(line: string): React.ReactNode {
  if (!line.trim()) return null;
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.length >= 4 && p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function renderRichContent(text: string): React.ReactNode {
  if (!text?.trim()) return <span className="text-gray-300">—</span>;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (idx: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${idx}`} className="list-disc list-inside space-y-0.5">
        {bullets.map((b, j) => <li key={j} className="text-sm text-gray-700">{renderLine(b)}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(line.slice(2));
    } else {
      flushBullets(i);
      const rendered = renderLine(line);
      if (rendered) out.push(<p key={`p-${i}`} className="text-sm text-gray-700">{rendered}</p>);
    }
  });
  flushBullets(lines.length);
  return out.length ? <div className="space-y-1 px-2 py-1.5">{out}</div> : <span className="text-gray-300">—</span>;
}

export default function AutoTextarea({ value, onSave, readOnly, placeholder, minRows = 1 }: {
  value: string; onSave?: (v: string) => void; readOnly?: boolean; placeholder?: string; minRows?: number;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // Shows the formatted text (bold, bullets) until clicked, then the raw text box.
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  const showBox = editing || !local.trim();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [local, showBox]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  // Ctrl+B / Cmd+B wraps the selection in **…** (or unwraps it if already bold).
  const toggleBold = (el: HTMLTextAreaElement) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const sel = local.slice(start, end);
    const before = local.slice(0, start);
    const after = local.slice(end);
    let next: string, selStart: number, selEnd: number;
    if (sel.length >= 4 && sel.startsWith('**') && sel.endsWith('**')) {
      next = before + sel.slice(2, -2) + after;
      selStart = start; selEnd = end - 4;
    } else if (before.endsWith('**') && after.startsWith('**')) {
      next = before.slice(0, -2) + sel + after.slice(2);
      selStart = start - 2; selEnd = end - 2;
    } else {
      next = before + '**' + sel + '**' + after;
      selStart = start + 2; selEnd = end + 2;
    }
    setLocal(next);
    setTimeout(() => { el.selectionStart = selStart; el.selectionEnd = selEnd; }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      if (ref.current) toggleBold(ref.current);
      return;
    }
    if (e.key !== 'Enter') return;
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = local.lastIndexOf('\n', pos - 1) + 1;
    const line = local.slice(lineStart, pos);
    if (line === '- ' || line === '* ') {
      // Empty bullet line — remove it and insert normal newline
      e.preventDefault();
      const next = local.slice(0, lineStart) + '\n' + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = lineStart + 1; }, 0);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Continue bullet on next line
      e.preventDefault();
      const prefix = line.startsWith('- ') ? '- ' : '* ';
      const insert = '\n' + prefix;
      const next = local.slice(0, pos) + insert + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = pos + insert.length; }, 0);
    }
  };

  if (readOnly) {
    return <div className="min-h-[2rem]">{renderRichContent(value)}</div>;
  }

  if (!showBox) {
    return (
      <div role="button" tabIndex={0} title="Click to edit"
        onClick={() => setEditing(true)}
        onFocus={() => setEditing(true)}
        className="w-full cursor-text border border-transparent hover:border-gray-200 rounded min-h-[2rem]">
        {renderRichContent(local)}
      </div>
    );
  }

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => { setEditing(false); if (local !== value && onSave) onSave(local); }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none overflow-hidden bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:outline-none rounded px-2 py-1.5 text-sm placeholder-gray-300 min-h-[2rem]"
      style={{ overflow: 'hidden' }}
    />
  );
}
