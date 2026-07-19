import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { RecipeCard } from './RecipeCard';
import { PLANNER_ADD_TYPE, usePlanner, type RecipeData } from './usePlanner';
import { matchesFacets, extractedToFacets } from '../lib/recipeFilter.mjs';

interface Props {
  recipes: RecipeData[];
  basePath: string;
  previewLimit?: number;  // if set, limit to N cards when no search active
  viewAllHref?: string;   // show "View all N →" link when provided
  facets?: boolean;       // /recipes only: dietary/time/nutrition facets + NL search
  nlpApiUrl?: string | null;  // NL-query service base URL; null hides the search line
}

const toNum = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

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

const SERIF = "'EB Garamond', Georgia, serif";

const INPUT: React.CSSProperties = {
  border: '1px solid var(--color-hairline)',
  backgroundColor: 'var(--color-paper)',
  color: 'var(--color-ink)',
  fontFamily: "'EB Garamond', Georgia, serif",
  fontSize: 'var(--text-meta)',
  outline: 'none',
  padding: '7px 10px',
};

const FACET_LABEL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'baseline', gap: '5px',
  fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)',
  textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--color-ink-muted)',
};

const FACET_NUM: React.CSSProperties = {
  width: '3.5em', border: 'none', borderBottom: '1px solid var(--color-hairline)',
  backgroundColor: 'transparent', color: 'var(--color-ink)',
  fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)',
  textAlign: 'center', outline: 'none', padding: '2px 0',
};

