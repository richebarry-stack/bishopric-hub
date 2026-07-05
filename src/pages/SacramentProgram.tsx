import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { SacramentSpeaker, Prayer, SacramentMusic, SacramentTheme, SacramentAnnouncement } from '../lib/api';
import { useAuth } from '../lib/auth';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function thisSunday(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return localDateStr(d);
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return localDateStr(d);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const toKey = (s: string) => (s ? s.slice(0, 10) : '');

export default function SacramentProgram() {
  const { guestType } = useAuth();
  const isSacGuest = guestType === 'sac';
  const currentSunday = thisSunday();
  const [date, setDate] = useState(currentSunday);

  const { rows: speakers, isLoading: spLoad } = useTable<SacramentSpeaker>('sacrament-speakers');
  const { rows: prayers,  isLoading: prLoad } = useTable<Prayer>('prayers');
  const { rows: music,    isLoading: muLoad } = useTable<SacramentMusic>('sacrament-music');
  const { rows: themes,   isLoading: thLoad } = useTable<SacramentTheme>('sacrament-themes');
  const { rows: announcements, isLoading: anLoad } = useTable<SacramentAnnouncement>('sacrament-announcements');

  const isLoading = spLoad || prLoad || muLoad || thLoad || anLoad;

  const theme   = useMemo(() => themes.find(t => toKey(t.meeting_date) === date), [themes, date]);
  const mus     = useMemo(() => music.find(m => toKey(m.meeting_date) === date), [music, date]);
  const dateSpeakers = useMemo(
    () => speakers.filter(s => toKey(s.meeting_date) === date).sort((a, b) => (a.speaking_order ?? 0) - (b.speaking_order ?? 0)),
    [speakers, date]
  );
  const opening = useMemo(() => prayers.find(p => toKey(p.meeting_date) === date && p.opening_closing === 'Opening'), [prayers, date]);
  const closing = useMemo(() => prayers.find(p => toKey(p.meeting_date) === date && p.opening_closing === 'Closing'), [prayers, date]);
  const dateAnnouncements = useMemo(() => announcements.filter(a => toKey(a.meeting_date) === date), [announcements, date]);

  const hasContent = !!(theme || mus || dateSpeakers.length || opening || closing || (!isSacGuest && dateAnnouncements.length));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Sacrament Program</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setDate(d => addWeeks(d, -1))}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
          ‹ Prev
        </button>
        <div className="flex-1 text-center font-semibold text-gray-800">{formatDate(date)}</div>
        <button
          onClick={() => setDate(d => addWeeks(d, 1))}
          disabled={isSacGuest && date >= currentSunday}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
          Next ›
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-8">Loading…</p>
      ) : !hasContent ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">Nothing planned yet for this Sunday.</p>
          <p className="text-sm mt-1">Check back closer to the meeting date.</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Theme + Conducting */}
          {theme && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Theme</h2>
              {theme.theme && <p className="text-gray-800 font-medium">{theme.theme}</p>}
              {theme.conducting && (
                <p className="text-sm text-gray-600 mt-1">Conducting: {theme.conducting}</p>
              )}
              {theme.references_text && (
                <p className="text-sm text-gray-500 mt-2 whitespace-pre-line">{theme.references_text}</p>
              )}
            </section>
          )}

          {/* Prayers */}
          {(opening || closing) && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Prayers</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-600">Opening</p>
                  <p className="text-gray-800 mt-0.5">{opening?.name || <span className="text-gray-400">TBD</span>}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-600">Closing</p>
                  <p className="text-gray-800 mt-0.5">{closing?.name || <span className="text-gray-400">TBD</span>}</p>
                </div>
              </div>
            </section>
          )}

          {/* Music */}
          {mus && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Music</h2>
              <div className="space-y-1.5 text-sm">
                {mus.opening_hymn  && <Row label="Opening Hymn"   value={mus.opening_hymn} />}
                {mus.sacrament_hymn && <Row label="Sacrament Hymn" value={mus.sacrament_hymn} />}
                {mus.rest_special   && <Row label="Special Music"  value={mus.rest_special} />}
                {mus.closing_hymn  && <Row label="Closing Hymn"   value={mus.closing_hymn} />}
                {(mus.chorister || mus.organist) && (
                  <div className="pt-2 mt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-gray-500">
                    {mus.chorister && <Row label="Chorister" value={mus.chorister} />}
                    {mus.organist  && <Row label="Organist"  value={mus.organist} />}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Speakers */}
          {dateSpeakers.length > 0 && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Speakers</h2>
              <div className="space-y-3">
                {dateSpeakers.map(s => (
                  <div key={s.id} className="text-sm">
                    <span className="font-medium text-gray-800">{s.speaker}</span>
                    {s.speaker_type && s.speaker_type !== 'Adult Speaker' && (
                      <span className="text-gray-500 ml-2">({s.speaker_type})</span>
                    )}
                    {s.topic && <p className="text-gray-600 mt-0.5 italic">"{s.topic}"</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Announcements (no ward/stake business) */}
          {!isSacGuest && dateAnnouncements.length > 0 && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Announcements</h2>
              <ul className="space-y-2">
                {dateAnnouncements.map(a => (
                  <li key={a.id} className="text-sm">
                    <span className="font-medium text-gray-800">{a.title}</span>
                    {a.notes && <p className="text-gray-600 mt-0.5">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
