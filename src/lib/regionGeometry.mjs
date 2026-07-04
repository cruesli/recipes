// Shared map geometry rules — consumed by WorldMap.tsx (runtime) and the
// prebuild scripts (Node). Identical keying/grouping is what keeps the map,
// the completeness check and the generated silhouettes in agreement.

/** Feature key: numeric id when present, else name (3 disputed territories lack ids) */
export const featureKey = (geom) => String(geom.id ?? geom.properties?.name);

/**
 * Cuisine slug (leaf or region) for a feature, or null (inert land).
 * @param {Record<string, {name: string, region: string | null}>} mapping
 */
export const slugForFeature = (mapping, geom) => mapping[featureKey(geom)]?.region ?? null;

/** Region slug for a cuisine slug: parent if leaf, else the slug itself */
export const regionOf = (cuisines, slug) =>
  cuisines.find((c) => c.slug === slug)?.parent ?? slug;

/**
 * Group topology geometry objects by cuisine slug. Regions collect every
 * member feature; leaves additionally collect their directly-mapped features.
 * @returns {Map<string, any[]>}
 */
export function featuresBySlug(geometries, mapping, cuisines) {
  const groups = new Map();
  const add = (slug, geom) => {
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(geom);
  };
  geometries.forEach((geom) => {
    const slug = slugForFeature(mapping, geom);
    if (!slug) return;
    add(slug, geom);
    const region = regionOf(cuisines, slug);
    if (region !== slug) add(region, geom);
  });
  return groups;
}

// Base projection the runtime map uses (react-simple-maps defaults: 800×600,
// translate = centre) — the generator must match it exactly.
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;
export const PROJECTION_CONFIG = { scale: 170, center: [15, 25] };
