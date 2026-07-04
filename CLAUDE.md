# CLAUDE.md

Context for Claude Code working in this repo. Read this first, then the two living docs it
points to before doing any design or structural work.

## What this is

A personal recipe website ("Magnus & Tessern's Recipes") — a household tool, not a public
product. The goal is a calm, editorial, heirloom-cookbook feel that still gets to the
functional parts fast. Static Astro site with React islands for interactivity.

## Source-of-truth docs (read before changing design or structure)

- **`recipe-site-design-context.md`** — the locked design language (palette, typography,
  separation rules, homepage/browse architecture, what's rejected). Treat it as binding; if
  something seems wrong, ask rather than silently "improving" it.
- **`recipe-site-update-plan.md`** — the phased roadmap and what's shipped vs pending. Update
  the relevant checkboxes when you complete work.

These two files mirror an external knowledge base the maintainer syncs by hand — keep them
accurate and self-consistent when you touch them.

## Tech stack

- **Astro 5** + **React 19** islands, **Tailwind v4** (utilities are barely used — the design
  system lives in `@theme` tokens + custom CSS + inline styles; don't Tailwind-ify everything).
- **EB Garamond** (all-serif identity). Lucide icons. `react-simple-maps` for the world map.
- Hosting: **Netlify**. CMS: **Decap** at `/admin` — keep token/structure changes CMS-safe.
- A separate backend (`cruesli/NLP-project`, `backend/`) will later provide NL query +
  knowledge-graph features; see "NLP integration" below.

## Commands

- `npm install --legacy-peer-deps` — needed: `react-simple-maps` declares an older React peer
  range and conflicts with React 19 on a plain install.
- `npm run dev` / `npm run build` / `npm run preview`. **`npm run build` must pass** before a
  change is considered done.

## Project structure

- `src/pages/` — `index.astro` (splash + collection preview + map), `recipes/index.astro` (full
  collection), `recipes/[slug].astro` (recipe detail), `cuisines/[cuisine].astro`,
  `meal-planner.astro` (full editable planner).
- `src/components/` — key ones: `RecipeCard.tsx` (shared card), `usePlanner.ts` (planner state +
  `localStorage` week + shopping list), `PlannerDrawer.tsx` (global pinned drawer),
  `CollectionPlannerIsland.tsx` (home/`/recipes` collection), `MealPlannerIsland.tsx` (planner
  page), `RecipePageIsland.tsx`, `WorldMap.tsx`, `Splash.astro`.
- `src/content/recipes/*.md` — 20 recipes (Astro content collection). `src/content/meta/`,
  `src/content/meal-plans/`.
- `src/styles/global.css` — `@theme` design tokens (colour / type scale / spacing scale / radius)
  + base styles. `src/data/seasonal.ts`. `src/utils/` (cuisines, slug display, base path).

## Design language (summary — defer to the design-context doc)

- **One white** (`--color-paper`) everywhere; **no tinted zone backgrounds**.
- Separation is **space + short oxblood "ticks"** at section starts. No full-width rules, no
  bordered/filled cards, no boxed scroll areas.
- **Oxblood is the single working accent** (ticks, section eyebrows, links, planner marks,
  primary actions). **Olive is seasonal-only.** Don't reintroduce a second structural colour.
- **All-serif** EB Garamond — the Schibsted Grotesk sans is deferred; don't add it back.
- **Squared** display photography; `--radius-sm` only on tiny utility thumbnails.
- Type scale = semantic `--text-*` tokens (not `--text-base/-sm`, which collide with Tailwind
  defaults in `WorldMap`); spacing = t-shirt `--space-*` (anchored `md = 1rem`). Use tokens, not
  literals, for font-size and structural spacing.

## Architecture notes

- **One planner, shared:** all planner state/logic lives in `usePlanner` (week + `localStorage` +
  shopping list). `PlannerDrawer` and `meal-planner.astro` both consume it — don't duplicate it.
- **Global planner drawer:** `position: fixed; right: 0`, present on every browse surface (home,
  `/recipes`, cuisine pages), **excluded on `/meal-planner`**. Open = push content left via
  animated page padding; closed = slim tab flush to the viewport edge. Watch that it doesn't
  overlap the sticky header or fight the splash's 100vh on first paint.
- **Collection:** home shows a 6-card preview → `/recipes` is the full grid. Fixed 3 columns
  (squeeze when the drawer pushes), 1 column < 768px; browse frame `--max-wide: 1120px`.

## NLP integration (pending)

The frontend will consume the FastAPI backend once ready. A single `PUBLIC_NLP_API_URL` gates all
API features with graceful degradation when unset. Header search → `POST /api/v1/query`; nutrition
panel → `GET /api/v1/recipes/{slug}` + `/ingredients/{ingredient}/nutrition`; future facets →
`GET /api/v1/recipes/filter`. Until wired, these are placeholders — don't fake data.

## Working style

- Keep code **modular, clean, and as short as possible**. Match existing patterns; don't add
  dependencies without asking.
- **Comment to label sections** — a few words each, longer only where logic is non-obvious.
- Go **phase by phase** on multi-step work, one reviewable commit each, with a `build` +
  acceptance check before moving on. Keep diffs small.
- Respect the design-context's out-of-scope items unless explicitly asked (currently: recipe
  hero layout, ingredient-dot audit, paper grain, header NLP search, nutrition wiring).

## Maintainer

AI master's student, primarily a Python developer — so brief, concrete explanations of
TypeScript/Astro-specific choices are welcome when they're non-obvious.
