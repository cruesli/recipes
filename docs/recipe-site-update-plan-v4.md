# Recipe Site Update Plan v4 — Kitchen Features Batch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five household features agreed in the July 2026 grilling session: pantry staples with a shopping-list footer, an A–Z ingredient index, an ingredient facet on `/recipes`, prep/cook/marinade time fields with a work-back "start by" line, tap-to-start step timers, LLM-linked inline ingredient amounts in steps, and a committed, positioned kitchen journal (margin notes) with an in-page annotate mode.

**Architecture:** Everything stays static-first. Staples and journal notes are committed content (`src/content/`), enrichment additions ride the existing offline ingest pipeline into `src/data/enriched/*.json`, and the only new runtime dependencies are the existing gated NL service (one new filter key) and Netlify Identity + git-gateway for the annotate mode (gated by a new `PUBLIC_ANNOTATE_ORIGIN` env var, hidden when unset). Pure logic goes in `src/lib/*.mjs` with node tests; backend logic gets pytest coverage.

**Tech Stack:** Astro 5 + React 19 islands, EB Garamond design system (tokens in `src/styles/global.css`), Python 3.11 ingest pipeline (OpenAI-compatible LLM client, Gemini default), Decap CMS (git-gateway via `mtrecipes.netlify.app`), GitHub Pages hosting at base `/recipes`.

**Conventions (from CLAUDE.md — binding):**
- One reviewable commit per task; `npm run build` must pass before every frontend commit.
- `npm test` = `node --test scripts/*.test.mjs`; backend tests: `pytest` from repo root (config in `backend/pyproject.toml`).
- `npm install --legacy-peer-deps` if node_modules is missing.
- Use `--text-*` / `--space-*` tokens, never literals, for font sizes and structural spacing. Oxblood is the only working accent; no borders/fills beyond the sanctioned oxblood plate; all-serif EB Garamond.
- Never hand-edit `src/data/enriched/*.json` (regenerate via `npm run ingest`) or `src/generated/silhouettes/`.

**Branch setup (before Task 1):**

```bash
git checkout -b feature/update-v4
git add docs/recipe-site-update-plan-v4.md
git commit -m "docs: add update plan v4 (kitchen features batch)"
```

---

## Phase A — Pantry staples

### Task 1: Staples content file + schemas

**Files:**
- Create: `src/content/meta/staples.json`
- Modify: `src/content/config.ts` (meta union)
- Modify: `public/admin/config.yml` (meta collection files)

- [ ] **Step 1: List the actual canonical names in the export** (staples must match canonicals exactly, lowercase)

```bash
python3 -c "
import json, glob
names = sorted({i['canonical'] for f in glob.glob('src/data/enriched/*.json')
                for i in json.load(open(f))['ingredients'] if i['canonical']})
print('\n'.join(names))"
```

- [ ] **Step 2: Create `src/content/meta/staples.json`** — start from this list, keeping only names that appeared in Step 1's output verbatim (drop any that don't; add other always-in-the-house canonicals that do):

```json
{
  "staples": [
    "salt",
    "black pepper",
    "neutral oil",
    "olive oil",
    "water",
    "sugar",
    "soy sauce"
  ]
}
```

- [ ] **Step 3: Extend the meta schema union** in `src/content/config.ts` — add a third member to the existing `z.union` (currently cuisines | country-regions):

```ts
    z.object({
      staples: z.array(z.string()),
    }),
```

- [ ] **Step 4: Add the Decap entry** in `public/admin/config.yml` under the `meta` collection's `files:` list (sibling of the Cuisines file):

```yaml
      - label: "Pantry staples"
        name: "staples"
        file: "src/content/meta/staples.json"
        format: "json"
        fields:
          - name: "staples"
            label: "Staples (canonical ingredient names, lowercase)"
            widget: "list"
            allow_add: true
            field: { name: "name", label: "Canonical name", widget: "string" }
```

- [ ] **Step 5: Build + commit**

```bash
npm run build   # Expected: completes with no schema errors
git add src/content/meta/staples.json src/content/config.ts public/admin/config.yml
git commit -m "feat: pantry staples content file + schema + CMS entry"
```

### Task 2: Staples partition in shoppingList.mjs (TDD)

**Files:**
- Modify: `src/lib/shoppingList.mjs`
- Test: `scripts/shoppingList.test.mjs`

- [ ] **Step 1: Write failing tests** — append to `scripts/shoppingList.test.mjs` (reuse the existing `item()` factory):

```js
test('staple canonicals divert from buckets to the staples list', () => {
  const view = buildShoppingView(
    [
      item({ canonical: 'salt', category: 'spices-seasonings', quantity: { amount: 30, unit: 'g' } }),
      item({ canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } }),
    ],
    DEFAULT_BUCKET_ORDER, undefined, ['salt']
  );
  assert.equal(view.buckets.length, 1);
  assert.equal(view.buckets[0].category, 'produce');
  assert.equal(view.staples.length, 1);
  assert.equal(view.staples[0].canonical, 'salt');
  assert.equal(view.staples[0].id, 'c:salt');
});

test('staples not in the plan are not listed; no staples param → empty list', () => {
  const view = buildShoppingView(
    [item({ canonical: 'onion', category: 'produce', quantity: { amount: 1, unit: 'count' } })],
    DEFAULT_BUCKET_ORDER, undefined, ['salt']
  );
  assert.equal(view.staples.length, 0);
  assert.equal(buildShoppingView([]).staples.length, 0);
});

test('degraded (un-enriched) lines are never treated as staples', () => {
  const view = buildShoppingView(
    [item({ canonical: null, text: 'salt', raw: 'salt' })],
    DEFAULT_BUCKET_ORDER, undefined, ['salt']
  );
  assert.equal(view.staples.length, 0);
  assert.equal(view.degraded.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
# Expected: new tests FAIL (view.staples is undefined)
```

- [ ] **Step 3: Implement** — in `src/lib/shoppingList.mjs`, change `buildShoppingView` to accept and apply a staples list:

```js
export function buildShoppingView(items, bucketOrder = DEFAULT_BUCKET_ORDER, days = WEEK, staples = []) {
  const stapleSet = new Set(staples.map((s) => s.toLowerCase()));
  const enriched = items.filter((i) => i.canonical);
  const degraded = items.filter((i) => !i.canonical);
  const merged = mergeEnriched(enriched, days);
  const stapleLines = merged.filter((l) => stapleSet.has(l.canonical.toLowerCase()));
  const bucketLines = merged.filter((l) => !stapleSet.has(l.canonical.toLowerCase()));
  return {
    buckets: buildBuckets(bucketLines, bucketOrder),
    staples: stapleLines,
    degraded: groupDegraded(degraded, days),
    hasEnriched: enriched.length > 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
# Expected: all tests PASS (existing tests unaffected — staples defaults to [])
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shoppingList.mjs scripts/shoppingList.test.mjs
git commit -m "feat: staples partition in shopping-list view model"
```

### Task 3: Planner wiring + pantry footer UI + txt export

**Files:**
- Modify: `src/components/usePlanner.ts`
- Modify: `src/components/MealPlannerIsland.tsx`

- [ ] **Step 1: Wire staples through `usePlanner`.** In `src/components/usePlanner.ts`:

Add the import (top of file):

```ts
import staplesMeta from '../content/meta/staples.json';
```

Extend `ShoppingView` (after `degraded`):

```ts
export interface ShoppingView {
  buckets: CategoryBucket[];
  staples: MergedLine[];
  degraded: DegradedDay[];
  hasEnriched: boolean;
}
```

Extend `ShoppingSession` and its loader — restocked staples are part of the shopping session (reset on regenerate, survive reloads):

```ts
interface ShoppingSession {
  items: ShoppingItem[];
  checked: string[];
  collapsed: string[];
  restocked: string[];
}
```

In `loadSession`, tolerate old sessions: after parsing, `return { ...s, restocked: Array.isArray(s.restocked) ? s.restocked : [] }` (keep the existing items-length guard).

Inside `usePlanner()` add state + logic:

```ts
const [restocked, setRestocked] = useState<string[]>([]);
```

- In the mount effect, after `setCollapsedBuckets(...)`: `setRestocked(session.restocked);`
- In the session-persist effect, include it: `saveSession({ items: shoppingList, checked: [...checkedIds], collapsed: [...collapsedBuckets], restocked });` (add `restocked` to the dep array).
- In `resetList()` and `generateList()`: `setRestocked([]);`
- Replace the `shoppingView` memo:

```ts
const effectiveStaples = useMemo(
  () => staplesMeta.staples.filter((s) => !restocked.includes(s)),
  [restocked]
);
const shoppingView = useMemo(
  () => buildShoppingView(shoppingList, bucketOrder, undefined, effectiveStaples) as ShoppingView,
  [shoppingList, bucketOrder, effectiveStaples]
);
```

- Add and return a toggle (restock = "we're out — put it on the list"):

```ts
function restockStaple(canonical: string) {
  setRestocked((prev) =>
    prev.includes(canonical) ? prev.filter((c) => c !== canonical) : [...prev, canonical]
  );
}
```

Return `restockStaple` from the hook.

- [ ] **Step 2: Pantry footer in `MealPlannerIsland.tsx`.** Destructure `restockStaple` from `usePlanner()`. Insert this block after the degraded-remainder `.map` and before the custom-meals note (i.e. right before the `{/* Note for custom meals */}` comment):

```tsx
{/* Pantry footer — staples assumed at home; tap one to put it on the list */}
{shoppingView.staples.length > 0 && (
  <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--space-md)' }}>
    <p style={{ fontFamily: SERIF, fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)', fontStyle: 'italic', margin: '0 0 var(--space-2xs)' }}>
      Assumed in the pantry — tap anything you're out of:
    </p>
    <p style={{ margin: 0, lineHeight: 1.8 }}>
      {shoppingView.staples.map((line, i) => (
        <span key={line.id}>
          {i > 0 && <span style={{ color: 'var(--color-ink-muted)' }}> · </span>}
          <button
            onClick={() => restockStaple(line.canonical)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: SERIF, fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)', textTransform: 'capitalize' }}
          >
            {line.canonical}
          </button>
        </span>
      ))}
    </p>
  </div>
)}
```

