// Shared ingredient-section parsing: lines ending with ":" open a named
// section. Consumed by the recipe-page ingredient plate and the planner.

/** @returns {{ header: string | null, items: string[] }[]} */
export function parseIngredientSections(raw) {
  const sections = [];
  let current = { header: null, items: [] };
  for (const line of raw) {
    if (line.endsWith(':')) {
      if (current.items.length > 0 || current.header !== null) sections.push(current);
      current = { header: line.slice(0, -1), items: [] };
    } else if (line.trim()) {
      current.items.push(line);
    }
  }
  if (current.items.length > 0 || current.header !== null) sections.push(current);
  return sections;
}
