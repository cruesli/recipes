import { useState, useRef } from 'react';
import { Clock, Users, ChefHat, ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { scaleIngredient } from '../lib/quantity.mjs';
import type { NutritionPerServing } from '../lib/enrichment';

export interface RecipePageProps {
  title: string;
  /** Optional headnote (Norwegian); italic body above the columns */
  intro: string | null;
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
  /** Per-serving macros from the KG export; null when not in the graph */
  nutrition: NutritionPerServing | null;
  basePath: string;
}

// ── Shared style constants ────────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontFamily: "'EB Garamond', Georgia, serif",
  fontWeight: 600,
  fontSize: 'var(--text-eyebrow)',
  textTransform: 'uppercase',
  letterSpacing: '0.24em',
  color: 'var(--color-oxblood)',
  margin: 0,
};

const HAIRLINE: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--color-hairline)',
  margin: 0,
};

const PLATE_HAIRLINE: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--color-plate-hairline)',
  margin: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipePageIsland({
  title, intro, cuisine, totalTimeMinutes, servings: defaultServings,
  image, foodType, tags, ingredients, steps, nutrition, basePath,
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
      ? `${Math.floor(totalTimeMinutes / 60)} h ${totalTimeMinutes % 60 ? (totalTimeMinutes % 60) + ' min' : ''}`.trim()
      : `${totalTimeMinutes} min`
    : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)', paddingTop: '60px' }}>

      {/* ── Hero (100vh) ── */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>

        {/* Back + title */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg) var(--space-lg)', width: '100%', flexShrink: 0 }}>
          <a
            href={`${basePath}/`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-ink-muted)', textDecoration: 'none', marginBottom: 'var(--space-lg)', ...EYEBROW }}
          >
            <ArrowLeft size={13} />
            All recipes
          </a>
          <h1 style={{ fontSize: 'var(--text-title)', color: 'var(--color-ink)', margin: 0, lineHeight: 1.1, fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 500 }}>
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
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-lg) var(--space-lg)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)', alignItems: 'center' }}>
            <MetaItem label="Cuisine" value={cuisine} />
            {timeLabel && <MetaItem label="Total time" value={timeLabel} />}
            {foodType && <MetaItem label="Type" value={foodType} />}

            {/* Tags */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
              {tags.filter(Boolean).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{ fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.18em', padding: '3px 8px', border: '1px solid var(--color-hairline)', color: 'var(--color-olive)', fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600 }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content: ingredients + steps ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg) var(--space-4xl)' }}>
        {/* Headnote — italic Garamond body, author's voice before the columns */}
        {intro && (
          <p style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 'var(--text-body)',
            lineHeight: 1.7,
            color: 'var(--color-ink)',
            maxWidth: '62ch',
            margin: '0 0 var(--space-2xl)',
          }}>
            {intro}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3xl)', alignItems: 'start' }}>

          {/* Left column: ingredients + nutrition */}
          <div>
            {/* Ingredients — the one sanctioned printed plate: solid oxblood,
                paper type, print grammar (squared, flat, no border/shadow) */}
            <div style={{ backgroundColor: 'var(--color-oxblood)', padding: 'var(--space-xl) var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
              <p style={{ ...EYEBROW, color: 'var(--color-plate-text)', marginBottom: 'var(--space-sm)' }}>Ingredients</p>
              <hr style={PLATE_HAIRLINE} />

              {/* Servings stepper — moved onto the plate (the mid-cooking surface) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-xs) 0', borderBottom: '1px solid var(--color-plate-hairline)' }}>
                <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', fontWeight: 500, color: 'var(--color-plate-muted)' }}>Servings</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 500, color: 'var(--color-plate-text)' }}>
                  <button
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    aria-label="Fewer servings"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-plate-text)', padding: '2px', display: 'flex', lineHeight: 1 }}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="onum" style={{ minWidth: '1.5ch', textAlign: 'center', fontSize: 'var(--text-body)' }}>{servings}</span>
                  <button
                    onClick={() => setServings((s) => s + 1)}
                    aria-label="More servings"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-plate-text)', padding: '2px', display: 'flex', lineHeight: 1 }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {sections.map((sec, si) => (
                <div key={si}>
                  {sec.header && (
                    <p style={{ ...EYEBROW, color: 'var(--color-plate-muted)', margin: 'var(--space-md) 0 var(--space-2xs)' }}>
                      {sec.header}
                    </p>
                  )}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sec.items.map((item, ii) => (
                      <li
                        key={ii}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 'var(--space-xs)',
                          padding: 'var(--space-xs) 0',
                          borderBottom: '1px solid var(--color-plate-hairline)',
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: 'var(--text-meta)',
                          fontWeight: 500, /* light serif optically thins on dark ground */
                          color: 'var(--color-plate-text)',
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ color: 'var(--color-plate-text)', fontSize: '0.5rem', flexShrink: 0, marginTop: '0.1rem' }}>●</span>
                        <span>{scaleIngredient(item, ratio)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Nutrition — per-serving macros from the KG export (estimated).
                Per-serving values don't change with the servings stepper. */}
            <div>
              <p style={{ ...EYEBROW, marginBottom: 'var(--space-sm)' }}>Nutrition</p>
              <hr style={HAIRLINE} />
              {(nutrition
                ? ([
                    ['Calories', `${nutrition.kcal}`],
                    ['Protein', `${nutrition.proteinG} g`],
                    ['Carbohydrates', `${nutrition.carbsG} g`],
                    ['Fat', `${nutrition.fatG} g`],
                    ...(nutrition.fibreG != null ? [['Fibre', `${nutrition.fibreG} g`]] : []),
                    ...(nutrition.sodiumMg != null ? [['Sodium', `${nutrition.sodiumMg} mg`]] : []),
                  ] as [string, string][])
                : ([
                    ['Calories', '—'],
                    ['Protein', '—'],
                    ['Carbohydrates', '—'],
                    ['Fat', '—'],
                  ] as [string, string][])
              ).map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--space-xs) 0', borderBottom: '1px solid var(--color-hairline)' }}
                >
                  <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink)' }}>{label}</span>
                  <span className="onum" style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)' }}>{value}</span>
                </div>
              ))}
              <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', marginTop: 'var(--space-sm)', fontStyle: 'italic' }}>
                {nutrition ? 'Estimated per serving from ingredient data.' : 'Nutrition data coming soon.'}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
              <p style={{ ...EYEBROW, margin: 0 }}>Instructions</p>

              {/* Keep awake toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)' }}>Keep screen on</span>
                <button
                  onClick={toggleWakeLock}
                  role="switch"
                  aria-checked={keepAwake}
                  style={{
                    position: 'relative', width: '36px', height: '20px', borderRadius: '999px',
                    border: 'none', cursor: 'pointer', padding: 0,
                    backgroundColor: keepAwake ? 'var(--color-oxblood)' : 'var(--color-stone)',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '3px', left: keepAwake ? '19px' : '3px',
                    width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--color-paper)',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </label>
            </div>

            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((step, i) => (
                <li
                  key={i}
                  style={{ display: 'flex', gap: 'var(--space-lg)', paddingTop: i === 0 ? 0 : 'var(--space-lg)', borderTop: i === 0 ? 'none' : '1px solid var(--color-hairline)', marginTop: i === 0 ? 0 : 'var(--space-lg)' }}
                >
                  <button
                    onClick={() => toggleStep(i)}
                    aria-label={`Step ${i + 1}${completed.has(i) ? ' — done' : ''}`}
                    style={{
                      flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
                      cursor: 'pointer', fontSize: 'var(--text-eyebrow)', fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600,
                      backgroundColor: completed.has(i) ? 'var(--color-oxblood)' : 'transparent',
                      border: completed.has(i) ? 'none' : '1.5px solid var(--color-hairline)',
                      color: completed.has(i) ? 'var(--color-paper)' : 'var(--color-ink-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', marginTop: '2px',
                    }}
                  >
                    {completed.has(i) ? <Check size={13} /> : i + 1}
                  </button>
                  <p style={{
                    margin: 0, lineHeight: 1.7,
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: 'var(--text-body)',
                    color: completed.has(i) ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                    textDecoration: completed.has(i) ? 'line-through' : 'none',
                    transition: 'color 0.2s',
                    opacity: completed.has(i) ? 0.5 : 1,
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{
        fontFamily: "'EB Garamond', Georgia, serif",
        fontWeight: 600,
        fontSize: 'var(--text-eyebrow)',
        textTransform: 'uppercase',
        letterSpacing: '0.24em',
        color: 'var(--color-oxblood)',
        margin: '0 0 4px',
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: "'EB Garamond', Georgia, serif",
        fontSize: 'var(--text-body)',
        fontWeight: 500,
        color: 'var(--color-ink)',
        margin: 0,
      }}>
        {value}
      </p>
    </div>
  );
}
