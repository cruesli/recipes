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
- **One white, plus exactly one sanctioned printed plate:** a single paper tone throughout;
  separation comes from space + accent, not from tinted zone backgrounds. The one exception is
  the **recipe-page ingredient plate** — solid oxblood with paper text (see Structure) — a
  named, functionally motivated exception (the surface you re-locate mid-cooking), never to be
  repeated elsewhere without another explicit amendment.
- Warmth comes from **paper tone + food photography + the oxblood accent**, not from filled UI chrome.
- **Type-led identity** — all-serif (see Typography).
- **Calm first, function fast**: a brief splash, then straight into the tools.
- **Oxblood is the single working accent** (ticks, eyebrows, links, actions — and its one
  monumental use, the ingredient plate). **Sage is the place/material family**: map fills →
  cuisine chapter plates → card placeholder silhouettes. **Olive is the interaction colour
  only** (map/plate hovers) — never structural, and on record as failing text contrast as a fill.
- **Light mode only** — a cookbook is paper.

---

## Colour palette (single source of truth)

| Token | Hex / value | Role | Notes |
|---|---|---|---|
| `--color-paper` | `#FAF8F2` | The one background | Used everywhere; no second surface tone in layout |
| `--color-surface` | `#F3EFE4` | Retired | Parchment panel option considered and rejected (July 2026) |
| `--color-stone` | `#D4D0BF` | Image placeholders / empty states | Placeholder squares carry a light cuisine silhouette |
| `--color-ink` | `#292F17` | Primary text | |
| `--color-ink-muted` | `rgba(41,47,23,0.58)` | Secondary text / meta | |
| `--color-hairline` | `rgba(41,47,23,0.12)` | Minimal dividers where needed | Used sparingly, not as section separators |
| `--color-oxblood` | `#7E2625` | **The working accent** | Ticks, eyebrows, links, planner marks, primary actions, the ingredient plate |
| `--color-olive` | `#868B59` | Interaction colour (hover) + seasonal accent | Map + chapter-plate hovers; never a fill (paper-on-olive ≈ 3.4:1, fails) |
| `--color-map-land` | `#E5DECE` | Tan: land without recipes | Map + inert land inside region plates |
| `--color-map-active` | `#ACAA8C` | Sage: land with recipes | Map fills, cuisine chapter plates |
| `--color-plate-text` | `var(--color-paper)` | Primary text on the ingredient plate | |
| `--color-plate-muted` | paper at ~0.7 | Muted/meta text on the plate | Section sub-headers, meta |
| `--color-plate-hairline` | paper at ~0.18–0.20 | Row dividers on the plate | |

**Usage rule:** one white + one oxblood printed plate; space + oxblood ticks separate sections;
oxblood carries structure; sage is the place/material family (atlas, chapter plates, placeholder
silhouettes); olive is hover-only. (Evolution notes: the earlier "hairlines do the work / oxblood
is rare" rule was retired — the build read too boxy. The absolute one-white rule was amended
July 2026 with the single ink-plate exception; sage-wash and parchment tints for that panel were
considered and rejected — tinted paper is exactly what the rule exists to prevent, while a solid
ink plate is letterpress language, not zoning.)
**Retired:** candle `#F1ECDB`; warm-tint zone bands; `--color-surface` as a zone fill.

---

## Typography

All-serif. A secondary sans (Schibsted Grotesk) is deliberately **deferred** — and any place it
crept in (e.g. the collection toolbar) should be returned to EB Garamond.

- **Family:** EB Garamond. Weights 400, 500, 600 + 400 italic.
- **Titles / display:** Garamond 500. **Body / editorial:** Garamond 400; italic for intros,
  headnotes, and notes.
- **Eyebrow labels:** Garamond **600**, uppercase, letter-spacing ~`0.22–0.26em`, oxblood
  (paper when set on the ingredient plate).
- **Numbers / meta:** oldstyle figures (`font-feature-settings: "onum" 1`).
- **On the ingredient plate:** light serif optically thins on dark ground — the on-plate list
  runs Garamond **500**, stepping back to 400 only if it reads heavy.

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
  start. Avoid full-width rules, bordered cards, and boxes — the ingredient plate is the sole
  sanctioned fill.
