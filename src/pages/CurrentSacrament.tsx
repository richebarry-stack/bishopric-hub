import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useTable } from '../lib/useTable';
import type {
  SacramentSpeaker, Prayer, SacramentMusic, SacramentTheme, SacramentAnnouncement, SacramentAgendaNote,
  CallingPipeline, SacramentWardBusiness, User, WardMember,
} from '../lib/api';
// CallingPipeline is used only in the page shell (toAgendaCalling); SacramentWardBusiness for snapshot table
import { SPEAKER_TYPES } from '../lib/constants';
import { renderRichText } from '../lib/richText';
import { resolveMemberName } from '../lib/nameUtils';

// ─── module-level constants ───────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

const DEFAULT_INTRO_REMARKS = 'Welcome those with us today to our church services, as we are here to remember and worship our Savior Jesus Christ. We offer a special welcome to any that are visiting or that may be here for the first time.';
const DEFAULT_SACRAMENT_INTRO = 'Now we will prepare for the sacrament which is the central focus of our meeting by singing…';

// Guests and Ward Council read-only viewers only see the bare structure of the meeting
const READONLY_VISIBLE_KINDS = new Set([
  'presiding', 'conducting', 'chorister', 'organist', 'opening_hymn', 'sacrament_hymn', 'testimonies', 'closing_hymn',
]);

// 'speakers' removed — each speaker is now its own movable item interleaved with rest_special
const FIXED_ORDER = [
  'intro_remarks',
  'presiding', 'conducting', 'chorister', 'organist', 'high_councilor', 'stake_reps', 'recognize', 'opening_hymn', 'opening_prayer',
  'announcements', 'ward_business', 'thanksgivings', 'sustainings', 'stake_business',
  'sacrament_intro', 'sacrament_hymn', 'testimonies', 'rest_special', 'closing_remarks', 'closing_hymn', 'closing_prayer',
] as const;
type FixedKind = typeof FIXED_ORDER[number];
const ANCHOR: Record<FixedKind, number> = {
  intro_remarks:  0.1,
  presiding:      0.5,
  conducting:     1,
  chorister:      2,
  organist:       3,
  high_councilor: 3.3,
  stake_reps:     3.4,
  recognize:      3.5,
  opening_hymn:   4,
  opening_prayer: 5,
  announcements:  6,
  ward_business:  6.2,
  thanksgivings:  6.4,
  sustainings:    6.7,
  stake_business: 7,
  sacrament_intro: 7.9,
  sacrament_hymn: 8,
  testimonies:    8.5,
  rest_special:   9,
  closing_remarks: 9.5,
  closing_hymn:   10,
  closing_prayer: 11,
};
const LABEL: Record<FixedKind, string> = {
  intro_remarks:  'Introductory Remarks',
  presiding:      'Presiding',
  conducting:     'Conducting', chorister: 'Chorister', organist: 'Organist',
  high_councilor: 'High Councilor',
  stake_reps:     'Other Stake Representatives',
  recognize:      'Recognize',
  opening_hymn:   'Opening Hymn', opening_prayer: 'Opening Prayer',
  announcements:  'Announcements',
  ward_business:  'Ward Business',
  thanksgivings:  'To Be Thanked',
  sustainings:    'To Be Sustained',
  testimonies:    'Bearing of Testimonies',
  stake_business: 'Stake Business',
  sacrament_intro: 'Preparing for the Sacrament',
  sacrament_hymn: 'Sacrament Hymn',
  rest_special:   'Rest / Special Music',
  closing_remarks: 'Closing Remarks',
  closing_hymn:   'Closing Hymn', closing_prayer: 'Closing Prayer',
};

// rest_special anchor position — speakers default to just before it
const REST_POS = ANCHOR['rest_special']; // = 9

// Optional one-off agenda items — not shown unless user opts in
const OPTIONAL_ITEMS = {
  child_blessing: { label: 'Child Blessing', pos: 5.5 },  // after opening_prayer
  confirmation:   { label: 'Confirmation',   pos: 8.3 },  // after sacrament hymn
  ordination:     { label: 'Priesthood Advancement',     pos: 8.6 },  // after confirmation
} as const;
type OptionalKind = keyof typeof OPTIONAL_ITEMS;

// ─── utility ──────────────────────────────────────────────────────────────────

