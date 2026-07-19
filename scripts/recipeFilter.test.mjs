import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesFacets, extractedToFacets } from '../src/lib/recipeFilter.mjs';

const goulash = {
  title: 'Goulash', cuisine: 'hungarian', totalTimeMinutes: 170,
  dietary: [], kcalPerServing: 929, proteinPerServing: 51.6,
};
const salad = {
  title: 'Green Salad', cuisine: 'italian', totalTimeMinutes: 10,
  dietary: ['vegan', 'vegetarian'], kcalPerServing: 180, proteinPerServing: 4,
};
const unpriced = {
  title: 'Mystery', cuisine: 'french', totalTimeMinutes: null,
  dietary: [], kcalPerServing: null, proteinPerServing: null,
};

test('no filters matches everything', () => {
  assert.ok(matchesFacets(goulash, {}));
  assert.ok(matchesFacets(unpriced, {}));
});

test('free-text query matches title or cuisine', () => {
  assert.ok(matchesFacets(goulash, { query: 'goul' }));
  assert.ok(matchesFacets(goulash, { query: 'hungar' }));
  assert.ok(!matchesFacets(goulash, { query: 'pasta' }));
});

test('cuisine facet is exact (case-insensitive)', () => {
  assert.ok(matchesFacets(salad, { cuisine: 'Italian' }));
  assert.ok(!matchesFacets(goulash, { cuisine: 'italian' }));
});

test('dietary vegetarian matches vegan recipes too', () => {
  assert.ok(matchesFacets(salad, { dietary: 'vegetarian' }));
  assert.ok(!matchesFacets(goulash, { dietary: 'vegetarian' }));
});

test('dietary vegan matches only vegan', () => {
  assert.ok(matchesFacets(salad, { dietary: 'vegan' }));
  assert.ok(!matchesFacets(goulash, { dietary: 'vegan' }));
});

test('dietary "all" is a no-op', () => {
  assert.ok(matchesFacets(goulash, { dietary: 'all' }));
});

test('maxTime excludes slower recipes; null time is excluded', () => {
  assert.ok(matchesFacets(salad, { maxTime: 30 }));
  assert.ok(!matchesFacets(goulash, { maxTime: 30 }));
  assert.ok(!matchesFacets(unpriced, { maxTime: 30 }));  // no time known → excluded
});

test('nutrition facets do not penalise recipes with null nutrition', () => {
  assert.ok(matchesFacets(unpriced, { maxKcal: 400 }));   // null kcal passes
  assert.ok(matchesFacets(unpriced, { minProtein: 30 }));  // null protein passes
});

test('maxKcal and minProtein filter priced recipes', () => {
  assert.ok(matchesFacets(salad, { maxKcal: 400 }));
  assert.ok(!matchesFacets(goulash, { maxKcal: 400 }));
  assert.ok(matchesFacets(goulash, { minProtein: 40 }));
  assert.ok(!matchesFacets(salad, { minProtein: 40 }));
});

test('multiple facets AND together', () => {
  assert.ok(matchesFacets(salad, { dietary: 'vegan', maxTime: 30, maxKcal: 400 }));
  assert.ok(!matchesFacets(salad, { dietary: 'vegan', maxKcal: 100 }));
});

// --- extractedToFacets: map LLM filter keys to facet state ---

test('maps supported extracted keys', () => {
  const f = extractedToFacets({
    cuisine: 'italian', dietary: 'vegetarian',
    max_time: 30, max_kcal: 500, min_protein: 25,
  });
  assert.deepEqual(f, {
    cuisine: 'italian', dietary: 'vegetarian',
    maxTime: 30, maxKcal: 500, minProtein: 25,
  });
});

test('ignores unsupported keys and wrong types', () => {
  const f = extractedToFacets({
    max_sodium: 400, origin_country: 'italy', min_protein: 'lots', dietary: 'halal',
  });
  assert.deepEqual(f, {});
});

test('empty object for empty filters', () => {
  assert.deepEqual(extractedToFacets({}), {});
});

test('ingredient facet: substring match against canonicals', () => {
  const r = { title: 'Carnitas', cuisine: 'mexican', canonicals: ['pork shoulder', 'orange'] };
  assert.ok(matchesFacets(r, { ingredient: 'pork' }));
  assert.ok(matchesFacets(r, { ingredient: 'Pork Shoulder' }));
  assert.ok(!matchesFacets(r, { ingredient: 'chicken' }));
});

test('ingredient facet: recipes without canonicals fail the filter', () => {
  const r = { title: 'Custom', cuisine: 'norwegian' };
  assert.ok(!matchesFacets(r, { ingredient: 'pork' }));
  assert.ok(matchesFacets(r, {}));
});

test('extractedToFacets maps ingredient', () => {
  assert.deepEqual(extractedToFacets({ ingredient: 'pork shoulder' }), { ingredient: 'pork shoulder' });
  assert.deepEqual(extractedToFacets({ ingredient: 7 }), {});
});
