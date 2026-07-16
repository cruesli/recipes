# CLAUDE.md

Context for Claude Code working in this repo. Read this first, then the living docs it
points to before doing any design or structural work.

## What this is

A personal recipe website ("Magnus & Tessern's Recipes") — a household tool, not a public
product. The goal is a calm, editorial, heirloom-cookbook feel that still gets to the
functional parts fast. Static Astro site with React islands for interactivity. A Python
knowledge-graph pipeline enriches the recipes **offline** — nutrition, shopping categories,
and stated quantities are baked into static JSON at build time; a small stateless FastAPI
service provides only natural-language search.

## Source-of-truth docs (read before changing design or structure)

- **`recipe-site-design-context.md`** — the locked design language (palette, typography,
  separation rules, homepage/browse architecture, what's rejected). Treat it as binding; if
  something seems wrong, ask rather than silently "improving" it.
- **`recipe-site-update-plan-v3.md`** — the most recent frontend roadmap (Phases 13–16:
  chapter plates, oxblood ink plate, splash rework, voice & finish). Shipped.
- **`nlp-integration-update-plan.md`** — the backend + integration roadmap (N1–N5:
  pipeline changes, shopping-list rework, nutrition/facets/NL search). Shipped static-first.

All roadmap docs are shipped and merged to `main`. Current work is **ad-hoc refinement
batches** from household review sessions (three merged July 2026: planner/shopping-list
polish, map reframing, splash rework; batches 4–6 in review on `feature/repo-sweep`: repo
sweep, assessment fixes, and the **chapter backdrops** — cuisine pages open on a
near-viewport faded-sage country the grid rolls over, replacing the area-budget plates) —
small phase-per-commit batches on a feature branch, no plan doc.

These files mirror an external knowledge base the maintainer syncs by hand — keep them
accurate and self-consistent when you touch them.

## Tech stack

**Frontend** (repo root)
- **Astro 5** + **React 19** islands, **Tailwind v4** (utilities are barely used — the design
  system lives in `@theme` tokens + custom CSS + inline styles; don't Tailwind-ify everything).
- **EB Garamond** (all-serif identity). Lucide icons. `react-simple-maps` for the world map.
- Hosting: **GitHub Pages** (`astro.config.mjs`: site `cruesli.github.io`, base `/recipes`).
  CMS: **Decap** at `/admin` — keep token/structure changes CMS-safe.

**Backend** (`backend/`) — two roles:
- **Ingest pipeline (offline)**: **Python 3.11+**, **RDFLib**. Parses recipes → LLM-normalises
  ingredients (env-driven OpenAI-compatible client; **Gemini** default, CampusAI fallback) →
  Wikidata entity linking → USDA nutrition → builds `graph.ttl` **and** exports per-recipe JSON
  to `src/data/enriched/`. External API calls happen only here; results cached in
  `backend/.cache/` (committed, so re-ingest is free). Manual `data/*_overrides.json` fix bad
  USDA matches / pin QIDs; each run writes `reports/ingest-report.json`.
- **Query service (deployed)**: a **stateless FastAPI** app (`main.py`) — holds no graph. Turns
  a question into a filter object via the LLM + `sentence-transformers` few-shot selection.
  Deployed on **Hugging Face Spaces** (Docker, free CPU). Gated by `PUBLIC_NLP_API_URL`.

## Commands

**Frontend**
- `npm install --legacy-peer-deps` — needed: `react-simple-maps` declares an older React peer
  range and conflicts with React 19 on a plain install.
- `npm run dev` / `npm run build` / `npm run preview`. **`npm run build` must pass** before a
  change is considered done.
- `npm test` — `node --test scripts/*.test.mjs` (the pure `src/lib` helpers).
- `prebuild` (runs on every dev/build) regenerates `src/generated/silhouettes/` (gitignored)
  via `scripts/generate-silhouettes.mjs` — never edit those assets by hand.

**Backend**
- `npm run ingest` (or `python -m backend.ingest`) — runs the full pipeline (parse → normalise
  → link → nutrition → graph + JSON export). Needs `~/.env` with `USDA_API_KEY` and an LLM key
  (`GEMINI_API_KEY` / `LLM_API_KEY` / legacy `CAMPUSAI_API_KEY`). Cached, so re-runs are cheap.
- `uvicorn backend.main:app --reload` — starts the stateless query service locally.
- `pytest` from repo root (pythonpath configured in `pyproject.toml`).

## Project structure

**Frontend** (repo root)
- `src/pages/` — `index.astro` (splash + collection preview + map), `recipes/index.astro` (full
  collection), `recipes/[slug].astro` (recipe detail), `cuisines/[cuisine].astro`,
  `meal-planner.astro` (full editable planner).
- `src/components/` — key ones: `RecipeCard.tsx` (shared card), `usePlanner.ts` (planner state +
  `localStorage` week + shopping list), `PlannerDrawer.tsx` (global pinned drawer),
  `CollectionPlannerIsland.tsx` (home/`/recipes` collection), `MealPlannerIsland.tsx` (planner
  page), `RecipePageIsland.tsx`, `WorldMap.tsx`, `Splash.astro`.
- `src/content/recipes/*.md` — recipe content collection. `src/content/meta/`.
- `src/data/enriched/*.json` — **generated** per-recipe KG export (nutrition + per-line
  category/quantity); do not hand-edit. Consumed via `src/lib/enrichment.ts` (`getEnriched`,
  `CATEGORY_ORDER/LABELS`) — the single seam for the nutrition panel, facets, and shopping list.
- `src/lib/` — pure, node-tested helpers (`scripts/*.test.mjs`): `quantity.mjs`,
  `plannerModel.mjs`, `recipeTime.mjs` (`deriveTotalTime`), `recipeFilter.mjs` (facet matching +
  NL→facet mapping), `shoppingList.mjs` (bucket/merge logic), `regionGeometry.mjs` (shared map
  projection + feature keying — `WorldMap.tsx` and the prebuild scripts must stay in agreement
  through it), plus `enrichment.ts`.
- `src/styles/global.css` — `@theme` design tokens (colour / type scale / spacing scale / radius)
  + base styles. `src/data/seasonal.ts`. `src/utils/` (cuisines, slug display, base path).

**Backend** (`backend/`)
- `parser.py` — parses recipe Markdown + YAML frontmatter into `Recipe` objects.
- `normaliser.py` — batched LLM normalisation of ingredient strings → canonical names + gram
  quantities. One entry per input line guaranteed (compounds collapsed, "or"-alternatives
  pre-stripped).
- `entity_linker.py` — Wikidata `wbsearchentities` + SPARQL → QID, food category, origin,
  dietary flags.
- `nutrition.py` — USDA FoodData Central API → full nutrient profile per ingredient, with
  raw/fresh scoring + Atwater energy fallback; overrides win.
- `graph.py` — RDFLib knowledge graph (`rkg:` namespace at `cruesli.github.io/recipes/kg/`,
  reusing `schema.org` terms where natural). `per_serving_totals` is the shared nutrition math.
- `export.py` — writes `src/data/enriched/*.json` from the ingest maps.
- `ingest.py` — orchestrates the pipeline; serialises `graph.ttl`, JSON export, and the report.
- `main.py` — **stateless** FastAPI: `GET /health`, `POST /api/v1/query` → `{question, filters}`.
  No graph. `Dockerfile`/`README.md` are the HF Spaces deploy (CPU torch, port 7860).
- `models.py` — Pydantic models. `data/` + `reports/` + `.cache/` are committed.

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
  `/recipes`, cuisine pages) and on recipe pages (where a day's + adds the open recipe directly
  via BaseLayout's `currentRecipeId` prop), **excluded on `/meal-planner`**. Open = push content
  left via animated page padding; closed = slim tab flush to the viewport edge. Watch that it
  doesn't overlap the sticky header or fight the splash's 100vh on first paint.
- **Collection:** home shows a 6-card preview → `/recipes` is the full grid. Fixed 3 columns
  (squeeze when the drawer pushes), 1 column < 768px; browse frame `--max-wide: 1120px`.
- **Enrichment as progressive enhancement (static-first):** nutrition, categories, and stated
  quantities come from `src/data/enriched/*.json` at **build time** — no runtime API for recipe
  data. Degradation is one rung: a recipe missing from the export (or a raw line that doesn't
  match) falls back to the classic day→recipe shopping grouping and the "coming soon" nutrition
  placeholder. The only runtime dependency is NL search, gated by `PUBLIC_NLP_API_URL` (unset or
  asleep → the search line hides / degrades; facets below still work).
- **World map framing:** `PROJECTION_CONFIG` in `regionGeometry.mjs` (scale 150, centre 27°E)
  spans Mexico (117°W) to the dateline so New Zealand stays in frame — re-check both landmarks
  before changing it. Panning is clamped to the projected world square (`translateExtent`).
  `generate-silhouettes.mjs` drops remote territories (Svalbard, Jan Mayen, French Guiana) from
  every generated plate via its explicit `REMOTE_TERRITORIES` bbox list; the map keeps them.
- **Shopping list (enriched):** `usePlanner.generateList` joins each meal's raw lines to the
  export; `shoppingList.mjs` builds category buckets + canonical-merged lines with scaled day
  notes. Checked state is a `Set` keyed by `c:<canonical>` (survives bucket reorder); `bucketOrder`
  persists to `localStorage`. The generated list + checked marks + collapsed buckets persist as
  one `localStorage` session (survives mid-shop reloads; any week edit or regenerate resets it).
  Buckets collapse via their header (collapsed shows "· N left"); reordering re-sorts live during
  drag, with an oxblood outline marking the held chip.

## NLP / KG integration (shipped — see `nlp-integration-update-plan.md`)

Implemented static-first, diverging from the plan's original runtime-API shape:

- **N1** — Normaliser emits a 9-bucket shopping category + stated `{amount, unit}`; parser keeps
  section headers; graph carries the new triples. **Done.**
- **N2/N3** — Rewritten: instead of a runtime `GET /recipes/{slug}` + fetch/cache layer, ingest
  **exports** `src/data/enriched/*.json` consumed at build time via `src/lib/enrichment.ts`. **Done.**
- **N4** — Shopping-list rework (buckets, merged day notes, reorder bar, mirrored `.txt`). **Done.**
- **N5** — Nutrition panel (recipe page), client-side facets + NL search (`/recipes`). **Done.**

The deployed query service is stateless; re-ingest + rebuild is the update path when recipes change.

## Working style

- Keep code **modular, clean, and as short as possible**. Match existing patterns; don't add
  dependencies without asking.
- **Comment to label sections** — a few words each, longer only where logic is non-obvious.
- Go **phase by phase** on multi-step work, one reviewable commit each, with a `build` +
  acceptance check before moving on. Keep diffs small.
- Backend changes: run the ingest pipeline and verify graph output before moving to API work.
  Run `pytest` where tests exist.
- `client:only` islands (the map) never paint in headless-Chrome screenshots — verify map
  changes by extracting the hydrated SVG from `--dump-dom` output instead.
- Respect the design-context's out-of-scope items unless explicitly asked.

## Maintainer

AI master's student, primarily a Python developer — so brief, concrete explanations of
TypeScript/Astro-specific choices are welcome when they're non-obvious.