function upcomingSunday(): string {
  const d = new Date();
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dk = (d: string) => (d ? d.slice(0, 10) : '');

// ─── sub-component types ──────────────────────────────────────────────────────

type SpeakerRow   = { id?: number; speaker: string; speaker_type: string; topic: string; accepted: string; position: number };
type AnnounceRow  = { id?: number; title: string; notes: string };
type NoteRow      = { id?: number; content: string; position: number };
export type AgendaCalling = { member: string; calling: string; organization: string };

// ─── top-level sub-components ─────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
      <div className="w-full sm:w-48 shrink-0 sm:pt-2 text-xs font-bold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SimpleField({ label, value, onChange, readonly, placeholder }: { label: string; value: string; onChange: (v: string) => void; readonly?: boolean; placeholder?: string }) {
  return (
    <Row label={label}>
      {readonly
        ? <p className="text-sm text-gray-800 py-1.5">{value || <span className="text-gray-300 italic">—</span>}</p>
        : <input className={INPUT_CLS} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
    </Row>
  );
}

function AutoTextarea({ value, onChange, className, placeholder, rows: _, style: __, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={onChange} className={className}
      placeholder={placeholder} rows={1}
      style={{ overflow: 'hidden', resize: 'none' }} {...rest} />
  );
}

function TextareaField({ label, value, onChange, readonly }: { label: string; value: string; onChange: (v: string) => void; readonly?: boolean }) {
  return (
    <Row label={label}>
      {readonly
        ? <p className="text-sm text-gray-800 py-1.5 whitespace-pre-wrap">{value || <span className="text-gray-300 italic">—</span>}</p>
        : <AutoTextarea className={INPUT_CLS} value={value} onChange={e => onChange(e.target.value)} />}
    </Row>
  );
}

function SpeakerItem({
  index, row, onUpdate, onMoveUp, onMoveDown, onRemove, canMoveUp, canMoveDown,
}: {
  index: number;
  row: SpeakerRow;
  onUpdate: (patch: Partial<SpeakerRow>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-100">
      <div className="w-full sm:w-48 shrink-0 sm:pt-2 flex items-center gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Speaker {index + 1}</span>
        <div className="flex items-center gap-0.5 ml-auto sm:ml-1">
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 px-1 leading-none text-sm" title="Move up">↑</button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown}
            className="text-gray-300 hover:text-gray-600 disabled:opacity-20 px-1 leading-none text-sm" title="Move down">↓</button>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="rounded-md border border-gray-200 p-2 relative">
          <button type="button" onClick={onRemove} aria-label="Remove"
            className="absolute top-1 right-2 text-gray-300 hover:text-red-500 text-sm leading-none">×</button>
          <input className={INPUT_CLS + ' mb-1 pr-6'} placeholder="Speaker name" value={row.speaker}
            onChange={e => onUpdate({ speaker: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className={INPUT_CLS} value={row.speaker_type}
              onChange={e => onUpdate({ speaker_type: e.target.value })}>
              {SPEAKER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={INPUT_CLS} placeholder="Topic" value={row.topic}
              onChange={e => onUpdate({ topic: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteItem({
  content, onContentChange, onMoveUp, onMoveDown, onRemove,
}: {
  content: string;
  onContentChange: (v: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-100 bg-amber-50/40 -mx-2 px-2 rounded">
      <div className="w-full sm:w-48 shrink-0 sm:pt-2 flex items-center gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-amber-500">Agenda Item</span>
        <div className="flex items-center gap-0.5 ml-auto sm:ml-0">
          <button type="button" onClick={onMoveUp} title="Move up" className="text-gray-400 hover:text-gray-700 px-1 leading-none">↑</button>
          <button type="button" onClick={onMoveDown} title="Move down" className="text-gray-400 hover:text-gray-700 px-1 leading-none">↓</button>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-start gap-2">
        <AutoTextarea className={INPUT_CLS} placeholder="Additional note…" value={content} onChange={e => onContentChange(e.target.value)} />
        <button type="button" onClick={onRemove} aria-label="Remove" className="text-gray-300 hover:text-red-500 text-lg leading-none pt-1">×</button>
      </div>
    </div>
  );
}

const stripMd = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '$1');

function CallingsList({ label, callings, script }: {
  label: string;
  callings: AgendaCalling[];
  script?: string;
}) {
  if (callings.length === 0) return null;
  return (
    <Row label={label}>
      <div className="space-y-0.5">
        {callings.map((c, i) => (
          <p key={i} className="text-sm text-gray-800">
            {renderRichText(c.member)}{c.calling ? ` — ${c.calling}` : ''}
            {c.organization ? <span className="text-xs text-gray-400"> ({c.organization})</span> : null}
          </p>
        ))}
        {script && (
          <p className="text-xs text-gray-500 italic mt-2 leading-relaxed whitespace-pre-line">{script}</p>
        )}
      </div>
    </Row>
  );
}

function OptionalItem({ label, value, onChange, onRemove }: {
  label: string; value: string;
  onChange: (v: string) => void; onRemove: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-100 bg-indigo-50/40 -mx-2 px-2 rounded">
      <div className="w-full sm:w-48 shrink-0 sm:pt-2 flex items-center gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-indigo-500">{label}</span>
        <button type="button" onClick={onRemove}
          className="ml-auto text-gray-300 hover:text-red-500 text-sm leading-none" title="Remove">×</button>
      </div>
      <div className="flex-1 min-w-0">
        <input className={INPUT_CLS} placeholder="Name…" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function AnnouncementsSection({ rows, setRows, onCopyPrior, priorCount }: {
  rows: AnnounceRow[];
  setRows: React.Dispatch<React.SetStateAction<AnnounceRow[]>>;
  onCopyPrior?: () => void;
  priorCount?: number;
}) {
  return (
    <Row label={LABEL.announcements}>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-gray-300 italic">None</p>}
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border border-gray-200 p-2 relative">
            <button type="button" onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))} aria-label="Remove"
              className="absolute top-1 right-2 text-gray-300 hover:text-red-500 text-sm leading-none">×</button>
            <input className={INPUT_CLS + ' mb-1'} placeholder="Title" value={r.title}
              onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
            <AutoTextarea className={INPUT_CLS} placeholder="Details (optional)" value={r.notes}
              onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} />
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => setRows(rs => [...rs, { title: '', notes: '' }])}
            className="text-xs text-blue-600 hover:text-blue-800">+ Add announcement</button>
          {onCopyPrior && (priorCount ?? 0) > 0 && (
            <button type="button" onClick={onCopyPrior}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">
              + Copy {priorCount} from prior week
            </button>
          )}
        </div>
      </div>
    </Row>
  );
}

function RecognizeSection({ rows, setRows, autoLines }: {
  rows: string[];
  setRows: React.Dispatch<React.SetStateAction<string[]>>;
  autoLines?: string[];
}) {
  return (
    <Row label={LABEL.recognize}>
      <div className="space-y-2">
        {autoLines?.map((line, i) => (
          <div key={`auto-${i}`} className="flex items-start gap-2">
            <p className="flex-1 text-sm text-gray-600 italic py-1.5">{line}</p>
            <span className="text-[10px] text-gray-300 shrink-0 mt-2" title="Automatically follows the High Councilor / Organist / Chorister fields above">auto</span>
          </div>
        ))}
        {rows.length === 0 && !autoLines?.length && <p className="text-xs text-gray-300 italic">None</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <AutoTextarea className={INPUT_CLS} value={r}
              onChange={e => setRows(rs => rs.map((x, idx) => idx === i ? e.target.value : x))} />
            <button type="button" onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))} aria-label="Remove"
              className="text-gray-300 hover:text-red-500 text-sm leading-none shrink-0 mt-2">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows(rs => [...rs, ''])}
          className="text-xs text-blue-600 hover:text-blue-800">+ Add recognition</button>
      </div>
    </Row>
  );
}

// ─── AgendaEditor ─────────────────────────────────────────────────────────────

type ViewerMode = 'readonly' | 'music' | undefined;

const MUSIC_EDITABLE_FIELDS = new Set(['chorister', 'organist', 'opening_hymn', 'sacrament_hymn', 'rest_special', 'closing_hymn']);

interface EditorProps {
  date: string;
  speakers: ReturnType<typeof useTable<SacramentSpeaker>>;
  prayers: ReturnType<typeof useTable<Prayer>>;
  music: ReturnType<typeof useTable<SacramentMusic>>;
  themes: ReturnType<typeof useTable<SacramentTheme>>;
  announcements: ReturnType<typeof useTable<SacramentAnnouncement>>;
  notes: ReturnType<typeof useTable<SacramentAgendaNote>>;
  thanksgivings: AgendaCalling[];
  sustainings: AgendaCalling[];
  onSaveSnapshot: (sustainings: AgendaCalling[], thanksgivings: AgendaCalling[]) => Promise<void>;
  viewerMode?: ViewerMode;
}

export function AgendaEditor({ date, speakers, prayers, music, themes, announcements, notes, thanksgivings, sustainings, onSaveSnapshot, viewerMode }: EditorProps) {
  const ro = (field: string) => viewerMode === 'readonly' || (viewerMode === 'music' && !MUSIC_EDITABLE_FIELDS.has(field));
  const existingTheme  = themes.rows.find(t => dk(t.meeting_date) === date);
  const existingMusic  = music.rows.find(m => dk(m.meeting_date) === date);
  const existingSpeakers = speakers.rows
    .filter(s => dk(s.meeting_date) === date)
    .sort((a, b) => (a.speaking_order || 0) - (b.speaking_order || 0));
  const existingAnnouncements = announcements.rows.filter(a => dk(a.meeting_date) === date);
  const existingNotes  = notes.rows.filter(n => dk(n.meeting_date) === date);
  const openingExisting = prayers.rows.find(p => dk(p.meeting_date) === date && p.opening_closing === 'Opening');
  const closingExisting = prayers.rows.find(p => dk(p.meeting_date) === date && p.opening_closing === 'Closing');

  const { rows: allUsers, isLoading: usersLoading } = useTable<User>('users');
  const { rows: wardMembers } = useTable<WardMember>('ward-members');
  const currentHighCouncilor = allUsers.find(u => u.church_role === 'High Councilor');
  const defaultRecognizeRows = [
    "The youth door greeters, for creating a reverent and welcoming environment",
  ];

  const [introRemarks,   setIntroRemarks]   = useState(existingTheme?.intro_remarks   || DEFAULT_INTRO_REMARKS);
  const [presiding,      setPresiding]      = useState(existingTheme?.presiding       || '');
  const [conducting,     setConducting]     = useState(existingTheme?.conducting      || '');
  const [highCouncilorName, setHighCouncilorName] = useState(existingTheme?.high_councilor || '');
  const [stakeReps,      setStakeReps]      = useState(existingTheme?.stake_reps || '');
  const [recognizeRows,  setRecognizeRows]  = useState<string[]>(() =>
    existingTheme?.recognize ? existingTheme.recognize.split('\n').filter(Boolean) : defaultRecognizeRows);

  // The user list loads asynchronously — backfill the current High Councilor's name once it's
  // ready, if this date has no saved value yet (a genuinely new/unedited future agenda).
  useEffect(() => {
    if (usersLoading || existingTheme?.high_councilor || !currentHighCouncilor) return;
    setHighCouncilorName(name => name || currentHighCouncilor.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersLoading, currentHighCouncilor?.name]);

  // Always reflects the High Councilor field above, rather than being frozen into the saved Recognize text
  const highCouncilorLastName = highCouncilorName.trim().split(/\s+/).pop();
  const highCouncilorThanksLine = highCouncilorName ? `Brother ${highCouncilorLastName} from the stake high council` : '';
  const stakeRepsLine = stakeReps.trim();

  const [wardBusiness,   setWardBusiness]   = useState(existingTheme?.ward_business   || '');
  const [stakeBusiness,  setStakeBusiness]  = useState(existingTheme?.stake_business  || '');
  const [closingRemarks, setClosingRemarks] = useState(existingTheme?.closing_remarks || '');
  const [isFastSunday,   setIsFastSunday]   = useState(!!existingTheme?.is_fast_sunday);
  const [sacramentIntro, setSacramentIntro] = useState(existingTheme?.sacrament_intro || DEFAULT_SACRAMENT_INTRO);
  const [chorister,     setChorister]     = useState(existingMusic?.chorister     || '');
  const [organist,      setOrganist]      = useState(existingMusic?.organist      || '');

  // Always reflects this week's current Organist/Chorister fields, rather than being frozen into the saved Recognize text
  const musicThanksLine = (organist || chorister)
    ? `Those providing the music — ${[organist && `Organist: ${organist}`, chorister && `Chorister: ${chorister}`].filter(Boolean).join(', ')}`
    : '';

  const [openingHymn,   setOpeningHymn]   = useState(existingMusic?.opening_hymn  || '');
  const [sacramentHymn, setSacramentHymn] = useState(existingMusic?.sacrament_hymn || '');
  const [restSpecial,   setRestSpecial]   = useState(existingMusic?.rest_special   || '');
  const [closingHymn,   setClosingHymn]   = useState(existingMusic?.closing_hymn  || '');
  const [openingPrayer, setOpeningPrayer] = useState(openingExisting?.name || '');
  const [closingPrayer, setClosingPrayer] = useState(closingExisting?.name || '');
  const [childBlessing, setChildBlessing] = useState<string | null>(existingMusic?.child_blessing ?? null);
  const [confirmation,  setConfirmation]  = useState<string | null>(existingMusic?.confirmation  ?? null);
  const [ordination,    setOrdination]    = useState<string | null>(existingMusic?.ordination    ?? null);
  const [copied, setCopied] = useState(false);

  // Each speaker gets its own float position so it can interleave with rest_special.
  // If position is saved in DB, use it; otherwise place all before rest_special by default.
  const [speakerRows, setSpeakerRows] = useState<SpeakerRow[]>(() => {
    const total = existingSpeakers.length;
    return existingSpeakers.map((s, i) => ({
      id: s.id,
      speaker:      s.speaker      || '',
      speaker_type: s.speaker_type || 'Adult Speaker',
      topic:        s.topic        || '',
      accepted:     s.accepted     || '',
      // If position was persisted, use it. Otherwise evenly space before rest_special.
      position: s.position != null ? s.position : REST_POS - 1 + (i + 1) / (total + 1),
    }));
  });

  const [announceRows, setAnnounceRows] = useState<AnnounceRow[]>(
    existingAnnouncements.map(a => ({ id: a.id, title: a.title || '', notes: a.notes || '' }))
  );

  // Prior-week copy: only active for the upcoming Sunday (today if Sunday, else next Sunday this week)
  const priorDate = (() => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const isCurrent = date === upcomingSunday();
  const priorAnnouncements = isCurrent
    ? announcements.rows.filter(a => dk(a.meeting_date) === priorDate && a.title?.trim())
    : [];
  const priorNewCount = priorAnnouncements.filter(
    a => !announceRows.some(r => r.title.trim().toLowerCase() === a.title.trim().toLowerCase())
  ).length;
  const handleCopyPrior = () => {
    const existing = new Set(announceRows.map(r => r.title.trim().toLowerCase()));
    const toAdd = priorAnnouncements
      .filter(a => !existing.has(a.title.trim().toLowerCase()))
      .map(a => ({ title: a.title, notes: a.notes || '' }));
    if (toAdd.length > 0) setAnnounceRows(rs => [...rs, ...toAdd]);
  };
  const [noteRows, setNoteRows] = useState<NoteRow[]>(
    existingNotes.map((n, i) => ({ id: n.id, content: n.content || '', position: n.position ?? 11.5 + i }))
  );
  const [saving, setSaving]   = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty]     = useState(false);

  const isSavingRef   = useRef(false);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  // Merged ordered list: fixed anchors + individual speakers + free notes + optional ordinance items
  type MergedItem =
    | { kind: FixedKind;    pos: number }
    | { kind: 'speaker';    pos: number; speakerIndex: number }
    | { kind: 'note';       pos: number; noteIndex:   number }
    | { kind: 'optional';   pos: number; optKind: OptionalKind };

  const merged: MergedItem[] = [
    ...FIXED_ORDER.filter(k => k !== 'testimonies' || isFastSunday).map(k => ({ kind: k, pos: ANCHOR[k] } as MergedItem)),
    ...(isFastSunday ? [] : speakerRows.map((s, i) => ({ kind: 'speaker' as const, pos: s.position, speakerIndex: i }))),
    ...noteRows.map((n, i)    => ({ kind: 'note'    as const, pos: n.position, noteIndex:   i })),
    ...(childBlessing !== null ? [{ kind: 'optional' as const, pos: OPTIONAL_ITEMS.child_blessing.pos, optKind: 'child_blessing' as OptionalKind }] : []),
    ...(confirmation  !== null ? [{ kind: 'optional' as const, pos: OPTIONAL_ITEMS.confirmation.pos,   optKind: 'confirmation'   as OptionalKind }] : []),
    ...(ordination    !== null ? [{ kind: 'optional' as const, pos: OPTIONAL_ITEMS.ordination.pos,     optKind: 'ordination'     as OptionalKind }] : []),
  ].sort((a, b) => a.pos - b.pos);

  // Move a speaker or note up/down in the merged list using bisection positioning
  const moveItem = (
    findFn: (item: MergedItem) => boolean,
    updateFn: (newPos: number) => void,
    dir: -1 | 1,
  ) => {
    const mi = merged.findIndex(findFn);
    const ti = mi + dir;
    if (ti < 0 || ti >= merged.length) return;
    const neighbor = merged[ti];
    let newPos: number;
    if (dir < 0) {
      const above = merged[ti - 1];
      newPos = above ? (above.pos + neighbor.pos) / 2 : neighbor.pos - 1;
    } else {
      const below = merged[ti + 1];
      newPos = below ? (neighbor.pos + below.pos) / 2 : neighbor.pos + 1;
    }
    updateFn(newPos);
  };

  const moveSpeaker = (si: number, dir: -1 | 1) =>
    moveItem(
      r => r.kind === 'speaker' && (r as { speakerIndex: number }).speakerIndex === si,
      pos => setSpeakerRows(rs => rs.map((r, i) => i === si ? { ...r, position: pos } : r)),
      dir,
    );

  const moveNote = (ni: number, dir: -1 | 1) =>
    moveItem(
      r => r.kind === 'note' && (r as { noteIndex: number }).noteIndex === ni,
      pos => setNoteRows(ns => ns.map((n, i) => i === ni ? { ...n, position: pos } : n)),
      dir,
    );

  const addSpeaker = () => {
    // Place after the last speaker (or just before rest_special if none exist)
    const existing = speakerRows.map(s => s.position);
    const maxSpk = existing.length ? Math.max(...existing) : REST_POS - 1;
    const nextFixed = merged.find(r => r.pos > maxSpk && r.kind !== 'speaker' && r.kind !== 'note');
    const cap = nextFixed ? nextFixed.pos : maxSpk + 2;
    setSpeakerRows(rs => [...rs, { speaker: '', speaker_type: 'Adult Speaker', topic: '', accepted: '', position: (maxSpk + cap) / 2 }]);
  };

  const addNote = () => {
    const maxPos = Math.max(FIXED_ORDER.length, ...noteRows.map(n => n.position), 0);
    setNoteRows(ns => [...ns, { content: '', position: maxPos + 1 }]);
  };

  const handleSave = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    try {
      const recognizeValue = recognizeRows.filter(r => r.trim()).join('\n');
      const themeFields = {
        meeting_date: date, presiding, conducting, ward_business: wardBusiness, stake_business: stakeBusiness,
        intro_remarks: introRemarks, recognize: recognizeValue, closing_remarks: closingRemarks,
        is_fast_sunday: isFastSunday ? 1 : 0, sacrament_intro: sacramentIntro, high_councilor: highCouncilorName,
        stake_reps: stakeReps,
      };
      if (existingTheme) await themes.update(existingTheme.id, themeFields, { silent: true });
      else if (presiding || conducting || wardBusiness || stakeBusiness || introRemarks || recognizeValue || closingRemarks || isFastSunday || sacramentIntro || highCouncilorName || stakeReps) await themes.create(themeFields, { silent: true });

      const musicFields = { meeting_date: date, chorister, organist, opening_hymn: openingHymn, sacrament_hymn: sacramentHymn, rest_special: restSpecial, closing_hymn: closingHymn, child_blessing: childBlessing, confirmation, ordination };
      const hasMusic = !!(chorister || organist || openingHymn || sacramentHymn || restSpecial || closingHymn || childBlessing !== null || confirmation !== null || ordination !== null);
      if (existingMusic) await music.update(existingMusic.id, musicFields, { silent: true });
      else if (hasMusic) await music.create(musicFields, { silent: true });

      const syncPrayer = async (lbl: string, name: string, existing?: Prayer) => {
        if (name.trim()) {
          const d = { meeting_date: date, name: resolveMemberName(name, wardMembers), opening_closing: lbl };
          if (existing) await prayers.update(existing.id, d, { silent: true }); else await prayers.create(d, { silent: true });
        } else if (existing) await prayers.remove(existing.id);
      };
      await syncPrayer('Opening', openingPrayer, openingExisting);
      await syncPrayer('Closing', closingPrayer, closingExisting);

      // Sort speakers by position to assign speaking_order and persist position — none for a fast/testimony meeting
      const keepSpk = (isFastSunday ? [] : speakerRows.filter(r => r.speaker.trim()))
        .sort((a, b) => a.position - b.position);
      const keepSpkIds = new Set(keepSpk.filter(r => r.id).map(r => r.id));
      for (const s of existingSpeakers) if (!keepSpkIds.has(s.id)) await speakers.remove(s.id);
      for (let i = 0; i < keepSpk.length; i++) {
        const r = keepSpk[i];
        const d = { meeting_date: date, speaker: resolveMemberName(r.speaker, wardMembers), speaker_type: r.speaker_type || 'Adult Speaker', topic: r.topic, accepted: r.accepted, speaking_order: i + 1, position: r.position };
        if (r.id) await speakers.update(r.id, d, { silent: true }); else await speakers.create(d, { silent: true });
      }

      const keepAnn = announceRows.filter(r => r.title.trim());
      const keepAnnIds = new Set(keepAnn.filter(r => r.id).map(r => r.id));
      for (const a of existingAnnouncements) if (!keepAnnIds.has(a.id)) await announcements.remove(a.id);
      for (const r of keepAnn) {
        const d = { meeting_date: date, title: r.title, notes: r.notes };
        if (r.id) await announcements.update(r.id, d, { silent: true }); else await announcements.create(d, { silent: true });
      }

      const keepNotes = noteRows.filter(r => r.content.trim());
      const keepNoteIds = new Set(keepNotes.filter(r => r.id).map(r => r.id));
      for (const n of existingNotes) if (!keepNoteIds.has(n.id)) await notes.remove(n.id);
      for (const r of keepNotes) {
        const d = { meeting_date: date, content: r.content, position: r.position };
        if (r.id) await notes.update(r.id, d, { silent: true }); else await notes.create(d, { silent: true });
      }

      await onSaveSnapshot(sustainings, thanksgivings);

      setSavedAt(new Date().toLocaleTimeString()); setDirty(false);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  const handleMusicSave = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    try {
      const musicFields = { meeting_date: date, chorister, organist, opening_hymn: openingHymn, sacrament_hymn: sacramentHymn, rest_special: restSpecial, closing_hymn: closingHymn };
      if (existingMusic) await music.update(existingMusic.id, musicFields, { silent: true });
      else await music.create(musicFields, { silent: true });
      setSavedAt(new Date().toLocaleTimeString()); setDirty(false);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  // Keep ref current so the debounced callback always calls the latest closure
  handleSaveRef.current = handleSave;

  // If user navigates away while a debounced save is pending, fire it immediately
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        handleSaveRef.current();
      }
    };
  }, []);

  const generateText = (): string => {
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const lines: string[] = [`Sacrament Meeting — ${dateLabel}`, ''];
    for (const item of merged) {
      if (item.kind === 'speaker') {
        const r = speakerRows[item.speakerIndex];
        if (!r.speaker.trim()) continue;
        const num = speakerDisplayIndex(item.speakerIndex) + 1;
        let line = `Speaker ${num}: ${r.speaker}`;
        if (r.speaker_type && r.speaker_type !== 'Adult Speaker') line += ` (${r.speaker_type})`;
        if (r.topic) line += ` — "${r.topic}"`;
        lines.push(line);
        continue;
      }
      if (item.kind === 'note') {
        const c = noteRows[item.noteIndex].content.trim();
        if (c) lines.push(c);
        continue;
      }
      if (item.kind === 'optional') {
        const val = item.optKind === 'child_blessing' ? childBlessing : item.optKind === 'confirmation' ? confirmation : ordination;
        if (val) lines.push(`${OPTIONAL_ITEMS[item.optKind].label}: ${val}`);
        continue;
      }
      switch (item.kind as FixedKind) {
        case 'intro_remarks':  if (introRemarks)  lines.push(`Introductory Remarks: ${introRemarks}`); break;
        case 'presiding':      if (presiding)     lines.push(`Presiding: ${presiding}`); break;
        case 'conducting':     if (conducting)    lines.push(`Conducting: ${conducting}`); break;
        case 'chorister':      if (chorister)     lines.push(`Chorister: ${chorister}`); break;
        case 'organist':       if (organist)      lines.push(`Organist: ${organist}`); break;
        case 'recognize': {
          const recognizeItems = [highCouncilorThanksLine, stakeRepsLine, musicThanksLine, ...recognizeRows.map(r => r.trim()).filter(Boolean)].filter(Boolean);
          if (recognizeItems.length) {
            lines.push('Recognize:');
            for (const r of recognizeItems) lines.push(`  • ${r}`);
          }
          break;
        }
        case 'opening_hymn':   if (openingHymn)   lines.push(`Opening Hymn: ${openingHymn}`); break;
        case 'opening_prayer': if (openingPrayer) lines.push(`Opening Prayer: ${openingPrayer}`); break;
        case 'announcements':
          if (announceRows.some(r => r.title.trim())) {
            lines.push('Announcements:');
            for (const r of announceRows) {
              if (!r.title.trim()) continue;
              lines.push(`  • ${r.title}`);
              if (r.notes?.trim()) lines.push(`    ${r.notes.trim()}`);
            }
          }
          break;
        case 'thanksgivings':
          if (thanksgivings.length) {
            lines.push('To Be Thanked (Releases):');
            lines.push('The following have been released from positions in the ward. We propose that they be given a vote of thanks for their service.');
            for (const c of thanksgivings) {
              const name = stripMd(c.member);
              lines.push(c.calling ? `  • ${name} has been released as ${stripMd(c.calling)}.` : `  • ${name}`);
            }
          }
          break;
        case 'sustainings':
          if (sustainings.length) {
            lines.push('To Be Sustained (Callings):');
            lines.push('The following have been called to positions in the ward. We ask that if they are present that they please stand and remain standing until the sustaining vote is complete.');
            for (const c of sustainings) {
              const name = stripMd(c.member);
              lines.push(c.calling ? `  • ${name} — ${stripMd(c.calling)}` : `  • ${name}`);
            }
            lines.push('We propose that they be sustained in these callings. Those in favor may manifest it by the uplifted hand. (pause) Those opposed, if any, may manifest it (pause)');
          }
          break;
        case 'ward_business':  if (wardBusiness)  lines.push(`Ward Business: ${wardBusiness}`);   break;
        case 'stake_business': if (stakeBusiness) lines.push(`Stake Business: ${stakeBusiness}`); break;
        case 'sacrament_intro': if (sacramentIntro) lines.push(sacramentIntro); break;
        case 'sacrament_hymn': if (sacramentHymn) lines.push(`Sacrament Hymn: ${sacramentHymn}`); break;
        case 'testimonies':    if (isFastSunday)  lines.push('Bearing of Testimonies'); break;
        case 'rest_special':   if (restSpecial)   lines.push(`Rest / Special Music: ${restSpecial}`); break;
        case 'closing_remarks': lines.push(`Closing Remarks: ${closingRemarks}`); break;
        case 'closing_hymn':   if (closingHymn)   lines.push(`Closing Hymn: ${closingHymn}`); break;
        case 'closing_prayer': if (closingPrayer) lines.push(`Closing Prayer: ${closingPrayer}`); break;
      }
    }
    return lines.join('\n');
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(generateText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportPDF = () => {
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const bodyLines = generateText().split('\n').map(l => {
      if (!l.trim()) return '<br>';
      if (l.startsWith('    ')) return `<p style="margin:0.05rem 0 0.1rem 2.5rem;color:#555;font-size:12pt">${l.trim()}</p>`;
      if (l.startsWith('  •')) return `<p style="margin:0.15rem 0 0.15rem 1.5rem">• ${l.trim().slice(1).trim()}</p>`;
      if (l === 'Bearing of Testimonies') return `<p style="margin:0.3rem 0"><strong>${l}</strong></p>`;
      const ci = l.indexOf(':');
      if (ci > -1) return `<p style="margin:0.3rem 0"><strong>${l.slice(0, ci)}:</strong>${l.slice(ci + 1)}</p>`;
      return `<p style="margin:0.3rem 0">${l}</p>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${dateLabel} — Sacrament Meeting</title>
<style>body{font-family:Georgia,serif;max-width:580px;margin:2rem auto;color:#111;font-size:13pt}h1{font-size:1.1rem;text-align:center;border-bottom:1px solid #ccc;padding-bottom:0.6rem;margin-bottom:1.2rem}@media print{@page{margin:1.5cm}}</style>
</head><body><h1>Sacrament Meeting<br>${dateLabel}</h1>${bodyLines}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const triggerAutoSave = () => {
    if (viewerMode) return;
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSaveRef.current(), 600);
  };

  // Count how many speakers appear before each speaker for display numbering
  const speakerDisplayIndex = (si: number): number => {
    const myPos = speakerRows[si].position;
    return speakerRows.filter(s => s.position < myPos).length;
  };

  // Read-only viewers (guests, Ward Council) only see the bare structure of the meeting
  const visibleMerged = viewerMode === 'readonly'
    ? merged.filter(item => item.kind === 'speaker' || READONLY_VISIBLE_KINDS.has(item.kind as string))
    : merged;

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6" onBlur={triggerAutoSave}>
        {!viewerMode && (
          <label className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100 text-sm text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={isFastSunday}
              onChange={e => { setIsFastSunday(e.target.checked); triggerAutoSave(); }}
              className="rounded border-gray-300" />
            Fast &amp; Testimony Meeting (no assigned speakers)
          </label>
        )}
        {visibleMerged.map((item, mi) => {
          if (item.kind === 'speaker') {
            const si = item.speakerIndex;
            const row = speakerRows[si];
            if (viewerMode) {
              return (
                <Row key={`speaker-${si}`} label={`Speaker ${speakerDisplayIndex(si) + 1}`}>
                  <div className="py-1">
                    <p className="text-sm font-medium text-gray-800">{row.speaker || <span className="text-gray-300 italic">—</span>}</p>
                    {row.topic && <p className="text-sm text-gray-600 mt-0.5">Topic: {row.topic}</p>}
                  </div>
                </Row>
              );
            }
            return (
              <SpeakerItem
                key={`speaker-${si}`}
                index={speakerDisplayIndex(si)}
                row={row}
                onUpdate={patch => setSpeakerRows(rs => rs.map((r, i) => i === si ? { ...r, ...patch } : r))}
                onMoveUp={() => moveSpeaker(si, -1)}
                onMoveDown={() => moveSpeaker(si, 1)}
                onRemove={() => setSpeakerRows(rs => rs.filter((_, i) => i !== si))}
                canMoveUp={mi > 0}
                canMoveDown={mi < merged.length - 1}
              />
            );
          }
          if (item.kind === 'optional') {
            const { optKind } = item;
            const val = optKind === 'child_blessing' ? childBlessing! : optKind === 'confirmation' ? confirmation! : ordination!;
            const setter = optKind === 'child_blessing' ? setChildBlessing : optKind === 'confirmation' ? setConfirmation : setOrdination;
            if (viewerMode) {
              return (
                <Row key={`opt-${optKind}`} label={OPTIONAL_ITEMS[optKind].label}>
                  <p className="text-sm text-gray-800 py-1">{val || <span className="text-gray-300 italic">—</span>}</p>
                </Row>
              );
            }
            return (
              <OptionalItem key={`opt-${optKind}`}
                label={OPTIONAL_ITEMS[optKind].label}
                value={val}
                onChange={setter}
                onRemove={() => setter(null)}
              />
            );
          }
          if (item.kind === 'note') {
            const ni = item.noteIndex;
            if (viewerMode) {
              return (
                <Row key={`note-${ni}`} label="Agenda Item">
                  <p className="text-sm text-gray-800 py-1 whitespace-pre-wrap">{noteRows[ni].content || <span className="text-gray-300 italic">—</span>}</p>
                </Row>
              );
            }
            return (
              <NoteItem
                key={`note-${ni}`}
                content={noteRows[ni].content}
                onContentChange={v => setNoteRows(ns => ns.map((n, i) => i === ni ? { ...n, content: v } : n))}
                onMoveUp={() => moveNote(ni, -1)}
                onMoveDown={() => moveNote(ni, 1)}
                onRemove={() => setNoteRows(ns => ns.filter((_, i) => i !== ni))}
              />
            );
          }
          const kind = item.kind as FixedKind;
          switch (kind) {
            case 'intro_remarks':  return <TextareaField key={kind} label={LABEL[kind]} value={introRemarks}   onChange={setIntroRemarks}  readonly={ro('intro_remarks')} />;
            case 'presiding':      return <SimpleField   key={kind} label={LABEL[kind]} value={presiding}     onChange={setPresiding}     readonly={ro('presiding')} />;
            case 'conducting':     return <SimpleField   key={kind} label={LABEL[kind]} value={conducting}    onChange={setConducting}    readonly={ro('conducting')} />;
            case 'chorister':      return <SimpleField   key={kind} label={LABEL[kind]} value={chorister}     onChange={setChorister}     readonly={ro('chorister')} />;
            case 'organist':       return <SimpleField   key={kind} label={LABEL[kind]} value={organist}      onChange={setOrganist}      readonly={ro('organist')} />;
            case 'high_councilor': return <SimpleField   key={kind} label={LABEL[kind]} value={highCouncilorName} onChange={setHighCouncilorName} readonly={ro('high_councilor')} />;
            case 'stake_reps':     return <SimpleField   key={kind} label={LABEL[kind]} value={stakeReps}       onChange={setStakeReps}     readonly={ro('stake_reps')} placeholder="Other stake representatives, if any…" />;
            case 'recognize': {
              const visibleRecognize = [highCouncilorThanksLine, stakeRepsLine, musicThanksLine, ...recognizeRows.filter(r => r.trim())].filter(Boolean);
              if (ro('recognize')) {
                if (visibleRecognize.length === 0) return null;
                return (
                  <Row key={kind} label={LABEL[kind]}>
                    <ul className="space-y-0.5 py-1">
                      {visibleRecognize.map((r, i) => <li key={i} className="text-sm text-gray-800">• {r}</li>)}
                    </ul>
                  </Row>
                );
              }
              return <RecognizeSection key={kind} rows={recognizeRows} setRows={setRecognizeRows}
                autoLines={[highCouncilorThanksLine, stakeRepsLine, musicThanksLine].filter(Boolean)} />;
            }
            case 'opening_hymn':   return <SimpleField   key={kind} label={LABEL[kind]} value={openingHymn}   onChange={setOpeningHymn}   readonly={ro('opening_hymn')} />;
            case 'opening_prayer': return <SimpleField   key={kind} label={LABEL[kind]} value={openingPrayer} onChange={setOpeningPrayer} readonly={ro('opening_prayer')} />;
            case 'stake_business': return viewerMode ? null : <TextareaField key={kind} label={LABEL[kind]} value={stakeBusiness} onChange={setStakeBusiness} />;
            case 'ward_business':  return viewerMode ? null : <TextareaField key={kind} label={LABEL[kind]} value={wardBusiness} onChange={setWardBusiness} />;
            case 'sacrament_intro': return <TextareaField key={kind} label={LABEL[kind]} value={sacramentIntro} onChange={setSacramentIntro} readonly={ro('sacrament_intro')} />;
            case 'sacrament_hymn': return <SimpleField   key={kind} label={LABEL[kind]} value={sacramentHymn} onChange={setSacramentHymn} readonly={ro('sacrament_hymn')} />;
            case 'testimonies':
              return (
                <Row key={kind} label={LABEL[kind]}>
                  <p className="text-sm text-gray-500 italic py-1.5">Members of the ward bear their testimonies.</p>
                </Row>
              );
            case 'rest_special':   return <SimpleField   key={kind} label={LABEL[kind]} value={restSpecial}   onChange={setRestSpecial}   readonly={ro('rest_special')} />;
            case 'closing_remarks': return <TextareaField key={kind} label={LABEL[kind]} value={closingRemarks} onChange={setClosingRemarks} readonly={ro('closing_remarks')} />;
            case 'closing_hymn':   return <SimpleField   key={kind} label={LABEL[kind]} value={closingHymn}   onChange={setClosingHymn}   readonly={ro('closing_hymn')} />;
            case 'closing_prayer': return <SimpleField   key={kind} label={LABEL[kind]} value={closingPrayer} onChange={setClosingPrayer} readonly={ro('closing_prayer')} />;
            case 'announcements':
              if (viewerMode === 'music') return null;
              if (viewerMode === 'readonly') {
                const visibleAnn = announceRows.filter(r => r.title.trim());
                if (visibleAnn.length === 0) return null;
                return (
                  <Row key={kind} label={LABEL[kind]}>
                    <ul className="space-y-0.5 py-1">
                      {visibleAnn.map((r, i) => (
                        <li key={i} className="text-sm text-gray-800">• {r.title}{r.notes ? ` — ${r.notes}` : ''}</li>
                      ))}
                    </ul>
                  </Row>
                );
              }
              return <AnnouncementsSection key={kind} rows={announceRows} setRows={setAnnounceRows}
                onCopyPrior={handleCopyPrior} priorCount={priorNewCount} />;
            case 'thanksgivings':  return viewerMode ? null : <CallingsList key={kind} label={LABEL[kind]} callings={thanksgivings}
              script={"[Name] has been released as [position]. Those who would like to express thanks for [his or her] service may show it by the uplifted hand."} />;
            case 'sustainings':    return viewerMode ? null : <CallingsList key={kind} label={LABEL[kind]} callings={sustainings}
              script={"[Name] has been called as [position]. Those in favor of sustaining [him or her] may show it by the uplifted hand. [Pause briefly.] Those opposed, if any, may also show it. [Pause briefly.]"} />;

          }
        })}
        {!viewerMode && (
          <div className="pt-3 flex flex-wrap gap-x-4 gap-y-2">
            {!isFastSunday && <button type="button" onClick={addSpeaker} className="text-sm text-blue-600 hover:text-blue-800">+ Add speaker</button>}
            <button type="button" onClick={addNote}    className="text-sm text-blue-600 hover:text-blue-800">+ Add agenda item</button>
            {childBlessing === null && (
              <button type="button" onClick={() => setChildBlessing('')} className="text-sm text-indigo-500 hover:text-indigo-700">+ Child Blessing</button>
            )}
            {confirmation === null && (
              <button type="button" onClick={() => setConfirmation('')} className="text-sm text-indigo-500 hover:text-indigo-700">+ Confirmation</button>
            )}
            {ordination === null && (
              <button type="button" onClick={() => setOrdination('')} className="text-sm text-indigo-500 hover:text-indigo-700">+ Priesthood Advancement</button>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 bg-gray-50/90 backdrop-blur py-3">
        <div className="flex items-center gap-2">
          <button onClick={copyText}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100">
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
          <button onClick={exportPDF}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100">
            Export PDF
          </button>
        </div>
        <div className="flex items-center gap-3">
          {dirty && !saving && <span className="text-xs text-amber-600">Unsaved changes…</span>}
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          {savedAt && !dirty && !saving && <span className="text-xs text-green-600">Saved at {savedAt}</span>}
          {viewerMode === 'music' && (
            <button onClick={handleMusicSave} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Music'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function toAgendaCalling(c: CallingPipeline): AgendaCalling {
  return { member: c.member, calling: c.calling || '', organization: c.organization || '' };
}

function parseSnapshot(json: string): AgendaCalling[] {
  try { const r = JSON.parse(json); return Array.isArray(r) ? r : []; } catch { return []; }
}

export default function CurrentSacrament() {
  const { user, selectedHub } = useAuth();
  const isWcContext = user?.hub === 'wc' || (user?.hub === 'both' && selectedHub === 'wc');
  const viewerMode: ViewerMode = isWcContext
    ? 'readonly'
    : user?.role === 'viewer'
      ? (/music.?coordinator/i.test(user.church_role || '') ? 'music' : 'readonly')
      : undefined;

  const [date, setDate] = useState<string>(upcomingSunday());

  const speakers      = useTable<SacramentSpeaker>('sacrament-speakers');
  const prayers       = useTable<Prayer>('prayers');
  const music         = useTable<SacramentMusic>('sacrament-music');
  const themes        = useTable<SacramentTheme>('sacrament-themes');
  const announcements = useTable<SacramentAnnouncement>('sacrament-announcements');
  const notes         = useTable<SacramentAgendaNote>('sacrament-agenda-notes');
  const callings      = useTable<CallingPipeline>('calling-pipeline', { enabled: !isWcContext });
  const wardBusiness  = useTable<SacramentWardBusiness>('sacrament-ward-business');

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentDate = date >= today;

  const wardBusinessForDate = wardBusiness.rows.find(r => dk(r.meeting_date) === date);

  // For current/upcoming dates use live calling-pipeline data.
  // For past dates use the snapshot saved when the agenda was last saved.
  const displayThanksgivings: AgendaCalling[] = isCurrentDate
    ? callings.rows.filter(c => c.status === '8. Need to thank at pulpit').map(toAgendaCalling)
    : parseSnapshot(wardBusinessForDate?.thanksgivings_snapshot ?? '[]');

  const displaySustainingsList: AgendaCalling[] = isCurrentDate
    ? callings.rows.filter(c => c.status === '4. Called & accepted').map(toAgendaCalling)
    : parseSnapshot(wardBusinessForDate?.sustainings_snapshot ?? '[]');

  // When viewing the current week, lock any past meeting dates that have no snapshot yet
  // by saving empty snapshots for them, so future live data doesn't bleed through.
  const autoSavedRef = useRef(false);
  useEffect(() => {
    if (viewerMode) return;
    if (!isCurrentDate) return;
    if (wardBusiness.isLoading || speakers.isLoading || music.isLoading || themes.isLoading) return;
    if (autoSavedRef.current) return;
    autoSavedRef.current = true;

    const savedDates = new Set(wardBusiness.rows.map(r => dk(r.meeting_date)));
    const pastDates = new Set<string>();
    for (const r of [...speakers.rows, ...music.rows, ...themes.rows, ...notes.rows]) {
      const d = dk(r.meeting_date);
      if (d && d < today) pastDates.add(d);
    }
    for (const d of pastDates) {
      if (!savedDates.has(d)) {
        wardBusiness.create({ meeting_date: d, sustainings_snapshot: '[]', thanksgivings_snapshot: '[]' }, { silent: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentDate, wardBusiness.isLoading, speakers.isLoading, music.isLoading, themes.isLoading]);

  const onSaveSnapshot = async (s: AgendaCalling[], t: AgendaCalling[]) => {
    const data = {
      meeting_date: date,
      sustainings_snapshot: JSON.stringify(s),
      thanksgivings_snapshot: JSON.stringify(t),
    };
    if (wardBusinessForDate) {
      await wardBusiness.update(wardBusinessForDate.id, data, { silent: true });
    } else {
      await wardBusiness.create(data, { silent: true });
    }
  };

  const loading = speakers.isLoading || prayers.isLoading || music.isLoading || themes.isLoading
    || announcements.isLoading || notes.isLoading || callings.isLoading || wardBusiness.isLoading;

  const shiftSunday = (weeks: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + weeks * 7);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Current Sacrament Meeting</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(upcomingSunday())} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Next Sunday</button>
          <button onClick={() => shiftSunday(-1)} className="px-2 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">‹</button>
          <button onClick={() => shiftSunday(1)} className="px-2 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">›</button>
          <span className="font-semibold text-gray-800 ml-1">{label}</span>
          {!isCurrentDate && !wardBusinessForDate && (
            <span className="text-xs text-amber-600 italic ml-2">(no saved snapshot)</span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <AgendaEditor
          key={date}
          date={date}
          speakers={speakers} prayers={prayers} music={music} themes={themes}
          announcements={announcements} notes={notes}
          thanksgivings={displayThanksgivings} sustainings={displaySustainingsList}
          onSaveSnapshot={onSaveSnapshot}
          viewerMode={viewerMode}
        />
      )}
    </div>
  );
}
