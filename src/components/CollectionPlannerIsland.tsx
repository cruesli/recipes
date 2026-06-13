import { useState, useRef } from 'react';
import { Plus, X, ChevronDown, Search, ShoppingCart, Check, Download } from 'lucide-react';

export interface RecipeData {
  id: string;
  title: string;
  cuisine: string;
  image: string | null;
  totalTimeMinutes: number | null;
  ingredients: string[];
}

interface Props {
  recipes: RecipeData[];
  basePath: string;
}

interface IngredientSection {
  header: string | null;
  items: string[];
}

interface PlannedMeal {
  recipeId: string | null;
  title: string;
  image: string | null;
  sections: IngredientSection[];
}

interface ShoppingItem {
  id: string;
  text: string;
  day: string;
  recipeTitle: string;
  sectionHeader: string | null;
  checked: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EYEBROW: React.CSSProperties = {
  fontFamily: "'EB Garamond', Georgia, serif",
  fontWeight: 600,
  fontSize: '0.68rem',
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

const INPUT: React.CSSProperties = {
  border: '1px solid var(--color-hairline)',
  backgroundColor: 'var(--color-paper)',
  color: 'var(--color-ink)',
  fontFamily: "'EB Garamond', Georgia, serif",
  fontSize: '0.9rem',
  outline: 'none',
  padding: '7px 10px',
};

function parseIngredients(raw: string[]): IngredientSection[] {
  const sections: IngredientSection[] = [];
  let current: IngredientSection = { header: null, items: [] };
  for (const line of raw) {
    if (line.endsWith(':')) {
      if (current.items.length > 0 || current.header !== null) sections.push(current);
      current = { header: line.slice(0, -1), items: [] };
    } else if (line.trim()) {
      current.items.push(line);
    }
  }
  if (current.items.length > 0 || current.header !== null) sections.push(current);
  return sections;
}

export function CollectionPlannerIsland({ recipes, basePath }: Props) {
  // ── Planner state ─────────────────────────────────────────────────────────
  const [meals, setMeals] = useState<Partial<Record<string, PlannedMeal>>>({});
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [customInputs, setCustomInputs] = useState<Partial<Record<string, string>>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [listReady, setListReady] = useState(false);
  const shoppingRef = useRef<HTMLDivElement>(null);

  // ── Collection state ──────────────────────────────────────────────────────
  const [collectionQuery, setCollectionQuery] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const availableCuisines = [...new Set(recipes.map((r) => r.cuisine))].sort((a, b) =>
    a.localeCompare(b)
  );

  const collectionRecipes = recipes.filter((r) => {
    const q = collectionQuery.toLowerCase();
    const matchesQ = !q || r.title.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q);
    const matchesC = !cuisineFilter || r.cuisine.toLowerCase() === cuisineFilter.toLowerCase();
    return matchesQ && matchesC;
  });

  // Recipes for inline day-picker (filtered by picker's own search field)
  const pickerFiltered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase())
  );

  const filledDays = DAYS.filter((d) => meals[d]);
  const canGenerate = filledDays.length > 0;

  // ── Planner actions ───────────────────────────────────────────────────────
  function selectRecipe(day: string, recipe: RecipeData) {
    setMeals((prev) => ({
      ...prev,
      [day]: {
        recipeId: recipe.id,
        title: recipe.title,
        image: recipe.image,
        sections: parseIngredients(recipe.ingredients),
      },
    }));
    setOpenDay(null);
    setSearch('');
    resetList();
  }

  function addCustom(day: string) {
    const name = (customInputs[day] ?? '').trim();
    if (!name) return;
    setMeals((prev) => ({
      ...prev,
      [day]: { recipeId: null, title: name, image: null, sections: [] },
    }));
    setCustomInputs((prev) => ({ ...prev, [day]: '' }));
    setOpenDay(null);
    resetList();
  }

  function removeMeal(day: string) {
    setMeals((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
    resetList();
  }

  function resetList() {
    setShoppingList([]);
    setListReady(false);
  }

  function generateList() {
    let counter = 0;
    const items: ShoppingItem[] = [];
    DAYS.forEach((day) => {
      const meal = meals[day];
      if (!meal) return;
      meal.sections.forEach((sec) => {
        sec.items.forEach((text) => {
          items.push({
            id: String(counter++),
            text,
            day,
            recipeTitle: meal.title,
            sectionHeader: sec.header,
            checked: false,
          });
        });
      });
    });
    setShoppingList(items);
    setListReady(true);
    setTimeout(
      () => shoppingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      100
    );
  }

  function toggleItem(id: string) {
    setShoppingList((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  function downloadList() {
    const lines: string[] = ['SHOPPING LIST', ''];
    lines.push('WEEKLY MENU');
    lines.push('─'.repeat(40));
    DAYS.forEach((day) => {
      const meal = meals[day];
      lines.push(`${day.padEnd(10)} ${meal ? meal.title : '—'}`);
    });
    lines.push('', 'INGREDIENTS', '─'.repeat(40));
    DAYS.forEach((day) => {
      const meal = meals[day];
      if (!meal || meal.sections.length === 0) return;
      lines.push('', `${day.toUpperCase()} — ${meal.title}`);
      meal.sections.forEach((sec) => {
        if (sec.header) lines.push(`  ${sec.header}:`);
        sec.items.forEach((item) => {
          const li = shoppingList.find((s) => s.day === day && s.text === item);
          lines.push(`  ${li?.checked ? '[x]' : '[ ]'} ${item}`);
        });
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, recipe: RecipeData) {
    e.dataTransfer.setData('recipeId', recipe.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleDragOver(e: React.DragEvent, day: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverDay(day);
  }

  function handleDrop(e: React.DragEvent, day: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('recipeId');
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) selectRecipe(day, recipe);
    setDragOverDay(null);
  }

  // ── Shopping list grouping ────────────────────────────────────────────────
  type SectionGroup = { header: string | null; items: ShoppingItem[] };
  type DayGroup = { meal: PlannedMeal; sections: SectionGroup[] };
  const grouped: Record<string, DayGroup> = {};
  DAYS.forEach((day) => {
    const dayItems = shoppingList.filter((i) => i.day === day);
    if (!dayItems.length) return;
    const meal = meals[day]!;
    const sections: SectionGroup[] = [];
    dayItems.forEach((item) => {
      const last = sections[sections.length - 1];
      if (last && last.header === item.sectionHeader) {
        last.items.push(item);
      } else {
        sections.push({ header: item.sectionHeader, items: [item] });
      }
    });
    grouped[day] = { meal, sections };
  });
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  return (
    <>
      <style>{`
        .cpi-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(280px, 1fr);
          gap: 3.5rem;
          align-items: start;
          max-width: var(--max, 980px);
          margin: 0 auto;
          padding: 3.5rem 24px 4.5rem;
        }
        .cpi-left {
          position: sticky;
          top: 52px;
          height: calc(100vh - 68px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .cpi-recipe-list {
          overflow-y: auto;
          flex: 1;
          scrollbar-width: thin;
          scrollbar-color: var(--color-stone) transparent;
        }
        .cpi-recipe-list::-webkit-scrollbar { width: 4px; }
        .cpi-recipe-list::-webkit-scrollbar-track { background: transparent; }
        .cpi-recipe-list::-webkit-scrollbar-thumb { background: var(--color-stone); }
        .cpi-drag-item { cursor: grab; }
        .cpi-drag-item:active { cursor: grabbing; }
        @media (max-width: 720px) {
          .cpi-grid {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 2rem 16px 3rem;
          }
          .cpi-left {
            position: static;
            height: auto;
            overflow: visible;
          }
          .cpi-recipe-list {
            max-height: 55vh;
            overflow-y: auto;
            margin-bottom: 2rem;
          }
        }
      `}</style>

      <div className="cpi-grid">

        {/* ── LEFT: Recipe collection ──────────────────────────────────────── */}
        <div className="cpi-left">

          {/* Panel header */}
          <div style={{ flexShrink: 0, paddingBottom: '1rem' }}>
            <p style={{ ...EYEBROW, marginBottom: '0.35rem' }}>The collection</p>
            <h2 style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)',
              fontWeight: 500,
              color: 'var(--color-ink)',
              margin: '0 0 1.1rem',
            }}>
              All recipes
            </h2>

            {/* Search + filter row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem', alignItems: 'stretch' }}>
              {/* NL search input (active now; wired to NLP in Phase 3) */}
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
                    width: '100%',
                    paddingLeft: '28px',
                    paddingRight: '10px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Cuisine filter */}
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
                    padding: '7px 11px',
                    height: '100%',
                    border: cuisineFilter
                      ? '1px solid var(--color-oxblood)'
                      : '1px solid var(--color-hairline)',
                    backgroundColor: 'transparent',
                    color: cuisineFilter ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
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
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.875rem',
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
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: '0.75rem',
              color: 'var(--color-ink-muted)',
              margin: 0,
              fontStyle: 'italic',
            }}>
              {collectionRecipes.length} recipe{collectionRecipes.length !== 1 ? 's' : ''}
              {' · '}drag to a day to plan
            </p>
          </div>

          <hr style={{ ...HAIRLINE, flexShrink: 0 }} />

          {/* Scrollable recipe list */}
          <div className="cpi-recipe-list">
            {collectionRecipes.length === 0 ? (
              <p style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: '0.875rem',
                color: 'var(--color-ink-muted)',
                padding: '1.5rem 0',
                fontStyle: 'italic',
                margin: 0,
              }}>
                No recipes found.
              </p>
            ) : (
              collectionRecipes.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, r)}
                  className="cpi-drag-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.6rem 0',
                    borderBottom: '1px solid var(--color-hairline)',
                    userSelect: 'none',
                  }}
                >
                  {r.image ? (
                    <img
                      src={`${basePath}${r.image}`}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: '44px', height: '33px',
                        objectFit: 'cover',
                        flexShrink: 0,
                        borderRadius: '2px',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '44px', height: '33px',
                      flexShrink: 0,
                      backgroundColor: 'var(--color-stone)',
                      borderRadius: '2px',
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...EYEBROW, fontSize: '0.58rem', marginBottom: '2px' }}>{r.cuisine}</p>
                    <p style={{
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: '0.9rem',
                      lineHeight: 1.25,
                      color: 'var(--color-ink)',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {r.title}
                    </p>
                  </div>
                  {r.totalTimeMinutes && (
                    <span className="onum" style={{
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: '0.72rem',
                      color: 'var(--color-ink-muted)',
                      flexShrink: 0,
                    }}>
                      {r.totalTimeMinutes}m
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Meal planner ──────────────────────────────────────────── */}
        <div style={{ paddingTop: '0.25rem' }}>

          {/* Planner header */}
          <div style={{ marginBottom: '2rem' }}>
            <p style={{ ...EYEBROW, marginBottom: '0.35rem' }}>Plan</p>
            <h2 style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: 'clamp(1.25rem, 2.5vw, 1.6rem)',
              fontWeight: 500,
              color: 'var(--color-ink)',
              margin: '0 0 0.35rem',
            }}>
              Weekly Menu
            </h2>
            <p style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: '0.85rem',
              color: 'var(--color-ink-muted)',
              margin: 0,
            }}>
              Drag a recipe from the collection, or use the + picker.
            </p>
          </div>

          {/* Day rows */}
          <div style={{ borderBottom: '1px solid var(--color-hairline)', marginBottom: '2rem' }}>
            {DAYS.map((day) => {
              const meal = meals[day];
              const isOpen = openDay === day;
              const isDragOver = dragOverDay === day;

              return (
                <div
                  key={day}
                  onDragOver={(e) => handleDragOver(e, day)}
                  onDrop={(e) => handleDrop(e, day)}
                  onDragLeave={() => setDragOverDay(null)}
                  style={{
                    borderTop: isDragOver
                      ? '2px solid var(--color-oxblood)'
                      : '1px solid var(--color-hairline)',
                    backgroundColor: isDragOver
                      ? 'rgba(126, 38, 37, 0.04)'
                      : 'transparent',
                    transition: 'background-color 0.1s',
                  }}
                >
                  {/* Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.9rem 0' }}>
                    <span style={{
                      width: '80px', flexShrink: 0,
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'var(--color-ink-muted)',
                    }}>
                      {day}
                    </span>

                    {meal ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        {meal.image && (
                          <img
                            src={`${basePath}${meal.image}`}
                            alt={meal.title}
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: 'var(--radius-sm)',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.95rem',
                          color: 'var(--color-ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {meal.title}
                        </span>
                        {meal.recipeId === null && (
                          <span style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            color: 'var(--color-ink-muted)',
                            border: '1px solid var(--color-hairline)',
                            padding: '1px 5px',
                            flexShrink: 0,
                          }}>
                            custom
                          </span>
                        )}
                        <button
                          onClick={() => setOpenDay(isOpen ? null : day)}
                          style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'var(--color-oxblood)',
                            background: 'none', border: 'none',
                            cursor: 'pointer', padding: 0, flexShrink: 0,
                          }}
                        >
                          Change
                        </button>
                        <button
                          onClick={() => removeMeal(day)}
                          style={{
                            background: 'none', border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-ink-muted)',
                            padding: '2px',
                            display: 'flex',
                            opacity: 0.6,
                            flexShrink: 0,
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setOpenDay(isOpen ? null : day)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          flex: 1, background: 'none', border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-ink-muted)',
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.9rem',
                          padding: 0,
                        }}
                      >
                        <Plus size={13} />
                        <span>Add a meal</span>
                        <ChevronDown
                          size={13}
                          style={{
                            marginLeft: 'auto',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </button>
                    )}
                  </div>

                  {/* Inline picker */}
                  {isOpen && (
                    <div style={{
                      borderTop: '1px solid var(--color-hairline)',
                      padding: '1.1rem 0 1.4rem',
                    }}>
                      <div style={{ position: 'relative', marginBottom: '0.875rem' }}>
                        <Search
                          size={13}
                          style={{
                            position: 'absolute', left: '9px', top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-ink-muted)',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Search recipes…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          style={{
                            ...INPUT,
                            width: '100%',
                            paddingLeft: '30px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {pickerFiltered.length > 0 ? (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                          gap: '5px',
                          marginBottom: '1.1rem',
                        }}>
                          {pickerFiltered.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => selectRecipe(day, r)}
                              style={{
                                position: 'relative', overflow: 'hidden',
                                aspectRatio: '3/2',
                                border: 'none', cursor: 'pointer',
                                padding: 0,
                                backgroundColor: 'var(--color-stone)',
                              }}
                            >
                              {r.image ? (
                                <img
                                  src={`${basePath}${r.image}`}
                                  alt={r.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-stone)' }} />
                              )}
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
                              }} />
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                padding: '4px 6px', textAlign: 'left',
                              }}>
                                <p style={{
                                  color: 'white', fontSize: '10px',
                                  margin: 0, lineHeight: 1.25,
                                  fontFamily: "'EB Garamond', Georgia, serif",
                                }}>
                                  {r.title}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p style={{
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.875rem',
                          color: 'var(--color-ink-muted)',
                          marginBottom: '1rem',
                          fontStyle: 'italic',
                        }}>
                          No recipes found.
                        </p>
                      )}

                      {/* Custom meal */}
                      <div>
                        <p style={{
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.78rem',
                          color: 'var(--color-ink-muted)',
                          marginBottom: '0.4rem',
                        }}>
                          Or enter a custom dish:
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Dish name…"
                            value={customInputs[day] ?? ''}
                            onChange={(e) =>
                              setCustomInputs((prev) => ({ ...prev, [day]: e.target.value }))
                            }
                            onKeyDown={(e) => e.key === 'Enter' && addCustom(day)}
                            style={{ ...INPUT, flex: 1 }}
                          />
                          <button
                            onClick={() => addCustom(day)}
                            disabled={!(customInputs[day] ?? '').trim()}
                            style={{
                              padding: '7px 14px',
                              border: 'none',
                              backgroundColor: 'var(--color-oxblood)',
                              color: 'var(--color-paper)',
                              fontFamily: "'EB Garamond', Georgia, serif",
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              opacity: (customInputs[day] ?? '').trim() ? 1 : 0.4,
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Generate shopping list button */}
          <div style={{ marginBottom: '3rem' }}>
            <button
              onClick={generateList}
              disabled={!canGenerate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '10px 22px',
                border: canGenerate ? 'none' : '1px solid var(--color-hairline)',
                backgroundColor: canGenerate ? 'var(--color-oxblood)' : 'transparent',
                color: canGenerate ? 'var(--color-paper)' : 'var(--color-ink-muted)',
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: '0.9rem',
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.15s',
              }}
            >
              <ShoppingCart size={15} />
              {listReady ? 'Update shopping list' : 'Generate shopping list'}
            </button>
            {!canGenerate && (
              <p style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--color-ink-muted)',
                fontStyle: 'italic',
              }}>
                Add at least one meal to continue.
              </p>
            )}
          </div>

          {/* Shopping list */}
          {listReady && (
            <div ref={shoppingRef}>
              <div style={{
                display: 'flex', alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
              }}>
                <div>
                  <p style={{ ...EYEBROW, marginBottom: '0.5rem' }}>Shopping list</p>
                  <h3 style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    margin: 0,
                  }}>
                    Ingredients
                  </h3>
                </div>
                <button
                  onClick={downloadList}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 13px',
                    border: '1px solid var(--color-hairline)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-ink)',
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  <Download size={13} />
                  Download
                </button>
              </div>

              {shoppingList.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '0.6rem 0',
                  borderTop: '1px solid var(--color-hairline)',
                  borderBottom: '1px solid var(--color-hairline)',
                  marginBottom: '1.5rem',
                }}>
                  <span className="onum" style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: '0.875rem',
                    color: 'var(--color-ink-muted)',
                  }}>
                    {checkedCount} of {shoppingList.length} checked
                  </span>
                  {checkedCount === shoppingList.length && shoppingList.length > 0 && (
                    <span style={{
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: '0.875rem',
                      color: 'var(--color-olive)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      <Check size={13} /> All done!
                    </span>
                  )}
                </div>
              )}

              {shoppingList.length === 0 ? (
                <p style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  color: 'var(--color-ink-muted)',
                  fontSize: '0.9rem',
                  fontStyle: 'italic',
                  padding: '1.5rem 0',
                }}>
                  No ingredient data — all selected meals are custom.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
                  {DAYS.filter((d) => grouped[d]).map((day) => {
                    const { meal, sections } = grouped[day];
                    return (
                      <div key={day}>
                        <div style={{
                          display: 'flex', alignItems: 'baseline', gap: '0.75rem',
                          paddingBottom: '0.5rem',
                          borderBottom: '1px solid var(--color-hairline)',
                        }}>
                          <span style={{ ...EYEBROW, fontSize: '0.6rem' }}>{day}</span>
                          <span style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.9rem',
                            color: 'var(--color-ink)',
                          }}>
                            {meal.title}
                          </span>
                          {meal.image && (
                            <img
                              src={`${basePath}${meal.image}`}
                              alt={meal.title}
                              style={{
                                width: '22px', height: '22px',
                                borderRadius: 'var(--radius-sm)',
                                objectFit: 'cover',
                                marginLeft: 'auto',
                              }}
                            />
                          )}
                        </div>

                        {sections.map((sec, si) => (
                          <div key={si}>
                            {sec.header && (
                              <p style={{
                                fontFamily: "'EB Garamond', Georgia, serif",
                                fontSize: '0.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                color: 'var(--color-ink-muted)',
                                margin: '0.7rem 0 0',
                                fontWeight: 600,
                              }}>
                                {sec.header}
                              </p>
                            )}
                            {sec.items.map((item) => (
                              <label
                                key={item.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '12px',
                                  padding: '0.5rem 0',
                                  borderBottom: '1px solid var(--color-hairline)',
                                  cursor: 'pointer',
                                }}
                              >
                                <span
                                  onClick={() => toggleItem(item.id)}
                                  style={{
                                    flexShrink: 0,
                                    width: '15px', height: '15px',
                                    border: item.checked ? 'none' : '1.5px solid var(--color-hairline)',
                                    backgroundColor: item.checked ? 'var(--color-oxblood)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {item.checked && <Check size={9} color="var(--color-paper)" />}
                                </span>
                                <span
                                  onClick={() => toggleItem(item.id)}
                                  className="onum"
                                  style={{
                                    fontFamily: "'EB Garamond', Georgia, serif",
                                    fontSize: '0.9rem',
                                    color: item.checked ? 'var(--color-ink-muted)' : 'var(--color-ink)',
                                    textDecoration: item.checked ? 'line-through' : 'none',
                                    opacity: item.checked ? 0.55 : 1,
                                  }}
                                >
                                  {item.text}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {DAYS.some((d) => meals[d]?.recipeId === null) && (
                    <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '1rem' }}>
                      <p style={{
                        fontFamily: "'EB Garamond', Georgia, serif",
                        fontSize: '0.8rem',
                        color: 'var(--color-ink-muted)',
                        margin: '0 0 0.5rem',
                        fontStyle: 'italic',
                      }}>
                        Custom meals (no ingredient data):
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {DAYS.filter((d) => meals[d]?.recipeId === null).map((d) => (
                          <li key={d} style={{
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.9rem',
                            color: 'var(--color-ink-muted)',
                            marginBottom: '2px',
                          }}>
                            <span style={{ color: 'var(--color-ink)' }}>{d}:</span> {meals[d]?.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