export function CollectionPlannerIsland({ recipes, basePath, previewLimit, viewAllHref, facets, nlpApiUrl }: Props) {
  const [collectionQuery, setCollectionQuery] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [armedDay, setArmedDay] = useState<string | null>(null);

  // Facet state (only used when `facets`)
  const [dietary, setDietary] = useState('');       // '' | 'vegetarian' | 'vegan'
  const [maxTime, setMaxTime] = useState('');
  const [maxKcal, setMaxKcal] = useState('');
  const [minProtein, setMinProtein] = useState('');
  const [ingredient, setIngredient] = useState('');

  // NL search state
  const [nlQuery, setNlQuery] = useState('');
  const [nlStatus, setNlStatus] = useState<'idle' | 'pending' | 'error'>('idle');

  const { mealCount } = usePlanner();

  function clearFacets() {
    setCollectionQuery(''); setCuisineFilter(null);
    setDietary(''); setMaxTime(''); setMaxKcal(''); setMinProtein(''); setIngredient('');
  }

  async function runNlSearch(e: React.FormEvent) {
    e.preventDefault();
    const question = nlQuery.trim();
    if (!question || !nlpApiUrl) return;
    setNlStatus('pending');
    // Generous timeout — the free-tier service may be cold-starting (~30–60s).
    const attempt = async (): Promise<Record<string, unknown>> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      try {
        const res = await fetch(`${nlpApiUrl}/api/v1/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.filters ?? {};
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      let filters: Record<string, unknown>;
      try {
        filters = await attempt();
      } catch {
        filters = await attempt();  // one retry for cold start
      }
      const f = extractedToFacets(filters);
      clearFacets();
      if (f.cuisine) setCuisineFilter(f.cuisine);
      if (f.dietary) setDietary(f.dietary);
      if (f.maxTime != null) setMaxTime(String(f.maxTime));
      if (f.maxKcal != null) setMaxKcal(String(f.maxKcal));
      if (f.minProtein != null) setMinProtein(String(f.minProtein));
      if (f.ingredient) setIngredient(f.ingredient);
      setNlStatus('idle');
    } catch {
      setNlStatus('error');
    }
  }

  // Sync armed day from PlannerDrawer
  useEffect(() => {
    function handler(e: Event) {
      setArmedDay((e as CustomEvent<{ day: string | null }>).detail.day);
    }
    window.addEventListener('planner:arm', handler);
    return () => window.removeEventListener('planner:arm', handler);
  }, []);

  const availableCuisines = [...new Set(recipes.map((r) => r.cuisine))].sort((a, b) =>
    a.localeCompare(b)
  );

  const facetState = {
    query: collectionQuery,
    cuisine: cuisineFilter,
    dietary,
    maxTime: toNum(maxTime),
    maxKcal: toNum(maxKcal),
    minProtein: toNum(minProtein),
    ingredient: ingredient || null,
  };
  const collectionRecipes = recipes.filter((r) => matchesFacets(r, facetState));

  // When previewLimit is set and no active filter, cap the display (searching shows all matches)
  const facetsActive = dietary !== '' || maxTime !== '' || maxKcal !== '' || minProtein !== '' || ingredient !== '';
  const searchActive = collectionQuery.length > 0 || cuisineFilter !== null || facetsActive;
  const displayedRecipes = (previewLimit && !searchActive)
    ? collectionRecipes.slice(0, previewLimit)
    : collectionRecipes;

  function handleDragStart(e: React.DragEvent, recipe: RecipeData) {
    // Typed payload: the key discriminates add vs move in dragover handlers
    e.dataTransfer.setData(PLANNER_ADD_TYPE, JSON.stringify({ recipeId: recipe.id }));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleCardClick(e: React.MouseEvent, recipe: RecipeData) {
    if (!armedDay) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('planner:pick', { detail: { recipeId: recipe.id } }));
  }

  const plannerHref = `${basePath}/meal-planner`;

  return (
    <>
      <style>{`
        .cpi-collection {
          max-width: var(--max-wide);
          margin: 0 auto;
          padding: var(--space-2xl) var(--space-lg) var(--space-3xl);
        }
        .cpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2xl) var(--space-lg);
        }
        .cpi-drag-item { cursor: grab; user-select: none; }
        .cpi-drag-item:active { cursor: grabbing; }
        .cpi-armed .cpi-drag-item { cursor: crosshair; }
        .cpi-armed .recipe-card:hover {
          opacity: 1;
          outline: 1.5px solid var(--color-oxblood);
          outline-offset: -1px;
        }
        .cpi-mobile-planner-link { display: none; }
        @media (max-width: 768px) {
          .cpi-grid { grid-template-columns: 1fr; }
          .cpi-mobile-planner-link { display: flex; }
        }
      `}</style>

      <div className={`cpi-collection${armedDay ? ' cpi-armed' : ''}`}>

        {/* Toolbar */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="section-tick" />
          <p style={{ ...EYEBROW, marginBottom: 'var(--space-xs)' }}>The collection</p>
          <h2 style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'var(--text-section)',
            fontWeight: 500,
            color: 'var(--color-ink)',
            margin: '0 0 var(--space-md)',
          }}>
            All recipes
          </h2>

          {/* NL search line — quiet ask-in-a-sentence; populates the facets below */}
          {facets && nlpApiUrl && (
            <form onSubmit={runNlSearch} style={{ marginBottom: 'var(--space-sm)' }}>
              <input
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                placeholder="Ask for something — quick, filling, vegetarian…"
                aria-label="Ask for a recipe in your own words"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: 'none', borderBottom: '1px solid var(--color-hairline)',
                  backgroundColor: 'transparent', color: 'var(--color-ink)',
                  fontFamily: SERIF, fontSize: 'var(--text-body)', fontStyle: 'italic',
                  padding: '6px 2px', outline: 'none',
                }}
              />
              <p style={{ fontFamily: SERIF, fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', margin: 'var(--space-2xs) 0 0', minHeight: '1.1em' }}>
                {nlStatus === 'pending' && 'Waking the kitchen…'}
                {nlStatus === 'error' && 'Search is asleep — the filters below still work.'}
              </p>
            </form>
          )}

          {/* Search + cuisine filter */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)', alignItems: 'stretch' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)', pointerEvents: 'none' }}
              />
              <input
                type="search"
                placeholder="Search recipes…"
                value={collectionQuery}
                onChange={(e) => setCollectionQuery(e.target.value)}
                style={{ ...INPUT, fontFamily: SERIF, fontSize: 'var(--text-meta)', width: '100%', paddingLeft: '28px', paddingRight: '10px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Country filter — /recipes only; the home page filters by country via the map */}
            {facets && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => { if (cuisineFilter) setCuisineFilter(null); else setFilterOpen((o) => !o); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '7px 11px', height: '100%',
                  border: cuisineFilter ? '1px solid var(--color-oxblood)' : '1px solid var(--color-hairline)',
                  backgroundColor: 'transparent',
                  color: cuisineFilter ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                  fontFamily: SERIF, fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.24em',
                  cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box',
                }}
              >
                {cuisineFilter ? (
                  <>× {cuisineFilter}</>
                ) : (
                  <>Country <ChevronDown size={11} style={{ marginLeft: '2px' }} /></>
                )}
              </button>

              {filterOpen && !cuisineFilter && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 3px)',
                  zIndex: 20,
                  backgroundColor: 'var(--color-paper)',
                  border: '1px solid var(--color-hairline)',
                  minWidth: '160px', maxHeight: '220px', overflowY: 'auto',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                }}>
                  {availableCuisines.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCuisineFilter(c); setFilterOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 14px',
                        border: 'none', borderBottom: '1px solid var(--color-hairline)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-ink)',
                        fontFamily: SERIF, fontSize: 'var(--text-meta)',
                        textTransform: 'capitalize', cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Facet controls — dietary toggles + numeric bounds */}
          {facets && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'baseline', margin: '0 0 var(--space-sm)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline' }}>
                {([['', 'All'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']] as [string, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDietary(val)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                      fontFamily: SERIF, fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.18em',
                      color: dietary === val ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                      borderBottom: dietary === val ? '1px solid var(--color-oxblood)' : '1px solid transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label style={FACET_LABEL}>Max time
                <input type="number" inputMode="numeric" min="0" value={maxTime} onChange={(e) => setMaxTime(e.target.value)} className="onum" style={FACET_NUM} /> min
              </label>
              <label style={FACET_LABEL}>Max kcal
                <input type="number" inputMode="numeric" min="0" value={maxKcal} onChange={(e) => setMaxKcal(e.target.value)} className="onum" style={FACET_NUM} />
              </label>
              <label style={FACET_LABEL}>Min protein
                <input type="number" inputMode="numeric" min="0" value={minProtein} onChange={(e) => setMinProtein(e.target.value)} className="onum" style={FACET_NUM} /> g
              </label>
              <label style={FACET_LABEL}>With
                <input
                  type="text"
                  list="cpi-ingredient-options"
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="ingredient…"
                  style={{ ...FACET_NUM, width: '9em', textAlign: 'left', textTransform: 'none', letterSpacing: 'normal' }}
                />
              </label>
              <datalist id="cpi-ingredient-options">
                {[...new Set(recipes.flatMap((r) => r.canonicals ?? []))].sort().map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {searchActive && (
                <button
                  onClick={clearFacets}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: SERIF, fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--color-ink-muted)' }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <p className="onum" style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', margin: 0 }}>
            {collectionRecipes.length} recipe{collectionRecipes.length !== 1 ? 's' : ''}
            {armedDay
              ? <> · <span style={{ color: 'var(--color-oxblood)' }}>click a recipe to add to {armedDay}</span></>
              : ' · click to open · drag to plan'
            }
            {previewLimit && !searchActive && collectionRecipes.length > previewLimit && (
              <> · showing {previewLimit} of {collectionRecipes.length}</>
            )}
            {facets && (
              <> · <a href={`${basePath}/ingredients`} style={{ color: 'var(--color-oxblood)', textDecoration: 'none' }}>ingredient index</a></>
            )}
          </p>
        </div>

        {/* Mobile-only: link to planner page when drawer is hidden */}
        <a
          href={plannerHref}
          className="cpi-mobile-planner-link"
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-sm) 0',
            marginBottom: 'var(--space-sm)',
            borderTop: '1px solid var(--color-hairline)',
            borderBottom: '1px solid var(--color-hairline)',
            textDecoration: 'none',
            color: mealCount > 0 ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
          }}
        >
          <span style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 600,
            fontSize: 'var(--text-eyebrow)',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
          }}>
            {mealCount > 0 ? `Meal planner · ${mealCount} meal${mealCount !== 1 ? 's' : ''}` : 'Open meal planner'}
          </span>
          <ChevronRight size={13} />
        </a>

        <hr style={HAIRLINE} />

        {/* Recipe grid */}
        <div style={{ paddingTop: 'var(--space-lg)' }}>
          {displayedRecipes.length === 0 ? (
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)', fontStyle: 'italic', margin: 0 }}>
              Nothing matches that search.
            </p>
          ) : (
            <div className="cpi-grid">
              {displayedRecipes.map((r) => (
                <RecipeCard
                  key={r.id}
                  href={`${basePath}/recipes/${r.id}`}
                  imageSrc={r.image ? `${basePath}${r.image}` : null}
                  silhouette={r.silhouette}
                  eyebrow={r.cuisine}
                  title={r.title}
                  meta={[
                    r.totalTimeMinutes ? `${r.totalTimeMinutes} min` : null,
                    r.servings ? `${r.servings} servings` : null,
                  ]}
                  draggable
                  onDragStart={(e) => handleDragStart(e, r)}
                  onClick={armedDay ? (e) => handleCardClick(e, r) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* View all link — shown on preview pages when limit is active */}
        {viewAllHref && !searchActive && (
          <div style={{ marginTop: 'var(--space-2xl)' }}>
            <a
              href={viewAllHref}
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: 'var(--text-body)',
                color: 'var(--color-oxblood)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--color-oxblood)',
                paddingBottom: '1px',
              }}
            >
              View all {recipes.length} recipes →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
