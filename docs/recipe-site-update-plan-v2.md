# Recipe Site — Update Plan v2

Continues `recipe-site-update-plan.md` (Phases 0–7). Phases 8–11 below implement the
decisions resolved in the July 2026 grilling session (cuisine navigation, map
completeness, shape-morph transition, multi-meal planner). The shopping-list /
knowledge-graph work lives in its own plan: `nlp-integration-update-plan.md`
(Phase 12 here is just the dependency pointer).

Ordering is deliberate: **8 → 9 → 10** share map code and build on each other;
**11** is independent and can run in parallel; **12 (NLP plan)** depends on 11.

---

## Phase 8 — Cuisine-page navigation + map state restore

Replace the leftover cuisine sidebar with map-first navigation.

- [x] Make `/cuisines/[cuisine].astro` `fullWidth={true}`; delete the now-dead
      sidebar branch (`layout-sidebar`, `sidebar-cuisines`, related CSS) from
      `BaseLayout.astro`. *(Done: the `fullWidth` prop itself was removed — the
      cuisine page was its last consumer; all pages now render a bare `<main>`.)*
- [x] Add a muted Garamond **"← Back to the map"** link above the "Cuisine" eyebrow
      on all cuisine pages (leaf *and* region), href `/#map`.
- [x] Add `id="map"` to the map section on `index.astro`.
- [x] **State restore (consume-once):** in `WorldMap.tsx`, on click — *before* any
      navigation motion starts — write `{ coordinates, zoom, mode, slug }` from
      `positionRef.current` to `sessionStorage` (`map:snapshot`). The `slug` field
      is unused until Phase 10 T4 but written from day one.
- [x] On map mount: read + delete the snapshot; if present, initialise position and
      country/region mode from it. Instant restore, **no reverse flight**. *(Plus a
      `pageshow` handler: browser-back via bfcache doesn't remount the island, so
      the snapshot is consumed there too.)*
- [x] Reduced-motion path takes the same snapshot before immediate navigation.

**Acceptance:** no sidebar anywhere; back-link and browser back both land on the map
at the exact at-click framing and mode; a later fresh visit to home gets default
framing.

---

## Phase 9 — Map completeness + dead-land model

Root cause being fixed: `WORLD_ATLAS_COUNTRY_TO_SLUG` is a hand-maintained inline
dict keyed by name — 79 of 177 topology features are unmapped (invisible in region
mode), and 3 entries are silent zombies from name drift (`Czech Republic` vs
`Czechia`, `Bosnia and Herzegovina` vs `Bosnia and Herz.`, `North Macedonia` vs
`Macedonia`).

**W1 — Data-driven mapping + loud failure**

- [x] New `src/content/meta/country-regions.json`: one entry per topology feature,
      keyed by **numeric feature `id`** (stable ISO codes), with a human-readable
      `name` field and a `region` value that is either a region slug or `null`
      (inert visual land — drawn tan, never merged, never interactive).
      *(Deviation: Kosovo, N. Cyprus and Somaliland have no `id` in the 110m
      topology — they're keyed by `name`; shared `featureKey` rule = id ?? name.
      File shape is `{ "countries": { … } }` to coexist with the meta collection
      schema.)*
- [x] `WorldMap.tsx` consumes this file; delete the inline dict. *(Malta, Bahrain,
      Singapore from the old dict aren't 110m features — always dead entries,
      dropped.)*
- [x] **Build-time completeness check** (prebuild script, shares an npm step with
      Phase 10 T2): validates *both directions* — every topology feature id is
      mapped, every mapping entry matches a real feature, every non-null region
      value exists in `cuisines.json`. Any failure = failing build.
      *(`scripts/check-country-regions.mjs` + `node --test` unit tests; verified a
      deliberately broken entry fails `npm run build`.)*

**W2 — Dead-land interactivity model**

- [x] A shape is **alive** iff it resolves to a cuisine slug with recipes; alive =
      sage fill, olive hover, caption update, pointer cursor, click/keyboard nav,
      `tabIndex`/`role`/`aria-label`.
- [x] Everything else is **fully dead**: tan fill, no hover recolor, no caption
      change, default cursor, no focus/ARIA semantics — a decorative path. This
      shrinks the M4 accessibility surface to live shapes only.
