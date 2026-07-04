# Recipe Site — Refinement Plan (Round 2)

For Claude Code. This **builds on the already-shipped phases 0–5** (type/spacing scales,
shared `RecipeCard`, `usePlanner` + `localStorage`, the home push-drawer, mobile fence).
It refines the *look* after reviewing the live build: de-boxing, a single-white + oxblood
separation language, a globally-pinned planner, and a collection preview → full `/recipes`
page.

See `recipe-site-design-context.md` for the locked direction.

---

## Decisions — do not re-litigate

**Separation language (replaces "hairlines do the structural work")**
- **One white only.** Background is `--color-paper` everywhere. **No warm-tint zone bands**
  (don't use `--color-surface` as a section/planner fill).
- **Sections are separated by space + a short oxblood "tick"** — a 48×2px `--color-oxblood`
  bar above each section eyebrow. **No full-width rules between sections, no bordered/boxed
  panels.**
- **Oxblood is now the single working accent** (deliberate evolution from "oxblood is rare"):
  it carries the ticks, section eyebrows, the "View all" link, the planner rail divider +
  day-marks + open chevron, and primary actions. **Olive is reserved for seasonal cues only**
  and is not used structurally for now.
- Card cuisine eyebrows stay **oxblood** for now. (If the page reads too red once live,
  demoting them to `--color-ink-muted` is a one-line toggle — note it, don't pre-apply it.)

**De-boxing**
- Remove the home collection's `max-height: 70vh` + inner `overflow-y: auto`. The collection
  flows in normal page layout (its length is bounded by the *preview*, below — not a scrollbox).
- `RecipeCard`: **remove** the per-card top hairline (`borderTop`) **and** the `<hr>` between
  title and meta. Cards separate by grid **row-gap + whitespace** only. Keep the squared 220px
  `object-fit: cover` image.
- Collection grid gap becomes `var(--space-2xl) var(--space-lg)` (add the row gap).

**Globally-pinned planner**
- Extract the drawer out of `CollectionPlannerIsland` into a standalone **`PlannerDrawer`**
  island built on `usePlanner`.
- Mount it **once in `BaseLayout`** on every browse surface — home, `/recipes`, and cuisine
  pages — and **exclude it on `/meal-planner`** (pass a `showPlanner` flag from the page, or
  check the route).
- It is **`position: fixed; right: 0`**, full viewport height, so the **closed tab sits flush
  to the viewport edge** (this fixes the "right margin" + the over-large closed band). Closed =
  slim tab (~32–38px) with the vertical day-mark stack, rotated "Meal planner" eyebrow, chevron.
- **Push, via page padding:** opening it animates a `padding-right: 340px` (or margin) onto the
  page content wrapper so the content shifts left and nothing is occluded; closing animates it
  back. Width-only / padding-only transition, ~180ms.
- Drag-to-plan works from **any** `RecipeCard` grid (home preview, `/recipes`, cuisine pages)
  onto the fixed drawer; same drag-to-edge auto-open (closes after drop) and arm-a-day
  click-to-add as before. All state via the shared `localStorage` week.
- Mobile (<768px): drawer hidden entirely; show the "Open meal planner" link (as already built).

**Collection preview + `/recipes`**
- **Home** shows a **2-row preview** (6 cards; newest-first by default) then a **"View all N
  recipes →"** oxblood link. Keep the working search box — searching filters the preview so any
  recipe can still be surfaced and dragged to the planner.
- **New page `src/pages/recipes/index.astro`** = the full, uncapped editorial collection grid
  (all recipes, search + cuisine filter, the global planner present). This is the real "browse
  everything" home.
- Grid stays **fixed 3 columns**, squeezing when the planner pushes; **1 column < 768px**.
- Content frame for browse pages widens to **~1120px** (add `--max-wide: 1120px`); reading/detail
  layouts keep their current widths.

**Housekeeping (in this round)**
- **Sweep `index.astro`'s `<style>`** — it was missed in Phase A (`1.75rem`, `3.5rem`, `5rem`,
  `0.875rem`, `-1rem` etc.). Map to type/spacing tokens.
- **Section mastheads:** home section headings ("All recipes", "Around the world") use
  `--text-section`; lead each with the oxblood tick + eyebrow.
- **All-serif cleanup:** remove the `Schibsted Grotesk` (`SANS`) usage that crept into the
  `CollectionPlannerIsland` toolbar (search/filter/count/day labels) — honour the all-serif
  deferral; use EB Garamond + `onum`.
- **Language:** set the page titles to English (`title="Home"`, `title="Meal Planner"`); the
  Norwegian/English question is otherwise still open but the home default is English.
- **Content — broken images:** several recipes' `image` frontmatter points to missing files, so
  cards render a broken-image icon. Audit `src/content/recipes/*`; for any missing image, either
  add the file or set `image` to null so `RecipeCard` falls back to the stone placeholder.

**Out of scope this round (do not touch)**
- Recipe-detail **hero layout**; **oxblood-dot ingredient audit**; **paper grain**; **header NLP
  search**; **nutrition wiring**. Everything else stays as shipped.

---

## Phases

### R1 — Separation language + de-boxing
- Add a `.section-tick` utility (`width:48px;height:2px;background:var(--color-oxblood)`) and a
  section-masthead pattern (tick → oxblood eyebrow → `--text-section` heading) to `global.css`.
- Remove any `--color-surface` zone fills; confirm single paper background.
- `RecipeCard`: drop the `borderTop` and the title/meta `<hr>`; keep squared 220px image.
- Collection grid: remove `max-height:70vh` + inner scroll; set gap `var(--space-2xl) var(--space-lg)`.
- **Acceptance:** no boxed scroll area; cards separated by space only; sections marked by oxblood
  ticks on one white background; no full-width section rules.

### R2 — Global `PlannerDrawer`
- Create `src/components/PlannerDrawer.tsx` from the current drawer code, on `usePlanner`,
  `position: fixed; right:0`.
- Mount in `BaseLayout` for browse pages; exclude on `/meal-planner`. Add a page-content wrapper
  that animates `padding-right` when the drawer opens (push).
- Verify drag-to-plan + arm-and-click + drag-to-edge auto-open from any RecipeCard grid; closed
  tab flush to the viewport edge.
- **Acceptance:** the planner is reachable on home, `/recipes`, and cuisine pages but not
  `/meal-planner`; opening pushes content left with no occlusion; closed tab is flush right with
  no gap; one shared week across all surfaces.

### R3 — Preview + `/recipes`
- Home: render 6 newest cards + "View all N recipes →" → `/recipes`; keep search filtering the
  preview.
- Create `src/pages/recipes/index.astro`: full grid (all recipes), search + cuisine filter,
  `--max-wide` frame, global planner present.
- **Acceptance:** home is ~2 rows tall with Explore directly below; `/recipes` shows the full
  collection uncapped; both 3-col (1-col < 768px) and squeeze when the planner pushes.

### R4 — Housekeeping
- Sweep `index.astro` `<style>` to tokens; apply section mastheads; set English page titles.
- Remove Schibsted Grotesk from the collection toolbar (all-serif).
- **Acceptance:** no hardcoded sizes/spacing remain in `index.astro`; toolbar is all-serif;
  titles read "Home"/"Meal Planner".

### R5 — Content pass
- Audit recipe `image` frontmatter; fix or null missing images so no broken-image icons render.
- **Acceptance:** every card shows either a real photo or the stone placeholder — never a broken
  icon.

---

## Notes
- Hosting: Netlify; CMS at `/admin` (Decap). Keep changes CMS-safe.
- `--color-surface` stays a token but is currently **unused** as a zone fill — that's intended.
- The split-accent option (olive separators + oxblood text) and demoting card cuisine labels to
  muted are both noted as easy later toggles if the single-oxblood look reads too warm.
