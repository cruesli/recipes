import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIngredientIndex } from '../src/lib/ingredientIndex.mjs';

const recipes = [
  { slug: 'carnitas', title: 'Carnitas', cuisine: 'mexican', canonicals: ['pork shoulder', 'orange', 'salt', 'orange'] },
  { slug: 'char-siu', title: 'Char siu', cuisine: 'chinese', canonicals: ['pork shoulder', 'orange'] },
  { slug: 'briam', title: 'Briam', cuisine: 'greek', canonicals: ['potato'] },
];

test('groups A–Z, sorts entries and recipes, dedupes per recipe', () => {
  const groups = buildIngredientIndex(recipes, ['salt']);
  assert.deepEqual(groups.map((g) => g.letter), ['O', 'P']);
  const o = groups[0];
  assert.equal(o.entries.length, 1);
  assert.equal(o.entries[0].canonical, 'orange');
  // sorted by title, deduped (carnitas lists orange twice in input)
  assert.deepEqual(o.entries[0].recipes.map((r) => r.slug), ['carnitas', 'char-siu']);
  const p = groups[1];
  assert.deepEqual(p.entries.map((e) => e.canonical), ['pork shoulder', 'potato']);
});

test('staples are excluded case-insensitively', () => {
  const groups = buildIngredientIndex(recipes, ['Salt']);
  assert.ok(!groups.some((g) => g.entries.some((e) => e.canonical === 'salt')));
});

test('empty input → empty index', () => {
  assert.deepEqual(buildIngredientIndex([]), []);
});
