import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCovenantPath, ageOn, officeRank, DEFAULT_COVENANT_SETTINGS, type CovenantMember } from '../shared/covenantPath';

const TODAY = '2026-11-13';
let nextId = 1;
const person = (p: Partial<CovenantMember>): CovenantMember => ({
  id: nextId++, first_name: 'Pat', last_name: 'Doe', active: 1, birth_date: '1990-01-01', gender: 'F',
  baptized: 1, priesthood_office: null, endowed: 1, recommend_expires: '2027-05', sealed_to_current_spouse: null,
  ...p,
});
const listFor = (members: CovenantMember[], id: string) =>
  buildCovenantPath(members, [], new Set(), DEFAULT_COVENANT_SETTINGS, TODAY).find(c => c.id === id)!.items.map(i => i.name);

test('ageOn counts birthdays correctly', () => {
  assert.equal(ageOn('2008-11-13', TODAY), 18);
  assert.equal(ageOn('2008-11-14', TODAY), 17);
  assert.equal(ageOn(null, TODAY), null);
});

test('officeRank orders Aaronic and Melchizedek offices', () => {
  assert.deepEqual(['Deacon', 'Teacher', 'Priest', 'Elder', 'High Priest', ''].map(officeRank), [1, 2, 3, 4, 4, 0]);
});

test('patriarchal blessing list: baptized, of age, not received', () => {
  const members = [
    person({ first_name: 'Ann', pb_status: null }),
    person({ first_name: 'Bea', pb_status: 'Received' }),
    person({ first_name: 'Cy', birth_date: '2010-01-01' }),
    person({ first_name: 'Di', baptized: 0 }),
  ];
  assert.deepEqual(listFor(members, 'patriarchal-blessing'), ['Doe, Ann']);
});

test('priesthood office behind age uses the year they turn 12/14/16 and 18+ for elder', () => {
  const members = [
    person({ first_name: 'Al', gender: 'M', birth_date: '2014-12-31', priesthood_office: null }), // turns 12 this year
    person({ first_name: 'Bo', gender: 'M', birth_date: '2012-03-01', priesthood_office: 'Teacher' }), // turns 14, has it
    person({ first_name: 'Cal', gender: 'M', birth_date: '2000-01-01', priesthood_office: 'Priest' }), // 26, needs elder
    person({ first_name: 'Dan', gender: 'M', birth_date: '1980-01-01', priesthood_office: 'High Priest' }),
  ];
  assert.deepEqual(listFor(members, 'priesthood'), ['Doe, Al', 'Doe, Cal']);
});

test('married but not sealed needs both spouses on the roster and lists the couple once', () => {
  const john = person({ first_name: 'John', last_name: 'Alder', gender: 'M', spouse_name: 'Alder, Trisha', sealed_to_current_spouse: 0 });
  const trisha = person({ first_name: 'Trisha', last_name: 'Alder', spouse_name: 'Alder, John', sealed_to_current_spouse: 0, endowed: 0 });
  const lone = person({ first_name: 'Kim', last_name: 'Ray', spouse_name: 'Ray, Lee', sealed_to_current_spouse: 0 });
  const items = buildCovenantPath([john, trisha, lone], [], new Set(), DEFAULT_COVENANT_SETTINGS, TODAY)
    .find(c => c.id === 'married-not-sealed')!.items;
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Alder, John & Trisha');
  assert.equal(items[0].detail, 'Not endowed: Trisha');
});

test('not baptized, approaching baptism and ages follow settings', () => {
  const members = [
    person({ first_name: 'Eli', baptized: 0, birth_date: '2018-12-20', endowed: 0 }), // turns 8 within 3 months
    person({ first_name: 'Fay', baptized: 0, birth_date: '2000-01-01', endowed: 0 }),
  ];
  assert.deepEqual(listFor(members, 'approaching-baptism'), ['Doe, Eli']);
  assert.deepEqual(listFor(members, 'not-baptized'), ['Doe, Fay']);
});

test('households without a Melchizedek Priesthood holder', () => {
  const members = [
    person({ first_name: 'Gus', gender: 'M', head_of_house: 'Smith, Gus', priesthood_office: 'Elder' }),
    person({ first_name: 'Hal', head_of_house: 'Smith, Gus' }),
    person({ first_name: 'Ida', head_of_house: 'Jones, Ida' }),
  ];
  assert.deepEqual(listFor(members, 'no-mp-holder'), ['Jones, Ida']);
});
