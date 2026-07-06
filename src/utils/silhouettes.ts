// Build-time lookup: cuisine slug → raw leaf silhouette SVG, emitted by the
// prebuild generator. Used for RecipeCard placeholders so unphotographed
// recipes read as deliberate (stone + a light cuisine silhouette) rather than
// as a blank square. A recipe's `cuisine` is always a leaf slug; region SVGs in
// the same folder just sit unused here.
const files = import.meta.glob("../generated/silhouettes/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const bySlug: Record<string, string> = {};
for (const [path, svg] of Object.entries(files)) {
  const slug = path.slice(path.lastIndexOf("/") + 1, -".svg".length);
  bySlug[slug] = svg;
}

export function silhouetteFor(cuisine: string | null | undefined): string | null {
  if (!cuisine) return null;
  return bySlug[cuisine.toLowerCase()] ?? null;
}
