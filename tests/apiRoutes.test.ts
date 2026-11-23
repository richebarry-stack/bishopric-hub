// API route tests: the real router against an in-memory database built from migrations/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from './helpers/apiHarness';
import { hashPasswordSecure } from '../functions/api/_lib/passwords';

const FUTURE = '2099-03-02';
const PAST = '2000-03-06';

test('auth: login sets a session cookie, /auth/me reads it, bad password is refused', async () => {
  const api = createApi();
  api.addUser({ name: 'Pat Clerk', email: 'pat@example.test', church_role: 'Ward Clerk', password_hash: await hashPasswordSecure('right-pass') });

  const bad = await api.call('POST', '/api/auth/login', { body: { email: 'pat@example.test', password: 'wrong' } });
  assert.equal(bad.status, 401);

  const ok = await api.call('POST', '/api/auth/login', { body: { email: ' PAT@example.test ', password: 'right-pass' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.name, 'Pat Clerk');
  const cookie = (ok.headers.get('Set-Cookie') || '').split(';')[0];
  assert.match(cookie, /^session=/);

  const me = await api.call('GET', '/api/auth/me', { user: { id: 0, cookie } });
  assert.equal(me.data.user.email, 'pat@example.test');
});

test('requests without a session are refused; unknown tables are 404', async () => {
  const api = createApi();
  assert.equal((await api.call('GET', '/api/tasks')).status, 401);
  assert.equal((await api.call('GET', '/api/welfare-cases')).status, 401);
  const u = api.addUser();
  assert.equal((await api.call('GET', '/api/no-such-table', { user: u })).status, 404);
});

test('hub access: Welfare is Bishopric hub only', async () => {
  const api = createApi();
  const bishopric = api.addUser({ church_role: 'Second Counselor', hub: 'both' });
  const wc = api.addUser({ church_role: 'Relief Society President', hub: 'wc' });
  const yc = api.addUser({ church_role: 'Young Women President', hub: 'yc' });
  const cal = api.addUser({ church_role: 'Ward Bulletin Specialist', hub: 'cal' });

  const created = await api.call('POST', '/api/welfare-cases', { user: bishopric, body: { member_name: 'Doe Family', status: 'Open' } });
  assert.equal(created.status, 201);
  assert.equal((await api.call('GET', '/api/welfare-cases', { user: bishopric })).data.length, 1);
  for (const user of [wc, yc, cal]) {
    assert.equal((await api.call('GET', '/api/welfare-cases', { user })).status, 403);
    assert.equal((await api.call('POST', '/api/welfare-cases', { user, body: { member_name: 'X' } })).status, 403);
  }
});

test('hub access: Ward Council gets full CRUD on its tables and read-only on shared ones', async () => {
  const api = createApi();
  const wc = api.addUser({ name: 'Wren Council', church_role: 'Elders Quorum President', hub: 'wc' });

  const care = await api.call('POST', '/api/member-care', { user: wc, body: { name: 'New Family', kind: 'Move-in' } });
  assert.equal(care.status, 201);
  assert.equal(care.data.created_by, 'Wren Council');
  assert.equal((await api.call('DELETE', `/api/member-care/${care.data.id}`, { user: wc })).status, 200);

  assert.equal((await api.call('GET', '/api/yc-discussion-topics', { user: wc })).status, 200);
  assert.equal((await api.call('POST', '/api/yc-discussion-topics', { user: wc, body: { organization: 'Priests Quorum' } })).status, 403);
  assert.equal((await api.call('GET', '/api/homebound-sacrament', { user: wc })).status, 403);

  // Sacrament themes are readable, but never with ward or stake business.
  api.DB.raw.prepare("INSERT INTO sacrament_themes (meeting_date, theme, ward_business) VALUES ('2099-03-01', 'Faith', 'Confidential release')").run();
  const themes = await api.call('GET', '/api/sacrament-themes', { user: wc });
  assert.equal(themes.data[0].theme, 'Faith');
  assert.equal('ward_business' in themes.data[0], false);
});

test('hub access: Ward Council only sees tasks shared with the Ward Council', async () => {
  const api = createApi();
  const bishopric = api.addUser({ hub: 'both' });
  const wc = api.addUser({ hub: 'wc', church_role: 'Primary President' });
  const privateTask = await api.call('POST', '/api/tasks', { user: bishopric, body: { task: 'Bishopric only', share_with: '' } });
  await api.call('POST', '/api/tasks', { user: bishopric, body: { task: 'Shared', share_with: 'Ward Council' } });

  const seen = await api.call('GET', '/api/tasks', { user: wc });
  assert.deepEqual(seen.data.map((t: { task: string }) => t.task), ['Shared']);
  assert.equal((await api.call('GET', `/api/tasks/${privateTask.data.id}`, { user: wc })).status, 403);

  const added = await api.call('POST', '/api/tasks', { user: wc, body: { task: 'From WC' } });
  assert.equal(added.data.share_with, 'Ward Council');
});

test('hub access: Calendar hub roles and youth calendar guests are limited to their pages', async () => {
  const api = createApi();
  const music = api.addUser({ church_role: 'Music Coordinator', hub: 'cal' });
  const bulletin = api.addUser({ church_role: 'Ward Bulletin Specialist', hub: 'cal' });
  assert.equal((await api.call('GET', '/api/sacrament-music', { user: music })).status, 200);
  assert.equal((await api.call('GET', '/api/calendaring', { user: music })).status, 403);
  assert.equal((await api.call('GET', '/api/calendaring', { user: bulletin })).status, 200);
  assert.equal((await api.call('GET', '/api/sacrament-music', { user: bulletin })).status, 403);

  const guest = api.addUser({ role: 'guest', church_role: 'yc', hub: 'yc' });
  assert.equal((await api.call('GET', '/api/youth-activities', { user: guest })).status, 200);
  assert.equal((await api.call('POST', '/api/youth-activities', { user: guest, body: { title: 'x' } })).status, 403);
  assert.equal((await api.call('GET', '/api/tasks', { user: guest })).status, 403);
});

test('interview booking: open slots are public, booking is first come and adds an appointment', async () => {
  const api = createApi();
  const exec = api.addUser({ church_role: 'Executive Secretary', hub: 'both' });
  const slot = (await api.call('POST', '/api/interview-slots', { user: exec, body: { calendar: 'Bishop', date: FUTURE, start_time: '18:00', end_time: '18:15', location: 'Office' } })).data;
  await api.call('POST', '/api/interview-slots', { user: exec, body: { calendar: 'Bishop', date: PAST, start_time: '18:00', end_time: '18:15' } });

  const open = await api.call('GET', '/api/interview-booking/public');
  assert.equal(open.status, 200);
  assert.deepEqual(open.data.map((s: { id: number }) => s.id), [slot.id]); // the past slot is never offered
  assert.equal('reserved_by' in open.data[0], false);

  assert.equal((await api.call('POST', `/api/interview-booking/${slot.id}/reserve`, { body: { name: 'Sam', contact: '' } })).status, 400);
  const booked = await api.call('POST', `/api/interview-booking/${slot.id}/reserve`, { body: { name: 'Sam Lee', contact: '555-0100', purpose: 'Temple recommend' } });
  assert.equal(booked.status, 200);
  const again = await api.call('POST', `/api/interview-booking/${slot.id}/reserve`, { body: { name: 'Other', contact: 'x' } });
  assert.equal(again.status, 409);
  assert.equal((await api.call('GET', '/api/interview-booking/public')).data.length, 0);

  const entries = (await api.call('GET', '/api/schedule-entries', { user: exec })).data;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Interview: Sam Lee (Temple recommend)');
  assert.equal(entries[0].calendars, '["Bishop"]');

  // Deleting the booked slot removes its appointment too.
  assert.equal((await api.call('DELETE', `/api/interview-slots/${slot.id}`, { user: exec })).status, 200);
  assert.equal((await api.call('GET', '/api/schedule-entries', { user: exec })).data.length, 0);
});

test('interview booking: a slot that overlaps an appointment on that calendar is not offered', async () => {
  const api = createApi();
  const exec = api.addUser({ hub: 'both' });
  const slot = (await api.call('POST', '/api/interview-slots', { user: exec, body: { calendar: 'First Counselor', date: FUTURE, start_time: '19:00', end_time: '19:20' } })).data;
  await api.call('POST', '/api/schedule-entries', { user: exec, body: { calendars: '["First Counselor"]', date: FUTURE, start_time: '19:10', end_time: '19:40', title: 'Visit' } });
  await api.call('POST', '/api/schedule-entries', { user: exec, body: { calendars: '["Bishop"]', date: FUTURE, start_time: '19:00', end_time: '20:00', title: 'Other calendar' } });

  assert.equal((await api.call('GET', '/api/interview-booking/public')).data.length, 0);
  assert.equal((await api.call('POST', `/api/interview-booking/${slot.id}/reserve`, { body: { name: 'A', contact: 'b' } })).status, 409);
});

test('schedule: a Bishop appointment cannot overlap a reserved tithing declaration', async () => {
  const api = createApi();
  const u = api.addUser({ hub: 'both' });
  await api.call('POST', '/api/tithing-declarations', { user: u, body: { date: FUTURE, start_time: '10:00', end_time: '10:10', location: 'Office', reserved_by: 'The Smiths' } });
  const clash = await api.call('POST', '/api/schedule-entries', { user: u, body: { calendars: '["Bishop"]', date: FUTURE, start_time: '10:05', end_time: '10:30', title: 'Meeting' } });
  assert.equal(clash.status, 409);
  assert.match(clash.data.error, /The Smiths/);
  const counselor = await api.call('POST', '/api/schedule-entries', { user: u, body: { calendars: '["Second Counselor"]', date: FUTURE, start_time: '10:05', end_time: '10:30', title: 'Meeting' } });
  assert.equal(counselor.status, 201);
});

test('editing a record someone else just changed returns a conflict', async () => {
  const api = createApi();
  const a = api.addUser({ name: 'A', hub: 'both' });
  const b = api.addUser({ name: 'B', hub: 'both' });
  const row = (await api.call('POST', '/api/funerals', { user: a, body: { deceased_name: 'John Doe' } })).data;
  // A and B both open the record after this save.
  const loaded = (await api.call('PUT', `/api/funerals/${row.id}`, { user: a, body: { deceased_name: 'John Doe' } })).data;
  await new Promise(r => setTimeout(r, 5));
  const first = await api.call('PUT', `/api/funerals/${row.id}`, { user: b, body: { deceased_name: 'John Q. Doe', _base_updated_at: loaded.updated_at } });
  assert.equal(first.status, 200);
  assert.equal(first.data.updated_by, 'B');
  const stale = await api.call('PUT', `/api/funerals/${row.id}`, { user: a, body: { deceased_name: 'Jon Doe', _base_updated_at: loaded.updated_at } });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.current.deceased_name, 'John Q. Doe');
});

test('unknown fields in a request body are dropped instead of reaching SQL', async () => {
  const api = createApi();
  const u = api.addUser({ hub: 'both' });
  const res = await api.call('POST', '/api/funerals', { user: u, body: { deceased_name: 'X', 'bogus) VALUES (1); --': 1 } });
  assert.equal(res.status, 201);
  assert.equal(res.data.deceased_name, 'X');
});

test('patriarchal blessing sync: LCR sets Received and clears it again', async () => {
  const api = createApi();
  const u = api.addUser({ hub: 'both', role: 'admin' });
  api.DB.raw.prepare("INSERT INTO ward_members (first_name, last_name, active, pb_status) VALUES ('Ann', 'Doe', 1, NULL), ('Ben', 'Roe', 1, 'Recommend issued')").run();
  const sync = (rows: unknown) => api.call('POST', '/api/ward-members/sync-patriarchal-blessings', { user: u, body: { rows } });
  const status = () => api.DB.raw.prepare('SELECT first_name, pb_status FROM ward_members ORDER BY first_name').all()
    .map(r => [r.first_name, r.pb_status]);

  const first = await sync([{ name: 'Doe, Ann', received: true }, { name: 'Roe, Ben', received: false }, { name: 'Nobody, Here', received: true }]);
  assert.equal(first.data.updated, 2);
  assert.deepEqual(first.data.unmatched, ['Nobody, Here']);
  assert.deepEqual(status(), [['Ann', 'Received'], ['Ben', null]]);

  await sync([{ name: 'Doe, Ann', received: false }]);
  assert.deepEqual(status(), [['Ann', null], ['Ben', null]]);
});

test('calendar feed: a private token serves the chosen calendars as .ics', async () => {
  const api = createApi();
  const bishop = api.addUser({ name: 'Bishop Hale', church_role: 'Bishop', hub: 'both' });
  const wc = api.addUser({ hub: 'wc' });
  assert.equal((await api.call('PUT', '/api/calendar-feed', { user: wc, body: { calendars: ['Bishop'] } })).status, 403);

  const feed = (await api.call('PUT', '/api/calendar-feed', { user: bishop, body: { calendars: ['Bishop', 'Nonsense'] } })).data;
  assert.deepEqual(feed.calendars, ['Bishop']);
  await api.call('POST', '/api/schedule-entries', { user: bishop, body: { calendars: '["Bishop"]', date: FUTURE, start_time: '07:00', end_time: '07:30', title: 'Youth interview' } });
  await api.call('POST', '/api/schedule-entries', { user: bishop, body: { calendars: '["First Counselor"]', date: FUTURE, start_time: '08:00', end_time: '08:30', title: 'Not mine' } });

  const ics = await api.call('GET', `/api/calendar-feed/ics/${feed.token}.ics`);
  assert.equal(ics.status, 200);
  assert.match(ics.headers.get('Content-Type') || '', /text\/calendar/);
  assert.match(ics.data, /SUMMARY:Youth interview/);
  assert.doesNotMatch(ics.data, /Not mine/);

  const reset = (await api.call('PUT', '/api/calendar-feed', { user: bishop, body: { calendars: ['Bishop'], reset: true } })).data;
  assert.notEqual(reset.token, feed.token);
  assert.equal((await api.call('GET', `/api/calendar-feed/ics/${feed.token}`)).status, 404);
});
