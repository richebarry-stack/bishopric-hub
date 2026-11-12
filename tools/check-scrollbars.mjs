#!/usr/bin/env node
// Build-time check: keep scrollbars to where they're truly needed.
//
// Safari (especially on smaller screens, or with "Always show scroll bars" on)
// shows a scrollbar for every box that can scroll, and its "vh" unit is taller
// than the visible area, so viewport-sized boxes scroll when they shouldn't.
// This fails the build on the patterns that cause that:
//
//   1. overflow-scroll / overflow-x-scroll / overflow-y-scroll (and CSS
//      `overflow: scroll`) — always draws a scrollbar, even with nothing to
//      scroll. Use the -auto version, which only scrolls when content overflows.
//   2. h-screen / min-h-screen / max-h-screen and `vh` sizes like max-h-[90vh]
//      or calc(100vh…) — use dvh (h-dvh, max-h-[90dvh]) so the size matches
//      what Safari actually shows.
//   3. A box locked to the window height (h-[calc(100dvh…)]) without a
//      min-height media condition — on short screens its panels each get their
//      own scrollbar. Gate it, e.g. [@media(min-width:1024px)_and_(min-height:56rem)]:h-[…].
//
// A line that genuinely needs one of these can end with the comment `scroll-ok`.
// Run: node tools/check-scrollbars.mjs   (also runs as part of npm run build)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIRS = ['src'];
const EXT = /\.(tsx?|css)$/;

const RULES = [
  {
    re: /\boverflow(-[xy])?-scroll\b|overflow(-[xy])?\s*:\s*scroll|overflow[XY]?\s*:\s*['"]scroll['"]/,
    msg: 'always shows a scrollbar — use overflow-auto (or -x-auto / -y-auto) instead',
  },
  {
    re: /\b(min-|max-)?h-screen\b/,
    msg: 'h-screen is taller than Safari\'s visible area — use the dvh version (h-dvh, min-h-dvh, max-h-dvh)',
  },
  {
    re: /(?<![a-z])\d+(\.\d+)?vh\b/,
    msg: 'vh is taller than Safari\'s visible area — use dvh (e.g. max-h-[90dvh], calc(100dvh-…))',
  },
  {
    test: line => /h-\[calc\(100dvh/.test(line) && !/min-height/.test(line),
    msg: 'locks a box to the window height on every screen — gate it with a min-height media condition so short screens don\'t get a scrollbar per panel',
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

const problems = [];
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/scroll-ok/.test(line)) return;
      for (const rule of RULES) {
        const hit = rule.test ? rule.test(line) : rule.re.test(line);
        if (hit) problems.push(`${relative(ROOT, file)}:${i + 1}  ${rule.msg}\n    ${line.trim().slice(0, 160)}`);
      }
    });
  }
}

if (problems.length) {
  console.error(`Scrollbar check failed (${problems.length}):\n`);
  console.error(problems.join('\n\n'));
  console.error('\nSee tools/check-scrollbars.mjs. Add a `scroll-ok` comment on the line if a scrollbar is truly needed there.');
  process.exit(1);
}
console.log('Scrollbar check passed.');
