// Prebuild: emit one SVG silhouette per cuisine slug + a manifest of projected
// bboxes (base 800×600 map coordinates, groundwork for the reverse morph).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as topojson from 'topojson-client';
import { geoMercator, geoPath } from 'd3-geo';
import {
  featuresBySlug,
  MAP_WIDTH,
  MAP_HEIGHT,
  PROJECTION_CONFIG,
} from '../src/lib/regionGeometry.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const topology = read('public/geo/countries-110m.json');
const mapping = read('src/content/meta/country-regions.json').countries;
const cuisines = read('src/content/meta/cuisines.json').cuisines;

// Same projection as the runtime map (react-simple-maps defaults)
const projection = geoMercator()
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2])
  .center(PROJECTION_CONFIG.center)
  .scale(PROJECTION_CONFIG.scale);
const pathGen = geoPath(projection);

const outDir = path.join(root, 'src/generated/silhouettes');
mkdirSync(outDir, { recursive: true });

const round = (n) => Math.round(n * 100) / 100;
const manifest = {};
const missing = [];
const groups = featuresBySlug(topology.objects.countries.geometries, mapping, cuisines);

for (const { slug } of cuisines) {
  const geoms = groups.get(slug);
  if (!geoms?.length) {
    missing.push(slug);
    continue;
  }
  const merged = topojson.merge(topology, geoms);
  const d = pathGen(merged);
  const [[x0, y0], [x1, y1]] = pathGen.bounds(merged);
  const bbox = { x: round(x0), y: round(y0), width: round(x1 - x0), height: round(y1 - y0) };
  manifest[slug] = bbox;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}">` +
    `<path d="${d}" fill="currentColor"/></svg>\n`;
  writeFileSync(path.join(outDir, `${slug}.svg`), svg);
}

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (missing.length) {
  console.error('silhouettes: no geometry for slugs:', missing.join(', '));
  process.exit(1);
}
console.log(`silhouettes: ${Object.keys(manifest).length} generated`);
