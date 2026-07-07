import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShoppingView, formatPart, DEFAULT_BUCKET_ORDER } from '../src/lib/shoppingList.mjs';

// Item factory — mirrors the enriched ShoppingItem shape
let _id = 0;
function item(overrides) {
  return {
    id: String(_id++), mealId: 'm1', day: 'Monday', recipeTitle: 'Dish',
    sectionHeader: null, raw: 'x', ratio: 1,
    canonical: null, category: null, quantity: null,
    ...overrides,
  };
}

test('formatPart: count is unitless, others carry the unit', () => {
  assert.equal(formatPart(4, 'count'), '4');
  assert.equal(formatPart(400, 'g'), '400 g');
  assert.equal(formatPart(1.5, 'count'), '1.5');
});

test('merges the same canonical across days into one line', () => {
  const view = buildShoppingView([
    item({ day: 'Monday', canonical: 'onion', category: 'produce', quantity: { amount: 4, unit: 'count' } }),
    item({ day: 'Thursday', canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
  ]);
  const produce = view.buckets.find((b) => b.category === 'produce');
  assert.equal(produce.lines.length, 1);
  assert.equal(produce.lines[0].canonical, 'onion');
  assert.equal(produce.lines[0].note, 'Mon: 4, Thu: 1');
  assert.equal(produce.lines[0].id, 'c:onion');
});

test('scales stated quantity by each meal ratio before summing', () => {
  const view = buildShoppingView([
    item({ canonical: 'onion', category: 'produce', quantity: { amount: 4, unit: 'count' }, ratio: 0.5 }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon: 2');
});

test('same-day occurrences of one unit sum into a single entry', () => {
  const view = buildShoppingView([
    item({ mealId: 'a', canonical: 'onion', category: 'produce', quantity: { amount: 4, unit: 'count' } }),
    item({ mealId: 'b', canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon: 5');
});

test('mixed units within a day are listed, never converted', () => {
  const view = buildShoppingView([
    item({ mealId: 'a', canonical: 'butter', category: 'dairy-eggs', quantity: { amount: 2, unit: 'count' } }),
    item({ mealId: 'b', canonical: 'butter', category: 'dairy-eggs', quantity: { amount: 200, unit: 'g' } }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon: 2 + 200 g');
});

test('null quantity shows the day only and is excluded from scaling', () => {
  const view = buildShoppingView([
    item({ day: 'Monday', canonical: 'salt', category: 'spices-seasonings', quantity: null }),
    item({ day: 'Wednesday', canonical: 'salt', category: 'spices-seasonings', quantity: null }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon, Wed');
});

test('weights render with unit per day', () => {
  const view = buildShoppingView([
    item({ canonical: 'flour', category: 'dry-goods', quantity: { amount: 400, unit: 'g' } }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon: 400 g');
});

test('buckets come back in bucketOrder, only those present', () => {
  const view = buildShoppingView([
    item({ canonical: 'salt', category: 'spices-seasonings', quantity: null }),
    item({ canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
  ]);
  assert.deepEqual(view.buckets.map((b) => b.category), ['produce', 'spices-seasonings']);
});

test('custom bucketOrder reorders the view', () => {
  const order = ['spices-seasonings', 'produce', ...DEFAULT_BUCKET_ORDER];
  const view = buildShoppingView([
    item({ canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
    item({ canonical: 'salt', category: 'spices-seasonings', quantity: null }),
  ], order);
  assert.deepEqual(view.buckets.map((b) => b.category), ['spices-seasonings', 'produce']);
});

test('unknown category falls into other', () => {
  const view = buildShoppingView([
    item({ canonical: 'mystery', category: 'weird-bucket', quantity: null }),
  ]);
  assert.equal(view.buckets[0].category, 'other');
});

test('unenriched items degrade to day→recipe groups, out of the buckets', () => {
  const view = buildShoppingView([
    item({ day: 'Monday', recipeTitle: 'Soup', canonical: null, text: '1 splash of water', mealId: 'm1' }),
    item({ day: 'Monday', recipeTitle: 'Soup', canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' }, mealId: 'm1' }),
  ]);
  // onion is bucketed; the water line degrades
  assert.equal(view.buckets.find((b) => b.category === 'produce').lines.length, 1);
  assert.equal(view.degraded.length, 1);
  assert.equal(view.degraded[0].day, 'Monday');
  assert.equal(view.degraded[0].meals[0].sections[0].items[0].text, '1 splash of water');
});

test('days render in week order regardless of item order', () => {
  const view = buildShoppingView([
    item({ day: 'Thursday', canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
    item({ day: 'Monday', canonical: 'onion', category: 'produce', quantity: { amount: 2, unit: 'count' } }),
  ]);
  assert.equal(view.buckets[0].lines[0].note, 'Mon: 2, Thu: 1');
});
