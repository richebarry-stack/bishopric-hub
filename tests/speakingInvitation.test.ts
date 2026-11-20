import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  talkTypeForSpeaker, scheduleFieldsFor, buildLetter, letterText, lengthPhrase, composeUrl,
  claudePrompt, withDefaults, nextSunday, DEFAULT_INVITATION_SETTINGS,
} from '../shared/speakingInvitation';

test('talkTypeForSpeaker maps schedule rows to talk types', () => {
  assert.equal(talkTypeForSpeaker({ speaker_type: 'Youth Speaker', speaker_occasion: null, notes: '' }), 'Youth');
  assert.equal(talkTypeForSpeaker({ speaker_type: 'Adult Speaker', speaker_occasion: 'Homecoming', notes: '' }), 'Returning missionary');
  assert.equal(talkTypeForSpeaker({ speaker_type: 'Adult Speaker', speaker_occasion: 'Farewell', notes: '' }), 'Adult');
  assert.equal(talkTypeForSpeaker({ speaker_type: 'Adult Speaker', speaker_occasion: null, notes: 'High council' }), 'High council');
  assert.equal(talkTypeForSpeaker({ speaker_type: null, speaker_occasion: null, notes: null }), 'Adult');
});

test('scheduleFieldsFor saves talk types onto the two schedule speaker types', () => {
  assert.deepEqual(scheduleFieldsFor('Youth', ''), { speaker_type: 'Youth Speaker', speaker_occasion: null, notes: '' });
  assert.deepEqual(scheduleFieldsFor('Returning missionary', 'x'), { speaker_type: 'Adult Speaker', speaker_occasion: 'Homecoming', notes: 'x' });
  assert.deepEqual(scheduleFieldsFor('High council', 'Bro. Smith'), { speaker_type: 'Adult Speaker', speaker_occasion: null, notes: 'High council. Bro. Smith' });
  assert.equal(scheduleFieldsFor('High council', 'High council').notes, 'High council');
  // A farewell occasion is kept; a homecoming is cleared when the type changes away
  assert.equal(scheduleFieldsFor('Adult', '', 'Farewell').speaker_occasion, 'Farewell');
  assert.equal(scheduleFieldsFor('Adult', '', 'Homecoming').speaker_occasion, null);
});

test('lengthPhrase', () => {
  assert.equal(lengthPhrase('7'), 'about 7 minutes');
  assert.equal(lengthPhrase('3–5'), 'about 3–5 minutes');
  assert.equal(lengthPhrase('10 minutes'), '10 minutes');
  assert.equal(lengthPhrase(''), '');
});

test('buildLetter fills placeholders and skips empty sections', () => {
  const sections = buildLetter(
    { name: 'Robbins, Eli', date: '2026-11-22', topic: 'Gratitude', minutes: '7', scriptures: 'D&C 59:7', resources: '' },
    { ...DEFAULT_INVITATION_SETTINGS, guidance: 'Speak {minutes} on {topic}.', signature: '{ward} Bishopric' },
    'G2 Ward',
  );
  const text = letterText(sections, 'G2 Ward');
  assert.match(text, /^G2 Ward — Sacrament Meeting Speaking Invitation/);
  assert.match(text, /Dear Eli Robbins,/);
  assert.match(text, /on Sunday, November 22, 2026/);
  assert.match(text, /Speak about 7 minutes on Gratitude\./);
  assert.match(text, /G2 Ward Bishopric$/);
  assert.doesNotMatch(text, /Additional resources/);
});

test('composeUrl encodes for each client', () => {
  assert.equal(composeUrl('Gmail', 'a@b.com', 'Hi & bye', 'L1\nL2'),
    'https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.com&su=Hi%20%26%20bye&body=L1%0AL2');
  assert.match(composeUrl('Default mail app', '', 'S', 'B'), /^mailto:\?subject=S&body=B$/);
  assert.match(composeUrl('Outlook.com', 'x@y.z', 'S', 'B'), /^https:\/\/outlook\.live\.com\/mail\/0\/deeplink\/compose\?to=x%40y\.z/);
});

test('claudePrompt stays on the topic and caps it', () => {
  const p = claudePrompt('  Faith   in Christ ', 'Youth', '3–5');
  assert.match(p, /Topic: "Faith in Christ"/);
  assert.match(p, /youth speaker/);
  assert.match(p, /3–5 minutes/);
  assert.match(p, /Up to 5 scripture references/);
  assert.ok(claudePrompt('x'.repeat(500), 'Adult', '7').includes('x'.repeat(200) + '"'));
});

test('withDefaults ignores malformed saved settings', () => {
  assert.deepEqual(withDefaults(null), DEFAULT_INVITATION_SETTINGS);
  const s = withDefaults({ minutes: { Adult: '8', Youth: 5 }, guidance: 'G' });
  assert.equal(s.minutes.Adult, '8');
  assert.equal(s.minutes.Youth, '3–5');
  assert.equal(s.guidance, 'G');
  assert.equal(s.signature, DEFAULT_INVITATION_SETTINGS.signature);
});

test('nextSunday', () => {
  assert.equal(nextSunday(new Date(2026, 10, 20)), '2026-11-22'); // Friday
  assert.equal(nextSunday(new Date(2026, 10, 22)), '2026-11-22'); // Sunday
});
