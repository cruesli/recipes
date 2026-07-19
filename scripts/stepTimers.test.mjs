import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDurations } from '../src/lib/stepTimers.mjs';

test('finds explicit durations in hours and minutes', () => {
  assert.deepEqual(
    findDurations('let cook for at least 3 hours').map((d) => d.minutes), [180]);
  assert.deepEqual(findDurations('simmer 10 min, then rest').map((d) => d.minutes), [10]);
  assert.deepEqual(findDurations('1.5 hours in the oven').map((d) => d.minutes), [90]);
});

test('ranges start at the lower bound', () => {
  assert.deepEqual(findDurations('fry 2-3 minutes per side').map((d) => d.minutes), [2]);
  assert.deepEqual(findDurations('roast 3–4 hours').map((d) => d.minutes), [180]);
});

test('offsets and label cover the whole match', () => {
  const [d] = findDurations('bake for 20 minutes until golden');
  assert.equal(d.label, '20 minutes');
  assert.equal('bake for 20 minutes until golden'.slice(d.start, d.end), '20 minutes');
});

test('ignores numbers without duration units', () => {
  assert.deepEqual(findDurations('a 160 deg oven, 2-3 cm cubes, step 5'), []);
});

test('unit must end at a word boundary', () => {
  assert.deepEqual(findDurations('5 minor adjustments to the hrsx dial'), []);
});

test('"N to M unit" ranges also start at the lower bound', () => {
  assert.deepEqual(findDurations('roast 2 to 3 hours').map((d) => d.minutes), [120]);
  assert.deepEqual(findDurations('fry 12 to 15 minutes').map((d) => d.minutes), [12]);
  assert.deepEqual(findDurations('simmer 2.5 to 3 hours').map((d) => d.minutes), [150]);
});

test('bare "to" is only a range separator between two numbers with a unit', () => {
  assert.deepEqual(findDurations('add 2 tomatoes to the pan'), []);
});
