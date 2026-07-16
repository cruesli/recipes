import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientSections } from '../src/lib/ingredientSections.mjs';

test('flat list yields one headerless section', () => {
  assert.deepEqual(parseIngredientSections(['1 onion', '2 eggs']), [
    { header: null, items: ['1 onion', '2 eggs'] },
  ]);
});

test('lines ending with ":" open named sections', () => {
  assert.deepEqual(
    parseIngredientSections(['Sauce:', '1 tbsp soy', 'Garnish:', 'coriander']),
    [
      { header: 'Sauce', items: ['1 tbsp soy'] },
      { header: 'Garnish', items: ['coriander'] },
    ]
  );
});

test('leading unheaded items keep their own section; blanks dropped', () => {
  assert.deepEqual(
    parseIngredientSections(['2 eggs', '', 'Topping:', 'sesame seeds']),
    [
      { header: null, items: ['2 eggs'] },
      { header: 'Topping', items: ['sesame seeds'] },
    ]
  );
});

test('empty input yields no sections', () => {
  assert.deepEqual(parseIngredientSections([]), []);
});
