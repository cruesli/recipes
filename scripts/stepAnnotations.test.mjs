import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStepSegments } from '../src/lib/stepAnnotations.mjs';

const ingredients = [
  { raw: '30g salt', quantity: { amount: 30, unit: 'g' } },
  { raw: 'Roughly 500ml Water', quantity: { amount: 500, unit: 'ml' } },
  { raw: 'Neutral oil', quantity: null },
];

test('plain text → single text segment; reassembles to the original', () => {
  const segs = buildStepSegments('Cut pork into cubes');
  assert.deepEqual(segs, [{ type: 'text', text: 'Cut pork into cubes' }]);
});

test('timer segment splits the text', () => {
  const segs = buildStepSegments('cook for 3 hours in the oven');
  assert.deepEqual(segs.map((s) => s.type), ['text', 'timer', 'text']);
  assert.equal(segs[1].minutes, 180);
  assert.equal(segs.map((s) => s.text).join(''), 'cook for 3 hours in the oven');
});

test('amount inserted after the phrase, scaled by ratio', () => {
  const segs = buildStepSegments('Add the salt and water', {
    refs: [{ line: 0, phrase: 'salt' }, { line: 1, phrase: 'water' }],
    ingredients, ratio: 2,
  });
  assert.equal(
    segs.map((s) => s.text).join(''),
    'Add the salt (60 g) and water (1000 ml)'
  );
  assert.equal(segs.filter((s) => s.type === 'amount').length, 2);
});

test('refs without quantity or with missing phrase are skipped', () => {
  const segs = buildStepSegments('Add oil and mystery', {
    refs: [{ line: 2, phrase: 'oil' }, { line: 0, phrase: 'absent' }],
    ingredients,
  });
  assert.deepEqual(segs, [{ type: 'text', text: 'Add oil and mystery' }]);
});

test('timers and amounts coexist in order', () => {
  const segs = buildStepSegments('Add the salt then simmer 10 min', {
    refs: [{ line: 0, phrase: 'salt' }], ingredients,
  });
  assert.deepEqual(segs.map((s) => s.type), ['text', 'amount', 'text', 'timer']);
});

test('phrase match respects word boundaries (no mid-word insertion)', () => {
  const segs = buildStepSegments('Brush the broiler, not the oil', {
    refs: [{ line: 2, phrase: 'oil' }],
    ingredients: [
      { raw: '30g salt', quantity: { amount: 30, unit: 'g' } },
      { raw: '500ml water', quantity: { amount: 500, unit: 'ml' } },
      { raw: 'olive oil', quantity: { amount: 1, unit: 'tbsp' } },
    ],
  });
  assert.equal(segs.map((s) => s.text).join(''), 'Brush the broiler, not the oil (1 tbsp)');
});

test('duplicate phrases keep ref order (stable tiebreak)', () => {
  const segs = buildStepSegments('Add the salt and stir', {
    refs: [{ line: 0, phrase: 'salt' }, { line: 1, phrase: 'salt' }],
    ingredients: [
      { raw: '10g salt', quantity: { amount: 10, unit: 'g' } },
      { raw: '5g salt', quantity: { amount: 5, unit: 'g' } },
    ],
  });
  assert.equal(segs.map((s) => s.text).join(''), 'Add the salt (10 g) (5 g) and stir');
});

test('amount is suppressed when the prose already states a quantity', () => {
  const ings = [{ raw: '3 tbsp soy sauce', quantity: { amount: 3, unit: 'tbsp' } }];
  const segs = buildStepSegments('Stir 3 tbsp soy sauce into the pan', {
    refs: [{ line: 0, phrase: 'soy sauce' }], ingredients: ings,
  });
  assert.equal(segs.map((s) => s.text).join(''), 'Stir 3 tbsp soy sauce into the pan');
  assert.equal(segs.filter((s) => s.type === 'amount').length, 0);
});

test('suppression is clause-local — a number in a prior clause does not block', () => {
  const ings = [{ raw: '30g salt', quantity: { amount: 30, unit: 'g' } }];
  const segs = buildStepSegments('Simmer for 3 hours, then add the salt', {
    refs: [{ line: 0, phrase: 'salt' }], ingredients: ings,
  });
  assert.equal(segs.map((s) => s.text).join(''), 'Simmer for 3 hours, then add the salt (30 g)');
});

test('unquantified mention still gets the amount (the core case)', () => {
  const ings = [{ raw: '30g salt', quantity: { amount: 30, unit: 'g' } },
                { raw: '500ml water', quantity: { amount: 500, unit: 'ml' } }];
  const segs = buildStepSegments('Add the salt and water', {
    refs: [{ line: 0, phrase: 'salt' }, { line: 1, phrase: 'water' }], ingredients: ings,
  });
  assert.equal(segs.map((s) => s.text).join(''), 'Add the salt (30 g) and water (500 ml)');
});

test('amount is suppressed when the phrase itself carries the quantity', () => {
  // The linker often emits the number inside the phrase; the check must scan
  // through the phrase, not just the text before it.
  const ings = [{ raw: '3 tablespoons soy sauce', quantity: { amount: 3, unit: 'tablespoons' } }];
  const segs = buildStepSegments('Stir 3 tablespoons soy sauce into the pan', {
    refs: [{ line: 0, phrase: '3 tablespoons soy sauce' }], ingredients: ings,
  });
  assert.equal(segs.filter((s) => s.type === 'amount').length, 0);
});
