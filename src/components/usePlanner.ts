import { useState, useEffect } from 'react';
import { migrateWeek, addMealIn, moveMealIn, newMealId, MAX_MEALS_PER_DAY } from '../lib/plannerModel.mjs';
import { scaleIngredient } from '../lib/quantity.mjs';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export { MAX_MEALS_PER_DAY };

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

export interface ShoppingItem {
  id: string;
  text: string;
  day: string;
  recipeTitle: string;
  sectionHeader: string | null;
  checked: boolean;
}

export interface SectionGroup {
  header: string | null;
  items: ShoppingItem[];
}

export interface MealGroup {
  meal: PlannedMeal;
  sections: SectionGroup[];
}

const STORAGE_KEY = 'recipes:week';

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

// TODO(nlp-plan): KG enrichment, category buckets, merged day notes — see
// nlp-integration-update-plan.md
function enrichShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return items;
}

export function usePlanner() {
  const [meals, setMeals] = useState<Week>({});
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [listReady, setListReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = loadWeek();
    if (Object.keys(saved).length > 0) setMeals(saved);
    setLoaded(true);
  }, []);

  // Don't write until after initial load to avoid overwriting with empty state
  useEffect(() => {
    if (!loaded) return;
    saveWeek(meals);
  }, [meals, loaded]);

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

  // Per-meal-instance servings, bounds 1–12; the generated list is a snapshot
  function updateServings(day: string, mealId: string, servings: number) {
    const clamped = Math.min(12, Math.max(1, Math.round(servings)));
    setMeals((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((m) => (m.id === mealId ? { ...m, servings: clamped } : m)),
    }));
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
      (meals[day] ?? []).forEach((meal) => {
        // Each raw line scales by its own meal's servings ratio
        const ratio =
          meal.servings !== null && meal.baseServings ? meal.servings / meal.baseServings : 1;
        meal.sections.forEach((sec) => {
          sec.items.forEach((text) => {
            items.push({
              id: String(counter++),
              text: scaleIngredient(text, ratio),
              day,
              recipeTitle: meal.title,
              sectionHeader: sec.header,
              checked: false,
            });
          });
        });
      });
    });
    setShoppingList(enrichShoppingItems(items));
    setListReady(true);
  }

  function toggleItem(id: string) {
    setShoppingList((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  // Day → meal → section grouping. Items were generated in DAYS × meals order,
  // so a cursor pairs them back up unambiguously (duplicate recipes included).
  const grouped: Record<string, MealGroup[]> = {};
  if (shoppingList.length > 0) {
    let cursor = 0;
    DAYS.forEach((day) => {
      (meals[day] ?? []).forEach((meal) => {
        const count = meal.sections.reduce((n, s) => n + s.items.length, 0);
        if (count === 0) return;
        const mealItems = shoppingList.slice(cursor, cursor + count);
        cursor += count;
        const sections: SectionGroup[] = [];
        mealItems.forEach((item) => {
          const last = sections[sections.length - 1];
          if (last && last.header === item.sectionHeader) last.items.push(item);
          else sections.push({ header: item.sectionHeader, items: [item] });
        });
        (grouped[day] ??= []).push({ meal, sections });
      });
    });
  }

  function downloadList() {
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
    lines.push('', 'INGREDIENTS', '─'.repeat(40));
    DAYS.forEach((day) => {
      (grouped[day] ?? []).forEach(({ meal, sections }) => {
        lines.push('', `${day.toUpperCase()} — ${meal.title}`);
        sections.forEach((sec) => {
          if (sec.header) lines.push(`  ${sec.header}:`);
          sec.items.forEach((item) => {
            lines.push(`  ${item.checked ? '[x]' : '[ ]'} ${item.text}`);
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

  const checkedCount = shoppingList.filter((i) => i.checked).length;
  const filledDays = DAYS.filter((d) => (meals[d] ?? []).length > 0);
  const mealCount = DAYS.reduce((n, d) => n + (meals[d]?.length ?? 0), 0);
  const canGenerate = mealCount > 0;

  return {
    meals,
    shoppingList,
    listReady,
    loaded,
    grouped,
    checkedCount,
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
    downloadList,
  };
}
