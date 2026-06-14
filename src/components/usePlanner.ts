import { useState, useEffect } from 'react';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface RecipeData {
  id: string;
  title: string;
  cuisine: string;
  image: string | null;
  totalTimeMinutes: number | null;
  ingredients: string[];
}

export interface IngredientSection {
  header: string | null;
  items: string[];
}

export interface PlannedMeal {
  recipeId: string | null;
  title: string;
  image: string | null;
  sections: IngredientSection[];
}

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

export interface DayGroup {
  meal: PlannedMeal;
  sections: SectionGroup[];
}

const STORAGE_KEY = 'recipes:week';

function loadWeek(): Partial<Record<string, PlannedMeal>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWeek(meals: Partial<Record<string, PlannedMeal>>): void {
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
  const [meals, setMeals] = useState<Partial<Record<string, PlannedMeal>>>({});
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
    resetList();
  }

  function addCustom(day: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMeals((prev) => ({
      ...prev,
      [day]: { recipeId: null, title: trimmed, image: null, sections: [] },
    }));
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

  // Shopping list grouping — derived from shoppingList + meals
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
  const filledDays = DAYS.filter((d) => meals[d]);
  const canGenerate = filledDays.length > 0;

  return {
    meals,
    shoppingList,
    listReady,
    loaded,
    grouped,
    checkedCount,
    filledDays,
    canGenerate,
    selectRecipe,
    addCustom,
    removeMeal,
    resetList,
    generateList,
    toggleItem,
    downloadList,
  };
}
