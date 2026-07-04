# Magnus & Tessern's Recipes — Design Context

A guideline for all future design and build work on the recipe site. This is a
**personal household tool** (mainly for us, not an external audience), so it should
get us into the functional parts fast while still feeling calm and pleasant.

**North star:** a modern heirloom cookbook — simple, clean, warm, personal, authentic.
**Reference:** Phaidon's *Japan: The Cookbook* (Nancy Singleton Hachisu) — editorial
restraint, cream paper, type-led layout, photography treated as precious and used sparingly.

---

## Principles

- Editorial and book-like: **whitespace + generous spacing do the structural work**, marked by
  **short oxblood "ticks"** at section starts — not full-width rules, bordered cards, or boxes.
- **One white only:** a single paper tone throughout; separation comes from space + accent, not
  from tinted zone backgrounds.
- Warmth comes from **paper tone + food photography + the oxblood accent**, not from filled UI chrome.
- **Type-led identity** — all-serif (see Typography).
- **Calm first, function fast**: a brief splash, then straight into the tools.
- **Oxblood is the single working accent**; olive is held back for seasonal cues only.
- **Light mode only** — a cookbook is paper.

---

## Colour palette (single source of truth)

| Token | Hex / value | Role | Notes |
|---|---|---|---|
| `--color-paper` | `#FAF8F2` | The one background | Used everywhere; no second surface tone in layout |
| `--color-surface` | `#F3EFE4` | Reserved | **Currently unused** as a zone fill (single-white decision) |
| `--color-stone` | `#D4D0BF` | Image placeholders / empty states | |
| `--color-ink` | `#292F17` | Primary text | |
| `--color-ink-muted` | `rgba(41,47,23,0.58)` | Secondary text / meta | |
| `--color-hairline` | `rgba(41,47,23,0.12)` | Minimal dividers where needed | Used sparingly, not as section separators |
| `--color-oxblood` | `#7E2625` | **The working accent** | Ticks, section eyebrows, links, planner marks, primary actions |
| `--color-olive` | `#868B59` | Seasonal accent only | Not used structurally for now |
| `--color-map-land`   | `#E5DECE` | Map: countries with no recipes | Tan; only used in the world map |
| `--color-map-active` | `#ACAA8C` | Map: countries/regions with recipes | Sage; only used in the world map |

**Usage rule:** one white, space + oxblood ticks separate sections, oxblood carries structure,
olive is seasonal-only. (Evolution note: the earlier "hairlines do the work / oxblood is rare"
rule was deliberately retired — the build read too boxy, and a single warm accent on plain white
proved cleaner and more characterful.)
**Retired:** candle `#F1ECDB`; warm-tint zone bands.

---

## Typography

All-serif. A secondary sans (Schibsted Grotesk) is deliberately **deferred** — and any place it
crept in (e.g. the collection toolbar) should be returned to EB Garamond.

- **Family:** EB Garamond. Weights 400, 500, 600 + 400 italic.
- **Titles / display:** Garamond 500. **Body / editorial:** Garamond 400; italic for intros and notes.
- **Eyebrow labels:** Garamond **600**, uppercase, letter-spacing ~`0.22–0.26em`, oxblood.
- **Numbers / meta:** oldstyle figures (`font-feature-settings: "onum" 1`).

### Type scale (locked, shipped)

Perfect-fourth (×1.333), body-anchored, in `@theme`, consumed as `var(--text-*)`. Semantic names
(not `--text-base/-sm`, which collide with Tailwind defaults in `WorldMap`). Top three fluid.

| Token | Value | px (max) | Use |
|---|---|---|---|
| `--text-display` | `clamp(2.4rem,5.5vw,3.5625rem)` | 57 | splash title |
| `--text-title` | `clamp(1.9rem,4.5vw,2.6875rem)` | 43 | recipe / cuisine h1 |
| `--text-section` | `clamp(1.5rem,2.6vw,2rem)` | 32 | section mastheads |
| `--text-card` | `1.5rem` | 24 | card titles |
| `--text-body` | `1.125rem` | 18 | body |
| `--text-meta` | `0.84rem` | 13.5 | meta / captions |
| `--text-eyebrow` | `0.75rem` | 12 | caps labels |

### Spacing scale (locked, shipped)

T-shirt names, anchored `--space-md: 1rem`, in `@theme`. `2xs .25 / xs .5 / sm .75 / md 1 /
lg 1.5 / xl 2 / 2xl 3 / 3xl 4 / 4xl 6` (rem). Named by position so values can be retuned freely.

---

## Structure & components

- **Default separation:** whitespace + spacing; a short oxblood tick (48×2px) marks each section
  start. Avoid full-width rules, bordered cards, and boxed scroll areas.
- **Recipe card (shared `RecipeCard`, home + `/recipes` + cuisine pages):** squared 220px
  `object-fit: cover` image, oxblood cuisine eyebrow, Garamond `--text-card` title (2-line clamp),
  muted oldstyle meta (`time · servings · tag`, missing fields dropped). **No per-card rule, no
  hr** — cards separate by row-gap + space. (Card eyebrows may demote to muted ink if oxblood
  reads too heavy — a one-line toggle.)
