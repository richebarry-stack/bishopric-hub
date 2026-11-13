import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRosterMember } from '../functions/api/nameMatch';

const roster = [
  { id: 1, first_name: 'Curt James', last_name: 'Kleiner', extra: 'kept' },
  { id: 2, first_name: 'Dallin', last_name: 'Tippetts', extra: 'kept' },
];

test('matches "First Last" and "Last, First" names to the roster', () => {
  assert.equal(matchRosterMember('Kleiner, Curt James', roster)?.id, 1);
  assert.equal(matchRosterMember('Dallin Tippetts', roster)?.id, 2);
  assert.equal(matchRosterMember('Curt Kleiner', roster)?.extra, 'kept');
  assert.equal(matchRosterMember('Someone Else', roster), null);
});
