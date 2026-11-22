import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easterDate, specialSundayFlags } from '../shared/specialSundays';
import { sustainingLine, appendSustainingLine, removeSustainingLine, hasSustainingLine, isAaronicOffice } from '../shared/ordinances';
import { parseChecklist, stringifyChecklist, checklistProgress, MEMBER_CARE_ITEMS } from '../shared/checklists';
import { buildIcs, foldIcsLine, escapeIcsText } from '../shared/ics';
import { computeActionItems, buildNameIndex, type ActionItemSources } from '../shared/actionItems';

test('easterDate matches known Easter Sundays', () => {
  assert.equal(easterDate(2024), '2024-03-31');
  assert.equal(easterDate(2025), '2025-04-20');
  assert.equal(easterDate(2026), '2026-04-05');
  assert.equal(easterDate(2027), '2027-03-28');
  assert.equal(easterDate(2038), '2038-04-25');
});

test('specialSundayFlags flags Easter, Christmas on Sunday and 5th Sundays only', () => {
  assert.deepEqual(specialSundayFlags('2026-04-05').map(f => f.key), ['easter']);
  assert.deepEqual(specialSundayFlags('2022-12-25').map(f => f.key), ['christmas']);
  assert.deepEqual(specialSundayFlags('2026-11-29').map(f => f.key), ['fifth']);
  assert.deepEqual(specialSundayFlags('2026-11-22'), []);
  assert.deepEqual(specialSundayFlags('2026-12-25'), []); // a Friday
  assert.deepEqual(specialSundayFlags('nope'), []);
});

test('sustaining lines for Aaronic Priesthood offices', () => {
  assert.ok(isAaronicOffice('Deacon') && isAaronicOffice('Priest') && !isAaronicOffice('Baptism'));
  assert.match(sustainingLine('Sam Lee', 'Deacon'), /^We propose that Sam Lee receive the Aaronic Priesthood and be ordained a deacon\./);
  assert.match(sustainingLine('Sam Lee', 'Teacher'), /be ordained a teacher in the Aaronic Priesthood/);
  assert.match(sustainingLine('Sam Lee', 'Priest'), /be ordained a priest/);
});

test('appendSustainingLine adds once and removeSustainingLine takes it back out', () => {
  const start = 'We have received the records of the following: Ann Cole.';
  const once = appendSustainingLine(start, 'Sam Lee', 'Teacher');
  assert.equal(once.split('\n').length, 2);
  assert.equal(appendSustainingLine(once, 'Sam Lee', 'Teacher'), once);
  assert.ok(hasSustainingLine(once, 'Sam Lee', 'Teacher'));
  assert.equal(removeSustainingLine(once, 'Sam Lee', 'Teacher'), start);
  assert.equal(appendSustainingLine('', 'Sam Lee', 'Deacon'), sustainingLine('Sam Lee', 'Deacon'));
});

test('checklists round-trip and count progress', () => {
  assert.deepEqual(parseChecklist('{"welcome_visit":true,"calling":false,"x":1}'), { welcome_visit: true });
  assert.deepEqual(parseChecklist('not json'), {});
  assert.deepEqual(parseChecklist('[1]'), {});
  assert.equal(stringifyChecklist({ a: true, b: false }), '{"a":true}');
  assert.deepEqual(checklistProgress(MEMBER_CARE_ITEMS, { welcome_visit: true, temple: true }), { done: 2, total: 5 });
});

test('ics escapes text, folds long lines and writes timed and all-day events', () => {
  assert.equal(escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const folded = foldIcsLine('X'.repeat(160));
  assert.ok(folded.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75));
  assert.equal(folded.replace(/\r\n /g, ''), 'X'.repeat(160));
  const ics = buildIcs({
    name: 'Test', timeZone: 'America/Denver', now: new Date('2026-11-22T12:00:00Z'),
    events: [
      { uid: 'a@x', date: '2026-11-25', start: '19:00', end: '19:20', summary: 'Interview: Sam' },
      { uid: 'b@x', date: '2026-11-29', summary: 'Conducting' },
    ],
  });
  assert.ok(ics.includes('DTSTART;TZID=America/Denver:20261125T190000'));
  assert.ok(ics.includes('DTEND;TZID=America/Denver:20261125T192000'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261129'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261130'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});

const baseSources = (): ActionItemSources => ({
  tasks: [], callings: [], interviews: [], rotating: [], babies: [], todayIso: '2026-11-22',
  ordinances: [{ id: 1, member_name: 'Lee, Sam', ordinance_type: 'Deacon', status: 'Completed' }],
  welfare: [
    { id: 1, member_name: 'Cole family', status: 'Open', next_follow_up: '2026-11-25' },
    { id: 2, member_name: 'Far off', status: 'Open', next_follow_up: '2027-01-10' },
    { id: 3, member_name: 'Closed one', status: 'Closed', next_follow_up: '2026-11-20' },
  ],
  interviewBookings: [
    { id: 7, calendar: 'First Counselor', date: '2026-11-24', start_time: '19:00', reserved_by: 'Ann Cole', reserved_purpose: 'Temple recommend', reserved_at: 'x' },
    { id: 8, calendar: 'Bishop', date: '2026-11-20', start_time: '19:00', reserved_by: 'Past', reserved_purpose: null, reserved_at: 'y' },
  ],
});
const perms = (churchRole: string) => ({ canBishopric: true, canWc: true, canYc: false, isClerk: /clerk/i.test(churchRole), churchRole });

test('new action items go to the right callings', () => {
  const idx = buildNameIndex([]);
  const ids = (role: string) => computeActionItems('Someone', perms(role), baseSources(), idx, 'nov').map(i => i.id);
  assert.deepEqual(ids('Clerk'), ['clerk-ordinance-1']);
  assert.deepEqual(ids('Bishop'), ['welfare-1-2026-11-25']);
  assert.deepEqual(ids('First Counselor'), ['booking-7-x']);
  assert.deepEqual(ids('Executive Secretary'), ['booking-7-x']);
  assert.deepEqual(ids('Second Counselor'), []);
});
