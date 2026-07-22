import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTotalTime, workBack, formatClock } from '../src/lib/recipeTime.mjs';

test('explicit totalTimeMinutes wins', () => {
  assert.equal(deriveTotalTime({ totalTimeMinutes: 45, prepTimeMinutes: 10, cookTimeMinutes: 20 }), 45);
});

test('derives from prep + cook when total absent', () => {
  assert.equal(deriveTotalTime({ prepTimeMinutes: 20, cookTimeMinutes: 150 }), 170);
});

test('derives from a single present component', () => {
  assert.equal(deriveTotalTime({ prepTimeMinutes: 15 }), 15);
  assert.equal(deriveTotalTime({ cookTimeMinutes: 30 }), 30);
});

test('null when nothing is available', () => {
  assert.equal(deriveTotalTime({}), null);
  assert.equal(deriveTotalTime({ totalTimeMinutes: null }), null);
});

test('workBack: start = target − (prep + cook)', () => {
  assert.deepEqual(
    workBack(18 * 60, { prepTimeMinutes: 30, cookTimeMinutes: 180 }),
    { startBy: 14 * 60 + 30, marinadeFrom: null }
  );
});

test('workBack: marinade precedes the start', () => {
  const r = workBack(18 * 60, { prepTimeMinutes: 20, cookTimeMinutes: 40, marinadeTimeMinutes: 480 });
  assert.equal(r.startBy, 17 * 60);
  assert.equal(r.marinadeFrom, 9 * 60);
});

test('workBack: null without target or active time; negative start allowed', () => {
  assert.equal(workBack(null, { prepTimeMinutes: 10 }), null);
  assert.equal(workBack(18 * 60, {}), null);
  assert.equal(workBack(60, { cookTimeMinutes: 120 }).startBy, -60);
});

test('formatClock wraps the day', () => {
  assert.equal(formatClock(14 * 60 + 30), '14:30');
  assert.equal(formatClock(-60), '23:00');
  assert.equal(formatClock(0), '00:00');
});
