import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { RecipeCard } from './RecipeCard';
import type { RecipeData } from './usePlanner';

interface Props {
  recipes: RecipeData[];
  basePath: string;
}

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

const SANS = "'Schibsted Grotesk', system-ui, -apple-system, sans-serif";

const INPUT: React.CSSProperties = {
  border: '1px solid var(--color-hairline)',
  backgroundColor: 'var(--color-paper)',
  color: 'var(--color-ink)',
  fontFamily: "'EB Garamond', Georgia, serif",
  fontSize: 'var(--text-meta)',
  outline: 'none',
  padding: '7px 10px',
};

export function CollectionPlannerIsland({ recipes, basePath }: Props) {
  const [collectionQuery, setCollectionQuery] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const availableCuisines = [...new Set(recipes.map((r) => r.cuisine))].sort((a, b) =>
    a.localeCompare(b)
  );

  const collectionRecipes = recipes.filter((r) => {
    const q = collectionQuery.toLowerCase();
    const matchesQ = !q || r.title.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q);
    const matchesC = !cuisineFilter || r.cuisine.toLowerCase() === cuisineFilter.toLowerCase();
    return matchesQ && matchesC;
  });

  function handleDragStart(e: React.DragEvent, recipe: RecipeData) {
    e.dataTransfer.setData('recipeId', recipe.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <>
      <style>{`
        .cpi-frame {
          max-width: 1120px;
          margin: 0 auto;
          padding: var(--space-2xl) var(--space-lg) var(--space-3xl);
        }
        .cpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0 var(--space-lg);
        }
        .cpi-drag-item { cursor: grab; user-select: none; }
        .cpi-drag-item:active { cursor: grabbing; }
        @media (max-width: 768px) {
          .cpi-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="cpi-frame">

        {/* ── Toolbar ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <p style={{ ...EYEBROW, marginBottom: 'var(--space-xs)' }}>The collection</p>
          <h2 style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'var(--text-card)',
            fontWeight: 500,
            color: 'var(--color-ink)',
            margin: '0 0 var(--space-md)',
          }}>
            All recipes
          </h2>

          {/* Search + cuisine filter */}
          <div style={{ display: 'flex', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)', alignItems: 'stretch' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={13}
                style={{
                  position: 'absolute', left: '9px', top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-ink-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="search"
                placeholder="Search recipes…"
                value={collectionQuery}
                onChange={(e) => setCollectionQuery(e.target.value)}
                style={{
                  ...INPUT,
                  fontFamily: SANS,
                  fontSize: 'var(--text-meta)',
                  width: '100%',
                  paddingLeft: '28px',
                  paddingRight: '10px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (cuisineFilter) {
                    setCuisineFilter(null);
                  } else {
                    setFilterOpen((o) => !o);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '7px 11px', height: '100%',
                  border: cuisineFilter
                    ? '1px solid var(--color-oxblood)'
                    : '1px solid var(--color-hairline)',
                  backgroundColor: 'transparent',
                  color: cuisineFilter ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                  fontFamily: SANS,
                  fontSize: 'var(--text-eyebrow)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
              >
                {cuisineFilter ? (
                  <>× {cuisineFilter}</>
                ) : (
                  <>Filter <ChevronDown size={11} style={{ marginLeft: '2px' }} /></>
                )}
              </button>

              {filterOpen && !cuisineFilter && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 3px)',
                    zIndex: 20,
                    backgroundColor: 'var(--color-paper)',
                    border: '1px solid var(--color-hairline)',
                    minWidth: '160px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
                  }}
                >
                  {availableCuisines.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCuisineFilter(c); setFilterOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 14px',
                        border: 'none',
                        borderBottom: '1px solid var(--color-hairline)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-ink)',
                        fontFamily: SANS,
                        fontSize: 'var(--text-meta)',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="onum" style={{
            fontFamily: SANS,
            fontSize: 'var(--text-eyebrow)',
            color: 'var(--color-ink-muted)',
            margin: 0,
          }}>
            {collectionRecipes.length} recipe{collectionRecipes.length !== 1 ? 's' : ''}
            {' · '}click to open · drag to plan
          </p>
        </div>

        <hr style={{ ...HAIRLINE, marginBottom: 'var(--space-xl)' }} />

        {/* ── 3-column recipe grid ──────────────────────────────────── */}
        {collectionRecipes.length === 0 ? (
          <p style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'var(--text-meta)',
            color: 'var(--color-ink-muted)',
            fontStyle: 'italic',
            margin: 0,
          }}>
            No recipes found.
          </p>
        ) : (
          <div className="cpi-grid">
            {collectionRecipes.map((r) => (
              <RecipeCard
                key={r.id}
                href={`${basePath}/recipes/${r.id}`}
                imageSrc={r.image ? `${basePath}${r.image}` : null}
                eyebrow={r.cuisine}
                title={r.title}
                meta={[r.totalTimeMinutes ? `${r.totalTimeMinutes} min` : null]}
                draggable
                onDragStart={(e) => handleDragStart(e, r)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
