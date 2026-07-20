import { useState, useRef, useEffect, useMemo } from 'react';
import { ChefHat, ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { scaleIngredient } from '../lib/quantity.mjs';
import { parseIngredientSections } from '../lib/ingredientSections.mjs';
import { workBack, formatClock } from '../lib/recipeTime.mjs';
import { buildStepSegments } from '../lib/stepAnnotations.mjs';
import type { NutritionPerServing, EnrichedStep, EnrichedIngredient } from '../lib/enrichment';

export interface RecipePageProps {
  title: string;
  slug: string;
  /** Optional headnote (Norwegian); italic body above the columns */
  intro: string | null;
  cuisine: string;
  totalTimeMinutes: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  marinadeTimeMinutes: number | null;
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
  /** LLM-linked ingredient references per step, index-aligned with `steps`; null when not in the graph */
  enrichedSteps: EnrichedStep[] | null;
  /** Same ingredient list as `ingredients`, enriched with scaled quantities; null when not in the graph */
  enrichedIngredients: EnrichedIngredient[] | null;
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

// ── Timers: persistence + chime ─────────────────────────────────────────────

interface StepTimer {
  id: string;        // `${slug}:${stepIndex}:${segIndex}`
  slug: string;
  stepIndex: number;
  label: string;
  endsAt: number;    // epoch ms
  minutes: number;
  chimed?: boolean;
}

const TIMERS_KEY = 'recipes:timers';

function loadTimers(slug: string): StepTimer[] {
  try {
    const all = JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]') as StepTimer[];
    // keep this recipe's timers; drop anything finished over an hour ago
    return all.filter((t) => t.slug === slug && t.endsAt > Date.now() - 3_600_000);
  } catch { return []; }
}

function saveTimers(slug: string, timers: StepTimer[]) {
  try {
    const others = (JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]') as StepTimer[])
      .filter((t) => t.slug !== slug);
    localStorage.setItem(TIMERS_KEY, JSON.stringify([...others, ...timers]));
  } catch {}
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 1174 : 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipePageIsland({
  title, slug, intro, cuisine, totalTimeMinutes, prepTimeMinutes, cookTimeMinutes, marinadeTimeMinutes,
  servings: defaultServings,
  image, foodType, tags, ingredients, steps, nutrition, enrichedSteps, enrichedIngredients, basePath,
}: RecipePageProps) {
  const [servings, setServings] = useState(defaultServings);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [keepAwake, setKeepAwake] = useState(false);
  const [targetTime, setTargetTime] = useState('18:00');
  const wakeLockRef = useRef<any>(null);
  const didMountTimers = useRef(false);

  const [timers, setTimers] = useState<StepTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { setTimers(loadTimers(slug)); }, [slug]);
  useEffect(() => {
    if (!didMountTimers.current) { didMountTimers.current = true; return; }
    saveTimers(slug, timers);
  }, [timers]);

  // 1s tick while any timer is still counting down; stops once all are chimed
  useEffect(() => {
    if (!timers.some((t) => !t.chimed)) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [timers]);

  // chime once per timer on completion
  useEffect(() => {
    const due = timers.filter((t) => !t.chimed && t.endsAt <= now);
    if (due.length === 0) return;
    chime();
    setTimers((prev) => prev.map((t) => (!t.chimed && t.endsAt <= now ? { ...t, chimed: true } : t)));
  }, [now, timers]);

  function toggleTimer(id: string, stepIndex: number, label: string, minutes: number) {
    setTimers((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) return prev.filter((t) => t.id !== id); // tap again = clear
      return [...prev, { id, slug, stepIndex, label, minutes, endsAt: Date.now() + minutes * 60_000 }];
    });
  }

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

  // Parse ingredients into sections (shared with the planner)
  const sections = parseIngredientSections(ingredients);

  const fmtMin = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`;

  const timeLabel = totalTimeMinutes ? fmtMin(totalTimeMinutes) : null;

  // Work-back schedule from the chosen "on the table" time
  const [targetH, targetM] = targetTime.split(':').map(Number);
  const plan = workBack(targetH * 60 + targetM, { prepTimeMinutes, cookTimeMinutes, marinadeTimeMinutes });

  // Step prose → ordered segments (plain text + tappable timers + scaled amounts)
  const stepSegments = useMemo(
    () => steps.map((step, i) =>
      buildStepSegments(step, {
        refs: enrichedSteps?.[i]?.refs ?? null,
        ingredients: enrichedIngredients,
        ratio,
      })
    ),
    [steps, enrichedSteps, enrichedIngredients, ratio]
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)', paddingTop: '60px' }}>
      <style>{`
        @keyframes rp-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(126,38,37,0.5); } 50% { box-shadow: 0 0 0 6px rgba(126,38,37,0); } }
        .rp-step-due { animation: rp-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .rp-step-due { animation: none; } }
      `}</style>

      {/* ── Hero (100vh) ── */}
      <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>

        {/* Back + title */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg) var(--space-lg)', width: '100%', flexShrink: 0 }}>
          <a
            href={`${basePath}/recipes`}
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
            {prepTimeMinutes != null && <MetaItem label="Prep" value={fmtMin(prepTimeMinutes)} />}
            {cookTimeMinutes != null && <MetaItem label="Cook" value={fmtMin(cookTimeMinutes)} />}
            {prepTimeMinutes == null && cookTimeMinutes == null && timeLabel && (
              <MetaItem label="Total time" value={timeLabel} />
            )}
            {marinadeTimeMinutes != null && <MetaItem label="Marinade" value={fmtMin(marinadeTimeMinutes)} />}
            {foodType && <MetaItem label="Type" value={foodType} />}

            {/* Tags — quiet muted text, never pills (olive is hover/seasonal-only) */}
            <p style={{ margin: '0 0 0 auto', fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--color-ink-muted)', fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600 }}>
              {tags.filter(Boolean).slice(0, 3).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Content: ingredients + steps ── */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-2xl) var(--space-lg) var(--space-4xl)' }}>
        {/* Work-back schedule — one calm line under the metadata bar */}
        {plan && (
          <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-body)', color: 'var(--color-ink)', margin: '0 0 var(--space-2xl)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)' }}>
              <span style={{ color: 'var(--color-ink-muted)' }}>On the table at</span>
              <input
                type="time"
                value={targetTime}
                onChange={(e) => e.target.value && setTargetTime(e.target.value)}
                className="onum"
                style={{ border: 'none', borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'transparent', color: 'var(--color-oxblood)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-body)', padding: '0 2px', outline: 'none' }}
              />
            </label>
            <span style={{ color: 'var(--color-ink-muted)' }}>—</span>
            {plan.marinadeFrom != null && (
              <span>
                marinate from <span className="onum">{plan.marinadeFrom < 0 ? 'the evening before' : formatClock(plan.marinadeFrom)}</span>,
              </span>
            )}
            <span>start cooking by <span className="onum" style={{ fontWeight: 500 }}>{formatClock(plan.startBy)}</span>{plan.startBy < 0 ? ' the day before' : ''}.</span>
          </p>
        )}
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
                    className={timers.some((t) => t.stepIndex === i && t.endsAt <= now) ? 'rp-step-due' : undefined}
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
                    {stepSegments[i].map((seg, si) => {
                      if (seg.type === 'amount') {
                        return (
                          <span key={si} className="onum" style={{ color: 'var(--color-ink-muted)' }}>
                            {seg.text}
                          </span>
                        );
                      }
                      if (seg.type !== 'timer') return <span key={si}>{seg.text}</span>;
                      const id = `${slug}:${i}:${si}`;
                      const running = timers.find((t) => t.id === id);
                      const remaining = running ? running.endsAt - now : 0;
                      return (
                        <button
                          key={si}
                          onClick={() => toggleTimer(id, i, seg.text, seg.minutes)}
                          title={running ? 'Tap to clear the timer' : `Start a ${seg.text} timer`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'inherit', lineHeight: 'inherit',
                            color: 'var(--color-oxblood)',
                            borderBottom: running ? 'none' : '1px dotted var(--color-oxblood)',
                          }}
                        >
                          {seg.text}
                          {running && (
                            <span className="onum" style={{ marginLeft: '0.4em', fontWeight: 500 }}>
                              {remaining > 0 ? `· ${fmtCountdown(remaining)}` : '· done'}
                            </span>
                          )}
                        </button>
                      );
                    })}
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
