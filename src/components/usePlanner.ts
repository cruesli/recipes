import { useState, useEffect, useMemo } from 'react';
import { migrateWeek, addMealIn, moveMealIn, newMealId, MAX_MEALS_PER_DAY } from '../lib/plannerModel.mjs';
import { scaleIngredient } from '../lib/quantity.mjs';
import { buildShoppingView, DEFAULT_BUCKET_ORDER } from '../lib/shoppingList.mjs';
import { getEnriched, CATEGORY_LABELS, normaliseCategory } from '../lib/enrichment';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export { MAX_MEALS_PER_DAY };
export const MAX_SERVINGS = 24;

// dataTransfer types: the key itself discriminates add vs move during dragover
export const PLANNER_ADD_TYPE = 'application/x-planner-add';
export const PLANNER_MOVE_TYPE = 'application/x-planner-move';

export interface RecipeData {
  id: string;
  title: string;
  cuisine: string;
  image: string | null;
  totalTimeMinutes: number | null;
  servings: number | null;
  ingredients: string[];
  /** Raw cuisine silhouette SVG for the photo-less card placeholder */
  silhouette?: string | null;
  // Facet fields (only populated on /recipes; undefined elsewhere)
  dietary?: string[];
  kcalPerServing?: number | null;
  proteinPerServing?: number | null;
}

export interface IngredientSection {
  header: string | null;
  items: string[];
}

export interface PlannedMeal {
  id: string; // per-instance id — recipeId is not unique (same recipe twice is fine)
  recipeId: string | null;
  title: string;
  image: string | null;
  sections: IngredientSection[];
  servings: number | null; // null for custom dishes (no scaler)
  baseServings: number | null; // recipe frontmatter servings at add-time
}

export type Week = Partial<Record<string, PlannedMeal[]>>;

export interface StatedQuantity {
  amount: number;
  unit: string;
}

export interface ShoppingItem {
  id: string;
  text: string;              // servings-scaled display text (degraded fallback)
  raw: string;               // original unscaled line — the join key to the export
  day: string;
  mealId: string;
  recipeTitle: string;
  recipeSlug: string | null;
  sectionHeader: string | null;
  ratio: number;
  // KG enrichment (null when the recipe/line isn't in the export → degraded)
  canonical: string | null;
  category: string | null;
  quantity: StatedQuantity | null;
}

// Bucket-view types (mirror src/lib/shoppingList.mjs output)
export interface MergedLine {
  id: string;
  canonical: string;
  category: string;
  note: string;
}
export interface CategoryBucket {
  category: string;
  lines: MergedLine[];
}
export interface DegradedSection {
  header: string | null;
  items: ShoppingItem[];
}
export interface DegradedMeal {
  title: string;
  sections: DegradedSection[];
}
export interface DegradedDay {
  day: string;
  meals: DegradedMeal[];
}
export interface ShoppingView {
  buckets: CategoryBucket[];
  degraded: DegradedDay[];
  hasEnriched: boolean;
}

const STORAGE_KEY = 'recipes:week';
const BUCKET_ORDER_KEY = 'recipes:bucketOrder';
const SESSION_KEY = 'recipes:shoppingSession';

// One shopping session — generated list + progress; survives mid-shop reloads
interface ShoppingSession {
  items: ShoppingItem[];
  checked: string[];
  collapsed: string[];
}

function loadSession(): ShoppingSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ShoppingSession;
    return Array.isArray(s.items) && s.items.length > 0 ? s : null;
  } catch {
    return null;
  }
}

function saveSession(session: ShoppingSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session || session.items.length === 0) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function loadBucketOrder(): string[] {
  if (typeof window === 'undefined') return DEFAULT_BUCKET_ORDER;
  try {
    const raw = localStorage.getItem(BUCKET_ORDER_KEY);
    if (!raw) return DEFAULT_BUCKET_ORDER;
    const saved = JSON.parse(raw) as string[];
    // keep only known slugs, then append any defaults the saved order is missing
    const known = saved.filter((s) => DEFAULT_BUCKET_ORDER.includes(s));
    return [...known, ...DEFAULT_BUCKET_ORDER.filter((s) => !known.includes(s))];
  } catch {
    return DEFAULT_BUCKET_ORDER;
  }
}

function saveBucketOrder(order: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BUCKET_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

function loadWeek(): Week {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (migrateWeek(JSON.parse(raw)) as Week) : {};
  } catch {
    return {};
  }
}