- **Recipe card (shared `RecipeCard`, home + `/recipes` + cuisine pages):** squared 220px
  `object-fit: cover` image, oxblood cuisine eyebrow, Garamond `--text-card` title (2-line clamp),
  muted oldstyle meta (`time · servings · tag`, missing fields dropped). **No per-card rule, no
  hr** — cards separate by row-gap + space. **Placeholder:** unphotographed recipes show the
  stone square with the recipe's **cuisine silhouette in a lighter tone** (reuses the generated
  silhouette assets) — intentional, not missing. Real photos replace them at cooking pace; no
  stock or AI imagery, ever.
- **Section masthead:** oxblood tick → oxblood eyebrow → `--text-section` heading.
- **Photography:** **squared** for all display photos; `--radius-sm` only on tiny utility
  thumbnails (22px shopping-list, 32px day-row, meal-picker tiles).
- **Badges / tags:** quiet text, never filled pills.
- **Buttons:** outline / hairline; oxblood for primary actions.
- **Recipe detail:** functionality kept (servings scaler, step check-off, keep-awake). Optional
  **headnote** (`intro` frontmatter field, written in Norwegian): italic Garamond body between
  the title block and the columns; a couple of sentences, never an essay; absent = page
  unchanged. **The ingredient plate:** the ingredient block only (eyebrow, servings stepper,
  section sub-headers, list) sits on a solid `--color-oxblood` plate — print grammar: squared
  corners, flat fill, no border, no shadow, generous padding (`--space-lg`/`--space-xl`).
  On-plate type inverts via the plate tokens (paper primary, paper ~0.7 muted, paper ~0.2 row
  hairlines); the eyebrow is paper. The future nutrition panel stays on paper — the plate never
  grows into a dark column. On photo-less recipes the plate stands as the page's sole strong
  visual (accepted; resolves as photos land).

## Cuisine taxonomy (two-tier)

Cuisines form a two-level tree, declared in `src/content/meta/cuisines.json`. A recipe's
`cuisine` field is a single slug pointing at either a **country leaf** (Norwegian, Japanese,
Lebanese, …) or a **region** (Middle East, Northern Europe, …) — region is used when a dish
is genuinely non-placeable (e.g. western-style fusion of several East Asian traditions).

**Regions (16):** `northern-europe`, `central-europe`, `mediterranean`, `balkan`,
`eastern-europe`, `middle-east`, `north-africa`, `sub-saharan-africa`, `central-asia`,
`south-asia`, `east-asia`, `southeast-asia`, `oceania`, `north-america`, `central-america`,
`south-america`. *Mediterranean* = northern Med coast only (Spain, France-Med, Italy, Malta,
Greece, Cyprus); Levant = Middle East; Maghreb + Egypt = North Africa.

A cuisine page exists for any slug (leaf or region); region pages aggregate all descendant
recipes plus any tagged directly at the region level. The world map reads this tree — together
with the id-keyed `country-regions.json` mapping (build-failing completeness check) — as the
source of truth for country↔cuisine lookup, the runtime region merge, and the silhouette
generator.

---

## Homepage & browse architecture

**Scroll-away splash (~100vh, every visit)** — the site name **"Magnus & Tessern's Recipes"**
at `--text-display` is the splash (no tagline; header-brand duplication accepted — cover vs
running header), with the self-updating "in season" line and scroll cue, over the CSS living
texture (drifting warm blobs — first thing to drop if the composition gets busy). **The pot:**
a single-weight hairline ink line drawing (engraving style, proportions of a 4.2 L round
cocotte — two handles, domed lid, knob; generic, no brand marks) composed as a figure with the
title; 2–3 steam wisps loop slowly at idle (~4 s, pot body static; steam may be the one oxblood
element). On dismiss: a ~500 ms lid rattle-hop + stronger puff playing **during** the
scroll-away, never gating it. Reduced motion: static pot, no steam, instant dismiss. CSS only.
**No featured-recipe hero.**

