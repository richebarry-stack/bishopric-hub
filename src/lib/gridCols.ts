// Static class names so Tailwind's content scanner can find them — a template
// string like `lg:grid-cols-${n}` would not be detected at build time.
const LG_GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

/** Responsive grid class: single column on small screens, `count` columns at the lg breakpoint. */
export function responsiveGridCols(count: number): string {
  return `grid-cols-1 ${LG_GRID_COLS[count] || 'lg:grid-cols-1'}`;
}
