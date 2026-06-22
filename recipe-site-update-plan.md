# Recipe Site — Update Plan

Ordered and phased. Phases 0–6 are **shipped** (committed to `main`).
See `claude-code-refinement-plan.md` for Phase 6 per-file detail.

See `recipe-site-design-context.md` for the locked direction these tasks implement.

---

## Phase 0 — Design-system foundations ✅ shipped

- [x] Single source of truth for tokens (Tailwind `@theme`).
- [x] Delete the duplicate stylesheet (`public/styles/global.css` now dead/unimported).
- [x] Apply locked token values: paper, surface, stone, ink, muted, hairline, oxblood, olive; retire candle.
- [x] Refactor React islands to consume `var(--color-*)`.
- [x] Editorial utilities: hairline, whitespace, eyebrow label, oldstyle figures.
- [x] Fonts: EB Garamond 400 / 500 / 600 + italic.

---

## Phase 1 — Homepage rebuild ✅ shipped

- [x] Splash component (~100vh): CSS living texture + staggered reveal + scroll cue.
- [x] Sticky header: brand, nav, slim placeholder search.
- [x] Recipe collection: editorial whitespace grid.
- [x] Meal-planner entry in the functional zone.
- [x] Demote `WorldMap` to an "Explore by place" secondary section.
- [x] Remove `DiscoverPanel` and `RecipeSliderIsland` from the homepage.
- [x] Seasonal "in season" line folded into the splash from a single seasonal source.

---

## Phase 2 — Recipe, cuisine & planner polish ✅ shipped (1 open)

- [x] Editorial recipe-detail page (servings scaler, step check-off, keep-awake).
- [ ] **Nutrition panel** — still a placeholder; wired in Phase 3.
- [x] Editorial cuisine pages + quiet badges.
- [x] Editorial meal planner + shopping list.

---

## Phase 3 — NLP integration (when the backend is ready)

- [ ] `PUBLIC_NLP_API_URL` config + graceful degradation.
- [ ] Header search → `POST /api/v1/query` + results view.
- [ ] Nutrition panels → `GET /api/v1/recipes/{slug}` + `/ingredients/{ingredient}/nutrition`.
- [ ] (Optional) discovery facets from `GET /api/v1/recipes/filter`.

---

## Phase 4 — Flourishes ✅ shipped

- [x] Motion level 2: one-time swipeable splash dismiss.
- [x] ~~Side-by-side collection + planner with drag-and-drop.~~ **Superseded** by the push-drawer
      (Phase 5) and then the global pinned drawer (Phase 6).
- [x] Revisited a secondary sans (Schibsted Grotesk) — stayed all-serif; deferral holds. (Phase 6
      removes the bits that crept into the toolbar.)
- [x] Optional mood-led splash variant.

---

## Phase 5 — Scales + editorial collection & planner drawer ✅ shipped

- [x] **A** — type + spacing scales in `@theme`; full sweep (snap to nearest; one-offs left literal).
- [x] **B** — shared `usePlanner` hook + `localStorage`; `/meal-planner` refactored onto it (fully editable).
- [x] **C** — shared `RecipeCard` (squared photos); editorial 3-col collection; widen frame.
- [x] **D** — home push-drawer: tab + day-marks, drag/arm-to-add, mode-based auto-close, pinned button.
- [x] **E** — mobile fence at ~768px (drop drawer, 1-col, link out).

> Post-ship review: the build read **too boxy** and the collection was trapped in a 70vh
> scroll-box; the planner sat inside the centered column (visible right gap). Addressed in Phase 6.

---

## Phase 6 — Refinement round ✅ shipped

See `claude-code-refinement-plan.md` for per-file tasks + acceptance criteria.

**R1 — Separation language + de-boxing**
- [x] One white only; remove any warm-tint zone fills.
- [x] Short **oxblood ticks** + section mastheads replace full-width rules; oxblood = single accent.
- [x] `RecipeCard`: drop the per-card top hairline and the title/meta `<hr>`; separate by space.
- [x] Remove the collection's `max-height:70vh` + inner scroll; add grid row-gap.

**R2 — Global pinned planner**
- [x] Extract drawer → `PlannerDrawer` (on `usePlanner`); `position: fixed; right:0`.
- [x] Mount in `BaseLayout` on home / `/recipes` / cuisine pages; **exclude `/meal-planner`**.
- [x] Push via animated page padding; closed tab **flush to the viewport edge**.

**R3 — Preview + `/recipes`**
- [x] Home shows a 2-row preview + "View all N recipes →".
- [x] New `src/pages/recipes/index.astro` = full uncapped collection (search + filter, planner present).
- [x] Fixed 3-col (squeeze on push), 1-col < 768px; browse frame `--max-wide: 1120px`.

**R4 — Housekeeping**
- [x] Sweep `index.astro` `<style>` to tokens (missed in Phase A); apply mastheads.
- [x] Remove Schibsted Grotesk from the collection toolbar (all-serif).
- [x] English page titles (`Home`, `Meal Planner`, `Recipes`).

**R5 — Content**
- [x] Audit recipe `image` frontmatter; fix or null missing images (no broken-image icons).
  15 of 20 recipes had missing image files; `image:` field removed; cards fall back to stone placeholder.

> Note: "newest-first" home ordering requires a `date` field in the recipe schema — deferred to backlog.

---

## Later / backlog

- Cross-device week sync via `nanostores` over `localStorage` (currently per-device).
- Possible split-accent (olive separators + oxblood text) if single-oxblood reads too warm.
- Oxblood-dot ingredient audit; subtle paper grain; soften the recipe-detail hero.
- Add `date` field to recipe schema + content to enable newest-first ordering on the home preview.

---

## Notes

- Hosting: Netlify; CMS at `/admin` (Decap). Keep token/structure changes CMS-safe.
- Decide Norwegian/English language consistency intentionally (titles default to English now).