**Home, after the fold**
1. **Collection preview** — a 2-row (6-card) editorial grid, **newest first via the recipe
   `date` field**, + a **"View all N recipes →"** link to `/recipes`. The search box filters
   the preview (so any recipe can still be surfaced + dragged to the planner).
2. **Around the world** — the cuisine map as the **closing full-bleed editorial plate**: a
   near-fullscreen atlas (sphere outline + hairline graticule), tan/sage fills from the
   **dead-land model** (a shape is alive iff its cuisine has recipes; country mode is strict
   leaf-only; everything else is decorative tan — full atlas always drawn), olive on hover,
   anchored caption = the crossfading label alone (the caption tick was removed — it sat
   orphaned when nothing was hovered), country/region toggle (default = region, merged
   polygons). Plain page scroll passes through; pinch and ⌘/Ctrl-scroll zoom; drag pans;
   +/− buttons for plain-mouse. Click triggers the shape morph (see Motion).
3. Footer.

**Cuisine pages — chapter openers.** Each `/cuisines/[slug]` opens as a book chapter, top to
bottom: muted "← Back to the map" (→ `/#map`; the map restores the at-click framing via the
consume-once snapshot) → oxblood tick + "Cuisine" eyebrow → **h1 title** (`--text-title`;
escalate toward display only if it reads weak) → muted oldstyle recipe count → **the chapter
plate** → `--space-3xl` gap → recipe grid. The plate is the cuisine silhouette in solid sage,
sized by **area budget** (`max-height: clamp(240px, 34vh, 420px)` and max-width ~60% of the
frame; natural aspect via viewBox), inside `--max-wide` — never full-bleed (the world map earns
full-bleed; chapter plates live within book margins). **Region plates render the cuisines
inside**: a miniature country-mode map of the region — live leaves sage with the map's exact
grammar (olive hover, click → the leaf cuisine page, keyboard + ARIA), inert member land tan
and decorative. **The full-region grid is always the default and is never filtered by the
plate** — leaf selection is strictly optional navigation. Region-plate → leaf-page hops
crossfade (morph only if nearly free). **Mobile (<768px):** the plate stays (capped ~36–40vh)
but region plates are decorative — no tap targets (fat-finger honesty; same precedent as the
drawer); narrowing goes via the map's country mode or the grid.

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
  click a card. Days hold up to **4 meals** (unlabeled ordered list); meals move by drag between
  days. One shared week via `localStorage`; a pinned "Make shopping list · N" button →
  `/meal-planner`.
- **Mobile (<768px):** drawer hidden; an "Open meal planner" link routes to the page.

**`/meal-planner` (full, editable)** — its own roomy planning + shopping surface: per-day
search-picker (recipe search + custom-dish text), remove/clear, auto-generated checkable
downloadable shopping list. No drawer here. Shares the `usePlanner` hook + `localStorage` week;
lands with the list generated when reached from the drawer button. Meals move by drag **and** by
**tap-to-move** (tap a chip → arms oxblood → tap a destination day; doubles as the keyboard path
via focus + Enter). Each recipe meal carries a **per-instance servings stepper** (−/+ grammar
from the recipe page, oldstyle number, bounds 1–12; custom dishes have none) — the ratio scales
that meal's lines in the generated shopping list.

**Shopping list** — will be grouped by shopping-category buckets with per-ingredient day notes
(see the NLP plan); the current **day → recipe grouping is the degraded mode** and stays as the
fallback. Quantity parsing/scaling lives in a shared util (`src/lib/quantity.mjs`), used by the
recipe-page scaler and the list.

**Grid behaviour:** fixed 3 columns on browse pages (squeeze when the planner pushes), 1 column
< 768px; browse frame `--max-wide: 1120px`; reading/detail layouts keep their widths.

**Header (sticky):** brand, nav (Home, Meal Planner). **No search field** — the disabled
placeholder was removed (home + `/recipes` already carry search); NLP search returns to the
header only when `PUBLIC_NLP_API_URL` is live.

**Footer:** name · About · © year, hairline top border.

