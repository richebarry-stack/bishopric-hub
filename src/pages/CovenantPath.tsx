import { useEffect, useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { CovenantAgendaRow, CovenantPathExclusion, MissionaryPipeline, PartMemberHousehold, WardMember } from '../lib/api';
import {
  buildCovenantPath, DEFAULT_COVENANT_SETTINGS, PB_STATUSES,
  type CovenantCategory, type CovenantItem, type CovenantSettings,
} from '../../shared/covenantPath';

const SETTINGS_KEY = 'covenant_path_settings';

async function fetchSettings(): Promise<CovenantSettings> {
  try {
    const res = await fetch(`/api/ui-settings/${SETTINGS_KEY}`);
    if (!res.ok) return DEFAULT_COVENANT_SETTINGS;
    return { ...DEFAULT_COVENANT_SETTINGS, ...(await res.json() as Partial<CovenantSettings>) };
  } catch { return DEFAULT_COVENANT_SETTINGS; }
}

async function saveSettings(s: CovenantSettings): Promise<void> {
  await fetch(`/api/ui-settings/${SETTINGS_KEY}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s),
  });
}

function AgeField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  // The parent keys this field by its saved value, so a new value starts a fresh draft.
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= 0 && n <= 120 && n !== value) onSave(n);
    else setDraft(String(value));
  };
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      {label}
      <input type="number" min={0} max={120} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm" />
    </label>
  );
}

/**
 * Covenant Path: members who may be ready for their next ordinance or blessing
 * (baptism, priesthood, patriarchal blessing, endowment, sealing), plus related
 * lists from LCR. Anyone can be hidden from a list, with a reason, and restored.
 */
export default function CovenantPath() {
  const { rows: members, update: updateMember, isLoading } = useTable<WardMember>('ward-members');
  const { rows: households } = useTable<PartMemberHousehold>('part-member-households');
  const { rows: missionaries } = useTable<MissionaryPipeline>('missionary-pipeline');
  const { rows: exclusions, create: createExclusion, remove: removeExclusion } = useTable<CovenantPathExclusion>('covenant-path-exclusions');
  const { rows: agenda, create: createAgenda, update: updateAgenda } = useTable<CovenantAgendaRow>('covenant-path-agenda');
  const agendaFor = (category: string, key: string) => agenda.find(a => a.category === category && a.subject_key === key);
  const toggleAgenda = async (cat: CovenantCategory, it: CovenantItem, field: 'for_bishopric' | 'for_ward_council') => {
    const row = agendaFor(cat.id, it.key);
    if (row) await updateAgenda(row.id, { [field]: row[field] ? 0 : 1 });
    else await createAgenda({ category: cat.id, subject_key: it.key, subject_name: it.name, [field]: 1, note: '' });
  };
  const [settings, setSettings] = useState<CovenantSettings>(DEFAULT_COVENANT_SETTINGS);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState<Set<string>>(new Set());
  const [hiding, setHiding] = useState<{ category: string; key: string; reason: string } | null>(null);

  useEffect(() => { fetchSettings().then(setSettings); }, []);
  const changeSetting = (patch: Partial<CovenantSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const today = new Date().toLocaleDateString('en-CA');
  const categories = useMemo(() => {
    const inPipeline = new Set(missionaries.map(m => m.ward_member_id).filter((id): id is number => id != null));
    return buildCovenantPath(members, households, inPipeline, settings, today);
  }, [members, households, missionaries, settings, today]);

  const excluded = useMemo(() => {
    const map = new Map<string, CovenantPathExclusion>();
    for (const e of exclusions) map.set(`${e.category}|${e.subject_key}`, e);
    return map;
  }, [exclusions]);

  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const lastSynced = members.map(m => (m as WardMember & { ordinances_synced_at?: string }).ordinances_synced_at || '').sort().pop();
  const pmSynced = households[0]?.synced_at;

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const hide = async () => {
    if (!hiding) return;
    const cat = categories.find(c => c.id === hiding.category);
    const it = cat?.items.find(i => i.key === hiding.key);
    await createExclusion({ category: hiding.category, subject_key: hiding.key, subject_name: it?.name || '', reason: hiding.reason.trim() });
    setHiding(null);
  };

  const renderItem = (cat: CovenantCategory, it: CovenantItem, exclusion?: CovenantPathExclusion) => {
    const member = it.memberId ? memberById.get(it.memberId) : undefined;
    const isHiding = hiding?.category === cat.id && hiding.key === it.key;
    return (
      <li key={it.key} className={`px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${exclusion ? 'bg-gray-50 text-gray-500' : ''}`}>
        <span className="font-medium text-gray-900 min-w-0">{it.name}</span>
        <span className="text-xs text-gray-500">{it.detail}</span>
        {exclusion && <span className="text-xs text-gray-500 italic">Hidden{exclusion.reason ? `: ${exclusion.reason}` : ''}</span>}
        <span className="ml-auto flex items-center gap-2">
          {cat.id === 'patriarchal-blessing' && member && !exclusion && (
            <select value={member.pb_status || 'Not received'} aria-label={`Patriarchal blessing status for ${it.name}`}
              onChange={e => updateMember(member.id, { pb_status: e.target.value })}
              className="text-xs rounded-md border border-gray-300 px-1.5 py-1">
              {PB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {!exclusion && (['for_bishopric', 'for_ward_council'] as const).map(field => {
            const on = !!agendaFor(cat.id, it.key)?.[field];
            const label = field === 'for_bishopric' ? 'Bishopric' : 'Ward Council';
            return (
              <button key={field} type="button" aria-pressed={on}
                title={on ? `On the ${label} agenda. Click to take off.` : `Add to upcoming ${label} meetings`}
                onClick={() => toggleAgenda(cat, it, field)}
                className={`text-xs rounded-full border px-2 py-0.5 ${on
                  ? (field === 'for_bishopric' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white')
                  : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}>
                {on ? '✓ ' : '+ '}{label}
              </button>
            );
          })}
          {exclusion ? (
            <button type="button" onClick={() => removeExclusion(exclusion.id)} className="text-xs text-blue-600 hover:underline">Restore</button>
          ) : !isHiding && (
            <button type="button" onClick={() => setHiding({ category: cat.id, key: it.key, reason: '' })} className="text-xs text-gray-500 hover:text-gray-800">Hide</button>
          )}
        </span>
        {(() => {
          const row = !exclusion ? agendaFor(cat.id, it.key) : undefined;
          if (!row || (!row.for_bishopric && !row.for_ward_council)) return null;
          return (
            <input key={`note-${row.id}-${row.updated_at}`} defaultValue={row.note}
              placeholder={row.for_ward_council ? 'Note for the agenda (the ward council sees this)' : 'Note for the agenda (optional)'}
              onBlur={e => { if (e.target.value !== row.note) updateAgenda(row.id, { note: e.target.value }); }}
              className="basis-full rounded-md border border-gray-200 px-2 py-1 text-xs" />
          );
        })()}
        {isHiding && (
          <form className="basis-full flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); hide(); }}>
            <input autoFocus value={hiding.reason} onChange={e => setHiding({ ...hiding, reason: e.target.value })}
              placeholder="Reason (optional), e.g. not accountable"
              className="flex-1 min-w-[12rem] rounded-md border border-gray-300 px-2 py-1 text-sm" />
            <button type="submit" className="text-xs bg-gray-700 text-white rounded px-2.5 py-1">Hide from this list</button>
            <button type="button" onClick={() => setHiding(null)} className="text-xs text-gray-500">Cancel</button>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Covenant Path</h1>
        <p className="text-sm text-gray-500 mt-1">
          Members who may be ready for their next ordinance or blessing, from the nightly LCR sync
          {lastSynced ? ` (last updated ${lastSynced.slice(0, 10)})` : ''}. Patriarchal blessings are tracked here in the hub.
          Hide anyone a list doesn’t fit; they stay hidden until restored.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap gap-x-6 gap-y-2">
        <AgeField key={`pb-${settings.pbAge}`} label="Patriarchal blessing from age" value={settings.pbAge} onSave={v => changeSetting({ pbAge: v })} />
        <AgeField key={`ub-${settings.unbaptizedAge}`} label="Not baptized from age" value={settings.unbaptizedAge} onSave={v => changeSetting({ unbaptizedAge: v })} />
        <AgeField key={`en-${settings.endowmentAge}`} label="Not endowed from age" value={settings.endowmentAge} onSave={v => changeSetting({ endowmentAge: v })} />
      </div>

      {isLoading ? <p className="text-sm text-gray-400">Loading…</p> : categories.map(cat => {
        const visible = cat.items.filter(i => !excluded.has(`${cat.id}|${i.key}`));
        const hidden = cat.items.filter(i => excluded.has(`${cat.id}|${i.key}`));
        const isOpen = open.has(cat.id);
        return (
          <section key={cat.id} className="bg-white rounded-lg border border-gray-200">
            <button type="button" onClick={() => toggle(open, cat.id, setOpen)} aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <span className="text-gray-400 text-xs w-3">{isOpen ? '▼' : '▶'}</span>
              <span className="font-semibold text-gray-800">{cat.title}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${visible.length ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{visible.length}</span>
              {hidden.length > 0 && <span className="text-xs text-gray-400">{hidden.length} hidden</span>}
            </button>
            {isOpen && (
              <div className="border-t border-gray-100">
                <p className="px-4 pt-2 text-xs text-gray-500">
                  {cat.description}
                  {cat.id === 'part-member' && pmSynced ? ` Last updated ${pmSynced.slice(0, 10)}.` : ''}
                </p>
                {visible.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No one on this list right now.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 mt-1">{visible.map(it => renderItem(cat, it))}</ul>
                )}
                {hidden.length > 0 && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <button type="button" onClick={() => toggle(showHidden, cat.id, setShowHidden)} className="text-xs text-blue-600 hover:underline">
                      {showHidden.has(cat.id) ? 'Hide' : 'Show'} {hidden.length} hidden
                    </button>
                    {showHidden.has(cat.id) && (
                      <ul className="divide-y divide-gray-100 mt-1">{hidden.map(it => renderItem(cat, it, excluded.get(`${cat.id}|${it.key}`)))}</ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