A tapped staple leaves this footer and appears in its normal category bucket (checkable like any line); tapping regenerate or editing the week resets the assumption.

- [ ] **Step 3: Mirror in the txt export.** In `usePlanner.ts` `downloadList()`, after the buckets loop and before the degraded loop:

```ts
if (shoppingView.staples.length > 0) {
  lines.push('', 'ASSUMED IN THE PANTRY', '─'.repeat(40));
  lines.push('  ' + shoppingView.staples.map((l) => l.canonical).join(' · '));
}
```

- [ ] **Step 4: Build + manual acceptance**

```bash
npm run build   # Expected: passes
npm run dev
```

On `/meal-planner`: plan a recipe using salt/oil → generate list → salt and oil sit in the muted footer, not the buckets; tap "salt" → it moves into Spices & seasonings; reload mid-session → footer state persists; regenerate → assumption resets; download `.txt` → pantry block present.

- [ ] **Step 5: Commit**

```bash
git add src/components/usePlanner.ts src/components/MealPlannerIsland.tsx
git commit -m "feat: pantry staples footer on the shopping list"
```

---

## Phase B — Ingredient index

### Task 4: Index builder (TDD)

**Files:**
- Create: `src/lib/ingredientIndex.mjs`
- Test: `scripts/ingredientIndex.test.mjs`

- [ ] **Step 1: Write failing tests** — create `scripts/ingredientIndex.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIngredientIndex } from '../src/lib/ingredientIndex.mjs';

const recipes = [
  { slug: 'carnitas', title: 'Carnitas', cuisine: 'mexican', canonicals: ['pork shoulder', 'orange', 'salt', 'orange'] },
  { slug: 'char-siu', title: 'Char siu', cuisine: 'chinese', canonicals: ['pork shoulder', 'orange'] },
  { slug: 'briam', title: 'Briam', cuisine: 'greek', canonicals: ['potato'] },
];

test('groups A–Z, sorts entries and recipes, dedupes per recipe', () => {
  const groups = buildIngredientIndex(recipes, ['salt']);
  assert.deepEqual(groups.map((g) => g.letter), ['O', 'P']);
  const o = groups[0];
  assert.equal(o.entries.length, 1);
  assert.equal(o.entries[0].canonical, 'orange');
  // sorted by title, deduped (carnitas lists orange twice in input)
  assert.deepEqual(o.entries[0].recipes.map((r) => r.slug), ['carnitas', 'char-siu']);
  const p = groups[1];
  assert.deepEqual(p.entries.map((e) => e.canonical), ['pork shoulder', 'potato']);
});

test('staples are excluded case-insensitively', () => {
  const groups = buildIngredientIndex(recipes, ['Salt']);
  assert.ok(!groups.some((g) => g.entries.some((e) => e.canonical === 'salt')));
});

test('empty input → empty index', () => {
  assert.deepEqual(buildIngredientIndex([]), []);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test
# Expected: FAIL — Cannot find module ingredientIndex.mjs
```

- [ ] **Step 3: Implement** — create `src/lib/ingredientIndex.mjs`:

```js
// Back-of-book ingredient index: canonical → recipes, A–Z groups, staples
// excluded (they appear on every page and have the pantry footer). Pure.

export function buildIngredientIndex(recipes, staples = []) {
  const stapleSet = new Set(staples.map((s) => s.toLowerCase()));
  const byCanonical = new Map(); // canonical → [{slug, title, cuisine}]
  for (const r of recipes) {
    for (const c of new Set(r.canonicals ?? [])) {
      if (!c || stapleSet.has(c.toLowerCase())) continue;
      if (!byCanonical.has(c)) byCanonical.set(c, []);
      byCanonical.get(c).push({ slug: r.slug, title: r.title, cuisine: r.cuisine });
    }
  }
  const sorted = [...byCanonical.entries()].sort(([a], [b]) => a.localeCompare(b, 'en'));
  const groups = [];
  for (const [canonical, recs] of sorted) {
    const letter = canonical[0].toUpperCase();
    let group = groups[groups.length - 1];
    if (!group || group.letter !== letter) {
      group = { letter, entries: [] };
      groups.push(group);
    }
    recs.sort((x, y) => x.title.localeCompare(y.title, 'en'));
    group.entries.push({ canonical, recipes: recs });
  }
  return groups;
}
```

- [ ] **Step 4: Run tests + build, then commit**

```bash
npm test          # Expected: PASS
npm run build     # Expected: passes
git add src/lib/ingredientIndex.mjs scripts/ingredientIndex.test.mjs
git commit -m "feat: ingredient-index builder"
```

### Task 5: `/ingredients` page + links

**Files:**
- Create: `src/pages/ingredients.astro`
- Modify: `src/layouts/BaseLayout.astro` (footer)
- Modify: `src/components/CollectionPlannerIsland.tsx` (masthead link)

- [ ] **Step 1: Create `src/pages/ingredients.astro`** — static, no island:

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
import { getCollection } from "astro:content";
import { getEnriched } from "../lib/enrichment";
import { buildIngredientIndex } from "../lib/ingredientIndex.mjs";
import staplesMeta from "../content/meta/staples.json";

const recipes = await getCollection("recipes");
const indexInput = recipes.map((r) => ({
  slug: r.slug,
  title: r.data.title,
  cuisine: r.data.cuisine,
  canonicals: (getEnriched(r.slug)?.ingredients ?? [])
    .map((i) => i.canonical)
    .filter((c): c is string => c !== null),
}));
const groups = buildIngredientIndex(indexInput, staplesMeta.staples);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
---

<BaseLayout title="Ingredient index">
  <div style="max-width: 720px; margin: 0 auto; padding: calc(60px + var(--space-2xl)) var(--space-lg) var(--space-4xl);">
    <div class="section-tick"></div>
    <p style="font-family: 'EB Garamond', Georgia, serif; font-weight: 600; font-size: var(--text-eyebrow); text-transform: uppercase; letter-spacing: 0.24em; color: var(--color-oxblood); margin: 0 0 var(--space-xs);">
      The index
    </p>
    <h1 style="font-family: 'EB Garamond', Georgia, serif; font-size: var(--text-section); font-weight: 500; color: var(--color-ink); margin: 0 0 var(--space-2xl);">
      Ingredients
    </h1>

    {groups.map((group) => (
      <section style="margin-bottom: var(--space-xl);">
        <p style="font-family: 'EB Garamond', Georgia, serif; font-weight: 600; font-size: var(--text-eyebrow); text-transform: uppercase; letter-spacing: 0.24em; color: var(--color-oxblood); margin: 0 0 var(--space-xs);">
          {group.letter}
        </p>
        <hr style="border: none; border-top: 1px solid var(--color-hairline); margin: 0 0 var(--space-sm);" />
        {group.entries.map((entry) => (
          <p style="font-family: 'EB Garamond', Georgia, serif; font-size: var(--text-body); color: var(--color-ink); margin: 0 0 var(--space-2xs); line-height: 1.6;">
            <span style="text-transform: capitalize;">{entry.canonical}</span>
            <span style="color: var(--color-ink-muted);"> — </span>
            {entry.recipes.map((r, i) => (
              <>
                {i > 0 && <span style="color: var(--color-ink-muted);"> · </span>}
                <a href={`${basePath}/recipes/${r.slug}`} style="color: var(--color-oxblood); text-decoration: none;">{r.title}</a>
              </>
            ))}
          </p>
        ))}
      </section>
    ))}
  </div>
</BaseLayout>
```

(The `calc(60px + …)` top padding clears the fixed 60px header, matching the recipe page's `paddingTop: '60px'` convention.)

- [ ] **Step 2: Footer link.** In `src/layouts/BaseLayout.astro`, in the footer nav after the About link:

```astro
        <span aria-hidden="true">·</span>
        <a href={withBase("/ingredients")}>Index</a>
```

- [ ] **Step 3: Collection masthead link.** In `CollectionPlannerIsland.tsx`, in the recipe-count `<p>` (the one reading `{collectionRecipes.length} recipe…`), append inside the `<p>`, after the preview-limit fragment — only on the full collection page:

```tsx
{facets && (
  <> · <a href={`${basePath}/ingredients`} style={{ color: 'var(--color-oxblood)', textDecoration: 'none' }}>ingredient index</a></>
)}
```

- [ ] **Step 4: Build + acceptance, then commit**

```bash
npm run build   # Expected: /ingredients emitted
npm run preview
```

Open `/recipes/ingredients/` (note the `/recipes` base): A–Z groups render, staples absent, links navigate; footer "Index" link present on all pages.

```bash
git add src/pages/ingredients.astro src/layouts/BaseLayout.astro src/components/CollectionPlannerIsland.tsx
git commit -m "feat: A–Z ingredient index page + links"
```

---

## Phase C — Ingredient facet on /recipes

### Task 6: Facet matching + NL mapping (TDD)

**Files:**
- Modify: `src/lib/recipeFilter.mjs`
- Test: `scripts/recipeFilter.test.mjs`

- [ ] **Step 1: Write failing tests** — append to `scripts/recipeFilter.test.mjs`:

```js
test('ingredient facet: substring match against canonicals', () => {
  const r = { title: 'Carnitas', cuisine: 'mexican', canonicals: ['pork shoulder', 'orange'] };
  assert.ok(matchesFacets(r, { ingredient: 'pork' }));
  assert.ok(matchesFacets(r, { ingredient: 'Pork Shoulder' }));
  assert.ok(!matchesFacets(r, { ingredient: 'chicken' }));
});

test('ingredient facet: recipes without canonicals fail the filter', () => {
  const r = { title: 'Custom', cuisine: 'norwegian' };
  assert.ok(!matchesFacets(r, { ingredient: 'pork' }));
  assert.ok(matchesFacets(r, {}));
});

