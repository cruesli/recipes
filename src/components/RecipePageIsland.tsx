import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { ChefHat, ArrowLeft, Check, Minus, Plus, Pencil } from 'lucide-react';
import { scaleIngredient } from '../lib/quantity.mjs';
import { parseIngredientSections } from '../lib/ingredientSections.mjs';
import { workBack, formatClock } from '../lib/recipeTime.mjs';
import { buildStepSegments } from '../lib/stepAnnotations.mjs';
import { layoutMarginNotes } from '../lib/marginalia.mjs';
import { annotateEnabled, loggedIn, login } from '../lib/identity';
import { commitNote } from '../lib/journalStore';
import type { NutritionPerServing, EnrichedStep, EnrichedIngredient } from '../lib/enrichment';

export interface JournalAnchor { type: 'top' | 'ingredients' | 'step'; n?: number }
export interface JournalEntry { date: string; note: string; anchor: JournalAnchor; seed: number }

// Annotate mode: off → login (if needed) → arm (pick an anchor) → compose (write it)
type AnnotateState =
  | { mode: 'off' }
  | { mode: 'login' }
  | { mode: 'arm' }
  | { mode: 'compose'; anchor: JournalAnchor };

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
  /** Kitchen-journal marginalia entries for this recipe; empty when none exist */
  journal: JournalEntry[];
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
  image, foodType, tags, ingredients, steps, nutrition, enrichedSteps, enrichedIngredients, journal, basePath,
}: RecipePageProps) {
  const [servings, setServings] = useState(defaultServings);

  // Kitchen-journal marginalia: entries kept in state for a later task's optimistic writes
  const [journalEntries, setJournalEntries] = useState(journal);
  const contentRef = useRef<HTMLDivElement>(null);
  const stepLiRefs = useRef<(HTMLLIElement | null)[]>([]);
  const plateRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef(new Map<number, HTMLDivElement>());
  const [noteLayout, setNoteLayout] = useState<Map<number, { top: number; dx: number }> | null>(null);

  // Annotate mode: off → login (if needed) → arm (pick anchor) → compose (write + commit)
  const [annotate, setAnnotate] = useState<AnnotateState>({ mode: 'off' });
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'error'>('idle');

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

  // Marginalia layout: measure anchor positions + note heights, then seeded-jitter +
  // collision-resolve (pure engine lives in lib/marginalia.mjs). Re-measures on resize
  // and whenever servings scaling may have reflowed the steps column.
  useLayoutEffect(() => {
    if (journalEntries.length === 0 || !contentRef.current) return;
    const measure = () => {
      const containerTop = contentRef.current!.getBoundingClientRect().top;
      const anchorTopFor = (a: JournalAnchor): number => {
        if (a.type === 'step' && a.n != null) {
          const li = stepLiRefs.current[a.n - 1];
          if (li) return li.getBoundingClientRect().top - containerTop;
        }
        if (a.type === 'ingredients' && plateRef.current) {
          return plateRef.current.getBoundingClientRect().top - containerTop;
        }
        return 0; // 'top' and dangling step anchors
      };
      setNoteLayout(
        layoutMarginNotes(
          journalEntries.map((e, idx) => ({
            id: idx,
            anchorTop: anchorTopFor(e.anchor),
            seed: e.seed,
            height: noteRefs.current.get(idx)?.offsetHeight ?? 60,
          }))
        )
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [journalEntries, servings]);

  // Annotate mode: commit the draft note via git-gateway, then optimistically
  // append to journalEntries (a rebuild will supersede this once it lands).
  async function saveNote() {
    if (annotate.mode !== 'compose') return;
    const entry: JournalEntry = {
      date: new Date().toISOString().slice(0, 10),
      note: noteDraft.trim(),
      anchor: annotate.anchor,
      seed: Math.floor(Math.random() * 1_000_000),
    };
    setNoteStatus('saving');
    try {
      await commitNote(slug, entry);
      setJournalEntries((prev) => [...prev, entry]); // optimistic — rebuild catches up
      setAnnotate({ mode: 'off' });
      setNoteDraft('');
      setNoteStatus('idle');
    } catch {
      setNoteStatus('error');
    }
  }

  // Compose form JSX — rendered at exactly one of three sites depending on
  // annotate.anchor (step / ingredients / top). Reads only noteDraft/noteStatus,
  // so it's safe to compute unconditionally; each call site guards the anchor match.
  const composeForm = (
    <div style={{ margin: 'var(--space-sm) 0' }}>
      <textarea
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Skriv i margen…"
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--text-meta)', padding: '8px 10px', outline: 'none', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline', marginTop: 'var(--space-2xs)' }}>
        <button onClick={saveNote} disabled={noteStatus === 'saving' || !noteDraft.trim()} style={{ border: 'none', background: 'var(--color-oxblood)', color: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '6px 14px', cursor: 'pointer' }}>
          {noteStatus === 'saving' ? 'Writing…' : 'Write it in'}
        </button>
        <button onClick={() => { setAnnotate({ mode: 'off' }); setNoteDraft(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)' }}>Cancel</button>
        {noteStatus === 'error' && <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', fontStyle: 'italic', color: 'var(--color-ink-muted)' }}>Couldn't reach the book — try again.</span>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-paper)', paddingTop: '60px' }}>
      <style>{`
        @keyframes rp-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(126,38,37,0.5); } 50% { box-shadow: 0 0 0 6px rgba(126,38,37,0); } }
        .rp-step-due { animation: rp-pulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .rp-step-due { animation: none; } }

        /* Kitchen-journal marginalia: right-gutter rail on wide screens, tucked inline below */
        .rp-margin { display: none; }
        .rp-note-inline { display: block; margin-top: var(--space-xs); }
        @media (min-width: 1320px) {
          .rp-margin { display: block; }
          .rp-note-inline { display: none; }
        }
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
          <h1
            onClick={() => { if (annotate.mode === 'arm') setAnnotate({ mode: 'compose', anchor: { type: 'top' } }); }}
            style={{
              fontSize: 'var(--text-title)', color: 'var(--color-ink)', margin: 0, lineHeight: 1.1,
              fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 500,
              ...(annotate.mode === 'arm' ? { cursor: 'pointer', outline: '1px dotted var(--color-oxblood)', outlineOffset: 3 } : {}),
            }}
          >
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

        {/* Narrow screens: top/ingredients-anchored notes surface once, above the columns
            (step-anchored notes render inline under their own step instead — see below) */}
        {journalEntries.some((e) => e.anchor.type !== 'step') && (
          <div className="rp-note-inline" style={{ marginBottom: 'var(--space-xl)' }}>
            {journalEntries
              .filter((e) => e.anchor.type !== 'step')
              .map((entry, idx) => (
                <div key={idx} style={{ marginTop: idx === 0 ? 0 : 'var(--space-sm)' }}>
                  <NoteBody entry={entry} />
                </div>
              ))}
          </div>
        )}

        {annotate.mode === 'compose' && annotate.anchor.type === 'top' && composeForm}

        <div ref={contentRef} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3xl)', alignItems: 'start', position: 'relative' }}>

          {/* Left column: ingredients + nutrition */}
          <div>
            {/* Ingredients — the one sanctioned printed plate: solid oxblood,
                paper type, print grammar (squared, flat, no border/shadow) */}
            <div ref={plateRef} style={{ backgroundColor: 'var(--color-oxblood)', padding: 'var(--space-xl) var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
              <p
                onClick={() => { if (annotate.mode === 'arm') setAnnotate({ mode: 'compose', anchor: { type: 'ingredients' } }); }}
                style={{
                  ...EYEBROW,
                  color: 'var(--color-plate-text)',
                  marginBottom: 'var(--space-sm)',
                  ...(annotate.mode === 'arm' ? { cursor: 'pointer', outline: '1px dotted var(--color-oxblood)', outlineOffset: 3 } : {}),
                }}
              >
                Ingredients
              </p>
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

            {annotate.mode === 'compose' && annotate.anchor.type === 'ingredients' && composeForm}

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

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
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

                {/* Margin note (annotate mode) — pencil affordance, gated by PUBLIC_ANNOTATE_ORIGIN */}
                {annotateEnabled() && (
                  <button
                    onClick={() => {
                      setNoteStatus('idle'); // clear any stale login/save error on open or close
                      if (annotate.mode !== 'off') setAnnotate({ mode: 'off' });
                      else setAnnotate(loggedIn() ? { mode: 'arm' } : { mode: 'login' });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: annotate.mode !== 'off' ? 'var(--color-oxblood)' : 'var(--color-ink-muted)' }}
                  >
                    <Pencil size={13} /> {annotate.mode !== 'off' ? 'Close' : 'Margin note'}
                  </button>
                )}
              </div>
            </div>

            {annotate.mode === 'login' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  try {
                    await login(String(fd.get('email')), String(fd.get('password')));
                    setAnnotate({ mode: 'arm' });
                    setNoteStatus('idle');
                  } catch { setNoteStatus('error'); }
                }}
                style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', margin: '0 0 var(--space-lg)' }}
              >
                <input name="email" type="email" required placeholder="email" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 10px', outline: 'none' }} />
                <input name="password" type="password" required placeholder="password" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 10px', outline: 'none' }} />
                <button type="submit" style={{ border: 'none', background: 'var(--color-oxblood)', color: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 14px', cursor: 'pointer' }}>Sign in</button>
                {noteStatus === 'error' && <p style={{ width: '100%', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', fontStyle: 'italic', color: 'var(--color-ink-muted)', margin: 0 }}>That didn't work — check the details.</p>}
              </form>
            )}

            {annotate.mode === 'arm' && (
              <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)', margin: '0 0 var(--space-lg)' }}>
                Tap a step number, the ingredient plate, or the title to place the note.
              </p>
            )}

            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((step, i) => (
                <li
                  key={i}
                  ref={(el) => { stepLiRefs.current[i] = el; }}
                  style={{ display: 'flex', gap: 'var(--space-lg)', paddingTop: i === 0 ? 0 : 'var(--space-lg)', borderTop: i === 0 ? 'none' : '1px solid var(--color-hairline)', marginTop: i === 0 ? 0 : 'var(--space-lg)' }}
                >
                  <button
                    onClick={() => {
                      if (annotate.mode === 'arm') setAnnotate({ mode: 'compose', anchor: { type: 'step', n: i + 1 } });
                      else toggleStep(i);
                    }}
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
                      ...(annotate.mode === 'arm' ? { outline: '1px dotted var(--color-oxblood)', outlineOffset: 3 } : {}),
                    }}
                  >
                    {completed.has(i) ? <Check size={13} /> : i + 1}
                  </button>
                  {/* flex:1 wrapper — keeps inline journal notes stacked under the step text
                      instead of becoming a third item in this flex row (see button above) */}
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                    {journalEntries
                      .filter((e) => e.anchor.type === 'step' && e.anchor.n === i + 1)
                      .map((entry, ni) => (
                        <div key={ni} className="rp-note-inline">
                          <NoteBody entry={entry} />
                        </div>
                      ))}
                    {annotate.mode === 'compose' && annotate.anchor.type === 'step' && annotate.anchor.n === i + 1 && composeForm}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right-gutter margin rail — wide screens only; narrow screens use .rp-note-inline
              instead (rendered above and within the columns). See .rp-margin toggle above. */}
          {journalEntries.length > 0 && (
            <div className="rp-margin" aria-label="Kitchen journal" style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, width: '190px', paddingLeft: 'var(--space-lg)' }}>
              {journalEntries.map((entry, idx) => {
                const pos = noteLayout?.get(idx);
                return (
                  <div
                    key={idx}
                    ref={(el) => { if (el) noteRefs.current.set(idx, el); }}
                    style={{
                      position: 'absolute',
                      top: pos?.top ?? 0,
                      left: `calc(var(--space-lg) + ${pos?.dx ?? 0}px)`,
                      width: '170px',
                      visibility: pos ? 'visible' : 'hidden',
                    }}
                  >
                    <NoteBody entry={entry} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteBody({ entry }: { entry: JournalEntry }) {
  return (
    <>
      <p className="onum" style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', margin: '0 0 2px' }}>
        {entry.date}
      </p>
      <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--text-meta)', lineHeight: 1.5, color: 'var(--color-ink-muted)', margin: 0 }}>
        {entry.note}
      </p>
    </>
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
