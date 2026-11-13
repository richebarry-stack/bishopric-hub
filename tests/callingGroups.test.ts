import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callingGroups, handbookOrganization, isStakeLeadership } from '../shared/callingGroups';

test('callings land in their General Handbook organization', () => {
  assert.equal(handbookOrganization('Deacons Quorum Adviser', 'Aaronic Priesthood Quorums'), 'Aaronic Priesthood');
  assert.equal(handbookOrganization('Technology Specialist', 'Other Callings'), 'Communication and Technology');
  assert.equal(handbookOrganization('Valiant 9 Teacher', 'Valiant 9'), 'Primary');
  assert.equal(handbookOrganization('Ward Bulletin Specialist Custom Calling', 'Other Callings'), 'Other');
  assert.deepEqual(callingGroups('Ward FSY Rep', ''), ['Aaronic Priesthood', 'Young Women']);
  assert.deepEqual(callingGroups('Young Men and Young Women Camp Leader', 'Other Callings'), ['Aaronic Priesthood', 'Young Women']);
});

test('stake leadership is recognized, stake callings serving in the ward are not', () => {
  assert.equal(isStakeLeadership('Stake President', 'Stake Presidency'), true);
  assert.equal(isStakeLeadership('High Councilor', 'High Council'), true);
  assert.equal(isStakeLeadership('Stake Temple and Family History Consultant', 'Stake Temple and Family History'), false);
});
