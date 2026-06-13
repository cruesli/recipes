import { useState, useRef } from 'react';
import { Clock, Users, ChefHat, ArrowLeft, Check, Minus, Plus } from 'lucide-react';

export interface RecipePageProps {
  title: string;
  cuisine: string;
  totalTimeMinutes: number | null;
  servings: number;
  image: string | null;
  foodType: string | null;
  tags: string[];
  /** Flat string array; lines ending with ":" are section headers */
  ingredients: string[];
  /** Plain-text steps, one per array entry */
  steps: string[];
  basePath: string;
}

// ── Fraction helpers ──────────────────────────────────────────────────────────

const FRACTION_TO_DECIMAL: Record<string, number> = {
  '¼': 0.25, '½': 0.5, '¾': 0.75,
  '⅓': 0.333333, '⅔': 0.666667,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 0.166667, '⅚': 0.833333,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const DECIMAL_TO_FRACTION: Array<[number, string]> = [
  [0.875, '⅞'], [0.833333, '⅚'], [0.8, '⅘'], [0.75, '¾'],
  [0.666667, '⅔'], [0.625, '⅝'], [0.6, '⅗'], [0.5, '½'],
  [0.4, '⅖'], [0.375, '⅜'], [0.333333, '⅓'], [0.25, '¼'],
  [0.2, '⅕'], [0.166667, '⅙'], [0.125, '⅛'],
];

function parseFractionChar(ch: string): number {
  return FRACTION_TO_DECIMAL[ch] ?? 0;
}

function formatFraction(decimal: number): string {
  for (const [value, sym] of DECIMAL_TO_FRACTION) {
    if (Math.abs(decimal - value) < 0.01) return sym;
  }
  const s = decimal.toFixed(2).replace(/\.?0+$/, '');
  return s === '0' ? '' : s;
}

function parseQuantity(str: string): number {
  // Handle slash fractions like "1/2"
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  let value = 0;
  let digits = '';
  for (const ch of str) {
    const frac = parseFractionChar(ch);
    if (frac > 0) {
      if (digits) { value += parseFloat(digits); digits = ''; }
      value += frac;
    } else if (ch >= '0' && ch <= '9') {
      digits += ch;
    }
  }
  if (digits) value += parseFloat(digits);
  return value;
}

function formatQuantity(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  const fracStr = frac > 0.05 ? formatFraction(frac) : '';
  if (whole === 0) return fracStr || '0';
  return fracStr ? `${whole} ${fracStr}` : `${whole}`;
}

function scaleIngredient(raw: string, ratio: number): string {
  if (ratio === 1) return raw;
  // Match a leading quantity: digits, fractions, slash-fractions, spaces, hyphens
  const m = raw.match(/^([\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞\/\.\s]+(?:\s*-\s*[\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞\/\.]+)?)\s+/);
  if (!m) return raw;
  const qStr = m[1].trim();
  const rest = raw.slice(m[0].length);

  if (qStr.includes('-')) {
    const [lo, hi] = qStr.split('-').map((s) => parseQuantity(s.trim()) * ratio);
    return `${formatQuantity(lo)}-${formatQuantity(hi)} ${rest}`;
  }

  const scaled = parseQuantity(qStr) * ratio;
  return `${formatQuantity(scaled)} ${rest}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipePageIsland({
  title, cuisine, totalTimeMinutes, servings: defaultServings,
  image, foodType, tags, ingredients, steps, basePath,
}: RecipePageProps) {
  const [servings, setServings] = useState(defaultServings);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [keepAwake, setKeepAwake] = useState(false);
  const wakeLockRef = useRef<any>(null);

  const ratio = defaultServings > 0 ? servings / defaultServings : 1;

  function toggleStep(i: number) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function toggleWakeLock() {
    if (keepAwake) {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setKeepAwake(false);
    } else {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request('screen');
        setKeepAwake(true);
      } catch {
        // API not supported — silently ignore
      }
    }
  }

  // Parse ingredients into sections
  type Section = { header: string | null; items: string[] };
  const sections: Section[] = [];
  let cur: Section = { header: null, items: [] };
  for (const line of ingredients) {
    if (line.endsWith(':')) {
      if (cur.items.length || cur.header !== null) sections.push(cur);
      cur = { header: line.slice(0, -1), items: [] };
    } else if (line.trim()) {
      cur.items.push(line);
    }
  }
  if (cur.items.length || cur.header !== null) sections.push(cur);

  const timeLabel = totalTimeMinutes
    ? totalTimeMinutes >= 60
      ? `${Math.floor(totalTimeMinutes / 60)} t ${totalTimeMinutes % 60 ? (totalTimeMinutes % 60) + ' min' : ''}`.trim()
      : `${totalTimeMinutes} min`
    : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)', paddingTop: '60px' }}>

      {/* ── Hero (100vh) ── */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>

        {/* Back + title */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1.5rem 1rem', width: '100%', flexShrink: 0 }}>
          <a
            href={`${basePath}/`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--color-ink-muted)', textDecoration: 'none', marginBottom: '1.25rem' }}
          >
            <ArrowLeft size={16} />
            Back to recipes
          </a>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', color: 'var(--color-ink)', margin: 0, lineHeight: 1.1, fontFamily: "'EB Garamond', Georgia, serif" }}>
            {title}
          </h1>
        </div>

        {/* Hero image */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {image ? (
            <img
              src={`${basePath}${image}`}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-stone)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={48} color="var(--color-ink-muted)" />
            </div>
          )}
        </div>

        {/* Metadata bar */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'var(--color-paper)' }}>
          <div
            style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', alignItems: 'center' }}
          >
            {/* Cuisine */}
            <MetaItem icon={<ChefHat size={18} />} label="Cuisine" value={cuisine} />

            {/* Time */}
            {timeLabel && <MetaItem icon={<Clock size={18} />} label="Total time" value={timeLabel} />}

            {/* Food type */}
            {foodType && <MetaItem icon={<ChefHat size={18} />} label="Type" value={foodType} />}

            {/* Servings adjuster */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--color-oxblood)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginBottom: '2px' }}>Servings</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: 'var(--color-ink)' }}>
                  <button
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    aria-label="Fewer servings"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-oxblood)', padding: '2px', display: 'flex' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ minWidth: '1.5ch', textAlign: 'center' }}>{servings}</span>
                  <button
                    onClick={() => setServings((s) => s + 1)}
                    aria-label="More servings"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-oxblood)', padding: '2px', display: 'flex' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tags */}
            {tags.filter(Boolean).slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '999px', backgroundColor: 'rgba(134,139,89,0.15)', color: 'var(--color-olive)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content: ingredients + steps ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem', alignItems: 'start' }}>

          {/* Ingredients (dark panel) */}
          <div style={{ backgroundColor: 'var(--color-ink)', borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-paper)', margin: '0 0 1.25rem', fontFamily: "'EB Garamond', Georgia, serif" }}>
              Ingredients
            </h2>
            {sections.map((sec, si) => (
              <div key={si} style={{ marginBottom: sec.header ? '1.25rem' : '0' }}>
                {sec.header && (
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(250,248,242,0.5)', margin: '0 0 8px', fontFamily: 'system-ui, sans-serif' }}>
                    {sec.header}
                  </p>
                )}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sec.items.map((item, ii) => (
                    <li key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-paper)', fontSize: '14px', lineHeight: 1.5 }}>
                      <span style={{ marginTop: '6px', flexShrink: 0, width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'rgba(250,248,242,0.5)' }} />
                      {scaleIngredient(item, ratio)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--color-ink)', margin: 0, fontFamily: "'EB Garamond', Georgia, serif" }}>
                Instructions
              </h2>

              {/* Keep awake toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Keep screen on</span>
                <button
                  onClick={toggleWakeLock}
                  role="switch"
                  aria-checked={keepAwake}
                  style={{
                    position: 'relative', width: '40px', height: '22px', borderRadius: '999px',
                    border: 'none', cursor: 'pointer', padding: 0,
                    backgroundColor: keepAwake ? 'var(--color-oxblood)' : 'rgba(41,47,23,0.2)',
                    transition: 'background 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '3px', left: keepAwake ? '21px' : '3px',
                    width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>

            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {steps.map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => toggleStep(i)}
                    aria-label={`Step ${i + 1}${completed.has(i) ? ' — done' : ''}`}
                    style={{
                      flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                      border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      backgroundColor: 'var(--color-oxblood)', color: 'var(--color-paper)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {completed.has(i) ? <Check size={15} /> : i + 1}
                  </button>
                  <p style={{
                    paddingTop: '6px', margin: 0, lineHeight: 1.65, fontSize: '15px',
                    color: completed.has(i) ? 'rgba(41,47,23,0.35)' : 'rgba(41,47,23,0.75)',
                    textDecoration: completed.has(i) ? 'line-through' : 'none',
                    transition: 'color 0.2s',
                  }}>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'var(--color-oxblood)' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink)' }}>{value}</div>
      </div>
    </div>
  );
}
