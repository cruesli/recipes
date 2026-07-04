import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, featureKey } from './check-country-regions.mjs';

// Minimal fixtures: one id-keyed feature, one id-less (name-keyed) feature
const topology = {
  objects: {
    countries: {
      geometries: [
        { id: '578', properties: { name: 'Norway' } },
        { properties: { name: 'Kosovo' } },
      ],
    },
  },
};
const cuisines = {
  cuisines: [
    { slug: 'northern-europe', label: 'Northern Europe', parent: null },
    { slug: 'norwegian', label: 'Norwegian', parent: 'northern-europe' },
    { slug: 'balkan', label: 'Balkan', parent: null },
  ],
};
const valid = {
  countries: {
    '578': { name: 'Norway', region: 'norwegian' },
    'Kosovo': { name: 'Kosovo', region: null },
  },
};

test('featureKey prefers id, falls back to name', () => {
  assert.equal(featureKey(topology.objects.countries.geometries[0]), '578');
  assert.equal(featureKey(topology.objects.countries.geometries[1]), 'Kosovo');
});

test('valid mapping passes', () => {
  assert.deepEqual(validate(topology, valid, cuisines), []);
});

test('missing feature entry fails', () => {
  const broken = { countries: { '578': valid.countries['578'] } };
  const errors = validate(topology, broken, cuisines);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unmapped feature: Kosovo/);
});

test('orphan entry fails', () => {
  const broken = { countries: { ...valid.countries, '999': { name: 'Atlantis', region: null } } };
  const errors = validate(topology, broken, cuisines);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /orphan entry: 999/);
});

test('unknown region slug fails', () => {
  const broken = {
    countries: { ...valid.countries, '578': { name: 'Norway', region: 'atlantis' } },
  };
  const errors = validate(topology, broken, cuisines);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unknown region "atlantis"/);
});