test('extractedToFacets maps ingredient', () => {
  assert.deepEqual(extractedToFacets({ ingredient: 'pork shoulder' }), { ingredient: 'pork shoulder' });
  assert.deepEqual(extractedToFacets({ ingredient: 7 }), {});
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → new assertions FAIL.

- [ ] **Step 3: Implement** in `src/lib/recipeFilter.mjs`. In `matchesFacets`, after the cuisine check:

```js
  if (f.ingredient) {
    const q = f.ingredient.toLowerCase();
    if (!(recipe.canonicals ?? []).some((c) => c.toLowerCase().includes(q))) return false;
  }
```

In `extractedToFacets`, after the cuisine line:

```js
  if (typeof filters.ingredient === 'string') out.ingredient = filters.ingredient;
```

Update the doc comments at the top of both functions to mention `canonicals[]` / `ingredient`.

- [ ] **Step 4: Run tests, commit**

```bash
npm test    # Expected: PASS
git add src/lib/recipeFilter.mjs scripts/recipeFilter.test.mjs
git commit -m "feat: ingredient facet matching + NL mapping"
```

### Task 7: Facet data + UI

**Files:**
- Modify: `src/pages/recipes/index.astro`
- Modify: `src/components/usePlanner.ts` (`RecipeData`)
- Modify: `src/components/CollectionPlannerIsland.tsx`

- [ ] **Step 1: Ship canonicals to the island.** In `src/components/usePlanner.ts`, extend `RecipeData`'s facet block:

```ts
  // Facet fields (only populated on /recipes; undefined elsewhere)
  dietary?: string[];
  kcalPerServing?: number | null;
  proteinPerServing?: number | null;
  canonicals?: string[];
```

In `src/pages/recipes/index.astro`, inside the `allRecipes` map (the enriched lookup is already there — reuse it):

```ts
const allRecipes = recipes.map((r) => {
  const e = getEnriched(r.slug);
  const n = e?.nutritionPerServing ?? null;
  return {
    // …existing fields unchanged…
    kcalPerServing: n?.kcal ?? null,
    proteinPerServing: n?.proteinG ?? null,
    canonicals: [...new Set((e?.ingredients ?? []).map((i) => i.canonical).filter((c): c is string => c !== null))],
  };
});
```

- [ ] **Step 2: Facet control.** In `CollectionPlannerIsland.tsx`:

Add state next to the other facet state: `const [ingredient, setIngredient] = useState('');`

Include it in `facetState` (`ingredient: ingredient || null`), in `clearFacets()` (`setIngredient('')`), in `facetsActive` (`|| ingredient !== ''`), and in `runNlSearch`'s facet application (`if (f.ingredient) setIngredient(f.ingredient);`).

In the facet-controls row (after the Min protein label), add:

```tsx
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
```

- [ ] **Step 3: Build + acceptance, commit**

```bash
npm run build && npm run preview
```

On `/recipes`: type "pork" in **With** → only pork recipes remain; combines with Max time; Clear resets it; datalist suggests canonical names.

```bash
git add src/pages/recipes/index.astro src/components/usePlanner.ts src/components/CollectionPlannerIsland.tsx
git commit -m "feat: ingredient facet on the collection page"
```

---

## Phase D — Time fields + start-by line

### Task 8: Marinade schema + work-back helper (TDD)

**Files:**
- Modify: `src/content/config.ts`, `public/admin/config.yml`
- Modify: `src/lib/recipeTime.mjs`
- Test: `scripts/recipeTime.test.mjs`

- [ ] **Step 1: Failing tests** — append to `scripts/recipeTime.test.mjs`:

```js
test('workBack: start = target − (prep + cook)', () => {
  assert.deepEqual(
    workBack(18 * 60, { prepTimeMinutes: 30, cookTimeMinutes: 180 }),
    { startBy: 14 * 60 + 30, marinadeFrom: null }
  );
});

test('workBack: marinade precedes the start', () => {
  const r = workBack(18 * 60, { prepTimeMinutes: 20, cookTimeMinutes: 40, marinadeTimeMinutes: 480 });
  assert.equal(r.startBy, 17 * 60);
  assert.equal(r.marinadeFrom, 9 * 60);
});

test('workBack: null without target or active time; negative start allowed', () => {
  assert.equal(workBack(null, { prepTimeMinutes: 10 }), null);
  assert.equal(workBack(18 * 60, {}), null);
  assert.equal(workBack(60, { cookTimeMinutes: 120 }).startBy, -60);
});

test('formatClock wraps the day', () => {
  assert.equal(formatClock(14 * 60 + 30), '14:30');
  assert.equal(formatClock(-60), '23:00');
  assert.equal(formatClock(0), '00:00');
});
```

(Add `workBack, formatClock` to the import at the top of the test file.)

- [ ] **Step 2: Run** — `npm test` → FAIL (not exported).

- [ ] **Step 3: Implement** — append to `src/lib/recipeTime.mjs`:

```js
// Work-back schedule: minutes-of-day for "on the table at" → "start by".
// Marinade is do-ahead time before the active prep+cook block. Negative
// values mean "the day before" — formatting/labelling is the caller's job.
export function workBack(targetMinutes, { prepTimeMinutes, cookTimeMinutes, marinadeTimeMinutes } = {}) {
  const active = (prepTimeMinutes ?? 0) + (cookTimeMinutes ?? 0);
  if (targetMinutes == null || active <= 0) return null;
  const startBy = targetMinutes - active;
  return {
    startBy,
    marinadeFrom: marinadeTimeMinutes ? startBy - marinadeTimeMinutes : null,
  };
}

export function formatClock(minutes) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Schema + CMS.** In `src/content/config.ts` after `cookTimeMinutes`:

```ts
    // Do-ahead soak (half the collection marinates); excluded from active time
    marinadeTimeMinutes: z.number().int().nonnegative().optional(),
```

In `public/admin/config.yml` after the Cook time field:

```yaml
      - { name: "marinadeTimeMinutes", label: "Marinade time (minutes)", widget: "number", value_type: "int", required: false, min: 0, hint: "Do-ahead soak; 480 for overnight." }
```

- [ ] **Step 5: Test + build + commit**

```bash
npm test && npm run build    # Expected: both pass
git add src/lib/recipeTime.mjs scripts/recipeTime.test.mjs src/content/config.ts public/admin/config.yml
git commit -m "feat: marinade time field + work-back schedule helper"
```

### Task 9: Backfill time frontmatter

**Files:**
- Modify: 6 files in `src/content/recipes/` (prep/cook), plus marinade fields where the body instructs a soak.

- [ ] **Step 1: Split the total-only recipes.** Replace `totalTimeMinutes` with a prep/cook split (sum preserved; `deriveTotalTime` then derives the same total). Sanity-check each split against the recipe body and adjust if it clearly disagrees:

| File | Old | New |
|---|---|---|
| `carnitas.md` | `totalTimeMinutes: 300` | `prepTimeMinutes: 30`, `cookTimeMinutes: 270` |
| `pasta-bolognese.md` | `totalTimeMinutes: 120` | `prepTimeMinutes: 20`, `cookTimeMinutes: 100` |
| `lebanese-chicken-hummus-and-grilled-vegetables.md` | `totalTimeMinutes: 20` | `prepTimeMinutes: 10`, `cookTimeMinutes: 10` |
| `pytt-i-panne.md` | `totalTimeMinutes: 15` | `prepTimeMinutes: 5`, `cookTimeMinutes: 10` |
| `tahini-chicken-with-butternut-hummus-and-bulgur-salad.md` | `totalTimeMinutes: 40` | `prepTimeMinutes: 15`, `cookTimeMinutes: 25` |
| `Pork-chops-with-chimichurri-and-grilled-pepper-salad.md` | *(none)* | `prepTimeMinutes: 15`, `cookTimeMinutes: 25` (verify against body) |

- [ ] **Step 2: Marinade pass.** For each of these candidates (they mention marinating/overnight): `char-siu.md`, `carne-asada-tacos.md`, `souvlaki.md`, `teriyaki-chicken.md`, `chicken-fajitas.md`, `gongbao-chicken.md`, `lebanese-chicken-hummus-and-grilled-vegetables.md`, `tahini-chicken-with-butternut-hummus-and-bulgur-salad.md`, `briam.md`, `Pork-chops-with-chimichurri-and-grilled-pepper-salad.md` — read the body and add `marinadeTimeMinutes` **only when the body instructs marinating before cooking begins** (a rest during/after cooking does not count). Value = the stated time; a range → the lower bound; "overnight" → 480.

- [ ] **Step 3: Build + spot-check + commit**

```bash
npm run build   # Expected: passes; recipe cards still show the same derived totals
git add src/content/recipes/
git commit -m "content: split prep/cook times + marinade backfill"
```

### Task 10: Metadata bar + start-by line

**Files:**
- Modify: `src/pages/recipes/[slug].astro`
- Modify: `src/components/RecipePageIsland.tsx`

- [ ] **Step 1: Pass the raw fields.** In `[slug].astro`, add props to the island (keep `totalTimeMinutes={deriveTotalTime(d)}` as-is):

```astro
    prepTimeMinutes={d.prepTimeMinutes ?? null}
    cookTimeMinutes={d.cookTimeMinutes ?? null}
    marinadeTimeMinutes={d.marinadeTimeMinutes ?? null}
```

- [ ] **Step 2: Island props + metadata bar.** In `RecipePageIsland.tsx` add to `RecipePageProps` and the destructuring:

```ts
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  marinadeTimeMinutes: number | null;
```

Add a shared minute formatter next to the existing `timeLabel` logic and use it for all three:

```ts
const fmtMin = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim() : `${m} min`;
```

In the metadata bar, replace the single `{timeLabel && <MetaItem label="Total time" …/>}` with:

```tsx
{prepTimeMinutes != null && <MetaItem label="Prep" value={fmtMin(prepTimeMinutes)} />}
{cookTimeMinutes != null && <MetaItem label="Cook" value={fmtMin(cookTimeMinutes)} />}
{prepTimeMinutes == null && cookTimeMinutes == null && timeLabel && (
  <MetaItem label="Total time" value={timeLabel} />
)}
{marinadeTimeMinutes != null && <MetaItem label="Marinade" value={fmtMin(marinadeTimeMinutes)} />}
```

- [ ] **Step 3: Start-by line.** Import `{ workBack, formatClock }` from `../lib/recipeTime.mjs`. Add state `const [targetTime, setTargetTime] = useState('18:00');` and, in the content container directly above the headnote block:

```tsx
{/* Work-back schedule — one calm line under the metadata bar */}
{(() => {
  const [h, m] = targetTime.split(':').map(Number);
  const plan = workBack(h * 60 + m, { prepTimeMinutes, cookTimeMinutes, marinadeTimeMinutes });
  if (!plan) return null;
  return (
    <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-body)', color: 'var(--color-ink)', margin: '0 0 var(--space-2xl)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--color-ink-muted)' }}>On the table at</span>
      <input
        type="time"
        value={targetTime}
        onChange={(e) => e.target.value && setTargetTime(e.target.value)}
        className="onum"
        style={{ border: 'none', borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'transparent', color: 'var(--color-oxblood)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-body)', padding: '0 2px', outline: 'none' }}
      />
      <span style={{ color: 'var(--color-ink-muted)' }}>—</span>
      {plan.marinadeFrom != null && (
        <span>
          marinate from <span className="onum">{plan.marinadeFrom < 0 ? 'the evening before' : formatClock(plan.marinadeFrom)}</span>,
        </span>
      )}
      <span>start cooking by <span className="onum" style={{ fontWeight: 500 }}>{formatClock(plan.startBy)}</span>{plan.startBy < 0 ? ' the day before' : ''}.</span>
    </p>
  );
})()}
```

- [ ] **Step 4: Build + acceptance, commit**

```bash
npm run build && npm run dev
```

Carnitas: metadata shows Prep 30 min · Cook 4 h 30 min; line reads "On the table at 18:00 — start cooking by 13:00." Changing the time updates it. Char siu (if marinade added): the marinate-from clause appears; small targets flip to "the evening before". Recipes with only a total (none left after Task 9, but custom future ones) fall back to the Total time item and hide the line only when prep+cook are absent.

```bash
git add "src/pages/recipes/[slug].astro" src/components/RecipePageIsland.tsx
git commit -m "feat: prep/cook/marinade metadata + work-back start-by line"
```

---

## Phase E — Step timers

### Task 11: Duration detection + step segmenting (TDD)

**Files:**
- Create: `src/lib/stepTimers.mjs`, `src/lib/stepAnnotations.mjs`
- Test: `scripts/stepTimers.test.mjs`, `scripts/stepAnnotations.test.mjs`

- [ ] **Step 1: Failing tests** — create `scripts/stepTimers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDurations } from '../src/lib/stepTimers.mjs';

