// Prebuild: emit one SVG silhouette per cuisine slug + a manifest of projected
// bboxes (base 800×600 map coordinates, groundwork for the reverse morph).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as topojson from 'topojson-client';
import { geoMercator, geoPath } from 'd3-geo';
import {
  featuresBySlug,
  slugForFeature,
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

// Remote territories dropped from every generated asset — they stretch a
// plate's frame far past the cuisine's heartland. The world map keeps them.
// Boxes are [lonMin, latMin, lonMax, latMax]; a polygon is dropped when its
// outer ring's centre falls inside one. (French Guiana's west edge stays east
// of Suriname's centre at −55.9°.)
const REMOTE_TERRITORIES = {
  svalbard: [9, 74, 36, 81.5],
  'jan-mayen': [-10, 70.5, -7, 71.5],
  'french-guiana': [-54.9, 1.5, -51, 6.5],
};

const ringCentre = (ring) => {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
};

const isRemote = (poly) => {
  const [lon, lat] = ringCentre(poly[0]);
  return Object.values(REMOTE_TERRITORIES).some(
    ([x0, y0, x1, y1]) => lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1
  );
};

const strippedSlugs = new Set();
function stripRemote(geometry, slug) {
  if (geometry.type !== 'MultiPolygon') return geometry;
  const kept = geometry.coordinates.filter((poly) => !isRemote(poly));
  if (kept.length === geometry.coordinates.length || kept.length === 0) return geometry;
  strippedSlugs.add(slug);
  return { ...geometry, coordinates: kept };
}

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
  const merged = stripRemote(topojson.merge(topology, geoms), slug);
  const d = pathGen(merged);
  const [[x0, y0], [x1, y1]] = pathGen.bounds(merged);
  const bbox = { x: round(x0), y: round(y0), width: round(x1 - x0), height: round(y1 - y0) };
  manifest[slug] = bbox;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}">` +
    `<path d="${d}" fill="currentColor"/></svg>\n`;
  writeFileSync(path.join(outDir, `${slug}.svg`), svg);
}

// Region-plate variant: a miniature country-mode map of the region — one merged
// path per leaf cuisine (slug carried; aliveness is decided at page render) plus
// per-country paths for inert member land. Same viewBox as the plain silhouette,
// so both morph directions keep their endpoint.
let plates = 0;
for (const region of cuisines.filter((c) => !c.parent)) {
  const leaves = cuisines.filter((c) => c.parent === region.slug);
  const bbox = manifest[region.slug];
  if (!leaves.length || !bbox) continue;
  const leafPaths = leaves
    .filter((l) => groups.get(l.slug)?.length)
    .map((l) => ({ slug: l.slug, d: pathGen(stripRemote(topojson.merge(topology, groups.get(l.slug)), l.slug)) }));
  const inert = (groups.get(region.slug) ?? [])
    .filter((g) => slugForFeature(mapping, g) === region.slug)
    .map((g) => pathGen(stripRemote(topojson.feature(topology, g).geometry, region.slug)));
  const plate = {
    viewBox: `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`,
    leaves: leafPaths,
    inert,
  };
  writeFileSync(path.join(outDir, `${region.slug}.plate.json`), JSON.stringify(plate) + '\n');
  plates += 1;
}

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

if (missing.length) {
  console.error('silhouettes: no geometry for slugs:', missing.join(', '));
  process.exit(1);
}
if (strippedSlugs.size) {
  console.log(`silhouettes: remote territories dropped from: ${[...strippedSlugs].sort().join(', ')}`);
}
console.log(`silhouettes: ${Object.keys(manifest).length} generated, ${plates} region plates`);
