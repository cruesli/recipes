// Pure planner-week logic — consumed by usePlanner (runtime) and node --test.
export const MAX_MEALS_PER_DAY = 4;

export const newMealId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

// localStorage migration: pre-multi-meal weeks stored one meal object per day.
// Wrap as [meal]; backfill instance ids + servings fields; drop junk.
export function migrateWeek(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const week = {};
  for (const [day, value] of Object.entries(raw)) {
    const arr = Array.isArray(value) ? value : [value];
    const meals = arr
      .filter((m) => m && typeof m === 'object' && typeof m.title === 'string')
      .slice(0, MAX_MEALS_PER_DAY)
      .map((m) => ({
        id: typeof m.id === 'string' ? m.id : newMealId(),
        recipeId: m.recipeId ?? null,
        title: m.title,
        image: m.image ?? null,
        sections: Array.isArray(m.sections) ? m.sections : [],
        servings: typeof m.servings === 'number' ? m.servings : null,
        baseServings: typeof m.baseServings === 'number' ? m.baseServings : null,
      }));
    if (meals.length) week[day] = meals;
  }
  return week;
}

// Append with capacity check; null = day full
export function addMealIn(week, day, meal) {
  const dayMeals = week[day] ?? [];
  if (dayMeals.length >= MAX_MEALS_PER_DAY) return null;
  return { ...week, [day]: [...dayMeals, meal] };
}

// Remove from source, append to target; null = blocked (same day / missing / full)
export function moveMealIn(week, fromDay, mealId, toDay) {
  if (fromDay === toDay) return null;
  const source = week[fromDay] ?? [];
  const meal = source.find((m) => m.id === mealId);
  if (!meal) return null;
  if ((week[toDay] ?? []).length >= MAX_MEALS_PER_DAY) return null;
  const next = {
    ...week,
    [fromDay]: source.filter((m) => m.id !== mealId),
    [toDay]: [...(week[toDay] ?? []), meal],
  };
  if (next[fromDay].length === 0) delete next[fromDay];
  return next;
}
