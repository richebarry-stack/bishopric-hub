import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import type { SacramentSpeaker, SacramentTheme } from '../lib/api';
import MemberNameInput from '../components/MemberNameInput';
import Modal from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { useWardName } from '../lib/wardName';
import { normalizeNameKey } from '../lib/nameMatch';
import { toast } from '../lib/toast';
import {
  TALK_TYPES, MAIL_CLIENTS, DEFAULT_INVITATION_SETTINGS, withDefaults, talkTypeForSpeaker, scheduleFieldsFor,
  buildLetter, letterText, letterTitle, emailSubject, composeUrl, claudePrompt, claudeUrl, nextSunday, formatSunday,
  type TalkType, type MailClient, type InvitationSettings, type InvitationFields,
} from '../../shared/speakingInvitation';

interface SpeakingTopic {
  id: number;
  topic: string;
  scriptures: string;
  resources: string;
  updated_at?: string;
}

const SETTINGS_KEY = 'speaking_invitation_settings';
const MAIL_CLIENT_KEY = 'speaking_invitation_mail_client';
const AI_DISCLAIMER = 'AI suggestions can be wrong or cite talks that don’t exist. Check each scripture and talk in Gospel Library before adding it to the letter.';

async function fetchSettings(): Promise<InvitationSettings> {
  const res = await fetch(`/api/ui-settings/${SETTINGS_KEY}`);
  if (!res.ok) return DEFAULT_INVITATION_SETTINGS;
  return withDefaults(await res.json());
}

const dateKey = (d: string | null | undefined) => (d || '').slice(0, 10);

// The most recent Sunday (today if it is Sunday), so the schedule picker skips past meetings.
const RECENT_SUNDAY = nextSunday(new Date(Date.now() - 6 * 86400000));

const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadMailClient(): MailClient {
  try {
    const v = localStorage.getItem(MAIL_CLIENT_KEY);
    if (v && (MAIL_CLIENTS as readonly string[]).includes(v)) return v as MailClient;
  } catch { /* ignore */ }
  return 'Gmail';
}

