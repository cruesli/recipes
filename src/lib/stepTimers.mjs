// Explicit-duration detection in step prose ("3 hours", "2-3 min"). Ranges
// start at the lower bound (check early; adding time is easy). Pure.

const DURATION_RE =
  /(\d+(?:[.,]\d+)?)(?:(?:\s*[-–—]\s*|\s+to\s+)(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/gi;

export function findDurations(text) {
  const out = [];
  for (const m of text.matchAll(DURATION_RE)) {
    const value = parseFloat(m[1].replace(',', '.'));
    const isHours = m[3].toLowerCase().startsWith('h');
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      label: m[0],
      minutes: Math.round(value * (isHours ? 60 : 1)),
    });
  }
  return out;
}
