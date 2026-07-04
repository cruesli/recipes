# Recipe Site — Implementation Plan (Type/Spacing Scales + Editorial Collection & Planner Drawer)

This plan is for Claude Code. It implements two things on the `cruesli/recipes` Astro site:

1. **Design-system scales** — a tokenised type scale + spacing scale, swept across the whole codebase.
2. **Editorial collection grid + push-drawer meal planner** on the home page, with a shared planner extracted and reused on `/meal-planner`.

See `recipe-site-design-context.md` for the locked design direction.

---

## Decisions — do not re-litigate

These were settled deliberately. Execute them; don't re-derive or "improve" them.

**Scales (idea 1)**
- Both scales live in `@theme` in `src/styles/global.css`, beside the existing colour/radius tokens, consumed as `var(--…)` in CSS and inline styles.
- Type tokens use **semantic names** (`--text-display`, `--text-title`, …). Do **not** name them `--text-base`/`--text-sm` — those collide with Tailwind's default font-size utilities that `WorldMap.tsx` relies on (`text-4xl/5xl/xs/base`).
- Spacing uses **t-shirt names** anchored at `--space-md: 1rem`.
- **Full sweep:** every `font-size` → a type token; every structural `margin`/`padding`/`gap`/section spacing → a spacing token, **snapping to the nearest step**. The snap will visibly nudge some current spacing (e.g. `1.25rem → 1.5rem`, `3.5rem → 3rem`); that is the intended rhythm effect.
- **Left literal** (not tokenised): one-off component dimensions — lucide icon `size`, the keep-awake toggle (36×20), the step-number circle (28px), the 22px/32px thumbnails, border widths (1px/1.5px), `letter-spacing`, image `aspect-ratio`, and any sub-4px micro-gaps.