export default function SpeakingInvitations() {
  const ward = useWardName();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const speakers = useTable<SacramentSpeaker>('sacrament-speakers');
  const { rows: themes } = useTable<SacramentTheme>('sacrament-themes');
  const topics = useTable<SpeakingTopic>('speaking-topics');
  const { data: settings = DEFAULT_INVITATION_SETTINGS } = useQuery({ queryKey: ['ui-settings', SETTINGS_KEY], queryFn: fetchSettings });

  const [speakerId, setSpeakerId] = useState<number | null>(null);
  const [name, setName] = useState(() => searchParams.get('name') || '');
  const [date, setDate] = useState(() => {
    const d = searchParams.get('date');
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : nextSunday();
  });
  const [talkType, setTalkType] = useState<TalkType>('Adult');
  const [minutes, setMinutes] = useState<string | null>(null); // null = the talk type's default
  const [topic, setTopic] = useState('');
  const [scriptures, setScriptures] = useState('');
  const [resources, setResources] = useState('');
  const [email, setEmail] = useState('');
  const [mailClient, setMailClient] = useState<MailClient>(loadMailClient);
  const [sendOpen, setSendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const sendRef = useRef<HTMLDivElement>(null);

  const minutesValue = minutes ?? settings.minutes[talkType];

  // Opened from a scheduled speaker (?speakerId=): fill the form from that row once it loads.
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    const idParam = searchParams.get('speakerId');
    if (!idParam || prefilledFor.current === idParam || speakers.rows.length === 0) return;
    const row = speakers.rows.find(s => s.id === Number(idParam));
    prefilledFor.current = idParam;
    if (!row) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time fill once the schedule loads */
    setSpeakerId(row.id);
    setName(row.speaker || '');
    if (dateKey(row.meeting_date)) setDate(dateKey(row.meeting_date));
    setTalkType(talkTypeForSpeaker(row));
    setMinutes(null);
    if (row.topic) setTopic(row.topic);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams, speakers.rows]);

  const theme = useMemo(() => themes.find(t => dateKey(t.meeting_date) === date), [themes, date]);
  const themeText = (theme?.theme || '').trim();
  const themeRefs = (theme?.references_text || '').trim();

  // Speakers already on the schedule for the chosen Sunday, for the "Prefill from schedule" picker.
  const upcoming = useMemo(() => {
    const today = RECENT_SUNDAY;
    return speakers.rows
      .filter(s => dateKey(s.meeting_date) >= today && (s.speaker || '').trim())
      .sort((a, b) => dateKey(a.meeting_date).localeCompare(dateKey(b.meeting_date)) || (a.speaking_order || 0) - (b.speaking_order || 0))
      .slice(0, 40);
  }, [speakers.rows]);

  const fields: InvitationFields = { name, date, topic, minutes: minutesValue, scriptures, resources };
  const sections = buildLetter(fields, settings, ward);
  const plainText = letterText(sections, ward);

  const appendTo = (current: string, add: string) => {
    const a = add.trim();
    if (!a) return current;
    if (current.includes(a)) return current;
    return current.trim() ? `${current.trim()}\n${a}` : a;
  };

  const applyTheme = () => {
    if (themeText) setTopic(themeText);
    if (themeRefs) setScriptures(s => appendTo(s, themeRefs));
  };

  const applyTopic = (id: string) => {
    const t = topics.rows.find(x => x.id === Number(id));
    if (!t) return;
    setTopic(t.topic);
    setScriptures(s => appendTo(s, t.scriptures));
    setResources(r => appendTo(r, t.resources));
  };

  const pickScheduled = (id: string) => {
    const row = speakers.rows.find(s => s.id === Number(id));
    if (!row) { setSpeakerId(null); return; }
    setSpeakerId(row.id);
    setName(row.speaker || '');
    if (dateKey(row.meeting_date)) setDate(dateKey(row.meeting_date));
    setTalkType(talkTypeForSpeaker(row));
    setMinutes(null);
    setTopic(row.topic || '');
  };

  const askClaude = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first.'); return; }
    const prompt = claudePrompt(topic, talkType, minutesValue);
    try { await navigator.clipboard.writeText(prompt); toast.success('Prompt copied. If Claude doesn’t fill it in, paste it.'); } catch { /* the link still carries it */ }
    window.open(claudeUrl(prompt), '_blank', 'noopener');
  };

  const copyPrompt = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first.'); return; }
    try { await navigator.clipboard.writeText(claudePrompt(topic, talkType, minutesValue)); toast.success('Prompt copied'); }
    catch { toast.error('Could not copy. Your browser blocked clipboard access.'); }
  };

  const copyText = async () => {
    try { await navigator.clipboard.writeText(plainText); toast.success('Invitation copied'); }
    catch { toast.error('Could not copy. Your browser blocked clipboard access.'); }
  };

  const generatePdf = () => {
    const body = sections.map(s => s.label
      ? `<p class="lbl">${esc(s.label)}</p><p class="val">${esc(s.text).replace(/\n/g, '<br>')}</p>`
      : `<p>${esc(s.text).replace(/\n/g, '<br>')}</p>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(letterTitle(ward))}</title>
<style>
body{font-family:Georgia,serif;max-width:6.5in;margin:0.6in auto;color:#111;font-size:12.5pt;line-height:1.45}
h1{font-size:15pt;text-align:center;margin:0 0 0.15in;font-weight:normal;letter-spacing:0.03em}
h2{font-size:11pt;text-align:center;margin:0 0 0.35in;font-weight:normal;color:#444;border-bottom:1px solid #bbb;padding-bottom:0.15in;text-transform:uppercase;letter-spacing:0.12em}
p{margin:0 0 0.16in}.lbl{margin:0;font-weight:bold;font-size:11pt}.val{margin:0 0 0.16in 0.25in}
.tip{font-family:system-ui,sans-serif;text-align:center;color:#888;font-size:10pt;margin-bottom:0.3in}
@media print{@page{size:letter;margin:0.75in}body{margin:0}.tip{display:none}}
</style></head><body><p class="tip">Click any text to edit it, then print or choose “Save as PDF”.</p>
<div contenteditable="true" spellcheck="false">${ward ? `<h1>${esc(ward)}</h1>` : ''}<h2>Sacrament Meeting Speaking Invitation</h2>${body}</div></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Your browser blocked the new window. Allow pop-ups for this site.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const send = (client: MailClient) => {
    setMailClient(client);
    try { localStorage.setItem(MAIL_CLIENT_KEY, client); } catch { /* ignore */ }
    setSendOpen(false);
    const url = composeUrl(client, email, emailSubject(date), plainText);
    if (client === 'Default mail app') window.location.assign(url);
    else window.open(url, '_blank', 'noopener');
  };

  useEffect(() => {
    if (!sendOpen) return;
    const close = (e: MouseEvent) => { if (sendRef.current && !sendRef.current.contains(e.target as Node)) setSendOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [sendOpen]);

  const saveToSchedule = async () => {
    if (!name.trim()) { toast.error('Enter the speaker’s name first.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error('Pick the Sunday first.'); return; }
    const key = normalizeNameKey(name);
    const linked = speakerId ? speakers.rows.find(s => s.id === speakerId) : undefined;
    const existing = linked && dateKey(linked.meeting_date) === date
      ? linked
      : speakers.rows.find(s => dateKey(s.meeting_date) === date && normalizeNameKey(s.speaker || '') === key);
    const typeFields = scheduleFieldsFor(talkType, existing?.notes, existing?.speaker_occasion);
    setSaving(true);
    try {
      if (existing) {
        await speakers.update(existing.id, { speaker: name.trim(), meeting_date: date, topic: topic.trim(), ...typeFields });
        setSpeakerId(existing.id);
      } else {
        const order = Math.max(0, ...speakers.rows.filter(s => dateKey(s.meeting_date) === date).map(s => s.speaking_order || 0)) + 1;
        const created = await speakers.create({ speaker: name.trim(), meeting_date: date, topic: topic.trim(), accepted: '', speaking_order: order, ...typeFields });
        if (created && typeof (created as { id?: unknown }).id === 'number') setSpeakerId((created as { id: number }).id);
      }
    } finally { setSaving(false); }
  };

  const linkedRow = speakerId ? speakers.rows.find(s => s.id === speakerId) : undefined;
  const scheduledLabel = (s: SacramentSpeaker) => `${formatSunday(dateKey(s.meeting_date)).replace(/^\w+, /, '')} — ${s.speaker}${s.topic ? ` (${s.topic})` : ''}`;

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Speaking Invitations</h1>
          <p className="text-sm text-gray-500">Fill in the talk details, then print, save as PDF, or email the invitation.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLibraryOpen(true)} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Topic library</button>
          <button onClick={() => setSettingsOpen(true)} className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Template settings</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {upcoming.length > 0 && (
            <div>
              <label className={labelCls} htmlFor="si-sched">Prefill from schedule</label>
              <select id="si-sched" className={inputCls} value={speakerId ?? ''} onChange={e => pickScheduled(e.target.value)}>
                <option value="">— Not linked to a scheduled speaker —</option>
                {linkedRow && !upcoming.includes(linkedRow) && <option value={linkedRow.id}>{scheduledLabel(linkedRow)}</option>}
                {upcoming.map(s => <option key={s.id} value={s.id}>{scheduledLabel(s)}</option>)}
              </select>
            </div>
          )}

          <MemberNameInput label="Speaker" value={name} onChange={setName} required />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="si-date">Sunday</label>
              <input id="si-date" type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="si-type">Talk type</label>
              <select id="si-type" className={inputCls} value={talkType} onChange={e => { setTalkType(e.target.value as TalkType); setMinutes(null); }}>
                {TALK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
            <div>
              <label className={labelCls} htmlFor="si-min">Minutes</label>
              <input id="si-min" className={inputCls} value={minutesValue} onChange={e => setMinutes(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="si-topic">Topic</label>
              <input id="si-topic" className={inputCls} value={topic} maxLength={200} onChange={e => setTopic(e.target.value)} />
            </div>
          </div>

          {/* Source helpers */}
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-3 text-sm">
            <p className="font-medium text-gray-700">Find sources</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-600">This Sunday’s theme:</span>
              {themeText || themeRefs ? (
                <>
                  <span className="text-gray-900">{themeText || '(references only)'}</span>
                  <button onClick={applyTheme} className="text-blue-600 hover:underline">Use theme</button>
                </>
              ) : <span className="text-gray-400">none set</span>}
            </div>
            <div>
              <label className="text-gray-600 mr-2" htmlFor="si-lib">Topic library:</label>
              <select id="si-lib" className="rounded-md border border-gray-300 px-2 py-1 text-sm max-w-full" value="" onChange={e => applyTopic(e.target.value)}>
                <option value="">Pick a topic to add its sources…</option>
                {topics.rows.map(t => <option key={t.id} value={t.id}>{t.topic}</option>)}
              </select>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={askClaude} className="px-3 py-1.5 rounded-md bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100">Ask Claude for sources ↗</button>
                <button onClick={copyPrompt} className="text-gray-600 hover:underline">Copy prompt only</button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Opens Claude.ai in a new tab with a prompt for this topic, using your own Claude account. Copy the sources you want back into the boxes below.</p>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">⚠ {AI_DISCLAIMER}</p>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="si-scr">Scriptures <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea id="si-scr" rows={3} className={inputCls} value={scriptures} onChange={e => setScriptures(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="si-res">Additional resources <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea id="si-res" rows={3} className={inputCls} value={resources} onChange={e => setResources(e.target.value)} placeholder="Conference talks, Gospel Library links…" />
            <p className="text-xs text-gray-400 mt-1">If you pasted anything from Claude, check it before sending. {AI_DISCLAIMER.split('. ')[0]}.</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="si-email">Speaker’s email <span className="font-normal text-gray-400">(optional, for Send)</span></label>
            <input id="si-email" type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={generatePdf} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Generate PDF</button>
            <div className="relative" ref={sendRef}>
              <button onClick={() => setSendOpen(o => !o)} className="px-3 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Send ▾</button>
              {sendOpen && (
                <div className="absolute z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg py-1">
                  {MAIL_CLIENTS.map(c => (
                    <button key={c} onClick={() => send(c)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                      {c}{c === mailClient && <span className="text-gray-400"> (last used)</span>}
                    </button>
                  ))}
                  <p className="px-3 pt-1 pb-1.5 text-xs text-gray-400 border-t border-gray-100 mt-1">Opens a draft with the letter. Attach the PDF yourself if you want it.</p>
                </div>
              )}
            </div>
            <button onClick={copyText} className="px-3 py-2 rounded-md text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">Copy text</button>
            <button onClick={saveToSchedule} disabled={saving} className="px-3 py-2 rounded-md text-sm border border-green-300 text-green-800 bg-green-50 hover:bg-green-100 disabled:opacity-50">
              {saving ? 'Saving…' : linkedRow ? 'Update schedule' : 'Save to schedule'}
            </button>
          </div>
          {linkedRow && <p className="text-xs text-gray-500">Linked to {linkedRow.speaker} on {formatSunday(dateKey(linkedRow.meeting_date))} in Sacrament Planning.</p>}
        </div>

        {/* Preview */}
        <div className="bg-gray-100 rounded-lg border border-gray-200 p-3 sm:p-6">
          <div className="bg-white shadow-sm mx-auto max-w-[8.5in] px-6 py-8 sm:px-14 sm:py-12 font-serif text-[15px] leading-relaxed text-gray-900">
            {ward && <p className="text-center text-lg tracking-wide">{ward}</p>}
            <p className="text-center text-xs uppercase tracking-[0.15em] text-gray-500 border-b border-gray-300 pb-3 mb-6 mt-1">Sacrament Meeting Speaking Invitation</p>
            {sections.map((s, i) => s.label ? (
              <div key={i} className="mb-3">
                <p className="font-bold text-sm">{s.label}</p>
                <p className="ml-5 whitespace-pre-line">{s.text}</p>
              </div>
            ) : <p key={i} className="mb-4 whitespace-pre-line">{s.text}</p>)}
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['ui-settings', SETTINGS_KEY] })} />
      <TopicLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)} topics={topics} confirm={confirm} />
    </div>
  );
}

function SettingsModal({ open, onClose, settings, onSaved }: { open: boolean; onClose: () => void; settings: InvitationSettings; onSaved: () => void }) {
  const [draft, setDraft] = useState(settings);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) { setPrevOpen(open); if (open) setDraft(settings); }

  const save = async () => {
    const res = await fetch(`/api/ui-settings/${SETTINGS_KEY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    if (!res.ok) { toast.error('Could not save the template settings.'); return; }
    toast.success('Saved');
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Template settings">
      <div className="space-y-4 text-sm">
        <p className="text-gray-500">Shared by everyone in the bishopric. In the text boxes you can use {'{name}'}, {'{date}'}, {'{topic}'}, {'{minutes}'} and {'{ward}'}.</p>
        <div>
          <p className={labelCls}>Default talk length (minutes)</p>
          <div className="grid grid-cols-2 gap-2">
            {TALK_TYPES.map(t => (
              <label key={t} className="flex items-center justify-between gap-2 text-gray-700">
                {t}
                <input className="w-20 rounded-md border border-gray-300 px-2 py-1" value={draft.minutes[t]}
                  onChange={e => setDraft({ ...draft, minutes: { ...draft.minutes, [t]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="si-guid">Speaking guidance</label>
          <textarea id="si-guid" rows={8} className={inputCls} value={draft.guidance} onChange={e => setDraft({ ...draft, guidance: e.target.value })} />
        </div>
        <div>
          <label className={labelCls} htmlFor="si-sig">Signature</label>
          <textarea id="si-sig" rows={3} className={inputCls} value={draft.signature} onChange={e => setDraft({ ...draft, signature: e.target.value })} />
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <button onClick={() => setDraft(DEFAULT_INVITATION_SETTINGS)} className="text-gray-500 hover:underline">Reset to defaults</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TopicLibraryModal({ open, onClose, topics, confirm }: {
  open: boolean; onClose: () => void;
  topics: ReturnType<typeof useTable<SpeakingTopic>>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const [edit, setEdit] = useState<Partial<SpeakingTopic> | null>(null);

  const save = async () => {
    if (!edit || !(edit.topic || '').trim()) { toast.error('Enter a topic name.'); return; }
    const data = { topic: edit.topic!.trim(), scriptures: (edit.scriptures || '').trim(), resources: (edit.resources || '').trim() };
    if (edit.id) await topics.update(edit.id, data);
    else await topics.create(data);
    setEdit(null);
  };

  return (
    <Modal open={open} onClose={() => { setEdit(null); onClose(); }} title={edit ? (edit.id ? 'Edit topic' : 'New topic') : 'Topic library'}>
      {edit ? (
        <div className="space-y-3 text-sm">
          <div>
            <label className={labelCls} htmlFor="tl-topic">Topic</label>
            <input id="tl-topic" className={inputCls} value={edit.topic || ''} onChange={e => setEdit({ ...edit, topic: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="tl-scr">Scriptures</label>
            <textarea id="tl-scr" rows={3} className={inputCls} value={edit.scriptures || ''} onChange={e => setEdit({ ...edit, scriptures: e.target.value })} />
          </div>
          <div>
            <label className={labelCls} htmlFor="tl-res">Resources (talks, links)</label>
            <textarea id="tl-res" rows={4} className={inputCls} value={edit.resources || ''} onChange={e => setEdit({ ...edit, resources: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEdit(null)} className="px-4 py-2 text-gray-600">Back</button>
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-gray-500">Shared by the bishopric. Picking a topic on the form adds its scriptures and resources.</p>
            <button onClick={() => setEdit({ topic: '', scriptures: '', resources: '' })} className="shrink-0 ml-3 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">+ Add</button>
          </div>
          {topics.rows.length === 0 && <p className="text-gray-400 text-center py-4">No topics yet</p>}
          <ul className="divide-y divide-gray-100">
            {topics.rows.map(t => (
              <li key={t.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{t.topic}</p>
                  {t.scriptures && <p className="text-xs text-gray-500">{t.scriptures}</p>}
                  {t.resources && <p className="text-xs text-gray-400 whitespace-pre-line">{t.resources}</p>}
                </div>
                <div className="flex gap-3 shrink-0 text-xs">
                  <button onClick={() => setEdit(t)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={async () => { if (await confirm(`Delete the topic "${t.topic}"?`)) topics.remove(t.id); }} className="text-red-500 hover:underline">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
