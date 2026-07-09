// Minimal RFC-4180 CSV parser: handles quoted fields (with embedded commas,
// newlines, and "" escaped quotes) and both \n and \r\n line endings.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

/** Parses common LCR/membership export date formats into YYYY-MM-DD, or null if unrecognized. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const isoLike = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (isoLike) return `${isoLike[1]}-${isoLike[2].padStart(2, '0')}-${isoLike[3].padStart(2, '0')}`;

  const usLike = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (usLike) return `${usLike[3]}-${usLike[1].padStart(2, '0')}-${usLike[2].padStart(2, '0')}`;

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const textLike = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/) || s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (textLike) {
    const hasDayFirst = /^\d/.test(textLike[1]);
    const day = hasDayFirst ? textLike[1] : textLike[2];
    const monthStr = (hasDayFirst ? textLike[2] : textLike[1]).slice(0, 3).toLowerCase();
    const year = textLike[3];
    const month = months[monthStr];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  return null;
}
