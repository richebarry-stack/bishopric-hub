import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCallingKey, stripCustomCalling } from '../shared/callingNames';

test('LCR "Custom Calling" ending is ignored when matching', () => {
  assert.equal(normCallingKey('Ward Bulletin Specialist Custom Calling'), normCallingKey('Ward Bulletin Specialist'));
  assert.equal(normCallingKey('**Ward  Bulletin Specialist** '), 'ward bulletin specialist');
  assert.equal(stripCustomCalling('Greeter custom calling'), 'Greeter');
  assert.equal(stripCustomCalling('Primary Teacher'), 'Primary Teacher');
});