**Standalone pages:** **`/about`** — a single-screen colophon (English): who cooks here, what
the site is, a line on how it's built. **404** — eyebrow, a dry one-liner in the site's voice,
links to Home and the map. Empty states (empty cuisine, empty planner day, no search matches)
carry site-voice copy, not default-app English.

---

## Motion

- **Shipped:** living-texture splash + staggered type reveal (CSS only); one-time swipeable splash
  dismiss; the push-drawer's padding/width animation (~180ms) and tab-unfurl; **Astro
  `<ClientRouter />` site-wide crossfade** (soft page transitions on every navigation).
- **Country-shape morph (the flight tween is retired — the morph IS the flight):** clicking a
  live map shape spawns a fixed overlay of that shape (`view-transition-name: cuisine-shape`)
  which the browser morphs into the cuisine **chapter plate**, ~400 ms ease-out — the arrival is
  the destination. **Reverse morph** on return to the map (the plate flies back onto the restored
  framing, injected at `astro:after-swap`); the plain crossfade is the contractual fallback when
  anything is missing. **Reduced motion = instant navigation**; unsupported browsers get the
  crossfade.
- **Splash pot:** slow steam loop at idle; ~500 ms lid rattle-hop + puff on dismiss, concurrent
  with the scroll-away. Reduced motion: fully static.
- Calm elsewhere. **Not** a fluid-everywhere treatment.

---

## Language

**Recipe headnotes (`intro`) are written in Norwegian.** Everything else — page chrome, titles,
About, empty states, system copy — is English. (Resolved July 2026.)

---

## NLP integration (placeholder now, live later)

Static Astro frontend → FastAPI backend (CORS open). `PUBLIC_NLP_API_URL` gates all API features
with graceful degradation. Header search (returns when the var is set) → `POST /api/v1/query`.
Nutrition panel → `GET /api/v1/recipes/{slug}` + `/ingredients/{ingredient}/nutrition`. Future
facets → `GET /api/v1/recipes/filter`.

---

## Explicitly rejected / out of scope

- Boxed/scroll-capped collections; bordered or filled cards as default.
- Warm-tint zone bands / a second background tone; candle `#F1ECDB`; **sage-wash or parchment
  tinted panels** (the oxblood ink plate is the sanctioned exception — a print device, not a zone).
- **A second printed plate anywhere** without a new, explicit amendment.
- **Olive as a fill or structural colour** (fails text contrast; hover-only).
- **Cuisine descriptions / per-cuisine copy** (too blog-like; voice lives in recipe headnotes).
- Two-colour zoning (chose a single oxblood accent); dark mode; a big featured-recipe hero;
  loud fluid page transitions.
- Adding a sans now (Schibsted Grotesk deferred); rounded display photography.
- A meal-planner overlay; a mobile bottom-sheet planner (mobile routes to the page).
- **Stock or AI recipe photography** (placeholder silhouettes until real photos exist).
- A header search box before NLP is live; a blog/journal section.

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
- **In plan (Phases 13–16, plan v3 — July 2026 grilling session #2):** cuisine **chapter
  plates** (arrival = destination; region plates with live leaves); the **oxblood ingredient
  plate**; **splash rework** (title = site name, line-drawn pot with steam, timeboxed with
  bail-out); **voice & finish** (optional Norwegian `intro` headnotes, `/about`, 404, footer,
  head hygiene, `date` field + real newest-first, header-search removal, dead-code sweep,
  silhouette placeholders, map caption-tick removal).
- **Later:** NLP wiring (incl. shopping-list category buckets); nutrition panel; oxblood-dot
  audit; paper grain; cross-device week sync (`nanostores` over `localStorage`); possible
  split-accent (olive separators + oxblood text); split `sub-saharan-africa` when recipes
  warrant it; splash pot (only if the Phase 15 bail-out fires).

## Open copy & decisions

- Whether card cuisine eyebrows stay oxblood or demote to muted once the single-accent look is live.
- *(Resolved July 2026: splash title = the site name, no tagline; language = Norwegian
  headnotes, English everything else.)*