test('finds explicit durations in hours and minutes', () => {
  assert.deepEqual(
    findDurations('let cook for at least 3 hours').map((d) => d.minutes), [180]);
  assert.deepEqual(findDurations('simmer 10 min, then rest').map((d) => d.minutes), [10]);
  assert.deepEqual(findDurations('1.5 hours in the oven').map((d) => d.minutes), [90]);
});

test('ranges start at the lower bound', () => {
  assert.deepEqual(findDurations('fry 2-3 minutes per side').map((d) => d.minutes), [2]);
  assert.deepEqual(findDurations('roast 3–4 hours').map((d) => d.minutes), [180]);
});

test('offsets and label cover the whole match', () => {
  const [d] = findDurations('bake for 20 minutes until golden');
  assert.equal(d.label, '20 minutes');
  assert.equal('bake for 20 minutes until golden'.slice(d.start, d.end), '20 minutes');
});

test('ignores numbers without duration units', () => {
  assert.deepEqual(findDurations('a 160 deg oven, 2-3 cm cubes, step 5'), []);
});

test('unit must end at a word boundary', () => {
  assert.deepEqual(findDurations('5 minor adjustments to the hrsx dial'), []);
});
```

And `scripts/stepAnnotations.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStepSegments } from '../src/lib/stepAnnotations.mjs';

const ingredients = [
  { raw: '30g salt', quantity: { amount: 30, unit: 'g' } },
  { raw: 'Roughly 500ml Water', quantity: { amount: 500, unit: 'ml' } },
  { raw: 'Neutral oil', quantity: null },
];

test('plain text → single text segment; reassembles to the original', () => {
  const segs = buildStepSegments('Cut pork into cubes');
  assert.deepEqual(segs, [{ type: 'text', text: 'Cut pork into cubes' }]);
});

test('timer segment splits the text', () => {
  const segs = buildStepSegments('cook for 3 hours in the oven');
  assert.deepEqual(segs.map((s) => s.type), ['text', 'timer', 'text']);
  assert.equal(segs[1].minutes, 180);
  assert.equal(segs.map((s) => s.text).join(''), 'cook for 3 hours in the oven');
});

test('amount inserted after the phrase, scaled by ratio', () => {
  const segs = buildStepSegments('Add the salt and water', {
    refs: [{ line: 0, phrase: 'salt' }, { line: 1, phrase: 'water' }],
    ingredients, ratio: 2,
  });
  assert.equal(
    segs.map((s) => s.text).join(''),
    'Add the salt (60 g) and water (1000 ml)'
  );
  assert.equal(segs.filter((s) => s.type === 'amount').length, 2);
});

test('refs without quantity or with missing phrase are skipped', () => {
  const segs = buildStepSegments('Add oil and mystery', {
    refs: [{ line: 2, phrase: 'oil' }, { line: 0, phrase: 'absent' }],
    ingredients,
  });
  assert.deepEqual(segs, [{ type: 'text', text: 'Add oil and mystery' }]);
});

test('timers and amounts coexist in order', () => {
  const segs = buildStepSegments('Add the salt then simmer 10 min', {
    refs: [{ line: 0, phrase: 'salt' }], ingredients,
  });
  assert.deepEqual(segs.map((s) => s.type), ['text', 'amount', 'text', 'timer']);
});
```

- [ ] **Step 2: Run** — `npm test` → both files FAIL (modules missing).

- [ ] **Step 3: Implement.** Create `src/lib/stepTimers.mjs`:

```js
// Explicit-duration detection in step prose ("3 hours", "2-3 min"). Ranges
// start at the lower bound (check early; adding time is easy). Pure.

const DURATION_RE =
  /(\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/gi;

export function findDurations(text) {
  const out = [];
  for (const m of text.matchAll(DURATION_RE)) {
    const value = parseFloat(m[1].replace(',', '.'));
    const isHours = m[3].toLowerCase().startsWith('h');
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      label: m[0],
      minutes: Math.round(value * (isHours ? 60 : 1)),
    });
  }
  return out;
}
```

Create `src/lib/stepAnnotations.mjs`:

```js
// Step text → ordered segments: plain text, tappable timers, and inline
// scaled amounts inserted after LLM-linked ingredient phrases. Pure.

import { findDurations } from './stepTimers.mjs';
import { formatPart } from './shoppingList.mjs';

export function buildStepSegments(text, { refs = null, ingredients = null, ratio = 1 } = {}) {
  const timers = findDurations(text);
  const inserts = [];
  if (refs && ingredients) {
    for (const ref of refs) {
      const quantity = ingredients[ref.line]?.quantity;
      if (!quantity) continue;
      const idx = text.toLowerCase().indexOf(ref.phrase.toLowerCase());
      if (idx === -1) continue;
      inserts.push({ pos: idx + ref.phrase.length, text: ` (${formatPart(quantity.amount * ratio, quantity.unit)})` });
    }
  }
  // Merge timer spans and zero-width amount insertions into ordered segments
  const events = [
    ...timers.map((t) => ({ kind: 'timer', at: t.start, t })),
    ...inserts.map((i) => ({ kind: 'amount', at: i.pos, i })),
  ].sort((a, b) => a.at - b.at || (a.kind === 'amount' ? -1 : 1));
  const segs = [];
  let cursor = 0;
  for (const ev of events) {
    if (ev.at < cursor) continue; // overlap guard
    if (ev.at > cursor) segs.push({ type: 'text', text: text.slice(cursor, ev.at) });
    if (ev.kind === 'timer') {
      segs.push({ type: 'timer', text: text.slice(ev.t.start, ev.t.end), minutes: ev.t.minutes });
      cursor = ev.t.end;
    } else {
      segs.push({ type: 'amount', text: ev.i.text });
      cursor = ev.at;
    }
  }
  if (cursor < text.length) segs.push({ type: 'text', text: text.slice(cursor) });
  return segs;
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test    # Expected: PASS
git add src/lib/stepTimers.mjs src/lib/stepAnnotations.mjs scripts/stepTimers.test.mjs scripts/stepAnnotations.test.mjs
git commit -m "feat: duration detection + step segment builder"
```

### Task 12: Timer UI — tappable durations, persistence, chime

**Files:**
- Modify: `src/components/RecipePageIsland.tsx`
- Modify: `src/pages/recipes/[slug].astro` (pass `slug`)

- [ ] **Step 1: Pass the slug.** `[slug].astro`: add `slug={recipe.slug}` to the island; add `slug: string;` to `RecipePageProps` and destructure it.

- [ ] **Step 2: Timer state + persistence** in `RecipePageIsland.tsx`:

```ts
import { buildStepSegments } from '../lib/stepAnnotations.mjs';

interface StepTimer {
  id: string;        // `${slug}:${stepIndex}:${segIndex}`
  slug: string;
  stepIndex: number;
  label: string;
  endsAt: number;    // epoch ms
  minutes: number;
  chimed?: boolean;
}

const TIMERS_KEY = 'recipes:timers';

function loadTimers(slug: string): StepTimer[] {
  try {
    const all = JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]') as StepTimer[];
    // keep this recipe's timers; drop anything finished over an hour ago
    return all.filter((t) => t.slug === slug && t.endsAt > Date.now() - 3_600_000);
  } catch { return []; }
}

function saveTimers(slug: string, timers: StepTimer[]) {
  try {
    const others = (JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]') as StepTimer[])
      .filter((t) => t.slug !== slug);
    localStorage.setItem(TIMERS_KEY, JSON.stringify([...others, ...timers]));
  } catch {}
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 1174 : 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.32);
    });
  } catch {}
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}
```

Component state + effects:

```ts
const [timers, setTimers] = useState<StepTimer[]>([]);
const [now, setNow] = useState(() => Date.now());

useEffect(() => { setTimers(loadTimers(slug)); }, [slug]);
useEffect(() => { saveTimers(slug, timers); }, [slug, timers]);

// 1s tick while any timer runs; chime once per timer on completion
useEffect(() => {
  if (timers.length === 0) return;
  const iv = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(iv);
}, [timers.length]);

useEffect(() => {
  const due = timers.filter((t) => !t.chimed && t.endsAt <= now);
  if (due.length === 0) return;
  chime();
  setTimers((prev) => prev.map((t) => (t.endsAt <= now ? { ...t, chimed: true } : t)));
}, [now, timers]);

