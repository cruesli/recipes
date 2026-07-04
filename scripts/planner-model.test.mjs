import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateWeek, addMealIn, moveMealIn, MAX_MEALS_PER_DAY } from '../src/lib/plannerModel.mjs';

const meal = (id, title = 'Dish') => ({
  id, recipeId: 'r1', title, image: null, sections: [], servings: 2, baseServings: 2,
});

// Pre-migration fixture: one bare meal object per day (no id/servings fields)
const legacyWeek = {
  Monday: { recipeId: 'pasta', title: 'Pasta', image: '/img/p.jpg', sections: [{ header: null, items: ['100g spaghetti'] }] },
  Tuesday: { recipeId: null, title: 'Leftovers', image: null, sections: [] },
};

test('migrateWeek wraps legacy single meals and backfills fields', () => {
  const week = migrateWeek(legacyWeek);
  assert.ok(Array.isArray(week.Monday));
  assert.equal(week.Monday.length, 1);
  const m = week.Monday[0];
  assert.equal(typeof m.id, 'string');
  assert.ok(m.id.length > 0);
  assert.equal(m.recipeId, 'pasta');
  assert.equal(m.servings, null);
  assert.equal(m.baseServings, null);
  assert.deepEqual(m.sections, [{ header: null, items: ['100g spaghetti'] }]);
  assert.equal(week.Tuesday[0].recipeId, null);
});

test('migrateWeek passes through current-format weeks and drops junk', () => {
  const current = { Monday: [meal('a'), meal('b')] };
  const week = migrateWeek(current);
  assert.equal(week.Monday.length, 2);
  assert.equal(week.Monday[0].id, 'a');
  assert.equal(week.Monday[0].servings, 2);
  assert.deepEqual(migrateWeek(null), {});
  assert.deepEqual(migrateWeek('nonsense'), {});
  assert.deepEqual(migrateWeek({ Monday: 42 }), {});
  assert.deepEqual(migrateWeek({ Monday: [{ noTitle: true }] }), {});
});

test('addMealIn appends and enforces the cap', () => {
  let week = {};
  for (let i = 0; i < MAX_MEALS_PER_DAY; i++) {
    week = addMealIn(week, 'Monday', meal(String(i)));
    assert.ok(week);
  }
  assert.equal(week.Monday.length, 4);
  assert.equal(addMealIn(week, 'Monday', meal('x')), null);
});

test('moveMealIn moves, blocks full targets, no-ops same day', () => {
  const week = { Monday: [meal('a'), meal('b')], Tuesday: [meal('c')] };
  const moved = moveMealIn(week, 'Monday', 'a', 'Tuesday');
  assert.deepEqual(moved.Monday.map((m) => m.id), ['b']);
  assert.deepEqual(moved.Tuesday.map((m) => m.id), ['c', 'a']);

  assert.equal(moveMealIn(week, 'Monday', 'a', 'Monday'), null);
  assert.equal(moveMealIn(week, 'Monday', 'missing', 'Tuesday'), null);

  const full = { Monday: [meal('a')], Tuesday: [meal('1'), meal('2'), meal('3'), meal('4')] };
  assert.equal(moveMealIn(full, 'Monday', 'a', 'Tuesday'), null);

  const emptied = moveMealIn({ Monday: [meal('a')] }, 'Monday', 'a', 'Friday');
  assert.equal('Monday' in emptied, false);
  assert.equal(emptied.Friday.length, 1);
});