- **Section masthead:** oxblood tick → oxblood eyebrow → `--text-section` heading.
- **Photography:** **squared** for all display photos; `--radius-sm` only on tiny utility
  thumbnails (22px shopping-list, 32px day-row, meal-picker tiles).
- **Badges / tags:** quiet text, never filled pills.
- **Buttons:** outline / hairline; oxblood for primary actions.
- **Recipe detail:** keep functionality (servings scaler, step check-off, keep-awake); editorial
  styling; nutrition panel pending (see NLP). Hero layout unchanged for now.

### Cuisine taxonomy (two-tier)

Defined in `src/content/meta/cuisines.json`. Two levels:

- **Regions** (`parent: null`) — **16** entries, e.g. `mediterranean`, `middle-east`,
  `northern-europe`, `central-asia`. Cuisine pages for regions aggregate all descendant
  recipes via `getDescendants()`.
- **Country leaves** (`parent: "<region-slug>"`) — 12 entries, e.g. `italian`, `norwegian`,
  `lebanese`, `argentinian`. Each maps to one region parent.

The world map operates on this taxonomy via a **data-driven mapping**:
`src/content/meta/country-regions.json` covers every topology feature (id-keyed; three
id-less disputed territories keyed by name) with a cuisine slug or `null` (inert land).
A **build-time completeness check** (`npm run prebuild`) fails the build if the mapping
and topology ever disagree, or a region slug is unknown. Region mode merges country
polygons by region at runtime (`topojson.merge` via the shared `src/lib/regionGeometry.mjs`).

**Dead-land model:** only recipe-bearing shapes are interactive (sage fill, olive hover,
caption, click/keyboard/ARIA); everything else is a decorative tan path — but the **full
atlas always renders** in both modes (dead regions merge borderless; inert land draws
individually). **Country mode is strict leaf-only:** a country lights up iff its own leaf
cuisine has recipes; region-tagged recipes are reachable in region mode only.

---

## Homepage & browse architecture

**Scroll-away splash (~100vh, every visit)** — masthead (name eyebrow, large Garamond title, thin
rule, self-updating "in season" line, scroll cue) over CSS living texture (drifting warm blobs)
+ staggered type reveal. CSS only. **No featured-recipe hero.**

**Home, after the fold**
1. **Collection preview** — a 2-row (6-card) editorial grid (newest first) + a **"View all N
   recipes →"** link to `/recipes`. Keeps the home short so Explore stays close. The search box
   filters the preview (so any recipe can still be surfaced + dragged to the planner).
2. **Explore by place** — the world map as a full-bleed closing editorial plate: near-fullscreen (`clamp(520px, 86vh, 1040px)`, server-rendered frame), Mercator projection, `--color-map-land` / `--color-map-active` palette. Country · Region toggle (default Region); merged-region polygons via topojson at runtime; only recipe-bearing shapes are interactive (dead-land model). Click a live shape → **country-shape morph** into the cuisine page header (see Motion). Pinch / ⌘+scroll zooms; plain scroll passes through to the page.
3. Footer.

**Cuisine pages** — full-width (the legacy sidebar is gone); header carries the cuisine's
**sage map silhouette** (generated at prebuild, inlined in static HTML) beside the title.
A muted Garamond **"← Back to the map"** link (→ `/#map`) is the return route; the map
restores the exact at-click framing + mode via a consume-once `sessionStorage` snapshot.

**`/recipes` (full collection)** — the uncapped editorial grid of every recipe, with search +
cuisine filter. The real "browse everything" page; cuisine pages remain the browse-by-place route.

**Global meal-planner drawer** — a viewport-pinned (`position: fixed; right: 0`) push-drawer
present on **all browse surfaces** (home, `/recipes`, cuisine pages) and **excluded on
`/meal-planner`**:
- **Closed:** a slim tab **flush to the viewport edge**, with a vertical day-mark stack (oxblood =
  planned), a rotated "Meal planner" eyebrow, and a chevron. An oxblood divider sets it off — no
  tint fill.
- **Open (push):** animates page content left via padding (~180ms) so nothing is occluded; the tab
  unfurls into the 340px panel; chevron flips.
- **Plan from anywhere:** drag any card to the edge (auto-opens, closes after drop) or arm a day +
  click a card. One shared week via `localStorage`; a pinned "Make shopping list · N" button →
  `/meal-planner`.
- **Multi-meal days:** each day holds up to **4 meals** as an unlabeled ordered chip list (no
  breakfast/lunch slot labels). Day rows grow with their chips; the panel scrolls; closed-tab
  day-marks stay binary (mark = ≥1 meal). Meals move between days by **dragging chips**
  (drawer is drag-only); full days are honestly blocked (no-drop cursor, no highlight; armed
  picks quietly no-op with a muted note).
- **Mobile (<768px):** drawer hidden; an "Open meal planner" link routes to the page.

