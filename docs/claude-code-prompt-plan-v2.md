# Claude Code prompt — implement recipe-site-update-plan-v2

> Before starting the session, commit these two files into the repo so I can read them:
> `docs/recipe-site-update-plan-v2.md` and `docs/recipe-site-design-context.md`.
> Then paste everything below this line as the first message.

---

Implement **Phases 8–11** of `docs/recipe-site-update-plan-v2.md` in this repo.

## Read first, in this order

1. `docs/recipe-site-update-plan-v2.md` — the authoritative spec. Every decision in it
   was already deliberated; do not re-litigate or "improve" the design (e.g. do not
   re-add a flight tween, do not add slot labels to planner days, do not keep the
   sidebar behind a flag).
2. `docs/recipe-site-design-context.md` — design language and tokens. All new UI must
   use existing CSS variables and the established grammar (muted Garamond text
   affordances, oxblood ticks, no pills/boxes/new chrome).
3. The files each phase touches, before planning that phase: `src/layouts/BaseLayout.astro`,
   `src/pages/cuisines/[cuisine].astro`, `src/pages/index.astro`,
   `src/components/WorldMap.tsx`, `src/components/usePlanner.ts`,
   `src/components/PlannerDrawer.tsx`, `src/components/MealPlannerIsland.tsx`,
   `src/components/RecipePageIsland.tsx`, `src/content/meta/cuisines.json`,
   `public/geo/countries-110m.json`.

## Working method

- Work **strictly in phase order 8 → 9 → 10 → 11**; they share map code and each builds
  on the previous. Within Phase 10, order is T1 → T2 → T3, and **T4 (reverse morph) is
  last of everything** — see its bail-out clause below.
- **Plan before each phase**: present a short per-phase plan (files touched, new
  modules, test/verify steps) and wait for my approval before editing.
- One git commit per completed sub-block (8, W1, W2, W3, T1, T2, T3, T4, P1, P2, P3,
  P4), message format `phase-8: remove sidebar, add back-link + map snapshot` etc.
  Work on a branch `feature/plan-v2`.
- `npm run build` must pass at every commit. Add `npm run prebuild` (completeness check
  + silhouette generator) wired into the build. Do not commit generated silhouettes
  (git-ignore `src/generated/`).
- Use subagents only for **read-only work**: codebase exploration, and a review pass per
  phase (a fresh-context subagent reads the diff against the plan's acceptance criteria
  and reports mismatches). Do not parallelize implementation across subagents — Phases
  8–10 all touch `WorldMap.tsx` and would conflict.

## Style constraints

- Frontend stays TypeScript/Astro/React as-is. Keep code **modular and as short as
  possible**; brief section comments (a few words) labeling what each block does.
- No new runtime dependencies. Dev-dependencies only if the silhouette generator needs
  them (e.g. `topojson-client`, `d3-geo` if not already available transitively) — ask
  first.
- Minimal-diff discipline: don't reformat untouched code, don't rename things the plan
  doesn't rename.

## NLP-plan placeholders (important scope boundary)

A separate NLP integration plan (not in this repo yet) will later add ingredient
enrichment, category buckets, and merged day-notes to the shopping list. **Do not build
any of that.** Concretely:

- `generateList()` / `downloadList()` keep today's day → recipe grouping and raw-text
  items. They must additionally apply each meal's servings ratio (P3) to raw lines via
  the shared quantity util (P4).
- Leave one clean seam: pass generated items through a single identity function
  `enrichShoppingItems(items) { return items; } // TODO(nlp-plan): KG enrichment,
  category buckets, merged day notes — see nlp-integration-update-plan.md` in
  `usePlanner.ts`.
- `ShoppingItem` may gain no new fields now. No category UI, no reorder bar, no merging.

## Per-phase acceptance gates (verify before committing)

- **Phase 8:** no sidebar anywhere; `/cuisines/*` pages full-width with a muted
  "← Back to the map" link → `/#map`; clicking a country then navigating back restores
  the exact at-click framing + mode; a subsequent fresh visit to home gets default
  framing. Snapshot already includes `slug`.
- **Phase 9 / W1:** inline dict deleted; `country-regions.json` keyed by numeric feature
  id covers all 177 features; completeness check validates both directions **and** that
  region values exist in `cuisines.json`; deliberately breaking one entry fails the
  build. W2: dead shapes are decorative paths (no hover/caption/cursor/focus/ARIA);
  region mode draws the full atlas with no holes; country-mode aliveness is strict
  leaf-only (verify: no Middle East country lights up). W3: `central-asia` added;
  assignments match the plan's table exactly.
- **Phase 10 / T1:** map clicks navigate via `navigate()` from
  `astro:transitions/client` (both motion branches). T2: merge logic extracted to a
  shared module imported by both `WorldMap.tsx` and the generator; silhouettes for all
  slugs + projected bboxes emitted at prebuild; cuisine header inlines its silhouette in
  static HTML. T3: single ~400 ms overlay morph (fixed-position overlay SVG with
  `view-transition-name: cuisine-shape`, header carries the same name); flight-tween
  machinery removed; reduced-motion = instant; no-support = Astro fallback crossfade.
  T4: implement per the plan's after-swap injection spec, but **if scroll-timing tuning
  is not converging, stop, keep the reverse crossfade, and report** — the plan's
  bail-out clause is binding.
- **Phase 11 / P1:** `meals[day]` is `PlannedMeal[]` capped at 4, per-instance ids,
  `servings`/`baseServings` fields; loading a pre-migration localStorage week (write a
  test fixture) does not crash and wraps correctly. P2: `moveMeal` +
  drag-move on both surfaces with the `{kind:'move'}` payload discriminator; full days
  blocked exactly as specced; tap-to-move on `/meal-planner` doubles as the keyboard
  path; drawer stays drag-only and scrolls. P3: stepper per meal chip on
  `/meal-planner` only, bounds 1–12, `resetList()` on change. P4: shared quantity util
  with unit tests covering `400g chicken thighs`, `1.2kg beef chuck`, `1.5 litres`,
  fractions, ranges, and unquantified lines; `RecipePageIsland` uses it; the old
  whitespace-requiring regex is gone.
- Add small unit tests where the plan's logic is pure (quantity util, completeness
  check, migration shim, moveMeal capacity rules). No test framework churn — use
  whatever the repo has, or plain `node --test` for the prebuild scripts.

## Finish

After Phase 11: update `docs/recipe-site-design-context.md` per the plan's
"Design-context sync" section (that file is the KB copy — edit it in place here),
then produce a short summary of every commit + any deviations from the plan.
