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
    <div style={{ backgroundColor: '#FAF9F5', minHeight: '60vh' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(41,47,23,0.5)', marginBottom: '4px' }}>
            Planning
          </p>
          <h1 style={{ fontSize: '2.25rem', color: '#292F17', margin: 0 }}>Weekly Menu</h1>
          <p style={{ marginTop: '6px', fontSize: '0.9rem', color: 'rgba(41,47,23,0.6)' }}>
            Pick meals for the week and generate a shopping list automatically.
          </p>
        </div>

        {/* Day rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '2rem' }}>
          {DAYS.map((day) => {
            const meal = meals[day];
            const isOpen = openDay === day;

            return (
              <div key={day} style={{ borderRadius: '10px', overflow: 'visible', backgroundColor: '#F1ECDB' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px' }}>
                  <span style={{ width: '80px', flexShrink: 0, fontSize: '13px', color: 'rgba(41,47,23,0.55)' }}>
                    {day}
                  </span>

                  {meal ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      {meal.image && (
                        <img
                          src={`${basePath}${meal.image}`}
                          alt={meal.title}
                          style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ flex: 1, fontSize: '14px', color: '#292F17' }}>{meal.title}</span>
                      {meal.recipeId === null && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(134,139,89,0.15)', color: '#868B59' }}>
                          custom
                        </span>
                      )}
                      <button
                        onClick={() => setOpenDay(isOpen ? null : day)}
                        style={{ fontSize: '12px', color: '#7E2625', background: 'none', border: 'none', cursor: 'pointer', padding: '0', textDecoration: 'underline' }}
                      >
                        Change
                      </button>
                      <button
                        onClick={() => removeMeal(day)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(41,47,23,0.4)', padding: '2px', display: 'flex' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenDay(isOpen ? null : day)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(41,47,23,0.4)', fontSize: '14px', padding: 0 }}
                    >
                      <Plus size={16} />
                      <span>Add a meal</span>
                      <ChevronDown
                        size={16}
                        style={{ marginLeft: 'auto', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>
                  )}
                </div>

                {/* Picker dropdown */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(41,47,23,0.1)', padding: '16px 18px 20px' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '14px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(41,47,23,0.4)' }} />
                      <input
                        type="text"
                        placeholder="Search recipes…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                          width: '100%',
                          paddingLeft: '32px',
                          paddingRight: '12px',
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          borderRadius: '8px',
                          border: '1px solid rgba(41,47,23,0.15)',
                          backgroundColor: '#FAF9F5',
                          color: '#292F17',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Recipe grid */}
                    {filtered.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                        {filtered.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => selectRecipe(day, r)}
                            style={{
                              position: 'relative',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              aspectRatio: '3/2',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              backgroundColor: '#D4D0BF',
                            }}
                          >
                            {r.image ? (
                              <img
                                src={`${basePath}${r.image}`}
                                alt={r.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', backgroundColor: '#D4D0BF' }} />
                            )}
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', textAlign: 'left' }}>
                              <p style={{ color: 'white', fontSize: '11px', margin: 0, lineHeight: 1.3 }}>{r.title}</p>
                              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', margin: 0 }}>{r.cuisine}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'rgba(41,47,23,0.5)', marginBottom: '16px' }}>No recipes found.</p>
                    )}

                    {/* Custom name */}
                    <div>
                      <p style={{ fontSize: '12px', color: 'rgba(41,47,23,0.5)', marginBottom: '8px' }}>
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
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(41,47,23,0.15)',
                            backgroundColor: '#FAF9F5',
                            color: '#292F17',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => addCustom(day)}
                          disabled={!(customInputs[day] ?? '').trim()}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#7E2625',
                            color: '#FAF9F5',
                            fontSize: '14px',
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
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <button
            onClick={generateList}
            disabled={!canGenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 28px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#7E2625',
              color: '#FAF9F5',
              fontSize: '14px',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              opacity: canGenerate ? 1 : 0.4,
            }}
          >
            <ShoppingCart size={18} />
            {listReady ? 'Update shopping list' : 'Create shopping list'}
          </button>
          {!canGenerate && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(41,47,23,0.4)' }}>
              Add at least one day to continue
            </p>
          )}
        </div>

        {/* Shopping list */}
        {listReady && (
          <div ref={shoppingRef}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(41,47,23,0.5)', marginBottom: '4px' }}>
                  Shopping list
                </p>
                <h2 style={{ fontSize: '1.75rem', color: '#292F17', margin: 0 }}>Ingredients</h2>
              </div>
              <button
                onClick={downloadList}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
                  border: '1px solid #292F17', backgroundColor: 'transparent',
                  color: '#292F17', cursor: 'pointer',
                }}
              >
                <Download size={15} />
                Download
              </button>
            </div>

            {/* Progress */}
            {shoppingList.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '8px', backgroundColor: '#F1ECDB', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '13px', color: 'rgba(41,47,23,0.7)' }}>
                  {checkedCount} of {shoppingList.length} checked
                </span>
                {checkedCount === shoppingList.length && shoppingList.length > 0 && (
                  <span style={{ fontSize: '13px', color: '#868B59', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={15} /> All done!
                  </span>
                )}
              </div>
            )}

            {shoppingList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'rgba(41,47,23,0.5)', fontSize: '14px', padding: '2rem 0' }}>
                No ingredient data available — all selected meals are custom.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '4rem' }}>
                {DAYS.filter((d) => grouped[d]).map((day) => {
                  const { meal, sections } = grouped[day];
                  return (
                    <div key={day} style={{ border: '1px solid rgba(41,47,23,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                      {/* Day header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', backgroundColor: '#F1ECDB' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#292F17' }}>{day}</span>
                        <span style={{ fontSize: '12px', color: 'rgba(41,47,23,0.5)' }}>— {meal.title}</span>
                        {meal.image && (
                          <img
                            src={`${basePath}${meal.image}`}
                            alt={meal.title}
                            style={{ width: '28px', height: '28px', borderRadius: '5px', objectFit: 'cover', marginLeft: 'auto' }}
                          />
                        )}
                      </div>

                      {/* Sections + items */}
                      {sections.map((sec, si) => (
                        <div key={si}>
                          {sec.header && (
                            <p style={{ padding: '10px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(41,47,23,0.45)', margin: 0 }}>
                              {sec.header}
                            </p>
                          )}
                          {sec.items.map((item) => (
                            <label
                              key={item.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', cursor: 'pointer' }}
                            >
                              {/* Checkbox */}
                              <span
                                onClick={() => toggleItem(item.id)}
                                style={{
                                  flexShrink: 0,
                                  width: '18px', height: '18px',
                                  borderRadius: '4px',
                                  border: item.checked ? 'none' : '1.5px solid rgba(41,47,23,0.3)',
                                  backgroundColor: item.checked ? '#7E2625' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                {item.checked && <Check size={11} color="white" />}
                              </span>
                              <span
                                onClick={() => toggleItem(item.id)}
                                style={{
                                  fontSize: '14px',
                                  color: item.checked ? 'rgba(41,47,23,0.35)' : '#292F17',
                                  textDecoration: item.checked ? 'line-through' : 'none',
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
                  <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#F1ECDB' }}>
                    <p style={{ fontSize: '13px', color: '#292F17', marginBottom: '8px' }}>
                      Custom meals (no ingredient data):
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {DAYS.filter((d) => meals[d]?.recipeId === null).map((d) => (
                        <li key={d} style={{ fontSize: '13px', color: 'rgba(41,47,23,0.6)' }}>
                          <strong style={{ color: '#292F17' }}>{d}:</strong> {meals[d]?.title}
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
