// Speaking Invitations (hub suggestion #42): the letter text, the "Ask Claude"
// prompt, the web-mail compose links, and how the generator's talk types map
// onto sacrament_speakers rows. Pure functions so they can be unit tested.

import { toFirstLast } from './text';

export const TALK_TYPES = ['Adult', 'Youth', 'Returning missionary', 'High council'] as const;
export type TalkType = typeof TALK_TYPES[number];

export interface InvitationSettings {
  /** Talk length shown on the letter for each talk type, e.g. "7" or "3–5". */
  minutes: Record<TalkType, string>;
  /** Paragraphs after the assignment details. Placeholders: {minutes} {date} {topic} {name} {ward}. */
  guidance: string;
  /** Closing lines. Same placeholders. */
  signature: string;
}

export const DEFAULT_INVITATION_SETTINGS: InvitationSettings = {
  minutes: { 'Adult': '7', 'Youth': '3–5', 'Returning missionary': '10', 'High council': '15' },
  guidance: [
    'Your talk will be most meaningful if you:',
    '• Center it on Jesus Christ and His gospel.',
    '• Use the scriptures and the words of latter-day prophets and apostles.',
    '• Share your own experiences and testimony.',
    '',
    'Please arrive about 10 minutes before the meeting starts and sit on the stand. If you have questions, or if this date no longer works for you, please let us know as soon as you can.',
  ].join('\n'),
  signature: 'Thank you,\n{ward} Bishopric',
};

/** Merge saved settings over the defaults, ignoring anything malformed. */
export function withDefaults(saved: unknown): InvitationSettings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<InvitationSettings>;
  const minutes = { ...DEFAULT_INVITATION_SETTINGS.minutes };
  if (s.minutes && typeof s.minutes === 'object') {
    for (const t of TALK_TYPES) {
      const v = (s.minutes as Record<string, unknown>)[t];
      if (typeof v === 'string' && v.trim()) minutes[t] = v.trim();
    }
  }
  return {
    minutes,
    guidance: typeof s.guidance === 'string' ? s.guidance : DEFAULT_INVITATION_SETTINGS.guidance,
    signature: typeof s.signature === 'string' ? s.signature : DEFAULT_INVITATION_SETTINGS.signature,
  };
}

export interface ScheduledSpeaker {
  speaker_type: string | null;
  speaker_occasion: string | null;
  notes: string | null;
}

/** Which talk type a scheduled speaker row is. */
export function talkTypeForSpeaker(s: ScheduledSpeaker): TalkType {
  if ((s.speaker_occasion || '').toLowerCase() === 'homecoming') return 'Returning missionary';
  if (/high council/i.test(s.notes || '')) return 'High council';
  if ((s.speaker_type || '').toLowerCase().startsWith('youth')) return 'Youth';
  return 'Adult';
}

/** The sacrament_speakers fields to save for a talk type. The schedule only has
 * Adult and Youth speaker types: returning missionaries keep the Homecoming
 * occasion and high council speakers get "High council" in their notes. */
export function scheduleFieldsFor(type: TalkType, existingNotes: string | null | undefined, existingOccasion?: string | null): {
  speaker_type: string; speaker_occasion: string | null; notes: string;
} {
  let notes = existingNotes || '';
  if (type === 'High council' && !/high council/i.test(notes)) notes = notes.trim() ? `High council. ${notes.trim()}` : 'High council';
  let occasion = existingOccasion ?? null;
  if (type === 'Returning missionary') occasion = 'Homecoming';
  else if ((occasion || '').toLowerCase() === 'homecoming') occasion = null;
  return { speaker_type: type === 'Youth' ? 'Youth Speaker' : 'Adult Speaker', speaker_occasion: occasion, notes };
}

export interface InvitationFields {
  name: string;      // as stored ("Last, First") or typed
  date: string;      // YYYY-MM-DD
  topic: string;
  minutes: string;
  scriptures: string;
  resources: string;
}