function toggleTimer(id: string, stepIndex: number, label: string, minutes: number) {
  setTimers((prev) => {
    const existing = prev.find((t) => t.id === id);
    if (existing) return prev.filter((t) => t.id !== id); // tap again = clear
    return [...prev, { id, slug, stepIndex, label, minutes, endsAt: Date.now() + minutes * 60_000 }];
  });
}
```

- [ ] **Step 3: Render segments.** Replace the step `<p …>{step}</p>` body with a segment renderer (keep the surrounding `<li>`/check-off intact). Add above the `return`:

```tsx
const stepSegments = steps.map((step) => buildStepSegments(step));
```

(The `refs`/`ingredients` options join in Phase F.) In the step `<p>`, replace `{step}` with:

```tsx
{stepSegments[i].map((seg, si) => {
  if (seg.type !== 'timer') return <span key={si}>{seg.text}</span>;
  const id = `${slug}:${i}:${si}`;
  const running = timers.find((t) => t.id === id);
  const remaining = running ? running.endsAt - now : 0;
  return (
    <button
      key={si}
      onClick={() => toggleTimer(id, i, seg.text, seg.minutes)}
      title={running ? 'Tap to clear the timer' : `Start a ${seg.text} timer`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'inherit', lineHeight: 'inherit',
        color: 'var(--color-oxblood)',
        borderBottom: running ? 'none' : '1px dotted var(--color-oxblood)',
      }}
    >
      {seg.text}
      {running && (
        <span className="onum" style={{ marginLeft: '0.4em', fontWeight: 500 }}>
          {remaining > 0 ? `· ${fmtCountdown(remaining)}` : '· done'}
        </span>
      )}
    </button>
  );
})}
```

When a timer hits zero, its step's number circle pulses: give the step-number `<button>` a conditional `className="rp-step-due"` when `timers.some((t) => t.stepIndex === i && t.endsAt <= now)`, and add a `<style>` block in the component root:

```tsx
<style>{`
  @keyframes rp-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(94,22,25,0.5); } 50% { box-shadow: 0 0 0 6px rgba(94,22,25,0); } }
  .rp-step-due { animation: rp-pulse 1.2s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .rp-step-due { animation: none; } }
`}</style>
```

(If `--color-oxblood` isn't `#5E1619`, take the actual rgb from `src/styles/global.css` for the shadow.)

- [ ] **Step 4: Build + acceptance, commit**

```bash
npm run build && npm run dev
```

Carnitas step 9: "3 hours" renders oxblood-dotted; tap → countdown appears and ticks; reload → still running; second concurrent timer on another step works; tap a running timer → cleared; on completion the chime sounds (if the tab was open) and the step number pulses; reduced-motion disables the pulse.

```bash
git add src/components/RecipePageIsland.tsx "src/pages/recipes/[slug].astro"
git commit -m "feat: tappable persistent step timers with chime"
```

---

## Phase F — Inline amounts (backend step linking)

### Task 13: `parse_steps` + step linker (TDD)

**Files:**
- Modify: `backend/parser.py`
- Create: `backend/step_linker.py`
- Test: `backend/tests/test_step_linker.py`

- [ ] **Step 1: Failing tests** — create `backend/tests/test_step_linker.py` (mirror the `MagicMock` client pattern from `test_normaliser.py`):

```python
import json
from unittest.mock import MagicMock

from backend.parser import parse_steps
from backend.step_linker import link_steps


def _mock_client(response_text: str) -> MagicMock:
    client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = response_text
    client.chat.completions.create.return_value = mock_resp
    return client


STEPS = ["Cut pork into cubes", "Add the salt and water"]
INGREDIENTS = ["2.5 kg Pork shoulder", "30g salt", "Roughly 500ml Water"]


def test_parse_steps_mirrors_frontend_split():
    body = "1. First step\n\n2. Second step\n continued line"
    assert parse_steps(body) == ["First step", "Second step\n continued line"]
    assert parse_steps("") == []


def test_valid_links_pass_through():
    links = json.dumps([
        [{"line": 0, "phrase": "pork"}],
        [{"line": 1, "phrase": "salt"}, {"line": 2, "phrase": "water"}],
    ])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[0] == [{"line": 0, "phrase": "pork"}]
    assert [r["line"] for r in result[1]] == [1, 2]


def test_invalid_refs_dropped():
    links = json.dumps([
        [{"line": 99, "phrase": "pork"}, {"line": 0, "phrase": "not in step"}],
        [{"line": 1, "phrase": "salt"}, {"line": 1, "phrase": "salt"}],
    ])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[0] == []                      # out of range + phrase mismatch
    assert result[1] == [{"line": 1, "phrase": "salt"}]  # deduped by line


def test_wrong_length_padded_or_truncated():
    result = link_steps(INGREDIENTS, STEPS, _mock_client(json.dumps([[]])))
    assert len(result) == 2
    result = link_steps(INGREDIENTS, STEPS, _mock_client(json.dumps([[], [], []])))
    assert len(result) == 2
```

