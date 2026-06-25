import { displayFromSlug } from "./displayFromSlug";

export type CuisineItem = { slug: string; label?: string; parent?: string | null };

export function cuisineLabel(c: CuisineItem) {
  return c.label?.trim() ? c.label : displayFromSlug(c.slug);
}

/** Returns all slugs that match a cuisine query:
 *  - the slug itself
 *  - plus any leaves whose parent === slug (one level deep) */
export function getDescendants(slug: string, allCuisines: CuisineItem[]): string[] {
  const children = allCuisines
    .filter((c) => c.parent === slug)
    .map((c) => c.slug);
  return [slug, ...children];
}
