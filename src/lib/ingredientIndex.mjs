// Back-of-book ingredient index: canonical → recipes, A–Z groups, staples
// excluded (they appear on every page and have the pantry footer). Pure.

export function buildIngredientIndex(recipes, staples = []) {
  const stapleSet = new Set(staples.map((s) => s.toLowerCase()));
  const byCanonical = new Map(); // canonical → [{slug, title, cuisine}]
  for (const r of recipes) {
    for (const c of new Set(r.canonicals ?? [])) {
      if (!c || stapleSet.has(c.toLowerCase())) continue;
      if (!byCanonical.has(c)) byCanonical.set(c, []);
      byCanonical.get(c).push({ slug: r.slug, title: r.title, cuisine: r.cuisine });
    }
  }
  const sorted = [...byCanonical.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const groups = [];
  for (const [canonical, recs] of sorted) {
    const letter = canonical[0].toUpperCase();
    let group = groups[groups.length - 1];
    if (!group || group.letter !== letter) {
      group = { letter, entries: [] };
      groups.push(group);
    }
    recs.sort((x, y) => x.title.localeCompare(y.title, 'en'));
    group.entries.push({ canonical, recipes: recs });
  }
  return groups;
}
