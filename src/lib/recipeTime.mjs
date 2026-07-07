// Total cook time for a recipe: prefer an explicit totalTimeMinutes, else
// sum whatever prep/cook components are present. Most recipes carry
// prep + cook rather than a single total.
export function deriveTotalTime({ totalTimeMinutes, prepTimeMinutes, cookTimeMinutes } = {}) {
  if (totalTimeMinutes != null) return totalTimeMinutes;
  if (prepTimeMinutes != null || cookTimeMinutes != null) {
    return (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);
  }
  return null;
}