- [ ] **Step 2: Run** — `cd backend && pytest tests/test_step_linker.py -v` → FAIL (imports missing). (Or `pytest` from repo root if that's how the repo runs it — `backend/pyproject.toml` holds the config.)

- [ ] **Step 3: Implement.** In `backend/parser.py` add (module level; ensure `import re` and `from typing import List` are present — add them if the file doesn't already have them):

```python
_STEP_SPLIT = re.compile(r"\n(?=\d+\.)")
_STEP_PREFIX = re.compile(r"^\d+\.\s*")


def parse_steps(body: str) -> List[str]:
    """Numbered steps from a recipe body — MUST mirror the frontend split in
    src/pages/recipes/[slug].astro exactly, or exported refs misalign."""
    return [s for s in (_STEP_PREFIX.sub("", c).strip() for c in _STEP_SPLIT.split(body)) if s]
```

Create `backend/step_linker.py`:

```python
"""LLM step→ingredient linking for inline amounts (cook mode).

Maps each recipe step to the ingredient lines it mentions, with the verbatim
phrase used, so the frontend can render scaled amounts inline in the prose.
Validation is strict: bad line indices or phrases not present in the step are
dropped — a missing ref degrades to plain text, never to a wrong amount.
"""

import json
from typing import Any, Dict, List

import openai

from backend.normaliser import _parse_response, get_model

_SYSTEM_PROMPT = (
    "You link recipe steps to the ingredient lines they mention.\n"
    "Input: a numbered INGREDIENTS list (0-indexed), then numbered STEPS (0-indexed).\n"
    "Return a JSON array with EXACTLY one element per step. Each element is an array of "
    '{"line": <ingredient index>, "phrase": "<words copied verbatim from the step>"} objects.\n'
    "Rules:\n"
    "- \"phrase\" MUST be a verbatim substring of that step naming the ingredient "
    "(the shortest natural span, e.g. \"salt\" or \"the pork\").\n"
    "- Only link ingredients actually used or added in that step; use [] when none are.\n"
    "- At most one ref per ingredient line per step.\n"
    "Reply with only the JSON array, no markdown fencing."
)


def link_steps(
    ingredients: List[str], steps: List[str], client: openai.OpenAI
) -> List[List[Dict[str, Any]]]:
    if not steps:
        return []
    user = "INGREDIENTS:\n" + "\n".join(f"{i}: {ing}" for i, ing in enumerate(ingredients))
    user += "\n\nSTEPS:\n" + "\n".join(f"{i}: {s}" for i, s in enumerate(steps))
    response = client.chat.completions.create(
        model=get_model(),
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    )
    raw = _parse_response(response.choices[0].message.content.strip())
    if not isinstance(raw, list):
        raw = []
    # align length, then validate each ref
    raw = (raw + [[] for _ in steps])[: len(steps)]
    result: List[List[Dict[str, Any]]] = []
    for step_text, refs in zip(steps, raw):
        seen: set = set()
        clean: List[Dict[str, Any]] = []
        for ref in refs if isinstance(refs, list) else []:
            if not isinstance(ref, dict):
                continue
            line, phrase = ref.get("line"), ref.get("phrase")
            if not isinstance(line, int) or not (0 <= line < len(ingredients)):
                continue
            if not isinstance(phrase, str) or phrase.lower() not in step_text.lower():
                continue
            if line in seen:
                continue
            seen.add(line)
            clean.append({"line": line, "phrase": phrase})
        result.append(clean)
    return result
```

- [ ] **Step 4: Run tests**

```bash
pytest backend/tests/test_step_linker.py -v
# Expected: 4 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/parser.py backend/step_linker.py backend/tests/test_step_linker.py
git commit -m "feat(backend): LLM step→ingredient linker with strict validation"
```

### Task 14: Export v2 + ingest wiring + re-ingest

**Files:**
- Modify: `backend/export.py`, `backend/ingest.py`
- Test: `backend/tests/test_export.py`
- Generated: `src/data/enriched/*.json`, `backend/.cache/steplinks.json`

- [ ] **Step 1: Failing test** — append to `backend/tests/test_export.py` (mirror how the existing tests build a `Recipe` and call `export_recipes`; the shape below is the contract):

```python
def test_export_includes_step_refs_and_version_2(tmp_path):
    recipe = Recipe(
        slug="t", title="T", cuisine="x", servings=2,
        ingredients=["30g salt"], ingredient_sections=[None],
        body="1. Add the salt\n\n2. Serve",
    )
    export_recipes(
        [recipe],
        normalised_map={"30g salt": "salt"},
        nutrition_map={"salt": None},
        quantity_map={"30g salt": 30.0},
        category_map={"30g salt": "spices-seasonings"},
        stated_quantity_map={"30g salt": {"amount": 30, "unit": "g"}},
        step_links_map={"t": [[{"line": 0, "phrase": "salt"}], []]},
        export_dir=tmp_path,
    )
    data = json.loads((tmp_path / "t.json").read_text())
    assert data["version"] == 2
    assert data["steps"] == [{"refs": [{"line": 0, "phrase": "salt"}]}, {"refs": []}]


def test_export_without_links_emits_empty_refs(tmp_path):
    recipe = Recipe(
        slug="t", title="T", cuisine="x", servings=2,
        ingredients=[], ingredient_sections=[], body="1. Serve",
    )
    export_recipes(
        [recipe], normalised_map={}, nutrition_map={}, quantity_map={},
        category_map={}, stated_quantity_map={}, export_dir=tmp_path,
    )
    data = json.loads((tmp_path / "t.json").read_text())
    assert data["steps"] == [{"refs": []}]
```

- [ ] **Step 2: Run** — `pytest backend/tests/test_export.py -v` → new tests FAIL.

- [ ] **Step 3: Implement in `export.py`.** Import `parse_steps` from `backend.parser`. Add `step_links_map: Optional[Dict[str, list]] = None` keyword to both `export_recipes` and `_recipe_json` (threading it through; default `None` → `{}`). In `_recipe_json`, before the return:

```python
    steps = parse_steps(recipe.body)
    links = (step_links_map or {}).get(recipe.slug) or []
    links = (links + [[] for _ in steps])[: len(steps)]
    step_objs = [{"refs": refs} for refs in links]
```

and in the returned dict: `"version": 2,` and `"steps": step_objs,`.

- [ ] **Step 4: Wire into `ingest.py`.** After the normalisation section (before entity linking), add a step-linking pass — cached per recipe on a content hash, LLM client created lazily exactly like the normaliser's:

```python
    # step linking (per recipe, cached on steps+ingredients hash)
    import hashlib
    from backend.parser import parse_steps
    from backend.step_linker import link_steps

    print("Linking steps to ingredients...")
    steplinks_cache_path = cache_dir / "steplinks.json"
    steplinks_cache = _load_cache(steplinks_cache_path)
    step_links_map: Dict[str, list] = {}
    for recipe in recipes:
        steps = parse_steps(recipe.body)
        if not steps:
            step_links_map[recipe.slug] = []
            continue
        digest = hashlib.sha256(
            ("\n".join(recipe.ingredients) + "\0" + "\n".join(steps)).encode("utf-8")
        ).hexdigest()
        cached = steplinks_cache.get(recipe.slug)
        if cached and cached.get("hash") == digest:
            step_links_map[recipe.slug] = cached["links"]
            print(f"  {recipe.slug}: cached")
            continue
        if llm_client is None:
            llm_client = make_client()
        links = link_steps(recipe.ingredients, steps, llm_client)
        steplinks_cache[recipe.slug] = {"hash": digest, "links": links}
        _save_cache(steplinks_cache_path, steplinks_cache)
        step_links_map[recipe.slug] = links
        print(f"  {recipe.slug}: {sum(len(r) for r in links)} refs")
```

Pass `step_links_map=step_links_map` to the `export_recipes(...)` call.

- [ ] **Step 5: Tests, then run the pipeline**

```bash
pytest                                  # Expected: all backend tests pass
npm run ingest                          # Expected: "Linking steps to ingredients..." runs once per recipe (cached on re-run)
python3 -c "import json; d=json.load(open('src/data/enriched/carnitas.json')); print(d['version'], len(d['steps']), d['steps'][4])"
# Expected: 2 <step count> and step 5's refs include the salt/water lines
```

Spot-check 2–3 exports for sane refs (phrases actually in the steps).

- [ ] **Step 6: Commit** (cache + exports are committed by design)

```bash
git add backend/export.py backend/ingest.py backend/tests/test_export.py backend/.cache/steplinks.json src/data/enriched/
git commit -m "feat(backend): export v2 with step→ingredient refs"
```

### Task 15: Frontend inline amounts

**Files:**
- Modify: `src/lib/enrichment.ts`, `src/pages/recipes/[slug].astro`, `src/components/RecipePageIsland.tsx`

- [ ] **Step 1: Types.** In `src/lib/enrichment.ts` add above `EnrichedRecipe`:

```ts
export interface StepRef {
  line: number;   // index into ingredients[]
  phrase: string; // verbatim span in the step text
}

export interface EnrichedStep {
  refs: StepRef[];
}
```

and in `EnrichedRecipe`: `steps?: EnrichedStep[];`

- [ ] **Step 2: Pass to the island.** In `[slug].astro` (the `getEnriched` call is already there — hoist it):

```ts
const enriched = getEnriched(slug!);
const nutrition = enriched?.nutritionPerServing ?? null;
const enrichedSteps = enriched?.steps ?? null;
const enrichedIngredients = enriched?.ingredients ?? null;
```

Pass `enrichedSteps={enrichedSteps}` and `enrichedIngredients={enrichedIngredients}`. Add to `RecipePageProps`:

```ts
  enrichedSteps: EnrichedStep[] | null;
  enrichedIngredients: EnrichedIngredient[] | null;
```

(import both types from `../lib/enrichment`).

- [ ] **Step 3: Feed the segment builder.** Replace the Task 12 `stepSegments` line with:

```ts
const stepSegments = steps.map((step, i) =>
  buildStepSegments(step, {
    refs: enrichedSteps?.[i]?.refs ?? null,
    ingredients: enrichedIngredients,
    ratio,
  })
);
```

In the segment renderer add the amount case before the plain-text fallback:

```tsx
if (seg.type === 'amount') {
  return (
    <span key={si} className="onum" style={{ color: 'var(--color-ink-muted)' }}>
      {seg.text}
    </span>
  );
}
```

- [ ] **Step 4: Build + acceptance, commit**

```bash
npm test && npm run build && npm run dev
```

Carnitas step 5 reads "Add the salt (30 g) and water (500 ml)" in muted ink; doubling servings on the plate doubles the inline amounts; a recipe with no `steps` in its export renders plain prose (delete one export locally to verify, then restore with `git checkout -- src/data/enriched/`).

```bash
git add src/lib/enrichment.ts "src/pages/recipes/[slug].astro" src/components/RecipePageIsland.tsx
git commit -m "feat: inline scaled amounts in recipe steps"
```

---

## Phase G — Kitchen journal (margin notes)

### Task 16: Journal collection + margin layout (TDD) + CMS

**Files:**
- Modify: `src/content/config.ts`, `public/admin/config.yml`
- Create: `src/lib/marginalia.mjs`, `src/content/journal/.gitkeep`
- Test: `scripts/marginalia.test.mjs`

- [ ] **Step 1: Failing tests** — create `scripts/marginalia.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jitterFor, layoutMarginNotes } from '../src/lib/marginalia.mjs';

test('jitter is deterministic per seed and bounded (x small, y larger)', () => {
  const a = jitterFor(42), b = jitterFor(42), c = jitterFor(43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(Math.abs(a.dx) <= 10);
  assert.ok(a.dy >= 0 && a.dy <= 48);
});

test('collision resolution pushes notes down, never overlapping', () => {
  const layout = layoutMarginNotes([
    { id: 'a', anchorTop: 100, seed: 1, height: 60 },
    { id: 'b', anchorTop: 110, seed: 2, height: 40 },
    { id: 'c', anchorTop: 500, seed: 3, height: 40 },
  ]);
  const a = layout.get('a'), b = layout.get('b'), c = layout.get('c');
  const [first, second] = a.top <= b.top ? [{ ...a, height: 60 }, { ...b, height: 40 }] : [{ ...b, height: 40 }, { ...a, height: 60 }];
  assert.ok(second.top >= first.top + first.height + 12);
  assert.ok(c.top >= 500); // far anchor unaffected by the cluster
});
```

- [ ] **Step 2: Run** — `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement** — create `src/lib/marginalia.mjs`:

```js
// Margin-note placement: seeded jitter (stable across visits) + top-down
// collision resolution so notes never overlap. Pure — measurements come in,
// offsets go out.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hand-placed feel: small x displacement, larger y. */
export function jitterFor(seed) {
  const rand = mulberry32(seed);
  return { dx: Math.round((rand() * 2 - 1) * 10), dy: Math.round(rand() * 48) };
}

/**
 * notes: [{ id, anchorTop, seed, height }] → Map id → { top, dx }.
 * Jittered tops, then push-down so each note clears the previous by `gap`.
 */
export function layoutMarginNotes(notes, gap = 12) {
  const placed = notes
    .map((n) => {
      const { dx, dy } = jitterFor(n.seed);
      return { id: n.id, dx, top: n.anchorTop + dy, height: n.height };
    })
    .sort((a, b) => a.top - b.top);
  let floor = -Infinity;
  for (const p of placed) {
    if (p.top < floor) p.top = floor;
    floor = p.top + p.height + gap;
  }
  return new Map(placed.map((p) => [p.id, { top: p.top, dx: p.dx }]));
}
```

- [ ] **Step 4: Run tests** — `npm test` → PASS.

- [ ] **Step 5: Content collection.** `mkdir -p src/content/journal && touch src/content/journal/.gitkeep`. In `src/content/config.ts` add:

```ts
// Kitchen journal — one JSON file per recipe slug; written by Decap or the
// in-page annotate mode (git-gateway). Never touched by the ingest pipeline.
const journal = defineCollection({
  type: "data",
  schema: z.object({
    slug: z.string(),
    entries: z.array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string(),
        anchor: z.object({
          type: z.enum(["top", "ingredients", "step"]),
          n: z.number().int().positive().optional(), // 1-based step number
        }),
        seed: z.number().int(),
      })
    ),
  }),
});
```

and export it: `export const collections = { recipes, meta, journal };`

- [ ] **Step 6: Decap collection** — append to `public/admin/config.yml` `collections:`:

```yaml
  - name: "journal"
    label: "Kitchen journal"
    folder: "src/content/journal"
    format: "json"
    extension: "json"
    create: true
    identifier_field: slug
    slug: "{{slug}}"
    fields:
      - { name: "slug", label: "Recipe slug", widget: "string", hint: "Must match the recipe filename, e.g. carnitas" }
      - name: "entries"
        label: "Notes"
        widget: "list"
        fields:
          - { name: "date", label: "Date (YYYY-MM-DD)", widget: "string" }
          - { name: "note", label: "Note", widget: "text" }
          - name: "anchor"
            label: "Anchor"
            widget: "object"
            fields:
              - { name: "type", label: "Type", widget: "select", options: ["top", "ingredients", "step"], default: "step" }
              - { name: "n", label: "Step number (for step anchors)", widget: "number", value_type: "int", required: false, min: 1 }
          - { name: "seed", label: "Placement seed (any integer)", widget: "number", value_type: "int", default: 1 }