function saveWeek(meals: Week): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  } catch {}
}

export function parseIngredients(raw: string[]): IngredientSection[] {
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

export function usePlanner() {
  const [meals, setMeals] = useState<Week>({});
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(new Set());
  const [bucketOrder, setBucketOrder] = useState<string[]>(DEFAULT_BUCKET_ORDER);
  const [listReady, setListReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = loadWeek();
    if (Object.keys(saved).length > 0) setMeals(saved);
    setBucketOrder(loadBucketOrder());
    const session = loadSession();
    if (session) {
      setShoppingList(session.items);
      setCheckedIds(new Set(session.checked));
      setCollapsedBuckets(new Set(session.collapsed));
      setListReady(true);
    }
    setLoaded(true);
  }, []);

  // Don't write until after initial load to avoid overwriting with empty state
  useEffect(() => {
    if (!loaded) return;
    saveWeek(meals);
  }, [meals, loaded]);

  // Persist the shopping session (list + checks + collapsed buckets)
  useEffect(() => {
    if (!loaded) return;
    saveSession({ items: shoppingList, checked: [...checkedIds], collapsed: [...collapsedBuckets] });
  }, [shoppingList, checkedIds, collapsedBuckets, loaded]);

  // Returns false when the day is already full (caller may show a note)
  function selectRecipe(day: string, recipe: RecipeData): boolean {
    if ((meals[day] ?? []).length >= MAX_MEALS_PER_DAY) return false;
    const meal: PlannedMeal = {
      id: newMealId(),
      recipeId: recipe.id,
      title: recipe.title,
      image: recipe.image,
      sections: parseIngredients(recipe.ingredients),
      servings: recipe.servings ?? null,
      baseServings: recipe.servings ?? null,
    };
    setMeals((prev) => (addMealIn(prev, day, meal) as Week | null) ?? prev);
    resetList();
    return true;
  }

  function addCustom(day: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if ((meals[day] ?? []).length >= MAX_MEALS_PER_DAY) return;
    const meal: PlannedMeal = {
      id: newMealId(),
      recipeId: null,
      title: trimmed,
      image: null,
      sections: [],
      servings: null,
      baseServings: null,
    };
    setMeals((prev) => (addMealIn(prev, day, meal) as Week | null) ?? prev);
    resetList();
  }

  function removeMeal(day: string, mealId: string) {
    setMeals((prev) => {
      const dayMeals = (prev[day] ?? []).filter((m) => m.id !== mealId);
      const next = { ...prev };
      if (dayMeals.length === 0) delete next[day];
      else next[day] = dayMeals;
      return next;
    });
    resetList();
  }

  function moveMeal(fromDay: string, mealId: string, toDay: string) {
    const next = moveMealIn(meals, fromDay, mealId, toDay) as Week | null;
    if (!next) return; // same day / full target: don't wipe a generated list
    setMeals(next);
    resetList();
  }

  // Per-meal-instance servings, bounds 1–MAX_SERVINGS; the generated list is a snapshot
  function updateServings(day: string, mealId: string, servings: number) {
    const clamped = Math.min(MAX_SERVINGS, Math.max(1, Math.round(servings)));
    setMeals((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((m) => (m.id === mealId ? { ...m, servings: clamped } : m)),
    }));
    resetList();
  }

  function resetList() {
    setShoppingList([]);
    setCheckedIds(new Set());
    setCollapsedBuckets(new Set());
    setListReady(false);
  }

  function generateList() {
    let counter = 0;
    const items: ShoppingItem[] = [];
    DAYS.forEach((day) => {
      (meals[day] ?? []).forEach((meal) => {
        // Each raw line scales by its own meal's servings ratio
        const ratio =
          meal.servings !== null && meal.baseServings ? meal.servings / meal.baseServings : 1;
        // Join the meal's raw lines against the recipe's enriched export by raw text
        const enriched = meal.recipeId ? getEnriched(meal.recipeId) : null;
        const byRaw = new Map<string, ReturnType<typeof getEnriched> extends null ? never : any>();
        enriched?.ingredients.forEach((ing) => byRaw.set(ing.raw.trim(), ing));
        meal.sections.forEach((sec) => {
          sec.items.forEach((raw) => {
            const e = byRaw.get(raw.trim());
            items.push({
              id: String(counter++),
              text: scaleIngredient(raw, ratio),
              raw,
              day,
              mealId: meal.id,
              recipeTitle: meal.title,
              recipeSlug: meal.recipeId,
              sectionHeader: sec.header,
              ratio,
              canonical: e?.canonical ?? null,
              category: e?.category ?? null,
              quantity: e?.quantity ?? null,
            });
          });
        });
      });
    });
    setShoppingList(items);
    setCheckedIds(new Set());
    setCollapsedBuckets(new Set());
    setListReady(true);
  }

  function toggleItem(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Drop checked rows from the session — declutters ingredients already at home.
  // Enriched rows check by merged id (c:<canonical>), degraded rows by item id.
  function removeChecked() {
    setShoppingList((prev) =>
      prev.filter((it) => !checkedIds.has(it.canonical ? `c:${it.canonical}` : it.id))
    );
    setCheckedIds(new Set());
  }

  function toggleBucketCollapse(category: string) {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }

  // Derived bucket view (enriched buckets + degraded day→recipe groups)
  const shoppingView = useMemo(
    () => buildShoppingView(shoppingList, bucketOrder) as ShoppingView,
    [shoppingList, bucketOrder]
  );

  // Bucket reorder — persisted, dynamic (re-sorts the derived view only)
  function reorderBuckets(next: string[]) {
    setBucketOrder(next);
    saveBucketOrder(next);
  }
  function resetBucketOrder() {
    setBucketOrder(DEFAULT_BUCKET_ORDER);
    saveBucketOrder(DEFAULT_BUCKET_ORDER);
  }

  function downloadList() {
    const mark = (id: string) => (checkedIds.has(id) ? '[x]' : '[ ]');
    const lines: string[] = ['SHOPPING LIST', ''];
    lines.push('WEEKLY MENU');
    lines.push('─'.repeat(40));
    DAYS.forEach((day) => {
      const dayMeals = meals[day] ?? [];
      if (dayMeals.length === 0) {
        lines.push(`${day.padEnd(10)} —`);
      } else {
        dayMeals.forEach((meal, i) => {
          lines.push(`${(i === 0 ? day : '').padEnd(10)} ${meal.title}`);
        });
      }
    });
    // Enriched buckets, in the user's order, with merged day-note lines
    shoppingView.buckets.forEach((bucket) => {
      const label = CATEGORY_LABELS[normaliseCategory(bucket.category)];
      lines.push('', label.toUpperCase(), '─'.repeat(40));
      bucket.lines.forEach((line) => {
        const name = line.canonical.charAt(0).toUpperCase() + line.canonical.slice(1);
        lines.push(`  ${mark(line.id)} ${name}${line.note ? `  — ${line.note}` : ''}`);
      });
    });
    // Degraded remainder keeps the classic day → recipe format
    shoppingView.degraded.forEach(({ day, meals: dayMeals }) => {
      dayMeals.forEach((meal) => {
        lines.push('', `${day.toUpperCase()} — ${meal.title}`);
        meal.sections.forEach((sec) => {
          if (sec.header) lines.push(`  ${sec.header}:`);
          sec.items.forEach((item) => {
            lines.push(`  ${mark(item.id)} ${item.text}`);
          });
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

  const totalRows =
    shoppingView.buckets.reduce((n, b) => n + b.lines.length, 0) +
    shoppingView.degraded.reduce(
      (n, d) => n + d.meals.reduce((m, ml) => m + ml.sections.reduce((s, sec) => s + sec.items.length, 0), 0),
      0
    );
  const checkedCount = checkedIds.size;
  const filledDays = DAYS.filter((d) => (meals[d] ?? []).length > 0);
  const mealCount = DAYS.reduce((n, d) => n + (meals[d]?.length ?? 0), 0);
  const canGenerate = mealCount > 0;

  return {
    meals,
    shoppingList,
    shoppingView,
    bucketOrder,
    checkedIds,
    collapsedBuckets,
    listReady,
    loaded,
    checkedCount,
    totalRows,
    filledDays,
    mealCount,
    canGenerate,
    selectRecipe,
    addCustom,
    removeMeal,
    moveMeal,
    updateServings,
    resetList,
    generateList,
    toggleItem,
    removeChecked,
    toggleBucketCollapse,
    reorderBuckets,
    resetBucketOrder,
    downloadList,
  };
}
