import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTsv, splitPeople, hasDateColumn, parseDateBlock, parseCellBlock } from '../shared/musicPaste';

test('parseTsv reads quoted cells with newlines and quotes', () => {
  const grid = parseTsv('a\t"Diane Krueger,organist\nAnna Grandil, chorister"\t"Choir ""Take Time"""\r\nb\t\tc');
  assert.deepEqual(grid, [
    ['a', 'Diane Krueger,organist\nAnna Grandil, chorister', 'Choir "Take Time"'],
    ['b', '', 'c'],
  ]);
});

test('splitPeople handles the spreadsheet formats', () => {
  assert.deepEqual(splitPeople('Diane Krueger,organist Anna Grandil, chorister'), { organist: 'Diane Krueger', chorister: 'Anna Grandil' });
  assert.deepEqual(splitPeople('DianeKrueger,organist.   AnnaGrandil,chorister'), { organist: 'Diane Krueger', chorister: 'Anna Grandil' });
  assert.deepEqual(splitPeople('Organist: Diane Krueger / Chorister: Carter Theriot'), { organist: 'Diane Krueger', chorister: 'Carter Theriot' });
  assert.deepEqual(splitPeople('Diane Krueger, Carter Theriot'), { organist: 'Diane Krueger', chorister: 'Carter Theriot' });
  assert.deepEqual(splitPeople('Eli Robbins'), { organist: 'Eli Robbins', chorister: '' });
});

test('parseDateBlock lines up a 2026-style block by date and skips blanks', () => {
  const grid = parseTsv([
    '\tOrganist/Chorister\tOpening \tSacrament \tRest/Special\tClosing',
    'January\t\t\t\t\t',
    'Fast Sunday 4\tDiane Krueger,organist Anna Grandil, chorister\t#217 Come, Let Us Anew\t#170 God Our Father, Hear Us Pray\t\t#1003 It is Well With My Soul',
    'Stake Conferemnce 18\t\t\t\t\t',
    '\t\t\t\t\t',
    'February\t\t\t\t\t',
    '8\t\t#78 God of Our Fathers\t#175 O God, the Eternal Father\tChoir \'Take Time to be Holy\'\t#264 Hark, All Ye Nations!',
  ].join('\n'));
  assert.equal(hasDateColumn(grid), true);
  const { patches, skipped } = parseDateBlock(grid, 2026);
  assert.deepEqual(Object.keys(patches), ['2026-01-04', '2026-02-08']);
  assert.equal(patches['2026-01-04'].organist, 'Diane Krueger');
  assert.equal(patches['2026-01-04'].chorister, 'Anna Grandil');
  assert.equal(patches['2026-01-04'].rest_special, undefined);
  assert.equal(patches['2026-02-08'].rest_special, "Choir 'Take Time to be Holy'");
  assert.deepEqual(skipped, []);
});

test('parseDateBlock reads the older 5-column layout and m/d/yy dates', () => {
  const grid = parseTsv('January 2023\tOpening\tSacrament\tRest/Special\tClosing\n1/29/23\t223 Have I Done Any Good\t194 There is a Green Hill\t270 I\'ll Go\t220 Lord I Would Follow Thee');
  const { patches } = parseDateBlock(grid, 2026);
  assert.deepEqual(patches, { '2023-01-29': { opening_hymn: '223 Have I Done Any Good', sacrament_hymn: '194 There is a Green Hill', rest_special: "270 I'll Go", closing_hymn: '220 Lord I Would Follow Thee' } });
});

test('week rows without a month row use the starting month and roll over', () => {
  const grid = parseTsv('22\t\t#6 Redeemer of Israel\t\t\t\nFast Sunday   1\t\t#138 Bless Our Fast\t\t\t');
  assert.equal(hasDateColumn(grid), true);
  const { patches } = parseDateBlock(grid, 2026, 1);
  assert.deepEqual(Object.keys(patches), ['2026-02-22', '2026-03-01']);
});

test('a non-Sunday date is skipped', () => {
  const { patches, skipped } = parseDateBlock(parseTsv('March\t\t\t\t\t\n5\t\t#1\t\t\t'), 2026);
  assert.deepEqual(patches, {});
  assert.deepEqual(skipped, ['5']);
});

test('parseCellBlock fills right from the starting cell and splits a combined cell', () => {
  const grid = parseTsv('Diane Krueger,organist Anna Grandil, chorister\t#217 Come, Let Us Anew\t#170\t\t#1003');
  assert.equal(hasDateColumn(grid), false);
  assert.deepEqual(parseCellBlock(grid, 0), [{
    organist: 'Diane Krueger', chorister: 'Anna Grandil',
    opening_hymn: '#217 Come, Let Us Anew', sacrament_hymn: '#170', rest_special: '', closing_hymn: '#1003',
  }]);
  assert.deepEqual(parseCellBlock(parseTsv('#1\t#2'), 3), [{ sacrament_hymn: '#1', rest_special: '#2' }]);
});