**`/meal-planner` (full, editable)** — its own roomy planning + shopping surface: per-day
search-picker (recipe search + custom-dish text), remove/clear, auto-generated checkable
downloadable shopping list. No drawer here. Shares the `usePlanner` hook + `localStorage` week;
lands with the list generated when reached from the drawer button. Meals move by drag **and**
by **tap-to-move** (tap a chip → arms oxblood → tap a destination day; doubles as the keyboard
path via focus + Enter). Each recipe meal carries a **per-instance servings stepper** (−/+
grammar from the recipe page, oldstyle number, bounds 1–12; custom dishes have none) — the
ratio scales that meal's lines in the generated shopping list.

**Shopping list** — will be grouped by shopping-category buckets with per-ingredient day notes
(see the NLP plan); the current **day → recipe grouping is the degraded mode** and stays as the
fallback. Quantity parsing/scaling lives in a shared util (`src/lib/quantity.mjs`), used by the
recipe-page scaler and the list.

**Grid behaviour:** fixed 3 columns on browse pages (squeeze when the planner pushes), 1 column
< 768px; browse frame `--max-wide: 1120px`; reading/detail layouts keep their widths.

**Header (sticky):** brand, nav (Home, Meal Planner), slim search field (NLP placeholder).

---

## Motion

- **Shipped:** living-texture splash + staggered type reveal (CSS only); one-time swipeable splash
  dismiss; the push-drawer's padding/width animation (~180ms) and tab-unfurl; **Astro `<ClientRouter />`
  site-wide crossfade** (soft page transitions on every navigation).
- **Country-shape morph (the flight tween is retired — the morph IS the flight):** clicking a live
  map shape spawns a fixed overlay of that shape (`view-transition-name: cuisine-shape`) which the
  browser morphs into the cuisine header silhouette, ~400 ms ease-out. **Reverse morph** on return
  to the map (silhouette flies back onto the restored framing, injected at `astro:after-swap`);
  the plain crossfade is the contractual fallback when anything is missing. **Reduced motion =
  instant navigation**; unsupported browsers get the crossfade.
- Calm elsewhere. **Not** a fluid-everywhere treatment.

---

## NLP integration (placeholder now, live later)

Static Astro frontend → FastAPI backend (CORS open). `PUBLIC_NLP_API_URL` gates all API features
with graceful degradation. Header search → `POST /api/v1/query`. Nutrition panel →
`GET /api/v1/recipes/{slug}` + `/ingredients/{ingredient}/nutrition`. Future facets →
`GET /api/v1/recipes/filter`.

---

## Explicitly rejected / out of scope

- Boxed/scroll-capped collections; bordered or filled cards as default.
- Warm-tint zone bands / a second background tone; candle `#F1ECDB`.
- Two-colour zoning (chose a single oxblood accent); olive as a structural colour.
- Dark mode; a big featured-recipe hero; loud fluid page transitions.
- Adding a sans now (Schibsted Grotesk deferred); rounded display photography.
- A meal-planner overlay; a mobile bottom-sheet planner (mobile routes to the page).

---

## State of play

- **Shipped (Phases 0–7):** type/spacing scales; shared `RecipeCard`; `usePlanner` +
  `localStorage`; editorial recipe/cuisine/planner pages; splash. Refinement round also
  complete: de-boxed collection; single-white + oxblood-tick separation; global pinned
  `PlannerDrawer` (`position:fixed; right:0`, push via `padding-right`); home 6-card preview
  and `/recipes` full-collection page; `index.astro` token sweep + mastheads; all-serif toolbar;
  15 broken recipe images nulled (stone placeholder fallback). **Phase 7:** two-tier cuisine
  taxonomy; WorldMap rework (full-bleed, tokenised palette, region merge, keyboard
  accessibility, live ARIA region); Astro ClientRouter view transitions site-wide.
- **Shipped (Phases 8–11, plan v2):** cuisine sidebar removed (map-first navigation with
  "← Back to the map" + consume-once state restore); data-driven country→region mapping with
  build-failing completeness check; dead-land model + strict leaf-only country mode;
  `central-asia` (16 regions, full atlas assigned); country-shape morph forward + reverse
  (flight tween retired); prebuild silhouette generator + inline cuisine-header silhouettes;
  planner multi-meal days (cap 4) with localStorage migration, drag/tap move, per-meal
  servings scaler; shared quantity util (glued-unit `400g` scaling fixed).
- **Later:** NLP wiring (incl. shopping-list category buckets); nutrition panel; oxblood-dot
  audit; paper grain; cross-device week sync (`nanostores` over `localStorage`); possible
  split-accent (olive separators + oxblood text); add `date` field to recipe schema for
  newest-first home ordering; split `sub-saharan-africa` when recipes warrant it.

## Open copy & decisions

- Splash title / welcome copy (placeholder: *"A kitchen, written down"*).
- Language: page titles default to English now; decide Norwegian/English consistency intentionally.
- Whether card cuisine eyebrows stay oxblood or demote to muted once the single-accent look is live.
