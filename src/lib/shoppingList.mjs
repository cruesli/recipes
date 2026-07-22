// Pure shopping-list merge logic (node-tested). Turns enriched shopping items
// into category buckets with merged, day-noted lines; staple canonicals divert
// to a separate list; unenriched items degrade to the classic day→recipe grouping. No React, no DOM.

export const DEFAULT_BUCKET_ORDER = [
  'produce', 'meat-poultry', 'fish-seafood', 'dairy-eggs', 'dry-goods',
  'canned-jarred', 'oils-condiments', 'spices-seasonings', 'other',
];

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

const _round = (n) => Math.round(n * 100) / 100;

/** One quantity part: counts are unitless, everything else keeps its unit. */
export function formatPart(amount, unit) {
  const n = _round(amount);
  return unit === 'count' ? String(n) : `${n} ${unit}`;
}

function normaliseCategory(category) {
  return DEFAULT_BUCKET_ORDER.includes(category) ? category : 'other';
}

// Day note for one merged canonical: quantities scaled + summed per unit within
// a day, mixed units listed (never converted), null-quantity days shown bare.
function dayNote(items, days) {
  const byDay = new Map();  // day → { units: Map<unit, amount>, hasNull, hasQty }
  for (const it of items) {
    if (!byDay.has(it.day)) byDay.set(it.day, { units: new Map(), hasNull: false, hasQty: false });
    const bucket = byDay.get(it.day);
    if (it.quantity && typeof it.quantity.amount === 'number') {
      const { amount, unit } = it.quantity;
      bucket.units.set(unit, (bucket.units.get(unit) ?? 0) + amount * (it.ratio ?? 1));
      bucket.hasQty = true;
    } else {
      bucket.hasNull = true;
    }
  }
  const parts = [];
  for (const day of days) {
    if (!byDay.has(day)) continue;
    const { units, hasQty } = byDay.get(day);
    const abbr = DAY_ABBR[day] ?? day;
    if (hasQty) {
      const rendered = [...units.entries()].map(([unit, amount]) => formatPart(amount, unit)).join(' + ');
      parts.push(`${abbr}: ${rendered}`);
    } else {
      parts.push(abbr);  // only null quantities → day alone
    }
  }
  return parts.join(', ');
}

function mergeEnriched(items, days) {
  const byCanonical = new Map();  // canonical → items[]
  for (const it of items) {
    if (!byCanonical.has(it.canonical)) byCanonical.set(it.canonical, []);
    byCanonical.get(it.canonical).push(it);
  }
  const lines = [];
  for (const [canonical, group] of byCanonical) {
    lines.push({
      id: `c:${canonical}`,
      canonical,
      category: normaliseCategory(group[0].category),
      note: dayNote(group, days),
    });
  }
  return lines;
}

function buildBuckets(lines, bucketOrder) {
  const byCat = new Map();
  for (const line of lines) {
    if (!byCat.has(line.category)) byCat.set(line.category, []);
    byCat.get(line.category).push(line);
  }
  const order = bucketOrder.filter((c, i) => bucketOrder.indexOf(c) === i);
  const buckets = [];
  for (const category of order) {
    const catLines = byCat.get(category);
    if (catLines && catLines.length) buckets.push({ category, lines: catLines });
  }
  return buckets;
}

// Degraded items keep the classic day → meal → section shape.
function groupDegraded(items, days) {
  const byDay = new Map();
  for (const it of items) {
    if (!byDay.has(it.day)) byDay.set(it.day, new Map());  // day → mealId → meal
    const mealMap = byDay.get(it.day);
    if (!mealMap.has(it.mealId)) mealMap.set(it.mealId, { title: it.recipeTitle, sections: [] });
    const meal = mealMap.get(it.mealId);
    let sec = meal.sections[meal.sections.length - 1];
    if (!sec || sec.header !== it.sectionHeader) {
      sec = { header: it.sectionHeader, items: [] };
      meal.sections.push(sec);
    }
    sec.items.push(it);
  }
  const out = [];
  for (const day of days) {
    if (!byDay.has(day)) continue;
    out.push({ day, meals: [...byDay.get(day).values()] });
  }
  return out;
}

export function buildShoppingView(items, bucketOrder = DEFAULT_BUCKET_ORDER, days = WEEK, staples = []) {
  const stapleSet = new Set(staples.map((s) => s.toLowerCase()));
  const enriched = items.filter((i) => i.canonical);
  const degraded = items.filter((i) => !i.canonical);
  const merged = mergeEnriched(enriched, days);
  const stapleLines = merged.filter((l) => stapleSet.has(l.canonical.toLowerCase()));
  const bucketLines = merged.filter((l) => !stapleSet.has(l.canonical.toLowerCase()));
  return {
    buckets: buildBuckets(bucketLines, bucketOrder),
    staples: stapleLines,
    degraded: groupDegraded(degraded, days),
    hasEnriched: enriched.length > 0,
  };
}
