import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { SacramentSpeaker, SacramentMusic, SacramentTheme, Prayer } from '../lib/api';
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

// Speakers default just before the intermediate musical number when no explicit position is set.
const REST_POS = 9;

export default function SacramentProgram() {
  const { guestType } = useAuth();
  const isSacGuest = guestType === 'sac';
  const currentSunday = thisSunday();
  const [date, setDate] = useState(currentSunday);

  const { rows: speakers, isLoading: spLoad } = useTable<SacramentSpeaker>('sacrament-speakers');
  const { rows: music,    isLoading: muLoad } = useTable<SacramentMusic>('sacrament-music');
  const { rows: themes,   isLoading: thLoad } = useTable<SacramentTheme>('sacrament-themes');
  const { rows: prayers,  isLoading: prLoad } = useTable<Prayer>('prayers');

  const isLoading = spLoad || muLoad || thLoad || prLoad;

  const theme   = useMemo(() => themes.find(t => toKey(t.meeting_date) === date), [themes, date]);
  const mus     = useMemo(() => music.find(m => toKey(m.meeting_date) === date), [music, date]);
  const datePrayers = useMemo(() => prayers.filter(p => toKey(p.meeting_date) === date), [prayers, date]);
  const openingPrayer = datePrayers.find(p => p.opening_closing === 'Opening');
  const closingPrayer = datePrayers.find(p => p.opening_closing === 'Closing');
  const dateSpeakers = useMemo(
    () => speakers.filter(s => toKey(s.meeting_date) === date).sort((a, b) => (a.speaking_order ?? 0) - (b.speaking_order ?? 0)),
    [speakers, date]
  );
  const isFastSunday = !!theme?.is_fast_sunday;

  // Interleave speakers (in order) with the intermediate musical number, using saved
  // position when set, otherwise defaulting speakers just before the musical number —
  // same convention used on the full agenda editor.
  const speakerItems = useMemo(() => {
    const total = dateSpeakers.length;
    const items: { pos: number; kind: 'speaker' | 'rest'; speaker?: SacramentSpeaker }[] = dateSpeakers.map((s, i) => ({
      pos: s.position != null ? s.position : REST_POS - 1 + (i + 1) / (total + 1),
      kind: 'speaker',
      speaker: s,
    }));
    if (mus?.rest_special) items.push({ pos: REST_POS, kind: 'rest' });
    return items.sort((a, b) => a.pos - b.pos);
  }, [dateSpeakers, mus]);

  const hasContent = !!(theme?.presiding || theme?.conducting || mus || dateSpeakers.length || isFastSunday);

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
        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="space-y-1.5 text-sm divide-y divide-gray-100">
            {theme?.presiding  && <Row label="Presiding"  value={theme.presiding} />}
            {theme?.conducting && <Row label="Conducting" value={theme.conducting} />}
            {mus?.chorister    && <Row label="Chorister"   value={mus.chorister} />}
            {mus?.organist     && <Row label="Organist"    value={mus.organist} />}
            {mus?.opening_hymn && <Row label="Opening Hymn" value={mus.opening_hymn} />}
            {openingPrayer     && <Row label="Opening Prayer" value={openingPrayer.name} />}

            <StaticRow label="Ward and Stake Business" />

            {mus?.sacrament_hymn && <Row label="Sacrament Hymn" value={mus.sacrament_hymn} />}

            <StaticRow label="Administration of the Sacrament" />

            {isFastSunday ? (
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Bearing of Testimonies</p>
                <p className="text-sm text-gray-500 italic">Members of the ward bear their testimonies.</p>
              </div>
            ) : (
              speakerItems.map((item, i) =>
                item.kind === 'rest' ? (
                  <div key={`rest-${i}`} className="pt-2 text-gray-500 italic">
                    Musical Number{mus?.rest_special ? `: ${mus.rest_special}` : ''}
                  </div>
                ) : (
                  <div key={item.speaker!.id} className="pt-2">
                    <span className="font-medium text-gray-800">{item.speaker!.speaker}</span>
                    {item.speaker!.speaker_type && item.speaker!.speaker_type !== 'Adult Speaker' && (
                      <span className="text-gray-500 ml-2">({item.speaker!.speaker_type})</span>
                    )}
                    {item.speaker!.topic && <p className="text-gray-600 mt-0.5 italic">"{item.speaker!.topic}"</p>}
                  </div>
                )
              )
            )}

            {mus?.closing_hymn && <Row label="Closing Hymn" value={mus.closing_hymn} />}
            {closingPrayer     && <Row label="Closing Prayer" value={closingPrayer.name} />}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 pt-2 first:pt-0">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function StaticRow({ label }: { label: string }) {
  return (
    <div className="pt-2 text-xs font-bold uppercase tracking-widest text-gray-400">{label}</div>
  );
}