```

- [ ] **Step 7: Build + commit**

```bash
npm run build   # Expected: passes (empty journal collection is fine)
git add src/lib/marginalia.mjs scripts/marginalia.test.mjs src/content/config.ts src/content/journal/.gitkeep public/admin/config.yml
git commit -m "feat: journal collection, margin-note layout engine, CMS entry"
```

### Task 17: Marginalia rendering on the recipe page

**Files:**
- Modify: `src/pages/recipes/[slug].astro`, `src/components/RecipePageIsland.tsx`

- [ ] **Step 1: Load + pass entries.** In `[slug].astro`:

```ts
import { getCollection } from "astro:content"; // already imported
const journalEntries =
  (await getCollection("journal")).find((j) => j.data.slug === slug)?.data.entries ?? [];
```

Pass `journal={journalEntries}`. Island types:

```ts
export interface JournalAnchor { type: 'top' | 'ingredients' | 'step'; n?: number }
export interface JournalEntry { date: string; note: string; anchor: JournalAnchor; seed: number }
```

Add `journal: JournalEntry[];` to props. Keep entries in state for Task 19's optimistic writes: `const [journalEntries, setJournalEntries] = useState(journal);`

- [ ] **Step 2: Measure + lay out.** Give the content grid wrapper (the `div` with `gridTemplateColumns: '1fr 2fr'`) a ref `contentRef` and `position: 'relative'`. Collect anchor element refs:

```ts
const contentRef = useRef<HTMLDivElement>(null);
const stepLiRefs = useRef<(HTMLLIElement | null)[]>([]);
const plateRef = useRef<HTMLDivElement>(null);
const noteRefs = useRef(new Map<number, HTMLDivElement>());
const [noteLayout, setNoteLayout] = useState<Map<number, { top: number; dx: number }> | null>(null);
```

(`ref={(el) => { stepLiRefs.current[i] = el; }}` on each step `<li>`; `ref={plateRef}` on the oxblood plate div.)

```ts
useLayoutEffect(() => {
  if (journalEntries.length === 0 || !contentRef.current) return;
  const measure = () => {
    const containerTop = contentRef.current!.getBoundingClientRect().top;
    const anchorTopFor = (a: JournalAnchor): number => {
      if (a.type === 'step' && a.n != null) {
        const li = stepLiRefs.current[a.n - 1];
        if (li) return li.getBoundingClientRect().top - containerTop;
      }
      if (a.type === 'ingredients' && plateRef.current) {
        return plateRef.current.getBoundingClientRect().top - containerTop;
      }
      return 0; // 'top' and dangling step anchors
    };
    setNoteLayout(
      layoutMarginNotes(
        journalEntries.map((e, idx) => ({
          id: idx,
          anchorTop: anchorTopFor(e.anchor),
          seed: e.seed,
          height: noteRefs.current.get(idx)?.offsetHeight ?? 60,
        }))
      )
    );
  };
  measure();
  window.addEventListener('resize', measure);
  return () => window.removeEventListener('resize', measure);
}, [journalEntries, servings]);
```

(import `useLayoutEffect`, `useRef` from react and `layoutMarginNotes` from `../lib/marginalia.mjs`; two renders settle heights: first pass uses the 60px estimate, the effect re-runs via `noteLayout` state only once measured heights change nothing further.)

- [ ] **Step 3: Render.** Inside the grid wrapper, after the steps column, add the margin rail (absolutely positioned in the right gutter):

```tsx
{journalEntries.length > 0 && (
  <div className="rp-margin" aria-label="Kitchen journal" style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, width: '190px', paddingLeft: 'var(--space-lg)' }}>
    {journalEntries.map((entry, idx) => {
      const pos = noteLayout?.get(idx);
      return (
        <div
          key={idx}
          ref={(el) => { if (el) noteRefs.current.set(idx, el); }}
          style={{
            position: 'absolute',
            top: pos?.top ?? 0,
            left: `calc(var(--space-lg) + ${pos?.dx ?? 0}px)`,
            width: '170px',
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          <p className="onum" style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', color: 'var(--color-ink-muted)', margin: '0 0 2px' }}>
            {entry.date}
          </p>
          <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--text-meta)', lineHeight: 1.5, color: 'var(--color-ink-muted)', margin: 0 }}>
            {entry.note}
          </p>
        </div>
      );
    })}
  </div>
)}
```

Narrow screens tuck notes inline instead — under their anchored step (`<div className="rp-note-inline">` with the same date+note markup after each step's `<p>`, filtering `journalEntries` by `anchor.n === i + 1`; `top`/`ingredients` notes render once above the grid). Toggle the two with a style block in the component:

```tsx
<style>{`
  .rp-margin { display: none; }
  .rp-note-inline { display: block; margin-top: var(--space-xs); }
  @media (min-width: 1320px) {
    .rp-margin { display: block; }
    .rp-note-inline { display: none; }
  }
`}</style>
```

- [ ] **Step 4: Acceptance.** Create a real test note (this is genuine content, keep it):

`src/content/journal/carnitas.json`

```json
{
  "slug": "carnitas",
  "entries": [
    {
      "date": "2026-07-19",
      "note": "Første notat i margen — boka lever.",
      "anchor": { "type": "step", "n": 5 },
      "seed": 7
    }
  ]
}
```

```bash
npm test && npm run build && npm run dev
```

Wide viewport: the note sits in the right gutter beside step 5, jittered, date above; resize below 1320px → it tucks under step 5; two notes anchored to adjacent steps never overlap (add a temporary second entry to verify, then remove it); reload → identical placement (seeded).

- [ ] **Step 5: Commit**

```bash
git add "src/pages/recipes/[slug].astro" src/components/RecipePageIsland.tsx src/content/journal/carnitas.json
git commit -m "feat: positioned kitchen-journal margin notes"
```

---

## Phase H — In-page annotate mode

### Task 18: Gateway spike + identity/journal clients

**Files:**
- Create: `src/lib/identity.ts`, `src/lib/journalStore.ts`
- Modify: `.env` (local), GH Pages build workflow if present

- [ ] **Step 1: CORS spike (decides the origin story — do this first).** In a browser tab on `https://cruesli.github.io/recipes/`, open the console and run:

```js
fetch('https://mtrecipes.netlify.app/.netlify/identity/settings').then(r => r.json()).then(console.log)
```

Expected: a JSON settings object (Identity endpoints send permissive CORS). If it's blocked, or the later login/gateway calls fail cross-origin, the documented fallback is: annotate mode is used via the Netlify mirror (`https://mtrecipes.netlify.app`) instead of the GH Pages origin — everything else in this phase is origin-agnostic. Record the outcome in the commit message.

- [ ] **Step 2: Env gate.** Add to `.env` (repo root, used by the Astro build): `PUBLIC_ANNOTATE_ORIGIN=https://mtrecipes.netlify.app`. Check `ls .github/workflows/` — if a Pages build workflow exists, add the same variable to its build step `env:`. Unset ⇒ annotate UI never renders (same gating pattern as `PUBLIC_NLP_API_URL`).

- [ ] **Step 3: Identity client** — create `src/lib/identity.ts`:

```ts
// Minimal Netlify Identity (GoTrue) client for the annotate mode. Tokens live
// in localStorage; refresh happens on demand. Gated by PUBLIC_ANNOTATE_ORIGIN.

const ORIGIN: string | null = import.meta.env.PUBLIC_ANNOTATE_ORIGIN ?? null;
const KEY = 'recipes:identity';

interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export const annotateEnabled = (): boolean => ORIGIN !== null;

function load(): TokenSet | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch { return null; }
}

function save(t: TokenSet | null) {
  if (t) localStorage.setItem(KEY, JSON.stringify(t));
  else localStorage.removeItem(KEY);
}

async function tokenRequest(body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(`${ORIGIN}/.netlify/identity/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`identity ${res.status}`);
  const data = await res.json();
  const t: TokenSet = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  save(t);
  return t;
}

export async function login(email: string, password: string): Promise<void> {
  await tokenRequest(new URLSearchParams({ grant_type: 'password', username: email, password }));
}

export function loggedIn(): boolean {
  return load() !== null;
}

export function logout(): void {
  save(null);
}

/** Valid access token, refreshing if expired; null when not logged in. */
export async function accessToken(): Promise<string | null> {
  const t = load();
  if (!t) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  try {
    const fresh = await tokenRequest(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token })
    );
    return fresh.access_token;
  } catch {
    save(null);
    return null;
  }
}
```

- [ ] **Step 4: Journal store** — create `src/lib/journalStore.ts`:

```ts
// Reads/writes src/content/journal/<slug>.json through Netlify git-gateway
// (the same backend Decap uses). Writes commit to main; GH Pages rebuilds.
// Only ever touches journal JSON — recipe markdown is off limits by design.

import { accessToken } from './identity';
import type { JournalEntry } from '../components/RecipePageIsland';

const ORIGIN: string | null = import.meta.env.PUBLIC_ANNOTATE_ORIGIN ?? null;
const gateway = () => `${ORIGIN}/.netlify/git/github`;
const filePath = (slug: string) => `src/content/journal/${slug}.json`;

const b64encode = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const b64decode = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

