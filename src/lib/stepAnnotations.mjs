// Step text → ordered segments: plain text, tappable timers, and inline
// scaled amounts inserted after LLM-linked ingredient phrases. Pure.

import { findDurations } from './stepTimers.mjs';
import { formatPart } from './shoppingList.mjs';

// End index of the first whole-word occurrence of `phrase` in `text`, or -1.
// Word-bounded so a phrase never matches inside a larger word ("oil" ⊄ "broiler").
function phraseEnd(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`\\b${escaped}\\b`, 'i').exec(text);
  return m ? m.index + m[0].length : -1;
}

export function buildStepSegments(text, { refs = null, ingredients = null, ratio = 1 } = {}) {
  const timers = findDurations(text);
  const inserts = [];
  if (refs && ingredients) {
    for (const ref of refs) {
      const quantity = ingredients[ref.line]?.quantity;
      if (!quantity) continue;
      const pos = phraseEnd(text, ref.phrase);
      if (pos === -1) continue;
      inserts.push({ pos, text: ` (${formatPart(quantity.amount * ratio, quantity.unit)})` });
    }
  }
  // Merge timer spans and zero-width amount insertions into ordered segments
  const events = [
    ...timers.map((t) => ({ kind: 'timer', at: t.start, t })),
    ...inserts.map((i) => ({ kind: 'amount', at: i.pos, i })),
  ].sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === 'amount' ? -1 : 1));
  const segs = [];
  let cursor = 0;
  for (const ev of events) {
    if (ev.at < cursor) continue; // overlap guard
    if (ev.at > cursor) segs.push({ type: 'text', text: text.slice(cursor, ev.at) });
    if (ev.kind === 'timer') {
      segs.push({ type: 'timer', text: text.slice(ev.t.start, ev.t.end), minutes: ev.t.minutes });
      cursor = ev.t.end;
    } else {
      segs.push({ type: 'amount', text: ev.i.text });
      cursor = ev.at;
    }
  }
  if (cursor < text.length) segs.push({ type: 'text', text: text.slice(cursor) });
  return segs;
}