**Planner architecture (idea 2)**
- Extract the planner **once** into a shared `usePlanner` hook (+ a shared `RecipeCard`). Both the home drawer and `/meal-planner` consume it. Today the planner logic is duplicated across `CollectionPlannerIsland` and `MealPlannerIsland` — remove the duplication.
- The planned week **persists in `localStorage`** via `loadWeek()`/`saveWeek()`; read on mount, write on change. Per-device only (no cross-device sync — that's a much later, backend-shaped concern). Note `nanostores` as a possible later upgrade if live same-page island sync is ever needed.
- `/meal-planner` stays **fully editable**: keeps its per-day search-picker (recipe search **and** custom-dish text input), remove/clear, and the auto-generated, checkable, downloadable shopping list. When reached via the drawer's button it lands with the list **already generated**. Custom dishes (e.g. "leftovers", "eat out") are added **here**, not in the drawer. Two add-interactions (drawer click/drag vs. page picker) is accepted and intentional, because the page has no collection beside it.

**Home push-drawer (idea 2)**
- **Push, not overlay**: opening the planner reflows the collection narrower; the panel takes the freed space.
- Planner panel width when open: **340px**.
- **Two ways to open:** drag a recipe toward the right edge → auto-opens; or open manually via the tab. Auto-open triggers when the drag enters a right-edge zone; keep the animation short (**~180ms**) so day slots settle before the cursor arrives.
- **Auto-close is mode-dependent:** drag-opened → closes after the drop; manually opened → stays open until dismissed.
- **Closed-state affordance:** a hairline **tab** flush to the right edge with a rotated "Meal planner" eyebrow and a **vertical stack of marks, one per planned day** (the marks ARE the count — no numeric badge). The tab is itself the drop target; on drag-over it widens/highlights with an oxblood hairline.
- **Tab is the spine:** the tab unfurls **leftward** into the panel (one object, two states); the day-marks dissolve into the real day rows; the chevron flips open↔close. Animate width only.
- **Click-to-add = arm-a-day-then-click:** each drawer day row has a small `+`/target → click it to **arm** that day (highlighted) → click any collection card → fills that day and disarms. Clicking a closed day's `+` opens the drawer with that day armed. Drag-to-plan remains available alongside.
- **"Make shopping list · N meals"** button **pinned to the bottom of the drawer**, always visible: disabled/muted on an empty week, oxblood primary when meals exist, count in oldstyle figures. It **navigates to `/meal-planner`** (which auto-generates the list). The drawer does **not** render the shopping list inline.

**Collection grid + cards (idea 2)**
- One shared **`RecipeCard`** used on the home collection **and** the cuisine pages. Eyebrow source switches by context: **cuisine** on home, **tag** on cuisine pages.
- Card anatomy: fixed-height image **220px**, `object-fit: cover`, **square corners (`border-radius: 0`)**; oxblood `--text-eyebrow` caps eyebrow; title `--text-card` Garamond 500, clamp to **2 lines**; **hairline rule** between title and meta; muted **oldstyle-figure** meta joining available fields with ` · ` (`time · servings · tag`), dropping missing fields gracefully. **All-serif** (defer Schibsted Grotesk).
- Home collection grid: **fixed 3 columns in both drawer states** (not `auto-fit` — a 3→2 reflow would shift card positions). Widen the home collection frame to **~1120px** (grid only; reading/detail layouts keep their current widths). When the planner pushes in, the collection container width animates narrower and the 3 columns just **squeeze** (images recrop horizontally via `object-fit: cover`; height stays 220px so vertical positions are stable). Drop the current filled-gridline look (the `background: var(--color-hairline)` + 1px-gap trick) in favour of whitespace + the per-card hairline rule.

**Squared photos rule**
- Square **all display photography**: collection cards, cuisine cards, and the recipe-detail hero (already square full-bleed — effectively a no-op, leave its layout otherwise untouched).
- Keep `--radius-sm` on **tiny utility thumbnails only**: the 22px shopping-list thumb, the 32px day-row thumb, and the meal-picker tiles. (Square the photos you look *at*; keep a whisper of radius on the chips you scan *past*.) Add a code comment so this isn't "helpfully" reverted.

**Mobile (~768px breakpoint)**
- Above ~768px: the full push-drawer model.
- Below ~768px: **no drawer at all.** The collection becomes 1 column; surface a prominent "Open meal planner" link where the tab would sit (the nav entry already exists). No tab, no push, no touch-drag. All mobile planning happens on the fully-editable `/meal-planner` page.

**Out of scope — do not touch (beyond the token sweep)**
- Recipe-detail **hero layout** (keep 100vh full-bleed; only square corners + token sweep).
- **Oxblood audit** (per-ingredient red dots) — deferred.
- **Paper grain / texture** — deferred.
- **`WorldMap`** — structurally untouched; token sweep only.
- **Header search** (disabled NLP placeholder) — leave alone (Phase 3 / NLP).
- Everything outside this plan stays mechanically token-swept but visually and structurally unchanged.

---

## Token blocks (write verbatim into `@theme`)

```css
@theme {
  /* ── Type scale (perfect fourth, ×1.333; 1rem = 16px) ── */
  /* top three tiers fluid; --text-card and below fixed */
  --text-display: clamp(2.4rem, 5.5vw, 3.5625rem); /* ~57px max — splash title */
  --text-title:   clamp(1.9rem, 4.5vw, 2.6875rem); /* ~43px max — recipe / cuisine h1 */
  --text-section: clamp(1.5rem, 2.6vw, 2rem);      /* ~32px max — section headings */
  --text-card:    1.5rem;    /* 24px — card titles, subheads */
  --text-body:    1.125rem;  /* 18px — body */
  --text-meta:    0.84rem;   /* ~13.5px — meta / captions */
  --text-eyebrow: 0.75rem;   /* 12px — caps labels (off-ratio, intentional) */

  /* ── Spacing scale (t-shirt; anchored md = 1rem) ── */
  --space-2xs: 0.25rem; /* 4 */
  --space-xs:  0.5rem;  /* 8 */
  --space-sm:  0.75rem; /* 12 */
  --space-md:  1rem;    /* 16 */
  --space-lg:  1.5rem;  /* 24 */
  --space-xl:  2rem;    /* 32 */
  --space-2xl: 3rem;    /* 48 */
  --space-3xl: 4rem;    /* 64 */
  --space-4xl: 6rem;    /* 96 */
}
```

Notes:
- Snap-to-nearest examples for the sweep: `0.35rem→0.5rem (xs)`, `0.55rem→0.5rem (xs)`, `0.68rem→0.75rem (sm, but font-size 0.68rem eyebrow → --text-eyebrow)`, `1.1rem→1rem (md)`, `1.25rem→1.5rem (lg)`, `1.75rem→2rem (xl)`, `3.5rem→3rem (2xl)`, `4.5rem→4rem (3xl)`, `5rem→6rem (4xl)`.
- The splash title's current `clamp(2.6rem, 6.5vw, 4.2rem)` max drops to `--text-display` (`3.5625rem`). Accepted — it snaps the splash onto the scale.

---

## Phases

Each phase should be a reviewable unit. Stop and verify acceptance criteria before moving on.

### Phase A — Define tokens + full sweep
- Add both token blocks to `@theme` in `src/styles/global.css`.
- Sweep `src/styles/global.css` utilities (`.eyebrow`, `.section-label`, `.card`, `.grid`, `.badge*`, header, sidebar, footer, `hr`, recipe img, etc.) onto the tokens.
- Sweep all `font-size` and structural spacing onto tokens in: `Splash.astro`, `CollectionPlannerIsland.tsx`, `MealPlannerIsland.tsx`, `RecipePageIsland.tsx`, `WorldMap.tsx`, `cuisines/[cuisine].astro`, `recipes/[slug].astro`, `BaseLayout.astro`.
- Leave the literal one-offs listed in Decisions.
- **Acceptance:** no raw `font-size` values remain except the literal exceptions; no structural spacing literals remain except sub-4px / one-offs; `WorldMap` still renders (its `text-4xl/5xl/xs/base` utilities untouched); the site builds (`npm run build`).

### Phase B — Extract the shared planner
- Create `src/components/usePlanner.ts`: the week state (`meals`), `selectRecipe`, `addCustom`, `removeMeal`, `resetList`/`generateList`, `toggleItem`, `downloadList`, `parseIngredients`, and the shopping-list grouping — all currently duplicated in both islands.
- Persistence: `loadWeek()` / `saveWeek()` over `localStorage` (e.g. key `recipes:week`), called on mount and on every mutation. Guard for SSR (`typeof window`).
- Refactor `MealPlannerIsland.tsx` to consume `usePlanner` with **no behavioural change** — it stays the fully-editable page planner (search-picker, custom dish, shopping list, download). Make it auto-generate the list on mount if a week is already stored.
- **Acceptance:** `/meal-planner` behaves exactly as before but reads/writes the shared `localStorage` week; planner logic exists in exactly one place.

### Phase C — Shared editorial `RecipeCard` + collection grid
- Create `src/components/RecipeCard.tsx` to the card spec in Decisions (220px image, square corners, oxblood eyebrow, `--text-card` 2-line title, hairline rule, oldstyle meta dropping missing fields). Prop for eyebrow source (cuisine vs tag).
- Use it statically (no client directive) in `cuisines/[cuisine].astro`, replacing the inline `.recipe-card` markup; remove the now-dead card CSS there.
- Square the display photos; keep `--radius-sm` on the 22px/32px utility thumbnails (add the "do not round" comment).
- Build the home collection as a **fixed 3-col** grid in a **~1120px** frame; drop the filled-gridline trick.
- **Acceptance:** home and cuisine cards are visually identical and come from one component; cards have square photos; collection is 3-up at full width; reading/detail widths unchanged.

### Phase D — Home push-drawer
- Restructure `CollectionPlannerIsland.tsx` (the home experience) into: full-width collection (using `RecipeCard` + the existing search/cuisine filter) **+** a right-edge push-drawer planner built on `usePlanner`.
- Implement: the hairline tab with rotated eyebrow + vertical day-mark stack; push reflow (collection container width animates, 3 cols squeeze, 220px height held); ~180ms width-only animation; tab-unfurls-into-panel with flipping chevron.
- Open/close: drag-to-right-edge auto-opens (closes after drop); manual open via tab (stays open); arm-a-day-then-click for click-to-add; clicking a closed day's `+` opens armed. Keep drag-to-plan working.
- Pinned-bottom "Make shopping list · N meals" button → links to `/meal-planner`. No inline list in the drawer.
- **Acceptance:** with the drawer closed the collection is calm and full-width; dragging a card toward the edge opens the planner and a drop assigns + auto-closes; manual open stays; arming a day + clicking a card assigns it; the tab shows one mark per planned day; the button is disabled until meals exist and navigates to a pre-generated list.

### Phase E — Mobile + fences
- At ~768px: collapse to 1-column collection, remove the drawer/tab/push entirely, surface an "Open meal planner" link. Verify `/meal-planner` is the full planning path on touch.
- Re-check the out-of-scope fence: hero layout, oxblood dots, paper grain, WorldMap structure, header search all unchanged.
- **Acceptance:** no horizontal scroll or broken push layout under 768px; the fenced items are untouched beyond token sweeping; `npm run build` clean.

---

## Notes for the implementer
- Hosting: Netlify; CMS at `/admin` (Decap). Keep token/structure changes CMS-safe.
- The site uses Astro 5 + React 19 islands + Tailwind v4 (utilities barely used — mostly `@theme` tokens + custom CSS + inline styles).
- `public/styles/global.css` is already a dead 1-line file and is not imported — ignore it.
- Prefer one source of truth for the card's classes/spec so home and cuisine can't drift; if the Astro/React boundary for `RecipeCard` proves awkward, an Astro card + mirrored markup is an acceptable fallback **only** if the shared CSS spec stays single-sourced.
