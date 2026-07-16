import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleIngredient, parseQuantity, formatQuantity } from '../src/lib/quantity.mjs';

test('glued metric units scale and keep the unit attached', () => {
  assert.equal(scaleIngredient('400g chicken thighs', 1.5), '600g chicken thighs');
  assert.equal(scaleIngredient('1.2kg beef chuck', 1.5), '1.8kg beef chuck');
  assert.equal(scaleIngredient('400g', 0.5), '200g');
});

test('spaced units keep the old behavior', () => {
  assert.equal(scaleIngredient('1.5 litres', 2), '3 litres');
  assert.equal(scaleIngredient('2 onions', 1.5), '3 onions');
  assert.equal(scaleIngredient('100 g flour', 1.5), '150 g flour');
});

test('fractions scale and format as fractions', () => {
  assert.equal(scaleIngredient('½ cup flour', 2), '1 cup flour');
  assert.equal(scaleIngredient('1 ½ cups sugar', 2), '3 cups sugar');
  assert.equal(scaleIngredient('¼ tsp salt', 3), '¾ tsp salt');
});

test('ranges scale both ends, attached unit preserved', () => {
  assert.equal(scaleIngredient('2-3 tomatoes', 2), '4-6 tomatoes');
  assert.equal(scaleIngredient('400-500g mince', 0.5), '200-250g mince');
});

test('unquantified lines pass through untouched', () => {
  assert.equal(scaleIngredient('salt', 2), 'salt');
  assert.equal(scaleIngredient('a pinch of saffron', 2), 'a pinch of saffron');
  assert.equal(scaleIngredient('freshly ground pepper', 0.5), 'freshly ground pepper');
});

test('ratio 1 returns the raw line', () => {
  assert.equal(scaleIngredient('400g chicken thighs', 1), '400g chicken thighs');
});

test('parse/format round-trips', () => {
  assert.equal(parseQuantity('1 ½'), 1.5);
  assert.equal(parseQuantity('1/2'), 0.5);
  assert.equal(formatQuantity(2.25), '2 ¼');
});

test('ASCII mixed fractions parse whole + fraction', () => {
  assert.equal(parseQuantity('1 1/2'), 1.5);
  assert.equal(parseQuantity('2 3/4'), 2.75);
  assert.equal(scaleIngredient('1 1/2 dl cream', 2), '3 dl cream');
});
