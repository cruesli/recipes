import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jitterFor, layoutMarginNotes } from '../src/lib/marginalia.mjs';

test('jitter is deterministic per seed and bounded (x small, y larger)', () => {
  const a = jitterFor(42), b = jitterFor(42), c = jitterFor(43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(Math.abs(a.dx) <= 10);
  assert.ok(a.dy >= 0 && a.dy <= 48);
});

test('collision resolution pushes notes down, never overlapping', () => {
  const layout = layoutMarginNotes([
    { id: 'a', anchorTop: 100, seed: 1, height: 60 },
    { id: 'b', anchorTop: 110, seed: 2, height: 40 },
    { id: 'c', anchorTop: 500, seed: 3, height: 40 },
  ]);
  const a = layout.get('a'), b = layout.get('b'), c = layout.get('c');
  const [first, second] = a.top <= b.top ? [{ ...a, height: 60 }, { ...b, height: 40 }] : [{ ...b, height: 40 }, { ...a, height: 60 }];
  assert.ok(second.top >= first.top + first.height + 12);
  assert.ok(c.top >= 500 && c.top <= 548); // far anchor sits at its own jittered spot, un-pushed by the cluster
  assert.equal(layout.get('a').dx, jitterFor(1).dx); // dx carried through unchanged
});

test('empty input returns an empty map', () => {
  assert.equal(layoutMarginNotes([]).size, 0);
});
