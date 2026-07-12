// Shared ingredient-quantity parsing/scaling — consumed by the recipe-page
// scaler and the shopping list's degraded mode (NLP plan N4).

const FRACTION_TO_DECIMAL = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 0.333333, '⅔': 0.666667,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 0.166667, '⅚': 0.833333,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const DECIMAL_TO_FRACTION = [
  [0.875, '⅞'], [0.833333, '⅚'], [0.8, '⅘'], [0.75, '¾'],
  [0.666667, '⅔'], [0.625, '⅝'], [0.6, '⅗'], [0.5, '½'],
  [0.4, '⅖'], [0.375, '⅜'], [0.333333, '⅓'], [0.25, '¼'],
  [0.2, '⅕'], [0.166667, '⅙'], [0.125, '⅛'],
];

function formatFraction(decimal) {
  for (const [value, sym] of DECIMAL_TO_FRACTION) {
    if (Math.abs(decimal - value) < 0.01) return sym;
  }
  const s = decimal.toFixed(2).replace(/\.?0+$/, '');
  return s === '0' ? '' : s;
}

/** "1 ½", "¾", "1.2", "1/2", "1 1/2" → number */
export function parseQuantity(str) {
  if (str.includes('/')) {
    // optional leading whole part before an ASCII fraction ("1 1/2")
    const m = str.match(/^\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/);
    if (m) return (m[1] ? parseFloat(m[1]) : 0) + parseFloat(m[2]) / parseFloat(m[3]);
  }
  let value = 0;
  let digits = '';
  for (const ch of str) {
    const frac = FRACTION_TO_DECIMAL[ch] ?? 0;
    if (frac > 0) {
      if (digits) { value += parseFloat(digits); digits = ''; }
      value += frac;
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      digits += ch;
    }
  }
  if (digits) value += parseFloat(digits);
  return value;
}

/** number → "1 ½"-style mixed fraction */
export function formatQuantity(n) {
  const whole = Math.floor(n);
  const frac = n - whole;
  const fracStr = frac > 0.05 ? formatFraction(frac) : '';
  if (whole === 0) return fracStr || '0';
  return fracStr ? `${whole} ${fracStr}` : `${whole}`;
}

/** number → decimal string, max 2dp, trailing zeros trimmed */
function formatDecimal(n) {
  return String(Math.round(n * 100) / 100);
}

// Leading quantity (digits/fractions, optional internal spaces), optional
// range, optional ATTACHED unit (no whitespace — "400g", "1.2kg"), then rest.
// Spaced units ("1.5 litres") stay part of the rest, as before.
const NUM = '[\\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/.]';
const QTY = `${NUM}+(?: ${NUM}+)*`;
const QTY_RE = new RegExp(`^(${QTY})(?:\\s*-\\s*(${QTY}))?([a-zA-Z]+)?(?:\\s+|$)(.*)$`);

/** Scale the leading quantity of an ingredient line; unquantified lines pass through */
export function scaleIngredient(raw, ratio) {
  if (ratio === 1) return raw;
  const m = raw.match(QTY_RE);
  if (!m) return raw;
  const [, qty1, qty2, unit = '', rest = ''] = m;

  // Decimal inputs (metric style) stay decimal; fractions/integers stay fractional
  const fmt = qty1.includes('.') || qty2?.includes('.') ? formatDecimal : formatQuantity;
  const tail = unit ? `${unit}${rest ? ` ${rest}` : ''}` : rest ? ` ${rest}` : '';

  if (qty2) {
    const lo = parseQuantity(qty1) * ratio;
    const hi = parseQuantity(qty2) * ratio;
    return `${fmt(lo)}-${fmt(hi)}${tail}`;
  }
  return `${fmt(parseQuantity(qty1) * ratio)}${tail}`;
}
