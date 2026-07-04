// Prebuild gate: country-regions.json must cover the topology exactly, with known region slugs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Feature key: numeric id when present, else name (mirrors WorldMap.tsx)
export const featureKey = (geom) => String(geom.id ?? geom.properties?.name);

// Returns a list of error strings; empty = valid
export function validate(topology, countryRegions, cuisines) {
  const errors = [];
  const geoms = topology.objects.countries.geometries;
  const mapping = countryRegions.countries;
  const slugs = new Set(cuisines.cuisines.map((c) => c.slug));
  const featureKeys = new Set(geoms.map(featureKey));

  // Every topology feature is mapped
  for (const g of geoms) {
    if (!(featureKey(g) in mapping))
      errors.push(`unmapped feature: ${featureKey(g)} (${g.properties?.name})`);
  }
  // Every entry matches a real feature
  for (const key of Object.keys(mapping)) {
    if (!featureKeys.has(key)) errors.push(`orphan entry: ${key} (${mapping[key].name})`);
  }
  // Every non-null region exists in cuisines.json
  for (const [key, { name, region }] of Object.entries(mapping)) {
    if (region !== null && !slugs.has(region))
      errors.push(`unknown region "${region}" for ${key} (${name})`);
  }
  return errors;
}

// CLI wrapper (skipped when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
  const countryRegions = read('src/content/meta/country-regions.json');
  const errors = validate(
    read('public/geo/countries-110m.json'),
    countryRegions,
    read('src/content/meta/cuisines.json')
  );
  if (errors.length) {
    console.error(`country-regions check failed (${errors.length}):`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log(`country-regions check passed (${Object.keys(countryRegions.countries).length} features)`);
}