export function formatSunday(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "7" → "about 7 minutes"; "3–5" → "about 3–5 minutes"; "10 minutes" stays as typed. */
export function lengthPhrase(minutes: string): string {
  const m = (minutes || '').trim();
  if (!m) return '';
  return /min/i.test(m) ? m : `about ${m} minutes`;
}

function fill(template: string, f: InvitationFields, ward: string): string {
  return template
    .replace(/\{minutes\}/g, lengthPhrase(f.minutes))
    .replace(/\{date\}/g, formatSunday(f.date))
    .replace(/\{topic\}/g, f.topic.trim())
    .replace(/\{name\}/g, toFirstLast(f.name).trim())
    .replace(/\{ward\}/g, ward.trim() || 'The');
}

export interface LetterSection { label?: string; text: string }

/** The letter as ordered sections; the page renders them, and the plain text
 * (for copy and email) is built from the same list. */
export function buildLetter(f: InvitationFields, settings: InvitationSettings, ward: string): LetterSection[] {
  const name = toFirstLast(f.name).trim();
  const date = formatSunday(f.date);
  const out: LetterSection[] = [];
  out.push({ text: name ? `Dear ${name},` : 'Dear ____________,' });
  out.push({ text: `We invite you to speak in sacrament meeting${date ? ` on ${date}` : ''}. Thank you for being willing to share your testimony with the ward.` });
  if (f.topic.trim()) out.push({ label: 'Topic', text: f.topic.trim() });
  if (f.minutes.trim()) out.push({ label: 'Length', text: lengthPhrase(f.minutes) });
  if (f.scriptures.trim()) out.push({ label: 'Scriptures', text: f.scriptures.trim() });
  if (f.resources.trim()) out.push({ label: 'Additional resources', text: f.resources.trim() });
  if (settings.guidance.trim()) out.push({ text: fill(settings.guidance, f, ward).trim() });
  if (settings.signature.trim()) out.push({ text: fill(settings.signature, f, ward).trim() });
  return out;
}

export function letterTitle(ward: string): string {
  return ward.trim() ? `${ward.trim()} — Sacrament Meeting Speaking Invitation` : 'Sacrament Meeting Speaking Invitation';
}

export function letterText(sections: LetterSection[], ward: string): string {
  const body = sections.map(s => (s.label ? `${s.label}:\n${s.text}` : s.text)).join('\n\n');
  return `${letterTitle(ward)}\n\n${body}`;
}

export function emailSubject(date: string): string {
  const d = formatSunday(date);
  return d ? `Sacrament meeting talk — ${d}` : 'Sacrament meeting talk';
}

export const MAIL_CLIENTS = ['Gmail', 'Outlook.com', 'Outlook (work or school)', 'Yahoo Mail', 'Default mail app'] as const;
export type MailClient = typeof MAIL_CLIENTS[number];

/** A link that opens a pre-filled draft in the chosen mail client. */
export function composeUrl(client: MailClient, to: string, subject: string, body: string): string {
  const e = encodeURIComponent;
  const addr = to.trim();
  switch (client) {
    case 'Gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${e(addr)}&su=${e(subject)}&body=${e(body)}`;
    case 'Outlook.com':
      return `https://outlook.live.com/mail/0/deeplink/compose?to=${e(addr)}&subject=${e(subject)}&body=${e(body)}`;
    case 'Outlook (work or school)':
      return `https://outlook.office.com/mail/deeplink/compose?to=${e(addr)}&subject=${e(subject)}&body=${e(body)}`;
    case 'Yahoo Mail':
      return `https://compose.mail.yahoo.com/?to=${e(addr)}&subject=${e(subject)}&body=${e(body)}`;
    default:
      return `mailto:${e(addr)}?subject=${e(subject)}&body=${e(body)}`;
  }
}

/** The prompt the user takes to their own Claude account. Kept narrowly on
 * finding sources for one sacrament meeting talk. */
export function claudePrompt(topic: string, type: TalkType, minutes: string): string {
  const t = topic.trim().replace(/\s+/g, ' ').slice(0, 200);
  const audience = type === 'Youth' ? 'a youth speaker (age 12–17)' : type === 'Returning missionary' ? 'a returning missionary' : type === 'High council' ? 'a high council speaker' : 'an adult ward member';
  const len = lengthPhrase(minutes);
  return [
    `I'm helping ${audience} prepare a ${len ? `${len.replace(/^about /, '')} ` : ''}sacrament meeting talk for The Church of Jesus Christ of Latter-day Saints.`,
    '',
    `Topic: "${t}"`,
    '',
    'Please suggest sources for this topic only:',
    '1. Up to 5 scripture references from the Bible, Book of Mormon, Doctrine and Covenants, or Pearl of Great Price, each with one short sentence on how it relates to the topic.',
    '2. Up to 3 General Conference talks, each with the title, speaker, and conference (month and year).',
    '',
    'Only include talks you are confident exist. If you aren\'t sure of a talk, leave it out rather than guessing. Don\'t write the talk itself, and keep the answer to these two lists.',
  ].join('\n');
}

export function claudeUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

/** The next Sunday on or after the given date (YYYY-MM-DD, local time). */
export function nextSunday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
