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

// ── Shared style constants ────────────────────────────────────────────────────

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

export function MealPlannerIsland({ recipes, basePath }: Props) {
  const [meals, setMeals] = useState<Partial<Record<string, PlannedMeal>>>({});
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [customInputs, setCustomInputs] = useState<Partial<Record<string, string>>>({});
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [listReady, setListReady] = useState(false);
  const shoppingRef = useRef<HTMLDivElement>(null);

  const filledDays = DAYS.filter((d) => meals[d]);
  const canGenerate = filledDays.length > 0;

  const filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase())
  );

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
    setTimeout(() => shoppingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
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
    lines.push('');
    lines.push('INGREDIENTS');
    lines.push('─'.repeat(40));

    DAYS.forEach((day) => {
      const meal = meals[day];
      if (!meal || meal.sections.length === 0) return;
      lines.push('');
      lines.push(`${day.toUpperCase()} — ${meal.title}`);
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

  // Group shopping list by day → section
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
    <div style={{ backgroundColor: 'var(--color-paper)', minHeight: '60vh' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{ ...EYEBROW, marginBottom: '0.5rem' }}>Plan</p>
          <h1 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 500, color: 'var(--color-ink)', margin: '0 0 0.4rem' }}>
            Weekly Menu
          </h1>
          <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', color: 'var(--color-ink-muted)', margin: 0 }}>
            Pick meals for the week and generate a shopping list automatically.
          </p>
        </div>

        {/* Day rows */}
        <div style={{ borderBottom: '1px solid var(--color-hairline)', marginBottom: '2rem' }}>
          {DAYS.map((day) => {
            const meal = meals[day];
            const isOpen = openDay === day;

            return (
              <div key={day} style={{ borderTop: '1px solid var(--color-hairline)' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem 0' }}>
                  <span style={{ width: '88px', flexShrink: 0, fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-ink-muted)' }}>
                    {day}
                  </span>

                  {meal ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {meal.image && (
                        <img
                          src={`${basePath}${meal.image}`}
                          alt={meal.title}
                          style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ flex: 1, fontFamily: "'EB Garamond', Georgia, serif", fontSize: '1rem', color: 'var(--color-ink)' }}>{meal.title}</span>
                      {meal.recipeId === null && (
                        <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-ink-muted)', border: '1px solid var(--color-hairline)', padding: '1px 6px' }}>
                          custom
                        </span>
                      )}
                      <button
                        onClick={() => setOpenDay(isOpen ? null : day)}
                        style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-oxblood)', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                      >
                        Change
                      </button>
                      <button
                        onClick={() => removeMeal(day)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted)', padding: '2px', display: 'flex', opacity: 0.6 }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenDay(isOpen ? null : day)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.95rem', padding: 0 }}
                    >
                      <Plus size={14} />
                      <span>Add a meal</span>
                      <ChevronDown
                        size={14}
                        style={{ marginLeft: 'auto', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>
                  )}
                </div>

                {/* Picker dropdown */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--color-hairline)', padding: '1.25rem 0 1.5rem' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)' }} />
                      <input
                        type="text"
                        placeholder="Search recipes…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                          width: '100%',
                          paddingLeft: '32px',
                          paddingRight: '12px',
                          paddingTop: '7px',
                          paddingBottom: '7px',
                          border: '1px solid var(--color-hairline)',
                          backgroundColor: 'var(--color-paper)',
                          color: 'var(--color-ink)',
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: '0.9rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Recipe grid */}
                    {filtered.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px', marginBottom: '1.25rem' }}>
                        {filtered.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => selectRecipe(day, r)}
                            style={{
                              position: 'relative',
                              overflow: 'hidden',
                              aspectRatio: '3/2',
                              border: 'none',
                              cursor: 'pointer',
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
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 7px', textAlign: 'left' }}>
                              <p style={{ color: 'white', fontSize: '10px', margin: 0, lineHeight: 1.3, fontFamily: "'EB Garamond', Georgia, serif" }}>{r.title}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.875rem', color: 'var(--color-ink-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>No recipes found.</p>
                    )}

                    {/* Custom name */}
                    <div>
                      <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>
                        Or enter a custom dish:
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Dish name…"
                          value={customInputs[day] ?? ''}
                          onChange={(e) => setCustomInputs((prev) => ({ ...prev, [day]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addCustom(day)}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            border: '1px solid var(--color-hairline)',
                            backgroundColor: 'var(--color-paper)',
                            color: 'var(--color-ink)',
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: '0.9rem',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => addCustom(day)}
                          disabled={!(customInputs[day] ?? '').trim()}
                          style={{
                            padding: '7px 16px',
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

        {/* Generate button */}
        <div style={{ marginBottom: '3rem' }}>
          <button
            onClick={generateList}
            disabled={!canGenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 24px',
              border: canGenerate ? 'none' : '1px solid var(--color-hairline)',
              backgroundColor: canGenerate ? 'var(--color-oxblood)' : 'transparent',
              color: canGenerate ? 'var(--color-paper)' : 'var(--color-ink-muted)',
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: '0.9rem',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.15s',
            }}
          >
            <ShoppingCart size={16} />
            {listReady ? 'Update shopping list' : 'Generate shopping list'}
          </button>
          {!canGenerate && (
            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
              Add at least one meal to continue.
            </p>
          )}
        </div>

        {/* Shopping list */}
        {listReady && (
          <div ref={shoppingRef}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ ...EYEBROW, marginBottom: '0.5rem' }}>Shopping list</p>
                <h2 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 500, color: 'var(--color-ink)', margin: 0 }}>
                  Ingredients
                </h2>
              </div>
              <button
                onClick={downloadList}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px',
                  border: '1px solid var(--color-hairline)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-ink)',
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Download
              </button>
            </div>

            {/* Progress */}
            {shoppingList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.65rem 0', borderTop: '1px solid var(--color-hairline)', borderBottom: '1px solid var(--color-hairline)', marginBottom: '1.5rem' }}>
                <span className="onum" style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.875rem', color: 'var(--color-ink-muted)' }}>
                  {checkedCount} of {shoppingList.length} checked
                </span>
                {checkedCount === shoppingList.length && shoppingList.length > 0 && (
                  <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.875rem', color: 'var(--color-olive)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> All done!
                  </span>
                )}
              </div>
            )}

            {shoppingList.length === 0 ? (
              <p style={{ fontFamily: "'EB Garamond', Georgia, serif", color: 'var(--color-ink-muted)', fontSize: '0.9rem', fontStyle: 'italic', padding: '1.5rem 0' }}>
                No ingredient data — all selected meals are custom.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
                {DAYS.filter((d) => grouped[d]).map((day) => {
                  const { meal, sections } = grouped[day];
                  return (
                    <div key={day}>
                      {/* Day header */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-hairline)' }}>
                        <span style={{ ...EYEBROW, fontSize: '0.6rem' }}>{day}</span>
                        <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', color: 'var(--color-ink)' }}>{meal.title}</span>
                        {meal.image && (
                          <img
                            src={`${basePath}${meal.image}`}
                            alt={meal.title}
                            style={{ width: '24px', height: '24px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', marginLeft: 'auto' }}
                          />
                        )}
                      </div>

                      {/* Sections + items */}
                      {sections.map((sec, si) => (
                        <div key={si}>
                          {sec.header && (
                            <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--color-ink-muted)', margin: '0.75rem 0 0', fontWeight: 600 }}>
                              {sec.header}
                            </p>
                          )}
                          {sec.items.map((item) => (
                            <label
                              key={item.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.55rem 0', borderBottom: '1px solid var(--color-hairline)', cursor: 'pointer' }}
                            >
                              <span
                                onClick={() => toggleItem(item.id)}
                                style={{
                                  flexShrink: 0,
                                  width: '16px', height: '16px',
                                  border: item.checked ? 'none' : '1.5px solid var(--color-hairline)',
                                  backgroundColor: item.checked ? 'var(--color-oxblood)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {item.checked && <Check size={10} color="var(--color-paper)" />}
                              </span>
                              <span
                                onClick={() => toggleItem(item.id)}
                                className="onum"
                                style={{
                                  fontFamily: "'EB Garamond', Georgia, serif",
                                  fontSize: '0.95rem',
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

                {/* Note for custom meals */}
                {DAYS.some((d) => meals[d]?.recipeId === null) && (
                  <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: '1rem' }}>
                    <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.8rem', color: 'var(--color-ink-muted)', margin: '0 0 0.5rem', fontStyle: 'italic' }}>
                      Custom meals (no ingredient data):
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                      {DAYS.filter((d) => meals[d]?.recipeId === null).map((d) => (
                        <li key={d} style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '0.9rem', color: 'var(--color-ink-muted)', marginBottom: '2px' }}>
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
  );
}
