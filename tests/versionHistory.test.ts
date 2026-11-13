import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION_HISTORY, versionDateIso } from '../shared/versionHistory';

test('every Version History date parses (the weekly admin email depends on it)', () => {
  for (const { date } of VERSION_HISTORY) {
    if (date === 'Earlier') continue;
    assert.match(versionDateIso(date), /^\d{4}-\d{2}-\d{2}$/, `bad date: ${date}`);
  }
  assert.equal(versionDateIso('Nov 11, 2026'), '2026-11-11');
});

test('Version History is newest first', () => {
  const isos = VERSION_HISTORY.map(e => versionDateIso(e.date)).filter(Boolean);
  assert.deepEqual(isos, [...isos].sort().reverse());
});
