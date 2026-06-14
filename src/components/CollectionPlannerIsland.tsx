import { useState } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { RecipeCard } from './RecipeCard';
import { DAYS, usePlanner, type RecipeData } from './usePlanner';

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

const DRAWER_W = 340;
const TAB_W = 32;

export function CollectionPlannerIsland({ recipes, basePath }: Props) {
  // Collection UI
  const [collectionQuery, setCollectionQuery] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'manual' | 'drag'>('manual');
  const [armedDay, setArmedDay] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const { meals, filledDays, selectRecipe, removeMeal } = usePlanner();
  const mealCount = filledDays.length;

  const availableCuisines = [...new Set(recipes.map((r) => r.cuisine))].sort((a, b) =>
    a.localeCompare(b)
  );

  const collectionRecipes = recipes.filter((r) => {
    const q = collectionQuery.toLowerCase();
    const matchesQ = !q || r.title.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q);
    const matchesC = !cuisineFilter || r.cuisine.toLowerCase() === cuisineFilter.toLowerCase();
    return matchesQ && matchesC;
  });

  // ── Drag handlers ─────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, recipe: RecipeData) {
    e.dataTransfer.setData('recipeId', recipe.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  // Drag enters the drawer area → auto-open in drag mode
  function handleDragOverDrawer(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!drawerOpen) {
      setDragOverTab(true);
      setDrawerOpen(true);
      setDrawerMode('drag');
    }
  }

  // Drag leaves the whole drawer element
  function handleDragLeaveDrawer(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverTab(false);
    }
  }

  // Drag over a specific day row
  function handleDragOverDay(e: React.DragEvent, day: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverDay(day);
  }

  function handleDragLeaveDay(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverDay(null);
    }
  }

  function handleDropOnDay(e: React.DragEvent, day: string) {
    e.preventDefault();
    const recipeId = e.dataTransfer.getData('recipeId');
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) selectRecipe(day, recipe);
    setDragOverDay(null);
    setDragOverTab(false);
    // Drag-opened drawer auto-closes after drop
    if (drawerMode === 'drag') {
      setDrawerOpen(false);
    }
  }

  // Clear drag highlights if drag ends without a drop (cancelled)
  function handleDragEnd() {
    setDragOverTab(false);
    setDragOverDay(null);
  }

  // ── Drawer open / close ───────────────────────────────────────

  function toggleDrawer() {
    if (drawerOpen) {
      setDrawerOpen(false);
      setArmedDay(null);
      setDragOverTab(false);
    } else {
      setDrawerOpen(true);
      setDrawerMode('manual');
    }
  }

  // ── Arm-a-day-then-click ──────────────────────────────────────

  // Click + on a day row → arm it (open drawer if needed)
  function armDay(day: string) {
    if (!drawerOpen) {
      setDrawerOpen(true);
      setDrawerMode('manual');
    }
    setArmedDay(armedDay === day ? null : day);
  }

  // Collection card clicked while a day is armed → assign, disarm
  function handleCardClick(e: React.MouseEvent, recipe: RecipeData) {
    if (!armedDay) return;
    e.preventDefault();
    selectRecipe(armedDay, recipe);
    setArmedDay(null);
  }

  const plannerHref = `${basePath}/meal-planner`;

  return (
    <>
      <style>{`
        .cpi-outer {
          display: flex;
          align-items: stretch;
          max-width: 1120px;
          margin: 0 auto;
        }
        .cpi-collection {
          flex: 1;
          min-width: 0;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: var(--space-2xl) var(--space-lg) 0;
        }
        .cpi-collection-scroll {
          flex: 1;
          overflow-y: auto;
          padding-top: var(--space-lg);
          padding-bottom: var(--space-3xl);
        }
        /* Drawer: 32px tab when closed, 340px panel when open */
        .cpi-drawer {
          flex-shrink: 0;
          width: ${TAB_W}px;
          overflow: hidden;
          transition: width 180ms ease;
          border-left: 1px solid var(--color-hairline);
          position: relative;
        }
        .cpi-drawer.open { width: ${DRAWER_W}px; }
        .cpi-drawer.drag-over { border-left-color: var(--color-oxblood); }
        /* Inner wrapper is always DRAWER_W wide; overflow clips it in closed state */
        .cpi-drawer-inner {
          width: ${DRAWER_W}px;
          height: 100%;
          min-height: 60vh;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        /* Tab spine: absolute, occupies the left TAB_W strip in both states */
        .cpi-tab {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: ${TAB_W}px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-lg) 0;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 2;
        }
        .cpi-tab:hover { background: rgba(41,47,23,0.025); }
        /* Panel: offset by TAB_W, fades in when drawer opens */
        .cpi-panel {
          position: absolute;
          left: ${TAB_W}px; right: 0; top: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease 60ms;
          overflow: hidden;
        }
        .cpi-drawer.open .cpi-panel {
          opacity: 1;
          pointer-events: auto;
        }
        .cpi-panel-scroll {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-lg) var(--space-md) var(--space-md) var(--space-sm);
        }
        /* Day rows in the planner panel */
        .cpi-day-row {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-sm) 0;
          border-bottom: 1px solid var(--color-hairline);
          transition: background 0.12s;
        }
        .cpi-day-row.drag-over {
          background: rgba(126,38,37,0.06);
          outline: 1px solid rgba(126,38,37,0.3);
        }
        .cpi-day-row.armed { background: rgba(126,38,37,0.04); }
        /* Day marks in the tab (filled = oxblood, empty = hairline) */
        .cpi-mark       { width: 14px; height: 2px; background: var(--color-oxblood); border-radius: 1px; }
        .cpi-mark-empty { width: 14px; height: 2px; background: var(--color-hairline); border-radius: 1px; }
        /* Pinned "Make shopping list" button at drawer bottom */
        .cpi-btn-pinned {
          padding: var(--space-sm) var(--space-md);
          border-top: 1px solid var(--color-hairline);
          background: var(--color-paper);
          flex-shrink: 0;
        }
        /* Recipe grid: fixed 3 cols, stays 3 even when drawer squeezes the space */
        .cpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0 var(--space-lg);
        }
        .cpi-drag-item { cursor: grab; user-select: none; }
        .cpi-drag-item:active { cursor: grabbing; }
        /* Armed mode: collection cards become click targets */
        .cpi-armed .cpi-drag-item { cursor: crosshair; }
        .cpi-armed .recipe-card:hover {
          opacity: 1;
          outline: 1.5px solid var(--color-oxblood);
          outline-offset: -1px;
        }
        .cpi-mobile-planner-link { display: none; }
        @media (max-width: 768px) {
          .cpi-grid { grid-template-columns: 1fr; }
          .cpi-drawer { display: none; }
          .cpi-mobile-planner-link { display: flex; }
        }
      `}</style>

      <div className={`cpi-outer${armedDay ? ' cpi-armed' : ''}`} onDragEnd={handleDragEnd}>

        {/* ── Collection ─────────────────────────────────────────── */}
        <div className="cpi-collection">

          {/* Toolbar */}
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
                  style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)', pointerEvents: 'none' }}
                />
                <input
                  type="search"
                  placeholder="Search recipes…"
                  value={collectionQuery}
                  onChange={(e) => setCollectionQuery(e.target.value)}
                  style={{ ...INPUT, fontFamily: SANS, fontSize: 'var(--text-meta)', width: '100%', paddingLeft: '28px', paddingRight: '10px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => { if (cuisineFilter) setCuisineFilter(null); else setFilterOpen((o) => !o); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '7px 11px', height: '100%',
                    border: cuisineFilter ? '1px solid var(--color-oxblood)' : '1px solid var(--color-hairline)',
                    backgroundColor: 'transparent',
                    color: cuisineFilter ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                    fontFamily: SANS, fontSize: 'var(--text-eyebrow)', textTransform: 'uppercase', letterSpacing: '0.07em',
                    cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box',
                  }}
                >
                  {cuisineFilter ? (
                    <>× {cuisineFilter}</>
                  ) : (
                    <>Filter <ChevronDown size={11} style={{ marginLeft: '2px' }} /></>
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
                          fontFamily: SANS, fontSize: 'var(--text-meta)',
                          textTransform: 'capitalize', cursor: 'pointer',
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="onum" style={{ fontFamily: SANS, fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', margin: 0 }}>
              {collectionRecipes.length} recipe{collectionRecipes.length !== 1 ? 's' : ''}
              {armedDay
                ? <> · <span style={{ color: 'var(--color-oxblood)' }}>click a recipe to add to {armedDay}</span></>
                : ' · click to open · drag to plan'
              }
            </p>
          </div>

          {/* Mobile-only: replaces the hidden drawer tab on touch screens */}
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

          {/* Recipe grid — scrollable; toolbar above stays static */}
          <div className="cpi-collection-scroll">
            {collectionRecipes.length === 0 ? (
              <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)', fontStyle: 'italic', margin: 0 }}>
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
                    onClick={armedDay ? (e) => handleCardClick(e, r) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Push-drawer planner ─────────────────────────────────── */}
        <div
          className={`cpi-drawer${drawerOpen ? ' open' : ''}${dragOverTab && !drawerOpen ? ' drag-over' : ''}`}
          onDragOver={handleDragOverDrawer}
          onDragLeave={handleDragLeaveDrawer}
          onDrop={(e) => e.preventDefault()} // fallback: no day targeted
        >
          <div className="cpi-drawer-inner">

            {/* Tab spine — always 32px wide, visible in both states */}
            <button className="cpi-tab" onClick={toggleDrawer} aria-label={drawerOpen ? 'Close meal planner' : 'Open meal planner'}>
              {/* One mark per day — filled = planned */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                {DAYS.map((day) => (
                  <div key={day} className={meals[day] ? 'cpi-mark' : 'cpi-mark-empty'} title={day} />
                ))}
              </div>

              {/* Rotated "Meal planner" label */}
              <span style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 600,
                fontSize: 'var(--text-eyebrow)',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--color-ink-muted)',
                userSelect: 'none',
              }}>
                Meal planner
              </span>

              {/* Chevron flips on open/close */}
              <span style={{ color: 'var(--color-ink-muted)', display: 'flex' }}>
                {drawerOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
              </span>
            </button>

            {/* Panel — fades in alongside the width animation */}
            <div className="cpi-panel">
              <div className="cpi-panel-scroll">

                {/* Panel header */}
                <div style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-hairline)' }}>
                  <p style={{ ...EYEBROW, marginBottom: 'var(--space-2xs)' }}>Plan</p>
                  <h2 style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontWeight: 500,
                    fontSize: 'var(--text-card)',
                    color: 'var(--color-ink)',
                    margin: 0,
                    lineHeight: 1.1,
                  }}>
                    This week
                  </h2>
                </div>

                {/* Day rows */}
                {DAYS.map((day) => {
                  const meal = meals[day];
                  const isArmed = armedDay === day;
                  const isDragTarget = dragOverDay === day;

                  return (
                    <div
                      key={day}
                      className={`cpi-day-row${isDragTarget ? ' drag-over' : ''}${isArmed ? ' armed' : ''}`}
                      onDragOver={(e) => handleDragOverDay(e, day)}
                      onDragLeave={handleDragLeaveDay}
                      onDrop={(e) => handleDropOnDay(e, day)}
                    >
                      {/* Day abbreviation */}
                      <span style={{
                        width: '28px',
                        flexShrink: 0,
                        fontFamily: "'EB Garamond', Georgia, serif",
                        fontSize: 'var(--text-eyebrow)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                      }}>
                        {day.slice(0, 3)}
                      </span>

                      {/* Meal title or placeholder */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {meal ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {meal.image && (
                              /* keep --radius-sm on 22px utility thumbnail */
                              <img
                                src={`${basePath}${meal.image}`}
                                alt={meal.title}
                                style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                              />
                            )}
                            <span style={{
                              fontFamily: "'EB Garamond', Georgia, serif",
                              fontSize: 'var(--text-eyebrow)',
                              color: 'var(--color-ink)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {meal.title}
                            </span>
                          </div>
                        ) : (
                          <span style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: 'var(--text-eyebrow)',
                            color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                            fontStyle: 'italic',
                            opacity: 0.75,
                          }}>
                            {isArmed ? 'click a card…' : '—'}
                          </span>
                        )}
                      </div>

                      {/* + arm button, × remove button */}
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button
                          onClick={() => armDay(day)}
                          title={`Add recipe to ${day}`}
                          style={{
                            background: 'none',
                            border: isArmed ? '1px solid var(--color-oxblood)' : '1px solid var(--color-hairline)',
                            color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px',
                            padding: 0,
                          }}
                        >
                          <Plus size={11} />
                        </button>
                        {meal && (
                          <button
                            onClick={() => removeMeal(day)}
                            title={`Clear ${day}`}
                            style={{
                              background: 'none', border: 'none',
                              color: 'var(--color-ink-muted)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '20px', height: '20px',
                              padding: 0,
                              opacity: 0.5,
                            }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pinned CTA — disabled when empty, oxblood when meals exist */}
              <div className="cpi-btn-pinned">
                <a
                  href={mealCount > 0 ? plannerHref : undefined}
                  onClick={mealCount === 0 ? (e) => e.preventDefault() : undefined}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '9px var(--space-md)',
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: 'var(--text-meta)',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textDecoration: 'none',
                    backgroundColor: mealCount > 0 ? 'var(--color-oxblood)' : 'transparent',
                    color: mealCount > 0 ? 'var(--color-paper)' : 'var(--color-ink-muted)',
                    border: mealCount > 0 ? 'none' : '1px solid var(--color-hairline)',
                    cursor: mealCount > 0 ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {mealCount > 0
                    ? `Make shopping list · ${mealCount} meal${mealCount !== 1 ? 's' : ''}`
                    : 'Make shopping list'
                  }
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
