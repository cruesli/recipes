// Client-side facet filtering for the collection, plus the mapping from the
// NL-query service's extracted filter keys to facet state. Pure + node-tested.

/**
 * Does a recipe pass the active facets?
 * recipe: { title, cuisine, totalTimeMinutes, dietary[], kcalPerServing, proteinPerServing, canonicals[] }
 * f (all optional): { query, cuisine, dietary, maxTime, maxKcal, minProtein, ingredient }
 *
 * Nutrition facets do NOT penalise recipes with unknown nutrition — a recipe
 * missing from the KG export still browses normally.
 */
export function matchesFacets(recipe, f = {}) {
  if (f.query) {
    const q = f.query.toLowerCase();
    if (!recipe.title.toLowerCase().includes(q) && !recipe.cuisine.toLowerCase().includes(q)) {
      return false;
    }
  }
  if (f.cuisine && recipe.cuisine.toLowerCase() !== f.cuisine.toLowerCase()) return false;

  if (f.ingredient) {
    const q = f.ingredient.toLowerCase();
    if (!(recipe.canonicals ?? []).some((c) => c.toLowerCase().includes(q))) return false;
  }

  if (f.dietary && f.dietary !== 'all') {
    if (!(recipe.dietary ?? []).includes(f.dietary)) return false;
  }

  if (f.maxTime != null) {
    if (recipe.totalTimeMinutes == null || recipe.totalTimeMinutes > f.maxTime) return false;
  }
  if (f.maxKcal != null) {
    if (recipe.kcalPerServing != null && recipe.kcalPerServing > f.maxKcal) return false;
  }
  if (f.minProtein != null) {
    if (recipe.proteinPerServing != null && recipe.proteinPerServing < f.minProtein) return false;
  }
  return true;
}

// The extracted filter keys the facet UI surfaces. Other keys the LLM may
// return (max_sodium, origin_country, …) have no control and are ignored.
export function extractedToFacets(filters = {}) {
  const out = {};
  if (typeof filters.cuisine === 'string') out.cuisine = filters.cuisine;
  if (typeof filters.ingredient === 'string') out.ingredient = filters.ingredient;
  if (filters.dietary === 'vegan' || filters.dietary === 'vegetarian') out.dietary = filters.dietary;
  if (typeof filters.max_time === 'number') out.maxTime = filters.max_time;
  if (typeof filters.max_kcal === 'number') out.maxKcal = filters.max_kcal;
  if (typeof filters.min_protein === 'number') out.minProtein = filters.min_protein;
  return out;
}
