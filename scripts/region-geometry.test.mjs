import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureKey, slugForFeature, regionOf, featuresBySlug } from '../src/lib/regionGeometry.mjs';

const cuisines = [
  { slug: 'northern-europe', label: 'Northern Europe', parent: null },
  { slug: 'norwegian', label: 'Norwegian', parent: 'northern-europe' },
  { slug: 'balkan', label: 'Balkan', parent: null },
];
const mapping = {
  '578': { name: 'Norway', region: 'norwegian' },
  '752': { name: 'Sweden', region: 'northern-europe' },
  'Kosovo': { name: 'Kosovo', region: 'balkan' },
  '010': { name: 'Antarctica', region: null },
};
const geoms = [
  { id: '578', properties: { name: 'Norway' } },
  { id: '752', properties: { name: 'Sweden' } },
  { properties: { name: 'Kosovo' } },
  { id: '010', properties: { name: 'Antarctica' } },
];

test('slugForFeature resolves via id or name key; null for inert', () => {
  assert.equal(slugForFeature(mapping, geoms[0]), 'norwegian');
  assert.equal(slugForFeature(mapping, geoms[2]), 'balkan');
  assert.equal(slugForFeature(mapping, geoms[3]), null);
});

test('regionOf: leaf resolves to parent, region to itself', () => {
  assert.equal(regionOf(cuisines, 'norwegian'), 'northern-europe');
  assert.equal(regionOf(cuisines, 'balkan'), 'balkan');
});

test('featuresBySlug groups leaves and their regions; skips inert', () => {
  const g = featuresBySlug(geoms, mapping, cuisines);
  assert.deepEqual(g.get('norwegian').map(featureKey), ['578']);
  assert.deepEqual(g.get('northern-europe').map(featureKey), ['578', '752']);
  assert.deepEqual(g.get('balkan').map(featureKey), ['Kosovo']);
  assert.ok(![...g.values()].flat().includes(geoms[3]));
});
