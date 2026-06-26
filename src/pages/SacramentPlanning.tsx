import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { SacramentSpeaker, Prayer, SacramentMusic, SacramentTheme, SacramentAnnouncement } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormFields';
import { SPEAKER_TYPES } from '../lib/constants';

const toDateKey = (d: string) => d ? d.slice(0, 10) : '';

function upcomingSunday(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

const THIS_SUNDAY = upcomingSunday();

export default function SacramentPlanning() {
  const { rows: speakers, create: createSpeaker, update: updateSpeaker, remove: removeSpeaker } = useTable<SacramentSpeaker>('sacrament-speakers');
  const { rows: prayers, create: createPrayer, update: updatePrayer, remove: removePrayer } = useTable<Prayer>('prayers');
  const { rows: music, create: createMusic, update: updateMusic, remove: removeMusic } = useTable<SacramentMusic>('sacrament-music');
  const { rows: themes, create: createTheme, update: updateTheme, remove: removeTheme } = useTable<SacramentTheme>('sacrament-themes');
  const { rows: announcements, create: createAnnouncement, update: updateAnnouncement, remove: removeAnnouncement } = useTable<SacramentAnnouncement>('sacrament-announcements');

  const [tab, setTab] = useState<'agenda' | 'speakers' | 'prayers' | 'music' | 'themes' | 'announcements'>('agenda');
  const [viewDate, setViewDate] = useState(() => new Date());
  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goPrev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  const [editSpeaker, setEditSpeaker] = useState<Partial<SacramentSpeaker> | null>(null);
  const [editPrayer, setEditPrayer] = useState<Partial<Prayer> | null>(null);
  const [editMusic, setEditMusic] = useState<Partial<SacramentMusic> | null>(null);
  const [editTheme, setEditTheme] = useState<Partial<SacramentTheme> | null>(null);
  const [editAnnouncement, setEditAnnouncement] = useState<Partial<SacramentAnnouncement> | null>(null);
  const [agendaDate, setAgendaDate] = useState<string | null>(null);

  const meetingDates = useMemo(() => {
    const dates = new Set<string>();
    speakers.forEach(s => { const k = toDateKey(s.meeting_date); if (k) dates.add(k); });
    prayers.forEach(p => { const k = toDateKey(p.meeting_date); if (k) dates.add(k); });
    music.forEach(m => { const k = toDateKey(m.meeting_date); if (k) dates.add(k); });
    themes.forEach(t => { const k = toDateKey(t.meeting_date); if (k) dates.add(k); });
    announcements.forEach(a => { const k = toDateKey(a.meeting_date); if (k) dates.add(k); });
    return [...dates].sort().reverse();
  }, [speakers, prayers, music, themes, announcements]);

  // All Sundays in the visible month (so we show empty cards for unplanned weeks)
  const monthSundays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const sundays: string[] = [];
    const d = new Date(year, month, 1);
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
    while (d.getMonth() === month) {
      sundays.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 7);
    }
    return sundays;
  }, [viewDate]);

  const monthDates = useMemo(() => {
    const existing = meetingDates.filter(d => d.startsWith(monthPrefix));
    const all = new Set([...existing, ...monthSundays]);
    return [...all].sort().reverse();
  }, [meetingDates, monthSundays, monthPrefix]);

  const tabs = [
    { key: 'agenda', label: 'Agenda View' },
    { key: 'speakers', label: 'Speakers' },
    { key: 'prayers', label: 'Prayers' },
    { key: 'music', label: 'Music' },
    { key: 'themes', label: 'Themes' },
    { key: 'announcements', label: 'Announcements' },
  ] as const;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Sacrament Meeting Planning</h1>

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agenda' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={goToday} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Today</button>
            <button onClick={goPrev} className="px-2 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">‹</button>
            <button onClick={goNext} className="px-2 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">›</button>
            <span className="font-semibold text-gray-800 ml-1">{monthLabel}</span>
          </div>
          <div className="space-y-4">
          {monthDates.map(date => {
            const dateSpeakers = speakers.filter(s => toDateKey(s.meeting_date) === date).sort((a, b) => (a.speaking_order || 0) - (b.speaking_order || 0));
            const datePrayers = prayers.filter(p => toDateKey(p.meeting_date) === date);
            const dateMusic = music.find(m => toDateKey(m.meeting_date) === date);
            const dateTheme = themes.find(t => toDateKey(t.meeting_date) === date);
            const dateAnnouncements = announcements.filter(a => toDateKey(a.meeting_date) === date);
            return (
              <div key={date} onClick={() => setAgendaDate(date)}
                className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-900 text-lg">{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
                  <span className="text-xs text-blue-500">Click to edit ✎</span>
                </div>
                {dateTheme && (
                  <div className="mb-3">
                    <span className="text-sm font-medium text-gray-500">Theme:</span>
                    <span className="text-sm text-gray-700 ml-2">{dateTheme.theme}</span>
                    {dateTheme.conducting && <span className="text-sm text-gray-500 ml-3">Conducting: {dateTheme.conducting}</span>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <h3 className="font-medium text-gray-600 mb-1">Music</h3>
                    {dateMusic ? (
                      <div className="space-y-0.5 text-gray-700">
                        <p>Opening: {dateMusic.opening_hymn || '—'}</p>
                        <p>Sacrament: {dateMusic.sacrament_hymn || '—'}</p>
                        {dateMusic.rest_special && <p>Special: {dateMusic.rest_special}</p>}
                        <p>Closing: {dateMusic.closing_hymn || '—'}</p>
                        {dateMusic.chorister && <p className="text-gray-500">Chorister: {dateMusic.chorister}</p>}
                        {dateMusic.organist && <p className="text-gray-500">Organist: {dateMusic.organist}</p>}
                      </div>
                    ) : <p className="text-gray-400">Not planned</p>}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-600 mb-1">Speakers</h3>
                    {dateSpeakers.length > 0 ? dateSpeakers.map(s => (
                      <p key={s.id} className="text-gray-700">
                        {s.speaker} <span className="text-gray-400">({s.speaker_type})</span>
                        {s.topic && <span className="text-gray-500"> — {s.topic}</span>}
                      </p>
                    )) : <p className="text-gray-400">No speakers</p>}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-600 mb-1">Prayers</h3>
                    {datePrayers.length > 0 ? datePrayers.map(p => (
                      <p key={p.id} className="text-gray-700">{p.opening_closing}: {p.name}</p>
                    )) : <p className="text-gray-400">Not assigned</p>}
                  </div>
                </div>
                {dateAnnouncements.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 text-sm">
                    <h3 className="font-medium text-gray-600 mb-1">Announcements & Ward Business</h3>
                    <ul className="space-y-1">
                      {dateAnnouncements.map(a => (
                        <li key={a.id} className="text-gray-700">
                          <span className="font-medium">{a.title}</span>
                          {a.notes && <span className="text-gray-500"> — {a.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
          {monthDates.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No Sundays found for {monthLabel}</p>}
          </div>
        </div>
      )}

      {tab === 'speakers' && (
        <CrudTable
          rows={speakers}
          columns={[
            { key: 'meeting_date', label: 'Date', date: true },
            { key: 'speaker', label: 'Speaker' },
            { key: 'speaker_type', label: 'Type' },
            { key: 'topic', label: 'Topic' },
            { key: 'accepted', label: 'Status' },
          ]}
          onAdd={() => setEditSpeaker({ meeting_date: '', speaker: '', speaker_type: 'Adult Speaker', accepted: '', speaking_order: 1, topic: '', notes: '' })}
          onEdit={setEditSpeaker}
          onDelete={removeSpeaker}
        />
      )}

      {tab === 'prayers' && (
        <CrudTable
          rows={prayers}
          columns={[
            { key: 'meeting_date', label: 'Date', date: true },
            { key: 'name', label: 'Name' },
            { key: 'opening_closing', label: 'Opening/Closing' },
          ]}
          onAdd={() => setEditPrayer({ meeting_date: '', name: '', opening_closing: 'Opening', notes: '' })}
          onEdit={setEditPrayer}
          onDelete={removePrayer}
        />
      )}

      {tab === 'music' && (
        <CrudTable
          rows={music}
          columns={[
            { key: 'meeting_date', label: 'Date', date: true },
            { key: 'opening_hymn', label: 'Opening' },
            { key: 'sacrament_hymn', label: 'Sacrament' },
            { key: 'closing_hymn', label: 'Closing' },
            { key: 'chorister', label: 'Chorister' },
          ]}
          onAdd={() => setEditMusic({ meeting_date: '', chorister: '', organist: '', opening_hymn: '', sacrament_hymn: '', rest_special: '', closing_hymn: '', notes: '' })}
          onEdit={setEditMusic}
          onDelete={removeMusic}
        />
      )}

      {tab === 'themes' && (
        <CrudTable
          rows={themes}
          columns={[
            { key: 'meeting_date', label: 'Date', date: true },
            { key: 'theme', label: 'Theme' },
            { key: 'conducting', label: 'Conducting' },
            { key: 'references_text', label: 'References' },
          ]}
          onAdd={() => setEditTheme({ meeting_date: '', theme: '', references_text: '', conducting: '', meeting_link: '' })}
          onEdit={setEditTheme}
          onDelete={removeTheme}
        />
      )}

      {tab === 'announcements' && (
        <CrudTable
          rows={announcements}
          columns={[
            { key: 'meeting_date', label: 'Date', date: true },
            { key: 'title', label: 'Title' },
            { key: 'notes', label: 'Details' },
          ]}
          onAdd={() => setEditAnnouncement({ meeting_date: '', title: '', notes: '' })}
          onEdit={setEditAnnouncement}
          onDelete={removeAnnouncement}
        />
      )}

      {/* Full agenda editor (click a Sunday in Agenda View) */}
      {agendaDate && (
        <AgendaModal
          key={agendaDate}
          date={agendaDate}
          onClose={() => setAgendaDate(null)}
          speakers={speakers} prayers={prayers} music={music} themes={themes} announcements={announcements}
          createSpeaker={createSpeaker} updateSpeaker={updateSpeaker} removeSpeaker={removeSpeaker}
          createPrayer={createPrayer} updatePrayer={updatePrayer} removePrayer={removePrayer}
          createMusic={createMusic} updateMusic={updateMusic} removeMusic={removeMusic}
          createTheme={createTheme} updateTheme={updateTheme} removeTheme={removeTheme}
          createAnnouncement={createAnnouncement} updateAnnouncement={updateAnnouncement} removeAnnouncement={removeAnnouncement}
        />
      )}

      {/* Speaker modal */}
      <Modal open={!!editSpeaker} onClose={() => setEditSpeaker(null)} title={editSpeaker?.id ? 'Edit Speaker' : 'New Speaker'}>
        {editSpeaker && (
          <form onSubmit={async e => { e.preventDefault(); const d = { ...editSpeaker }; delete (d as Record<string, unknown>).id; editSpeaker.id ? await updateSpeaker(editSpeaker.id, d as Record<string, unknown>) : await createSpeaker(d as Record<string, unknown>); setEditSpeaker(null); }} className="space-y-3">
            <Input label="Meeting Date" value={toDateKey(editSpeaker.meeting_date || '')} onChange={v => setEditSpeaker({ ...editSpeaker, meeting_date: v })} type="date" required />
            <Input label="Speaker" value={editSpeaker.speaker || ''} onChange={v => setEditSpeaker({ ...editSpeaker, speaker: v })} required />
            <Select label="Speaker Type" value={editSpeaker.speaker_type || ''} onChange={v => setEditSpeaker({ ...editSpeaker, speaker_type: v })} options={SPEAKER_TYPES} />
            <Input label="Topic" value={editSpeaker.topic || ''} onChange={v => setEditSpeaker({ ...editSpeaker, topic: v })} />
            <Select label="Accepted" value={editSpeaker.accepted || ''} onChange={v => setEditSpeaker({ ...editSpeaker, accepted: v })} options={['Considering', 'Called and Accepted']} />
            <Input label="Speaking Order" value={String(editSpeaker.speaking_order || '')} onChange={v => setEditSpeaker({ ...editSpeaker, speaking_order: Number(v) })} type="number" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditSpeaker(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Prayer modal */}
      <Modal open={!!editPrayer} onClose={() => setEditPrayer(null)} title={editPrayer?.id ? 'Edit Prayer' : 'New Prayer'}>
        {editPrayer && (
          <form onSubmit={async e => { e.preventDefault(); const d = { ...editPrayer }; delete (d as Record<string, unknown>).id; editPrayer.id ? await updatePrayer(editPrayer.id, d as Record<string, unknown>) : await createPrayer(d as Record<string, unknown>); setEditPrayer(null); }} className="space-y-3">
            <Input label="Meeting Date" value={toDateKey(editPrayer.meeting_date || '')} onChange={v => setEditPrayer({ ...editPrayer, meeting_date: v })} type="date" required />
            <Input label="Name" value={editPrayer.name || ''} onChange={v => setEditPrayer({ ...editPrayer, name: v })} required />
            <Select label="Opening/Closing" value={editPrayer.opening_closing || ''} onChange={v => setEditPrayer({ ...editPrayer, opening_closing: v })} options={['Opening', 'Closing']} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditPrayer(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Music modal */}
      <Modal open={!!editMusic} onClose={() => setEditMusic(null)} title={editMusic?.id ? 'Edit Music' : 'New Music'}>
        {editMusic && (
          <form onSubmit={async e => { e.preventDefault(); const d = { ...editMusic }; delete (d as Record<string, unknown>).id; editMusic.id ? await updateMusic(editMusic.id, d as Record<string, unknown>) : await createMusic(d as Record<string, unknown>); setEditMusic(null); }} className="space-y-3">
            <Input label="Meeting Date" value={toDateKey(editMusic.meeting_date || '')} onChange={v => setEditMusic({ ...editMusic, meeting_date: v })} type="date" required />
            <Input label="Chorister" value={editMusic.chorister || ''} onChange={v => setEditMusic({ ...editMusic, chorister: v })} />
            <Input label="Organist" value={editMusic.organist || ''} onChange={v => setEditMusic({ ...editMusic, organist: v })} />
            <Input label="Opening Hymn" value={editMusic.opening_hymn || ''} onChange={v => setEditMusic({ ...editMusic, opening_hymn: v })} />
            <Input label="Sacrament Hymn" value={editMusic.sacrament_hymn || ''} onChange={v => setEditMusic({ ...editMusic, sacrament_hymn: v })} />
            <Input label="Rest/Special" value={editMusic.rest_special || ''} onChange={v => setEditMusic({ ...editMusic, rest_special: v })} />
            <Input label="Closing Hymn" value={editMusic.closing_hymn || ''} onChange={v => setEditMusic({ ...editMusic, closing_hymn: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditMusic(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Theme modal */}
      <Modal open={!!editTheme} onClose={() => setEditTheme(null)} title={editTheme?.id ? 'Edit Theme' : 'New Theme'}>
        {editTheme && (
          <form onSubmit={async e => { e.preventDefault(); const d = { ...editTheme }; delete (d as Record<string, unknown>).id; editTheme.id ? await updateTheme(editTheme.id, d as Record<string, unknown>) : await createTheme(d as Record<string, unknown>); setEditTheme(null); }} className="space-y-3">
            <Input label="Meeting Date" value={toDateKey(editTheme.meeting_date || '')} onChange={v => setEditTheme({ ...editTheme, meeting_date: v })} type="date" required />
            <Input label="Theme" value={editTheme.theme || ''} onChange={v => setEditTheme({ ...editTheme, theme: v })} />
            <Textarea label="References" value={editTheme.references_text || ''} onChange={v => setEditTheme({ ...editTheme, references_text: v })} />
            <Input label="Conducting" value={editTheme.conducting || ''} onChange={v => setEditTheme({ ...editTheme, conducting: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTheme(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Announcement modal */}
      <Modal open={!!editAnnouncement} onClose={() => setEditAnnouncement(null)} title={editAnnouncement?.id ? 'Edit Announcement' : 'New Announcement'}>
        {editAnnouncement && (
          <form onSubmit={async e => { e.preventDefault(); const d = { ...editAnnouncement }; delete (d as Record<string, unknown>).id; editAnnouncement.id ? await updateAnnouncement(editAnnouncement.id, d as Record<string, unknown>) : await createAnnouncement(d as Record<string, unknown>); setEditAnnouncement(null); }} className="space-y-3">
            <Input label="Meeting Date" value={toDateKey(editAnnouncement.meeting_date || '')} onChange={v => setEditAnnouncement({ ...editAnnouncement, meeting_date: v })} type="date" required />
            <Input label="Title" value={editAnnouncement.title || ''} onChange={v => setEditAnnouncement({ ...editAnnouncement, title: v })} required />
            <Textarea label="Details" value={editAnnouncement.notes || ''} onChange={v => setEditAnnouncement({ ...editAnnouncement, notes: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditAnnouncement(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function TableSection<T extends { id: number }>({
  label, rows, columns, onEdit, onDelete, accent,
}: {
  label: string;
  rows: T[];
  columns: { key: string; label: string; date?: boolean }[];
  onEdit: (row: T) => void;
  onDelete: (id: number) => void;
  accent?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={`text-xs font-bold uppercase tracking-widest px-1 py-2 ${accent ?? 'text-gray-400'}`}>{label}</div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map(c => <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-600">{c.label}</th>)}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(r)}>
                {columns.map(c => {
                  const raw = String((r as Record<string, unknown>)[c.key] || '');
                  return <td key={c.key} className="px-3 py-2 text-gray-700">{c.date ? raw.slice(0, 10) : raw}</td>;
                })}
                <td className="px-3 py-2">
                  <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrudTable<T extends { id: number }>({ rows, columns, onAdd, onEdit, onDelete }: {
  rows: T[];
  columns: { key: string; label: string; date?: boolean }[];
  onAdd: () => void;
  onEdit: (row: T) => void;
  onDelete: (id: number) => void;
}) {
  const getDate = (r: T) => String((r as Record<string, unknown>)['meeting_date'] || '').slice(0, 10);

  const current = rows.filter(r => getDate(r) === THIS_SUNDAY);
  const future  = rows.filter(r => getDate(r) > THIS_SUNDAY).sort((a, b) => getDate(a) < getDate(b) ? -1 : 1);
  const past    = rows.filter(r => getDate(r) < THIS_SUNDAY).sort((a, b) => getDate(a) > getDate(b) ? -1 : 1);

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={onAdd} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      {current.length === 0 && future.length === 0 && past.length === 0 && (
        <p className="text-gray-400 text-sm italic text-center py-6">Nothing recorded yet.</p>
      )}
      <TableSection label="This Sunday" rows={current} columns={columns} onEdit={onEdit} onDelete={onDelete} accent="text-blue-600" />
      <TableSection label="Upcoming" rows={future} columns={columns} onEdit={onEdit} onDelete={onDelete} accent="text-green-600" />
      <TableSection label="Past" rows={past} columns={columns} onEdit={onEdit} onDelete={onDelete} />
    </>
  );
}

type CreateFn<T> = (data: Record<string, unknown>) => Promise<T>;
type UpdateFn<T> = (id: number, data: Record<string, unknown>) => Promise<T>;
type RemoveFn = (id: number) => Promise<unknown>;

interface AgendaModalProps {
  date: string;
  onClose: () => void;
  speakers: SacramentSpeaker[];
  prayers: Prayer[];
  music: SacramentMusic[];
  themes: SacramentTheme[];
  announcements: SacramentAnnouncement[];
  createSpeaker: CreateFn<SacramentSpeaker>; updateSpeaker: UpdateFn<SacramentSpeaker>; removeSpeaker: RemoveFn;
  createPrayer: CreateFn<Prayer>; updatePrayer: UpdateFn<Prayer>; removePrayer: RemoveFn;
  createMusic: CreateFn<SacramentMusic>; updateMusic: UpdateFn<SacramentMusic>; removeMusic: RemoveFn;
  createTheme: CreateFn<SacramentTheme>; updateTheme: UpdateFn<SacramentTheme>; removeTheme: RemoveFn;
  createAnnouncement: CreateFn<SacramentAnnouncement>; updateAnnouncement: UpdateFn<SacramentAnnouncement>; removeAnnouncement: RemoveFn;
}

type SpeakerRow = { id?: number; speaker: string; speaker_type: string; topic: string; accepted: string };
type AnnounceRow = { id?: number; title: string; notes: string };

function AgendaModal(props: AgendaModalProps) {
  const { date, onClose } = props;
  const dk = (d: string) => (d ? d.slice(0, 10) : '');

  const existingTheme = props.themes.find(t => dk(t.meeting_date) === date);
  const existingMusic = props.music.find(m => dk(m.meeting_date) === date);
  const existingSpeakers = props.speakers.filter(s => dk(s.meeting_date) === date).sort((a, b) => (a.speaking_order || 0) - (b.speaking_order || 0));
  const existingAnnouncements = props.announcements.filter(a => dk(a.meeting_date) === date);
  const openingExisting = props.prayers.find(p => dk(p.meeting_date) === date && p.opening_closing === 'Opening');
  const closingExisting = props.prayers.find(p => dk(p.meeting_date) === date && p.opening_closing === 'Closing');

  const [theme, setTheme] = useState({ theme: existingTheme?.theme || '', conducting: existingTheme?.conducting || '', references_text: existingTheme?.references_text || '' });
  const [mus, setMus] = useState({
    opening_hymn: existingMusic?.opening_hymn || '', sacrament_hymn: existingMusic?.sacrament_hymn || '',
    rest_special: existingMusic?.rest_special || '', closing_hymn: existingMusic?.closing_hymn || '',
    chorister: existingMusic?.chorister || '', organist: existingMusic?.organist || '',
  });
  const [speakerRows, setSpeakerRows] = useState<SpeakerRow[]>(
    existingSpeakers.map(s => ({ id: s.id, speaker: s.speaker || '', speaker_type: s.speaker_type || 'Adult Speaker', topic: s.topic || '', accepted: s.accepted || '' }))
  );
  const [openingName, setOpeningName] = useState(openingExisting?.name || '');
  const [closingName, setClosingName] = useState(closingExisting?.name || '');
  const [announceRows, setAnnounceRows] = useState<AnnounceRow[]>(
    existingAnnouncements.map(a => ({ id: a.id, title: a.title || '', notes: a.notes || '' }))
  );
  const [saving, setSaving] = useState(false);

  const updateSpeakerRow = (i: number, patch: Partial<SpeakerRow>) =>
    setSpeakerRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateAnnounceRow = (i: number, patch: Partial<AnnounceRow>) =>
    setAnnounceRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Theme
      const themeHas = !!(theme.theme || theme.conducting || theme.references_text);
      const themeData = { meeting_date: date, theme: theme.theme, conducting: theme.conducting, references_text: theme.references_text };
      if (existingTheme && themeHas) await props.updateTheme(existingTheme.id, themeData);
      else if (existingTheme && !themeHas) await props.removeTheme(existingTheme.id);
      else if (!existingTheme && themeHas) await props.createTheme(themeData);

      // Music
      const musHas = Object.values(mus).some(v => v.trim());
      const musData = { meeting_date: date, ...mus };
      if (existingMusic && musHas) await props.updateMusic(existingMusic.id, musData);
      else if (existingMusic && !musHas) await props.removeMusic(existingMusic.id);
      else if (!existingMusic && musHas) await props.createMusic(musData);

      // Speakers (delete removed, upsert the rest, renumber by order)
      const keepSpeakers = speakerRows.filter(r => r.speaker.trim());
      const keepSpeakerIds = new Set(keepSpeakers.filter(r => r.id).map(r => r.id));
      for (const s of existingSpeakers) if (!keepSpeakerIds.has(s.id)) await props.removeSpeaker(s.id);
      for (let i = 0; i < keepSpeakers.length; i++) {
        const r = keepSpeakers[i];
        const data = { meeting_date: date, speaker: r.speaker, speaker_type: r.speaker_type || 'Adult Speaker', topic: r.topic, accepted: r.accepted, speaking_order: i + 1 };
        if (r.id) await props.updateSpeaker(r.id, data); else await props.createSpeaker(data);
      }

      // Prayers (opening / closing)
      const syncPrayer = async (label: string, name: string, existing?: Prayer) => {
        if (name.trim()) {
          const data = { meeting_date: date, name, opening_closing: label };
          if (existing) await props.updatePrayer(existing.id, data); else await props.createPrayer(data);
        } else if (existing) await props.removePrayer(existing.id);
      };
      await syncPrayer('Opening', openingName, openingExisting);
      await syncPrayer('Closing', closingName, closingExisting);

      // Announcements
      const keepAnnounce = announceRows.filter(r => r.title.trim());
      const keepAnnounceIds = new Set(keepAnnounce.filter(r => r.id).map(r => r.id));
      for (const a of existingAnnouncements) if (!keepAnnounceIds.has(a.id)) await props.removeAnnouncement(a.id);
      for (const r of keepAnnounce) {
        const data = { meeting_date: date, title: r.title, notes: r.notes };
        if (r.id) await props.updateAnnouncement(r.id, data); else await props.createAnnouncement(data);
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = `Agenda — ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-5">

        {/* Theme */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Theme</h3>
          <Input label="Theme" value={theme.theme} onChange={v => setTheme({ ...theme, theme: v })} />
          <Input label="Conducting" value={theme.conducting} onChange={v => setTheme({ ...theme, conducting: v })} />
          <Textarea label="References" value={theme.references_text} onChange={v => setTheme({ ...theme, references_text: v })} rows={2} />
        </section>

        {/* Music */}
        <section className="space-y-3 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Music</h3>
          <Input label="Opening Hymn" value={mus.opening_hymn} onChange={v => setMus({ ...mus, opening_hymn: v })} />
          <Input label="Sacrament Hymn" value={mus.sacrament_hymn} onChange={v => setMus({ ...mus, sacrament_hymn: v })} />
          <Input label="Rest/Special" value={mus.rest_special} onChange={v => setMus({ ...mus, rest_special: v })} />
          <Input label="Closing Hymn" value={mus.closing_hymn} onChange={v => setMus({ ...mus, closing_hymn: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Chorister" value={mus.chorister} onChange={v => setMus({ ...mus, chorister: v })} />
            <Input label="Organist" value={mus.organist} onChange={v => setMus({ ...mus, organist: v })} />
          </div>
        </section>

        {/* Speakers */}
        <section className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Speakers</h3>
            <button type="button" onClick={() => setSpeakerRows(r => [...r, { speaker: '', speaker_type: 'Adult Speaker', topic: '', accepted: '' }])}
              className="text-xs text-blue-600 hover:text-blue-800">+ Add speaker</button>
          </div>
          {speakerRows.length === 0 && <p className="text-xs text-gray-400">No speakers yet.</p>}
          {speakerRows.map((r, i) => (
            <div key={i} className="rounded-md border border-gray-200 p-3 space-y-2 relative">
              <button type="button" onClick={() => setSpeakerRows(rows => rows.filter((_, idx) => idx !== i))}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-sm leading-none">×</button>
              <Input label={`Speaker ${i + 1}`} value={r.speaker} onChange={v => updateSpeakerRow(i, { speaker: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" value={r.speaker_type} onChange={v => updateSpeakerRow(i, { speaker_type: v })} options={SPEAKER_TYPES} />
                <Select label="Accepted" value={r.accepted} onChange={v => updateSpeakerRow(i, { accepted: v })} options={['Considering', 'Called and Accepted']} />
              </div>
              <Input label="Topic" value={r.topic} onChange={v => updateSpeakerRow(i, { topic: v })} />
            </div>
          ))}
        </section>

        {/* Prayers */}
        <section className="space-y-3 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Prayers</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Opening" value={openingName} onChange={setOpeningName} />
            <Input label="Closing" value={closingName} onChange={setClosingName} />
          </div>
        </section>

        {/* Announcements */}
        <section className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Announcements & Ward Business</h3>
            <button type="button" onClick={() => setAnnounceRows(r => [...r, { title: '', notes: '' }])}
              className="text-xs text-blue-600 hover:text-blue-800">+ Add</button>
          </div>
          {announceRows.length === 0 && <p className="text-xs text-gray-400">None.</p>}
          {announceRows.map((r, i) => (
            <div key={i} className="rounded-md border border-gray-200 p-3 space-y-2 relative">
              <button type="button" onClick={() => setAnnounceRows(rows => rows.filter((_, idx) => idx !== i))}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-sm leading-none">×</button>
              <Input label="Title" value={r.title} onChange={v => updateAnnounceRow(i, { title: v })} />
              <Textarea label="Details" value={r.notes} onChange={v => updateAnnounceRow(i, { notes: v })} rows={2} />
            </div>
          ))}
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Agenda'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