/** Append one entry and commit. Throws on auth/network/conflict errors. */
export async function commitNote(slug: string, entry: JournalEntry): Promise<void> {
  const token = await accessToken();
  if (!token) throw new Error('not logged in');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const getRes = await fetch(`${gateway()}/contents/${filePath(slug)}?ref=main`, { headers });
  let sha: string | undefined;
  let doc: { slug: string; entries: JournalEntry[] } = { slug, entries: [] };
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    doc = JSON.parse(b64decode(data.content));
  } else if (getRes.status !== 404) {
    throw new Error(`read failed: ${getRes.status}`);
  }

  doc.entries = [...doc.entries, entry];
  const putRes = await fetch(`${gateway()}/contents/${filePath(slug)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `journal: note on ${slug}`,
      branch: 'main',
      content: b64encode(JSON.stringify(doc, null, 2) + '\n'),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!putRes.ok) throw new Error(`write failed: ${putRes.status}`);
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build   # Expected: passes (nothing imports the new libs yet)
git add src/lib/identity.ts src/lib/journalStore.ts
git commit -m "feat: Netlify Identity + git-gateway journal clients (spike: <outcome>)"
```

### Task 19: Annotate UI

**Files:**
- Modify: `src/components/RecipePageIsland.tsx`

- [ ] **Step 1: State + affordance.** Imports: `annotateEnabled, loggedIn, login` from `../lib/identity`, `commitNote` from `../lib/journalStore`, `Pencil` from `lucide-react`. State:

```ts
type AnnotateState =
  | { mode: 'off' }
  | { mode: 'login' }
  | { mode: 'arm' }                              // pick an anchor
  | { mode: 'compose'; anchor: JournalAnchor };  // write the note
const [annotate, setAnnotate] = useState<AnnotateState>({ mode: 'off' });
const [noteDraft, setNoteDraft] = useState('');
const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'error'>('idle');
```

In the Instructions header row (next to the keep-awake toggle), when `annotateEnabled()`:

```tsx
<button
  onClick={() => {
    if (annotate.mode !== 'off') setAnnotate({ mode: 'off' });
    else setAnnotate(loggedIn() ? { mode: 'arm' } : { mode: 'login' });
  }}
  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: annotate.mode !== 'off' ? 'var(--color-oxblood)' : 'var(--color-ink-muted)' }}
>
  <Pencil size={13} /> {annotate.mode !== 'off' ? 'Close' : 'Margin note'}
</button>
```

- [ ] **Step 2: Login form** (rendered under the header row when `annotate.mode === 'login'`) — two `INPUT`-styled fields + submit; on success `setAnnotate({ mode: 'arm' })`, on failure an italic muted error line. Keep it inline and quiet (no modal):

```tsx
{annotate.mode === 'login' && (
  <form
    onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      try {
        await login(String(fd.get('email')), String(fd.get('password')));
        setAnnotate({ mode: 'arm' });
        setNoteStatus('idle');
      } catch { setNoteStatus('error'); }
    }}
    style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', margin: '0 0 var(--space-lg)' }}
  >
    <input name="email" type="email" required placeholder="email" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 10px', outline: 'none' }} />
    <input name="password" type="password" required placeholder="password" style={{ border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 10px', outline: 'none' }} />
    <button type="submit" style={{ border: 'none', background: 'var(--color-oxblood)', color: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '7px 14px', cursor: 'pointer' }}>Sign in</button>
    {noteStatus === 'error' && <p style={{ width: '100%', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', fontStyle: 'italic', color: 'var(--color-ink-muted)', margin: 0 }}>That didn't work — check the details.</p>}
  </form>
)}
```

- [ ] **Step 3: Arm + compose.** In arm mode show a hint line ("Tap a step number, the ingredient plate, or the title to place the note.") and make the anchors clickable: the step-number buttons (`onClick` → `setAnnotate({ mode: 'compose', anchor: { type: 'step', n: i + 1 } })` when armed, else the normal check-off), the plate's Ingredients eyebrow (`type: 'ingredients'`), and the `<h1>` (`type: 'top'`). Armed targets get `outline: '1px dotted var(--color-oxblood)'; outlineOffset: 3`.

In compose mode render, adjacent to the chosen anchor (inline under the step / plate / title), a small form:

```tsx
{annotate.mode === 'compose' && (
  <div style={{ margin: 'var(--space-sm) 0' }}>
    <textarea
      value={noteDraft}
      onChange={(e) => setNoteDraft(e.target.value)}
      rows={3}
      autoFocus
      placeholder="Skriv i margen…"
      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-hairline)', background: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 'var(--text-meta)', padding: '8px 10px', outline: 'none', resize: 'vertical' }}
    />
    <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'baseline', marginTop: 'var(--space-2xs)' }}>
      <button onClick={saveNote} disabled={noteStatus === 'saving' || !noteDraft.trim()} style={{ border: 'none', background: 'var(--color-oxblood)', color: 'var(--color-paper)', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', padding: '6px 14px', cursor: 'pointer' }}>
        {noteStatus === 'saving' ? 'Writing…' : 'Write it in'}
      </button>
      <button onClick={() => { setAnnotate({ mode: 'off' }); setNoteDraft(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-meta)', color: 'var(--color-ink-muted)' }}>Cancel</button>
      {noteStatus === 'error' && <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 'var(--text-eyebrow)', fontStyle: 'italic', color: 'var(--color-ink-muted)' }}>Couldn't reach the book — try again.</span>}
    </div>
  </div>
)}
```

```ts
async function saveNote() {
  if (annotate.mode !== 'compose') return;
  const entry: JournalEntry = {
    date: new Date().toISOString().slice(0, 10),
    note: noteDraft.trim(),
    anchor: annotate.anchor,
    seed: Math.floor(Math.random() * 1_000_000),
  };
  setNoteStatus('saving');
  try {
    await commitNote(slug, entry);
    setJournalEntries((prev) => [...prev, entry]); // optimistic — rebuild catches up
    setAnnotate({ mode: 'off' });
    setNoteDraft('');
    setNoteStatus('idle');
  } catch {
    setNoteStatus('error');
  }
}
```

- [ ] **Step 4: Build + acceptance, commit**

```bash
npm run build && npm run dev
```

Without `PUBLIC_ANNOTATE_ORIGIN`: no pencil anywhere. With it: pencil → login (bad password → quiet error) → arm → anchors outline on hover → tap step 3 → compose → "Write it in" → note appears in the margin immediately; the commit lands on `main` (check `git log` on GitHub / `src/content/journal/` in the repo); after the Pages rebuild the note is in the static HTML. Verify the flow from a phone once deployed.

```bash
git add src/components/RecipePageIsland.tsx
git commit -m "feat: in-page annotate mode (Identity + git-gateway)"
```

---

## Phase I — NL ingredient dimension

### Task 20: Query-service ingredient filter + redeploy

**Files:**
- Modify: `backend/main.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Failing test** — append to `backend/tests/test_api.py`. If the file already has a fake-LLM/TestClient helper, reuse it; otherwise this self-contained version works as-is:

```python
def test_query_passes_ingredient_filter():
    from unittest.mock import MagicMock
    from fastapi.testclient import TestClient
    from backend.main import app, get_openai_client

    llm = MagicMock()
    resp = MagicMock()
    resp.choices[0].message.content = '{"ingredient": "pork shoulder", "bogus": 1}'
    llm.chat.completions.create.return_value = resp
    app.dependency_overrides[get_openai_client] = lambda: llm
    try:
        client = TestClient(app)
        body = client.post("/api/v1/query", json={"question": "what can I make with pork shoulder"}).json()
        assert body["filters"] == {"ingredient": "pork shoulder"}  # allow-listed; bogus dropped
    finally:
        app.dependency_overrides.clear()
```

- [ ] **Step 2: Run** — `pytest backend/tests/test_api.py -v` → FAIL (`ingredient` filtered out).

- [ ] **Step 3: Implement in `backend/main.py`.** Prompt: add to the field list in `_BASE_SYSTEM_PROMPT`:

```python
    '- "ingredient"     : a specific ingredient the user wants to cook with '
    '(canonical lowercase english name, e.g. "pork shoulder")\n'
```

Examples — add to `_EXAMPLES`:

```python
    # --- ingredient ---
    ("what can I make with pork shoulder",      {"ingredient": "pork shoulder"}),
    ("something using cabbage",                 {"ingredient": "cabbage"}),
    ("I have leftover chicken thighs",          {"ingredient": "chicken thigh"}),
    ("quick dinner with rice",                  {"max_time": 30, "ingredient": "rice"}),
```

Allow-list: add `"ingredient"` to `_KNOWN_FILTER_KEYS`.

- [ ] **Step 4: Run tests** — `pytest` → all pass.

- [ ] **Step 5: Redeploy the Space + verify.** Follow the deploy steps in `backend/README.md` (HF Spaces, Docker). Then:

```bash
curl -s -X POST "$PUBLIC_NLP_API_URL/api/v1/query" -H 'Content-Type: application/json' \
  -d '{"question": "what can I make with pork shoulder"}'
# Expected: {"question": …, "filters": {"ingredient": "pork shoulder"}}
```

On `/recipes` (deployed or local with the env var): ask "what can I do with a pork shoulder" → the **With** facet populates and the grid filters.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat(backend): ingredient dimension in the NL query service"
```

---

## Phase J — Docs sync

### Task 21: Keep CLAUDE.md + design context truthful

**Files:**
- Modify: `CLAUDE.md`, `docs/recipe-site-design-context.md`

- [ ] **Step 1: `CLAUDE.md`.** Update the source-of-truth docs list (add `recipe-site-update-plan-v4.md` — kitchen features batch) and the "current work" paragraph; add to the project structure: `src/pages/ingredients.astro`, `src/content/journal/` + annotate gating (`PUBLIC_ANNOTATE_ORIGIN`), `src/content/meta/staples.json`, and the new libs (`ingredientIndex.mjs`, `stepTimers.mjs`, `stepAnnotations.mjs`, `marginalia.mjs`, `identity.ts`, `journalStore.ts`, `backend/step_linker.py`); note export `version: 2` carries `steps[].refs`.

- [ ] **Step 2: `docs/recipe-site-design-context.md`.** In **State of play**, add a shipped bullet for the v4 batch (staples footer, ingredient index + facet, prep/cook/marinade + start-by line, step timers + inline amounts, journal marginalia + annotate mode). In **Structure & components**, note the marginalia grammar: margin notes are ink-muted italic `--text-meta` with a date eyebrow — quiet pencil, not a second accent; timers/inline amounts live inside the step prose, no new chrome. Cross-device week sync stays on **Later** (the journal is committed content, not planner sync).

- [ ] **Step 3: Final check + commit**

```bash
npm test && npm run build && pytest    # Expected: everything green
git add CLAUDE.md docs/recipe-site-design-context.md
git commit -m "docs: sync CLAUDE.md + design context for v4 batch"
```

Then merge per house style (small batches may merge phase groups A–C, D–F, G–I separately if review prefers).

---

## Execution order & dependencies

```
A (staples) ──→ B (index: excludes staples) ──→ C (facet)
D (times) — independent
E (timers) ──→ F (inline amounts: F15 extends E's segment renderer)
A/… ──→ G (journal render) ──→ H (annotate: writes what G renders)
C ──→ I (NL ingredient: facet must exist)
everything ──→ J (docs)
```

D and E can be reordered freely; H needs G; I needs C; J is last.
