import { useMemo, useState } from 'react';
import Modal from './Modal';
import { parseCsv, normalizeDate } from '../lib/csv';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { legalName } from '../lib/displayName';

interface RosterMember {
  id: number;
  first_name: string;
  last_name: string;
  active: number;
  birth_date: string | null;
}

interface ParsedRow {
  rawName: string;
  normalizedName: string;
  birthDate: string | null;
}

interface MatchedRow {
  csvRow: ParsedRow;
  member: RosterMember;
}

interface UnresolvedRow {
  csvRow: ParsedRow;
  candidates: RosterMember[];
}

const NAME_COL_HINTS = ['preferred name', 'full name', 'name'];
const DATE_COL_HINTS = ['birth date', 'birthdate', 'date of birth', 'dob', 'birth'];

function findColumn(headers: string[], hints: string[]): number {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const hint of hints) {
    const i = lower.findIndex(h => h === hint);
    if (i !== -1) return i;
  }
  for (const hint of hints) {
    const i = lower.findIndex(h => h.includes(hint));
    if (i !== -1) return i;
  }
  return -1;
}

/** Normalizes "First Last" or "First Middle Last" into "Last, First" to match the roster's stored format. */
function toLastFirst(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  if (s.includes(',')) {
    const [last, first] = s.split(',').map(p => p.trim());
    return first ? `${last}, ${first}` : last;
  }
  const parts = s.split(' ');
  if (parts.length < 2) return s;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

function splitLastFirst(name: string): { last: string; first: string } {
  const [last = '', first = ''] = name.split(',').map(p => p.trim());
  return { last: last.toLowerCase(), first: first.toLowerCase() };
}

/** Same split as splitLastFirst but preserving case, for actual creates. */
function splitLastFirstCased(name: string): { last: string; first: string } {
  const [last = '', first = ''] = name.split(',').map(p => p.trim());
  return { last, first };
}

function firstToken(s: string): string {
  return s.split(/\s+/)[0] || '';
}

export default function WardMemberImport({ roster, onClose, onImported }: {
  roster: RosterMember[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);

  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [toCreate, setToCreate] = useState<ParsedRow[]>([]);
  const [unresolved, setUnresolved] = useState<UnresolvedRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<number, 'create' | number>>({}); // unresolved index -> action
  const [createChecked, setCreateChecked] = useState<Record<number, boolean>>({});
  const [deactivateChecked, setDeactivateChecked] = useState<Record<number, boolean>>({});

  const missing = useMemo(() => {
    const csvNames = new Set([...matched.map(m => m.member.id)]);
    return roster.filter(m => m.active && !csvNames.has(m.id));
  }, [roster, matched]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError('');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { setParseError('No data rows found in this file.'); return; }
      const headers = rows[0];
      const nameCol = findColumn(headers, NAME_COL_HINTS);
      const dateCol = findColumn(headers, DATE_COL_HINTS);
      if (nameCol === -1) { setParseError('Could not find a Name column in this file.'); return; }

      const parsed: ParsedRow[] = rows.slice(1)
        .filter(r => r[nameCol]?.trim())
        .map(r => ({
          rawName: r[nameCol].trim(),
          normalizedName: toLastFirst(r[nameCol]),
          birthDate: dateCol !== -1 ? normalizeDate(r[dateCol] || '') : null,
        }));
      setParsedRows(parsed);

      const byExact = new Map(roster.map(m => [legalName(m).toLowerCase(), m]));
      const matchedRows: MatchedRow[] = [];
      const createRows: ParsedRow[] = [];
      const unresolvedRows: UnresolvedRow[] = [];

      for (const row of parsed) {
        const exact = byExact.get(row.normalizedName.toLowerCase());
        if (exact) { matchedRows.push({ csvRow: row, member: exact }); continue; }

        const { last, first } = splitLastFirst(row.normalizedName);
        const sameLastName = roster.filter(m => m.last_name.toLowerCase() === last);
        const firstTokenMatch = sameLastName.find(m => firstToken(m.first_name.toLowerCase()) === firstToken(first));
        if (firstTokenMatch) { matchedRows.push({ csvRow: row, member: firstTokenMatch }); continue; }

        const prefixMatch = sameLastName.filter(m => {
          const mf = m.first_name.toLowerCase();
          return mf.startsWith(firstToken(first)) || firstToken(first).startsWith(firstToken(mf));
        });
        if (prefixMatch.length === 1) { matchedRows.push({ csvRow: row, member: prefixMatch[0] }); continue; }

        unresolvedRows.push({ csvRow: row, candidates: sameLastName });
      }

      setMatched(matchedRows);
      setToCreate(createRows);
      setUnresolved(unresolvedRows);
      setCreateChecked(Object.fromEntries(createRows.map((_, i) => [i, true])));
      setStep('preview');
    } catch {
      setParseError('Could not read this file. Make sure it is a CSV export.');
    }
  };

  const resolveAsCreate = (i: number) => setResolutions(r => ({ ...r, [i]: 'create' }));
  const resolveAsMatch = (i: number, memberId: number) => setResolutions(r => ({ ...r, [i]: memberId }));

  const finalCreates = useMemo(() => {
    const fromUnresolved = unresolved
      .map((u, i) => ({ u, i }))
      .filter(({ i }) => resolutions[i] === 'create')
      .map(({ u }) => u.csvRow);
    return [...toCreate, ...fromUnresolved].filter((_, i) => createChecked[i] !== false);
  }, [unresolved, resolutions, toCreate, createChecked]);

  const finalMatches = useMemo(() => {
    const fromUnresolved: MatchedRow[] = unresolved
      .map((u, i) => ({ u, i }))
      .filter(({ i }) => typeof resolutions[i] === 'number')
      .map(({ u, i }) => ({ csvRow: u.csvRow, member: roster.find(m => m.id === resolutions[i] as number)! }));
    return [...matched, ...fromUnresolved];
  }, [unresolved, resolutions, matched, roster]);

  const stillUnresolved = unresolved.filter((_, i) => resolutions[i] === undefined);

  const handleConfirm = async () => {
    setImporting(true);
    try {
      const updates = finalMatches
        .filter(m => m.csvRow.birthDate && m.csvRow.birthDate !== m.member.birth_date)
        .map(m => ({ id: m.member.id, birth_date: m.csvRow.birthDate as string }));
      const creates = finalCreates.map(c => {
        const { last, first } = splitLastFirstCased(c.normalizedName);
        return { last_name: last, first_name: first, birth_date: c.birthDate };
      });
      const deactivate = missing.filter(m => deactivateChecked[m.id]).map(m => m.id);

      const result = await api.wardMembers.import({ updates, creates, deactivate });
      toast.success(`Imported: ${result.updated} updated, ${result.created} added, ${result.deactivated} deactivated`);
      onImported();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Import Ward Roster">
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload a CSV export of your ward roster (from LCR or similar). It should have at least a Name column;
            a Birth Date column is optional but lets this update ages automatically.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-600 file:text-white file:text-sm hover:file:bg-blue-700"
          />
          {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-5 max-h-[65vh] overflow-y-auto">
          <p className="text-xs text-gray-400">{fileName} — {parsedRows.length} rows parsed</p>

          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">
              Matched ({finalMatches.length}) — birth dates will be updated where changed
            </h3>
            <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto text-sm divide-y divide-gray-100">
              {finalMatches.length === 0 && <p className="px-3 py-2 text-gray-400">None</p>}
              {finalMatches.map((m, i) => (
                <div key={i} className="px-3 py-1.5 flex justify-between">
                  <span>{legalName(m.member)}</span>
                  {m.csvRow.birthDate && m.csvRow.birthDate !== m.member.birth_date && (
                    <span className="text-gray-400">{m.member.birth_date || '—'} → <span className="text-blue-600">{m.csvRow.birthDate}</span></span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {stillUnresolved.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-amber-700 mb-1.5">
                Needs review ({stillUnresolved.length}) — couldn't confidently match these to the roster
              </h3>
              <div className="border border-amber-200 rounded-md divide-y divide-amber-100 text-sm">
                {unresolved.map((u, i) => resolutions[i] !== undefined ? null : (
                  <div key={i} className="px-3 py-2 flex items-center justify-between gap-2 bg-amber-50">
                    <span className="font-medium">{u.csvRow.normalizedName}</span>
                    <div className="flex items-center gap-2">
                      {u.candidates.map(c => (
                        <button key={c.id} type="button" onClick={() => resolveAsMatch(i, c.id)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-white">
                          Match to "{legalName(c)}"
                        </button>
                      ))}
                      <button type="button" onClick={() => resolveAsCreate(i)}
                        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-white">
                        Create new
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">New members ({finalCreates.length})</h3>
            <div className="border border-gray-200 rounded-md max-h-32 overflow-y-auto text-sm divide-y divide-gray-100">
              {finalCreates.length === 0 && <p className="px-3 py-2 text-gray-400">None</p>}
              {finalCreates.map((c, i) => <div key={i} className="px-3 py-1.5">{c.normalizedName}</div>)}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">
              Not in this file ({missing.length}) — check to deactivate; unchecked members are left alone
            </h3>
            <div className="border border-gray-200 rounded-md max-h-32 overflow-y-auto text-sm divide-y divide-gray-100">
              {missing.length === 0 && <p className="px-3 py-2 text-gray-400">None — every active member was found</p>}
              {missing.map(m => (
                <label key={m.id} className="px-3 py-1.5 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!deactivateChecked[m.id]}
                    onChange={e => setDeactivateChecked(d => ({ ...d, [m.id]: e.target.checked }))} />
                  {legalName(m)}
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={importing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {importing ? 'Importing…' : 'Confirm Import'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
