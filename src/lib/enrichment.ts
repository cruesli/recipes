// Build-time access to the enriched-recipe JSON produced by the KG ingest
// pipeline (backend/export.py → src/data/enriched/*.json). This is the single
// seam the recipe page, facets, and shopping list read enrichment from.

export interface NutritionPerServing {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fibreG?: number;
  sodiumMg?: number;
}

export interface StatedQuantity {
  amount: number;
  unit: string;
}

export interface EnrichedIngredient {
  raw: string;
  section: string | null;
  canonical: string | null;
  category: string | null;
  quantity: StatedQuantity | null;
  grams: number | null;
}

export interface EnrichedRecipe {
  slug: string;
  version: number;
  servings: number | null;
  nutritionPerServing: NutritionPerServing | null;
  ingredients: EnrichedIngredient[];
}

// Eagerly bundle every exported recipe at build time, keyed by slug.
const _modules = import.meta.glob<EnrichedRecipe>("../data/enriched/*.json", {
  eager: true,
  import: "default",
});

const _bySlug: Record<string, EnrichedRecipe> = {};
for (const mod of Object.values(_modules)) {
  _bySlug[mod.slug] = mod;
}

/** Enriched data for a slug, or null when the recipe is not in the export. */
export function getEnriched(slug: string): EnrichedRecipe | null {
  return _bySlug[slug] ?? null;
}

// Shopping-category vocabulary — the closed enum from the backend. Unknown
// slugs fall to "other" so a backend enum change can never break the frontend.
export const CATEGORY_ORDER = [
  "produce",
  "meat-poultry",
  "fish-seafood",
  "dairy-eggs",
  "dry-goods",
  "canned-jarred",
  "oils-condiments",
  "spices-seasonings",
  "other",
] as const;

export type ShoppingCategory = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: "Produce",
  "meat-poultry": "Meat & poultry",
  "fish-seafood": "Fish & seafood",
  "dairy-eggs": "Dairy & eggs",
  "dry-goods": "Dry goods",
  "canned-jarred": "Canned & jarred",
  "oils-condiments": "Oils & condiments",
  "spices-seasonings": "Spices & seasonings",
  other: "Other",
};

/** Normalise any category string to a known slug (unknown → "other"). */
export function normaliseCategory(category: string | null | undefined): ShoppingCategory {
  return category && (CATEGORY_ORDER as readonly string[]).includes(category)
    ? (category as ShoppingCategory)
    : "other";
}