- [x] Dead regions still **render** as merged shapes (tan, no internal borders) so
      the full atlas is always drawn regardless of recipe coverage.
- [x] **Country-mode aliveness is strict leaf-only:** a country is alive iff its
      *own leaf cuisine* has recipes. Countries mapped straight to a region slug
      never light up from region-tagged recipes (no more "all 14 Middle East
      countries sage from 2 recipes"). Region-tagged recipes are reachable in
      region mode only — region tags stay reserved for genuinely non-placeable
      dishes, per the taxonomy doc.

**W3 — Taxonomy additions**

- [x] Add **`central-asia`** as the 16th region to `cuisines.json`
      (`parent: null`).
- [x] Full assignment of the 79 previously unmapped features:

| Region | Gets |
|---|---|
| `northern-europe` | UK, Ireland, Greenland |
| `central-europe` | Belgium, Netherlands, Luxembourg, Czechia |
| `balkan` | Bosnia and Herz., Macedonia, Kosovo |
| `mediterranean` | N. Cyprus |
| `middle-east` | Georgia, Armenia, Azerbaijan |
| `central-asia` | Kazakhstan, Uzbekistan, Turkmenistan, Kyrgyzstan, Tajikistan, Afghanistan |
| `south-asia` | Bhutan |
| `southeast-asia` | Brunei, Timor-Leste |
| `oceania` | Papua New Guinea, Fiji, Solomon Is., Vanuatu, New Caledonia |
| `central-america` | Bahamas, Belize, Dominican Rep., Haiti, Jamaica, Puerto Rico, Trinidad and Tobago |
| `south-america` | Guyana, Suriname, Falkland Is. |
| `north-africa` | W. Sahara, Mauritania |
| `sub-saharan-africa` | remaining 36 (Angola … eSwatini, incl. S. Sudan, Somalia, Somaliland, Madagascar) |
| `null` (inert) | Antarctica, Fr. S. Antarctic Lands |

*(Done — actual leftover count is 37, not 36; all African as intended.)*

- [x] Fix the three name-drift zombies via id keying (they become ordinary mapped
      entries). *(Fixed via the table above: Czechia → central-europe, Bosnia and
      Herz. + Macedonia → balkan.)*

**Acceptance:** every landmass renders in both modes; region shapes have no holes;
only recipe-bearing shapes react to anything; build fails if a future topology swap
or typo leaves a feature unmapped.

---

## Phase 10 — Shape-morph transition (map → cuisine page)

Supersedes the Phase 7 M3 crossfade *and* the backlogged "country-shape morph" item.
Decision: **the morph is the flight** — the camera-zoom tween is removed, replaced by
one continuous shared-element motion (~400 ms, ease-out).

**T1 — Prerequisite fix**

- [x] Replace `window.location.href` in `handleNavigate` with `navigate()` from
      `astro:transitions/client` (both normal and reduced-motion branches).
      Currently every map click is a full page load that bypasses `<ClientRouter />`
      entirely — there has never actually been a crossfade.

**T2 — Silhouette generator (build-time, Node)**

- [x] Extract the region-merge logic from `WorldMap.tsx` into a shared module;
      both the runtime map and the generator import it (identical geometry is what
      makes the morph seamless — same `countries-110m.json`, same merge, same
      Mercator projection settings). *(`src/lib/regionGeometry.mjs`; review
      verified runtime vs generated `d` strings byte-identical. Lebanon remapped
      → `lebanese` so every leaf has geometry; d3-geo added as devDependency —
      both approved.)*
- [x] Prebuild Node script emits one small SVG silhouette per cuisine slug — **all
      slugs** in `cuisines.json`, not just recipe-bearing — into
      `src/generated/silhouettes/` (git-ignored; Netlify regenerates
      deterministically). Sibling of the W1 completeness check under one
      `npm run prebuild`. *(Also wired as `predev` so dev servers have
      silhouettes.)*
- [x] The generator **also emits each shape's projected bounding box** in base SVG
      coordinates (groundwork for T4; ~10 extra lines against the same projection
      module). *(`manifest.json`; the silhouette `viewBox` carries the same bbox.)*
- [x] Cuisine page header inlines its silhouette at first paint (static HTML — a
      late-arriving element cannot participate in a view transition).

**T3 — Forward morph**

- [x] Constraint driving the pattern: `view-transition-name` cannot target an SVG
      *child* path. On click: read the clicked path's live screen box via
      `getBoundingClientRect()` (automatically accounts for pan/zoom), spawn a
      `position: fixed` overlay `<svg>` of just that shape exactly over the real
      one, with `view-transition-name: cuisine-shape`.
- [x] Header silhouette carries the same `view-transition-name`; call `navigate()`;
      the browser morphs overlay-box → header-box. Identical geometry + aspect
      ratio ⇒ distortion-free "the country lands in the header".
- [x] Remove the flight-tween machinery (`animateFlight` becomes dead code); the
      Phase 8 snapshot logic is untouched (fires pre-motion either way).
      *(Deleted outright, incl. the centroid plumbing that only served it.)*
- [x] Timing via `::view-transition-group(cuisine-shape)` CSS: ~400 ms, ease-out.
- [x] **Reduced motion:** no morph, no crossfade — instant navigation. *(Astro's
      own `@media (prefers-reduced-motion)` rules kill all transition animation.)*
- [x] **No-support fallback** (older Safari/Firefox): Astro `fallback="animate"`
      simulated crossfade; morph silently absent. Nothing to build.

**T4 — Reverse morph** *(sequenced second — ship T1–T3 first; reverse-crossfade is
the contractual fallback by construction: missing named element ⇒ browsers just
crossfade)*

- [x] Trigger: arriving at home with a `map:snapshot` present (covers browser back
      *and* the "← Back to the map" link uniformly).
- [x] In `astro:after-swap` (runs inside the view-transition callback, so injected
      DOM is captured): inject a fixed overlay SVG of the slug's silhouette, named
      `cuisine-shape`, at a screen rect computed from the T2 projected bbox + the
      restored ZoomableGroup transform + the map container's post-swap rect.
      *(Implementation notes: the map island is `client:only`, so a server-rendered
      `.worldmap-frame` div now reserves the map's height — that is the measurable
      post-swap rect and also fixes `/#map` anchor-scroll accuracy. The snapshot
      gained a `projected` field (base-coord projection of the centre) so the
      swap-time script needs no d3. The silhouette is cloned from the outgoing
      cuisine header in `astro:before-swap`; its `viewBox` carries the projected
      bbox. Astro scrolls before `astro:after-swap`, so the rect is scroll-safe.)*
- [x] WorldMap hydrates, restores the Phase 8 position (now load-bearing — the real
      country must render exactly under the overlay), emits an event
      (`worldmap:restored`); overlay removed invisibly (plus a 1.5 s hard
      fallback).
- [ ] Known risks, accepted: scroll-timing of the rect measurement (where the tuning
      hours go) and a possible cold-cache beat where the shape sits on unpainted
      ocean. **Bail-out clause:** if scroll-timing tuning exceeds roughly a session
      of effort, keep the reverse crossfade and stop — nothing else depends on it.

**Acceptance:** clicking a live shape produces one continuous lift-into-header motion
with no hard cut; reduced-motion users get instant navigation; unsupported browsers
get a crossfade; back-navigation restores map state (Phase 8) with, eventually, the
shape flying back out.

---

## Phase 11 — Planner: multi-meal days, move, servings

Scope change resolved in session: the one-meal-per-day restriction is removed
(breakfast/lunch planning), which supersedes the swap-on-occupied design.

**P1 — Data model**

- [x] `meals[day]: PlannedMeal` → `PlannedMeal[]`, **cap 4 per day**.
- [x] Meals gain a stable per-instance `id` (nanoid-style) — `recipeId` is no longer
      unique (same recipe twice in a week/day is legitimate).
- [x] `PlannedMeal` gains `servings` and `baseServings` (see P3).
- [x] `selectRecipe` / `addCustom` become append-with-capacity-check;
      `removeMeal(day)` → `removeMeal(day, mealId)`; `generateList` /
      `downloadList` iterate arrays.
- [x] **localStorage migration shim** in `loadWeek`: non-array stored value → wrap
      as `[meal]`, backfill instance id + servings fields. Without it the deploy
      crashes every existing week.
- [x] Within a day, meals are an **unlabeled ordered list** (no breakfast/lunch slot
      labels, no within-day reordering in v1 — workaround is move-out-move-back;
      arrays are ordered, so within-day insert stays a pure additive upgrade).

**P2 — Move interactions**

- [x] New `usePlanner` primitive `moveMeal(fromDay, mealId, toDay)`: remove from
      source, append to target. Calls `resetList()` like every other mutation.
- [x] **Full target day (4 meals) = blocked**: no-drop cursor + no highlight on
      drag; armed-day card-click quietly no-ops (day auto-disarms, muted note);
      tap-to-move target inert. Drop on same day = no-op.
- [x] Drag on **both surfaces** (drawer + `/meal-planner`): day rows / meal chips
      become drag sources; `dataTransfer` payload gains a discriminator
      (`{ kind: 'move', fromDay, mealId }` vs the existing recipe-add payload) so
      one drop handler serves both; `dropEffect` `'move'` vs `'copy'`.
- [x] **Tap-to-move on `/meal-planner`** (touch + keyboard path in one): tap a meal
      chip → arms (oxblood tint, same grammar as the drawer's armed day) → tap a
      destination day → move; tap elsewhere disarms. Focus + Enter follows the same
      states. Drawer stays **drag-only** (desktop-only by definition; keep it slim).
- [x] Drawer geometry: day rows grow with up to 4 chips; panel gets
      `overflow-y: auto`; closed-tab day-marks stay binary (mark = ≥1 meal).

**P3 — Per-meal servings scaler**

- [x] Grain: **per meal instance** — `servings` defaults to the recipe's frontmatter
      `servings` (stored as `baseServings` at add-time); ratio =
      `servings / baseServings`. Custom dishes get no scaler.
- [x] Placement: **`/meal-planner` page only** (drawer stays add-and-arrange; the
      page is also the mobile surface). UI: the recipe page's −/+ stepper grammar,
      small oldstyle number per meal chip. Bounds 1–12.
- [x] Ratio applies at `generateList()` — each item's quantity scales by *its own
      meal's* factor before any same-day merging (see NLP plan). Changing servings
      calls `resetList()` (the generated list is a snapshot; never mutate under
      checked items).

**P4 — Shared quantity util (+ recipe-page bug fix)**

- [x] Extract quantity parsing/scaling into one shared module with two consumers:
      the recipe-page scaler and the shopping list's degraded mode (NLP plan N4).
- [x] Fix the root-cause bug: `scaleIngredient`'s regex requires whitespace after
      the quantity, so glued units (`400g chicken thighs`, `1.2kg beef chuck`)
      silently pass through unscaled. Accept an attached unit suffix; scale the
      number; preserve the unit. Keep existing fraction/range handling.

**Acceptance:** a week can hold up to 4 meals per day and survives the deploy via
migration; meals move by drag (desktop) and tap (touch/keyboard) with full days
honestly blocked; per-meal servings flow into the shopping list; `400g` lines scale
correctly on recipe pages.

---

## Phase 12 — Shopping-list categorisation (pointer)

Lives in **`nlp-integration-update-plan.md`** (pipeline + API + frontend framework).
Depends on Phase 11 (instance ids, scaler, shared quantity util). Supersedes the
Phase 3 skeleton in the original plan where they overlap.

---

## Design-context sync (do alongside the phases)

Update `recipe-site-design-context.md`:

- Cuisine pages: sidebar removed; "← Back to the map" link is the return route;
  map restores at-click state via consume-once snapshot.
- Map: country→region mapping is data-driven (`country-regions.json`, id-keyed)
  with a build-time completeness check; **dead-land model** (only recipe-bearing
  shapes are interactive; full atlas always drawn); country mode is strict
  leaf-only; **16 regions** (add `central-asia`).
- Page transitions: flight tween retired — the **country-shape morph is the
  flight** (~400 ms overlay pattern); reverse morph phased with crossfade fallback;
  reduced motion = instant.
- Planner: up to 4 meals per day (unlabeled ordered list), move by drag/tap,
  per-meal servings scaler on `/meal-planner` only.
- Shopping list: grouped by shopping-category buckets with per-ingredient day
  notes (see NLP plan); day→recipe grouping is the degraded mode.
- Backlog updates: remove "country-shape morph" and "restore pan/zoom state"
  (now in-plan); keep "split sub-saharan-africa" note.
