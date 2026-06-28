import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { MissionaryPipeline as MissionaryType, SacramentSpeaker } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields';
import { MISSIONARY_STATUSES, MISSIONARY_TEMPLE_STATUSES } from '../lib/constants';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  '0-Not at this time': { bg: 'bg-red-100', text: 'text-red-700' },
  '1-Considering': { bg: 'bg-blue-100', text: 'text-blue-700' },
  '2-Papers Started': { bg: 'bg-green-100', text: 'text-green-700' },
  '3-Papers Submitted': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  '4-Call Accepted': { bg: 'bg-pink-100', text: 'text-pink-700' },
  '5-Serving': { bg: 'bg-orange-100', text: 'text-orange-700' },
  '6-Released': { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const EMPTY: Partial<MissionaryType> = {
  who: '', notes: '', mission_call: '', temple_status: '', next_steps: '',
  report_date: '', release_date: '', status: '1-Considering',
};

function toDateOnly(v: string): string {
  if (!v) return '';
  return v.slice(0, 10);
}

type Occasion = 'Farewell' | 'Homecoming';

export default function MissionaryPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<MissionaryType>('missionary-pipeline');
  const {
    rows: speakers,
    create: createSpeaker,
    update: updateSpeaker,
    remove: removeSpeaker,
  } = useTable<SacramentSpeaker>('sacrament-speakers');
  const [editing, setEditing] = useState<Partial<MissionaryType> | null>(null);
  // Talk dates and topics live on linked sacrament_speakers rows; held transiently while the modal is open.
  const [farewellDate, setFarewellDate] = useState('');
  const [farewellTopic, setFarewellTopic] = useState('');
  const [homecomingDate, setHomecomingDate] = useState('');
  const [homecomingTopic, setHomecomingTopic] = useState('');

  const linkedSpeaker = (missionaryId: number | undefined, occasion: Occasion) =>
    missionaryId ? speakers.find(s => s.missionary_id === missionaryId && s.speaker_occasion === occasion) : undefined;

  const openEdit = (m: MissionaryType) => {
    const fw = linkedSpeaker(m.id, 'Farewell');
    const hc = linkedSpeaker(m.id, 'Homecoming');
    setFarewellDate(toDateOnly(fw?.meeting_date || ''));
    setFarewellTopic(fw?.topic || '');
    setHomecomingDate(toDateOnly(hc?.meeting_date || ''));
    setHomecomingTopic(hc?.topic || '');
    setEditing(m);
  };

  const openNew = () => {
    setFarewellDate('');
    setFarewellTopic('');
    setHomecomingDate('');
    setHomecomingTopic('');
    setEditing({ ...EMPTY });
  };

  // Create / update / delete the linked Adult Speaker row to match a talk date.
  const syncTalk = async (missionaryId: number, who: string, occasion: Occasion, date: string, topic: string) => {
    const existing = linkedSpeaker(missionaryId, occasion);
    if (date) {
      if (existing) {
        await updateSpeaker(existing.id, {
          meeting_date: date, speaker: who, speaker_type: 'Adult Speaker', topic,
        });
      } else {
        await createSpeaker({
          meeting_date: date, speaker: who, speaker_type: 'Adult Speaker',
          accepted: 'Called and Accepted', speaking_order: 1,
          topic, notes: '', missionary_id: missionaryId, speaker_occasion: occasion,
        });
      }
    } else if (existing) {
      await removeSpeaker(existing.id);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const who = editing.who || '';
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    let missionaryId = editing.id;
    if (missionaryId) {
      await update(missionaryId, data as Record<string, unknown>);
    } else {
      const created = await create(data as Record<string, unknown>);
      missionaryId = created.id;
    }
    await syncTalk(missionaryId, who, 'Farewell', farewellDate, farewellTopic);
    await syncTalk(missionaryId, who, 'Homecoming', homecomingDate, homecomingTopic);
    setEditing(null);
  };

  const handleStatusChange = async (missionary: MissionaryType, newStatus: string) => {
    await update(missionary.id, { status: newStatus } as Record<string, unknown>);
  };

  const handleDelete = async (missionaryId: number) => {
    for (const occ of ['Farewell', 'Homecoming'] as Occasion[]) {
      const linked = linkedSpeaker(missionaryId, occ);
      if (linked) await removeSpeaker(linked.id);
    }
    await remove(missionaryId);
  };

  const grouped = new Map<string, MissionaryType[]>();
  for (const status of MISSIONARY_STATUSES) {
    grouped.set(status, []);
  }
  for (const r of rows) {
    const status = r.status || 'Unknown';
    if (!grouped.has(status)) grouped.set(status, []);
    grouped.get(status)!.push(r);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Missionary Pipeline</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([status, missionaries]) => (
            <div key={status}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                <StatusBadge status={status} colors={STATUS_COLORS} />
                <span>({missionaries.length})</span>
              </h2>
              {missionaries.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 border-dashed p-3 text-center text-gray-400 text-sm">No missionaries</div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Who</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Mission Call</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Temple</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Report</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Release</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Farewell Talk</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Homecoming Talk</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {missionaries.map(r => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(r)}>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.who}</td>
                          <td className="px-3 py-2">
                            <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => handleStatusChange(r, e.target.value)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs">
                              {MISSIONARY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{r.mission_call}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{r.temple_status}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(r.report_date)}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(r.release_date)}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(linkedSpeaker(r.id, 'Farewell')?.meeting_date || '')}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(linkedSpeaker(r.id, 'Homecoming')?.meeting_date || '')}</td>
                          <td className="px-3 py-2">
                            <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Missionary' : 'New Missionary'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Who" value={editing.who || ''} onChange={v => setEditing({ ...editing, who: v })} required />
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={MISSIONARY_STATUSES} />
            <Input label="Mission Call" value={editing.mission_call || ''} onChange={v => setEditing({ ...editing, mission_call: v })} />
            <Select label="Temple Status" value={editing.temple_status || ''} onChange={v => setEditing({ ...editing, temple_status: v })} options={MISSIONARY_TEMPLE_STATUSES} />
            <Input label="Next Steps" value={editing.next_steps || ''} onChange={v => setEditing({ ...editing, next_steps: v })} />
            <Input label="Report Date" value={toDateOnly(editing.report_date || '')} onChange={v => setEditing({ ...editing, report_date: v })} type="date" />
            <Input label="Release Date" value={toDateOnly(editing.release_date || '')} onChange={v => setEditing({ ...editing, release_date: v })} type="date" />
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sacrament Talks (Adult Speaker)</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Farewell Talk Date" value={farewellDate} onChange={setFarewellDate} type="date" />
                  <Input label="Farewell Topic" value={farewellTopic} onChange={setFarewellTopic} placeholder="Talk topic" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Homecoming Talk Date" value={homecomingDate} onChange={setHomecomingDate} type="date" />
                  <Input label="Homecoming Topic" value={homecomingTopic} onChange={setHomecomingTopic} placeholder="Talk topic" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Setting a date adds this missionary to Sacrament Planning as an Adult Speaker on that Sunday. Clearing it removes the talk. The date and topic stay in sync on both pages.</p>
            </div>
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
