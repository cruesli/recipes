// Margin-note placement: seeded jitter (stable across visits) + top-down
// collision resolution so notes never overlap. Pure — measurements come in,
// offsets go out.

// mulberry32 — small fast deterministic PRNG (public domain, by Tommy Ettinger).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hand-placed feel: small x displacement, larger y. */
export function jitterFor(seed) {
  const rand = mulberry32(seed);
  return { dx: Math.round((rand() * 2 - 1) * 10), dy: Math.round(rand() * 48) };
}

/**
 * notes: [{ id, anchorTop, seed, height }] → Map id → { top, dx }.
 * Jittered tops, then push-down so each note clears the previous by `gap`.
 */
export function layoutMarginNotes(notes, gap = 12) {
  const placed = notes
    .map((n) => {
      const { dx, dy } = jitterFor(n.seed);
      return { id: n.id, dx, top: n.anchorTop + dy, height: Math.max(0, n.height) };
    })
    .sort((a, b) => a.top - b.top);
  let floor = -Infinity;
  for (const p of placed) {
    if (p.top < floor) p.top = floor;
    floor = p.top + p.height + gap;
  }
  return new Map(placed.map((p) => [p.id, { top: p.top, dx: p.dx }]));
}
