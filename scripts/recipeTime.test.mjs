import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTotalTime } from '../src/lib/recipeTime.mjs';

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
