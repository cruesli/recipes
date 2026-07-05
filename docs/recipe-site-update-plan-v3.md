# Recipe Site — Update Plan v3

Continues `recipe-site-update-plan-v2.md` (Phases 8–12, shipped). Phases 13–16 below
implement the decisions resolved in the July 2026 grilling session #2: cuisine
**chapter plates** (the map arrival becomes the destination), the **oxblood ink
plate** behind recipe ingredients, the **splash rework** (title + pot), and the
**voice & finish** pass. The NLP work is untouched and stays in
`nlp-integration-update-plan.md`.

**Ordering is deadline-driven** (limited Fable 5 window in Claude Code): spend the
strong model on the hardest work first. **13 → 14 → 15 → 16.** Phase 13 is the
geometry/pipeline/transition-heavy one; 14 is taste-heavy but contained; 15 carries
an explicit timebox + bail-out; 16 is mechanical and explicitly fine to fall
outside the window (any model can execute it from this plan).

---

## Phase 13 — Cuisine chapter plates

The morph's destination undersold the journey: the shape landed as an 80–140px
corner stamp over a plain grid. Decision: the cuisine page opens as a **book
chapter** — the silhouette enlarged into the page's dominant editorial plate —
and **region plates render their leaf countries inside** (the "cuisines inside"),
with navigation but never forced narrowing.

**C1 — Page composition (chapter opener)**

- [x] Restructure `[cuisine].astro` from the split flex header into a stacked
      chapter opener, top to bottom: `← Back to the map` → oxblood tick +
      "Cuisine" eyebrow → **h1 title** → muted oldstyle recipe count → **the
      plate** → deliberate gap (`--space-3xl`) → recipe grid. Title on top:
      arrival identity paints in the first frame while the shape flies in
      beneath it; title-beneath is caption grammar and demotes the h1.
- [x] Title at `--text-title`; escalate toward `--text-display` **only if** it
      reads weak against the big plate (try smaller first).
- [x] Plate sizing — area budget, not fixed height (Chile/Norway/Indonesia aspect
      chaos): `max-height: clamp(240px, 34vh, 420px)` **and** max-width ~60% of
      the content frame; each shape finds its natural size via its `viewBox`
      aspect. Plate sits **inside `--max-wide`**, never full-bleed (the world map
      earns full-bleed; chapter plates live within book margins). Type stays
      left-aligned per the masthead grammar.
- [x] Fill: **solid sage** `--color-map-active` on paper. No gradients, no
      photo-in-shape masking (photography stays precious; sage continuity is what
      makes the morph read).
- [x] Morph compatibility: the plate keeps `view-transition-name: cuisine-shape`
      — the forward morph inherits the new, larger endpoint automatically.
      **Verify the reverse morph** (T4 clones the header silhouette in
      `astro:before-swap`; its `viewBox` must keep carrying the projected bbox).
- [x] The header silhouette element must remain **static HTML at first paint**
      (late-arriving elements can't join a view transition) — unchanged
      constraint from Phase 10 T2.

**C2 — Region plates: the cuisines inside**

- [x] Extend the silhouette generator: for **region slugs**, emit a second
      variant — the merged region outline **plus internal leaf-country paths**
      (a miniature country-mode map of just that region). Each leaf path carries
      its slug and an **alive** flag (alive iff the leaf cuisine has recipes —
      strict leaf-only, same rule as Phase 9 W2). Same shared projection module;
      leaf plates stay the existing single-path asset.
- [x] Rendering: live leaves **sage**, inert member land **tan**
      (`--color-map-land`), paper strokes between shapes (the map's stroke
      grammar; tune width at plate scale — fall back to hairline strokes only if
      paper gaps turn invisible).
- [x] Interaction = **map grammar, navigate** (never filter): live leaf → olive
      on hover, click → `navigate()` to `/cuisines/<leaf>`; keyboard focus +
      Enter/Space; `aria-label` "`<label>` cuisine, N recipes". Dead leaves and
      inert land are decorative paths — no hover, no cursor, no focus/ARIA.
- [x] **The full-region grid remains the page default and is never filtered by
      the plate.** Leaf selection is strictly optional navigation; "← Back"
      returns to the full region.
- [x] Region-plate → leaf-page transition: **crossfade by default.** Attempt the
      shared-element morph only if it falls out nearly free from the shared
      silhouette machinery — do not spend tuning time; the wow-moment is
      map → page, not page → page.
- [x] Keep first paint static: prefer inline static SVG + a small inline script
      (or minimal island) for leaf hover/click; the plate element itself must be
      in static HTML regardless.

**C3 — Small viewports (<768px)**

- [x] Keep the plate, capped at ~36–40vh — mobile keeps the arrival visual.
- [x] Region plates are **decorative on touch/small viewports**: no tap targets,
      no focus/ARIA (leaf shapes fail the fat-finger test; honest per the
      established drawer precedent). Narrowing path = the map's country mode or
      the grid. No leaf text-links in v1 — add later only if missed.

**Acceptance:** the cuisine page opens as a chapter (eyebrow → title → count →
large plate → gap → grid); the forward morph lands the shape as the plate with no
hard cut and the reverse morph still works; region plates render as mini
country-mode maps where **only recipe-bearing leaves** react and navigate with the
map's exact grammar; the region grid always shows the full collection; mobile shows
the plate but keeps it inert.

---

## Phase 14 — Oxblood ink plate (recipe-page ingredients)

Constitutional amendment, resolved in session: **"one white, plus exactly one
sanctioned printed plate: the recipe-page ingredient panel — solid oxblood, paper
text."** Functionally motivated (the one surface you re-locate mid-cooking); never
repeated elsewhere without another amendment. Alternatives rejected on record:
olive fill (paper-on-olive ≈ 3.4:1 — fails body-text contrast; olive stays
interaction-only), sage wash / parchment tint (tinted paper is exactly what the
one-white rule exists to prevent). Paper-on-oxblood ≈ 9.1:1 — the version of this
idea that typographically works, matching the liked earlier iteration.

- [x] Wrap the **ingredient block only** — "Ingredients" eyebrow, servings
      stepper, section sub-headers, list — in a solid `--color-oxblood` plate in
      `RecipePageIsland.tsx`. The future nutrition panel stays on paper (a full
      dark left column would read as a dark-sidebar layout).
- [x] Print grammar, not card grammar: squared corners, flat fill, **no border,
      no shadow**, generous padding (`--space-lg`/`--space-xl`). It should read
      as if the page were printed with an oxblood block.
- [x] Inverted on-plate type as **tokens** in `global.css` (no inline rgba
      literals): `--color-plate-text: var(--color-paper)`;
      `--color-plate-muted:` paper at ~0.7; `--color-plate-hairline:` paper at
      ~0.18–0.20 (row dividers). Eyebrow on the plate = paper (it can't stay
      oxblood-on-oxblood); section sub-headers = plate-muted, still letterspaced
      caps.
- [x] Light serif optically thins on dark ground: try **Garamond 500** for the
      on-plate list; step back to 400 only if it reads heavy.
- [x] Stepper/check interactions unchanged — restyle only.
- [x] Photo-less recipes: the plate stands as the page's sole strong visual —
      **accepted, no softening** (resolves itself as photos are added).

**Acceptance:** the list is comfortably legible at arm's length (paper on oxblood
≥ 4.5:1 everywhere, including muted); scaler and section behaviour unchanged;
nothing else on the recipe page changes; no other surface anywhere gains a fill.

---

## Phase 15 — Splash rework: title + the pot

Tagline replaced, resolved in session: no text tagline at all — the site name
**is** the splash, with a line-drawn pot as the figure.

- [ ] Remove *"A kitchen, written down"*; promote **"Magnus & Tessern's
      Recipes"** to the display title (`--text-display`). Nothing replaces the
      tagline. Header-brand duplication accepted (a book's cover and running
      header repeat the title).
- [ ] Keep the self-updating in-season line, the scroll cue, and the
      living-texture blobs. If pot + blobs read busy, **the blobs are the thing
      to drop** — one CSS deletion.
- [ ] **The pot:** a single-weight hairline ink **line drawing** — engraving /
      cookbook-marginal style, no fills, no cartoon roundness — with the
      proportions of a 4.2 L round cocotte (two side handles, domed lid, lid
      knob). Generic in execution: **no brand marks or logo reproduction.**
      Modest size, composed as a figure beneath/beside the title, not a mascot.
      The steam may be the one oxblood element.
- [ ] **Idle:** 2–3 steam-wisp paths drifting up from under the lid rim and
      fading, slow CSS loop (~4 s). The pot body does not move at idle.
- [ ] **Dismiss (click/tap/scroll):** ~500 ms burst — small lid rattle-hop +
      stronger puff — playing **during** the scroll-away, never gating it.
- [ ] **Reduced motion:** static pot, no steam, instant dismiss.
- [ ] **Timebox + bail-out:** the code is small; the risk is the *drawing*. If
      the pot doesn't look right within roughly one session, ship the title
      change alone and move the pot to backlog — the title change is valuable
      independently.

**Acceptance:** the splash reads title-first with no tagline; the pot reads as an
engraving, not clip-art (else bailed out cleanly); dismissal never waits on an
animation; reduced-motion users get a static splash.

---

## Phase 16 — Voice & finish

The "barebones" diagnosis: missing **voice** (structure with no author) + missing
**finish** (dead edges). Explicitly *not* density or features. Language ruling:
**recipe headnotes in Norwegian; all other pages and chrome in English.** Cuisine
descriptions were considered and **rejected** (too blog-like).

**V — Voice**

- [ ] Recipe schema: optional `intro` (string). Render when present as *italic
      Garamond body* between the title block and the ingredients/method columns —
      a couple of sentences, never an essay. **Zero backfill required** — all 20
      recipes stay untouched until a headnote is actually written (Norwegian, at
      leisure; not every recipe has a story).
- [ ] **`/about`** — a single-screen colophon (English): who cooks here, what the
      site is, a line on how it's built. Linked from the footer.
- [ ] **Empty-state copy pass** (English, site voice): cuisine empty note,
      empty planner day, no-search-matches.

**F — Finish**

- [ ] **Remove the header search input entirely** (redundant: home preview and
      `/recipes` both have search; a disabled input is a promise the site isn't
      keeping). NLP search returns later gated by `PUBLIC_NLP_API_URL`.
- [ ] Footer becomes: **name · About · © year** (hairline top border as now).
- [ ] **404 page** in the site's voice — eyebrow, a dry one-liner, links to Home
      and the map.
- [ ] `<head>` hygiene: favicon (oxblood tick or a small silhouette — in-brand),
      `<meta name="description">`, `og:title`/`og:image`; **delete the dead
      `src/layouts/Layout.astro`.**
- [ ] Recipe schema: optional **`date`** field; rough backfill (git history /
      memory — precision doesn't matter); home preview sorts **newest-first for
      real**. Closes the standing backlog item.
- [ ] **Dead-code sweep** in `global.css`: recipe-slider block, legacy
      `.card`/`.badge`/`.grid` styles superseded by `RecipeCard` — audit and
      delete what's unreferenced.
- [ ] **Intentional placeholder:** `RecipeCard`'s stone square gains the
      recipe's **cuisine silhouette in a lighter tone** (reuse the generated
      assets) so unphotographed recipes look deliberate. Real photos replace
      them at cooking pace — no stock, no AI images.
- [ ] **Map:** delete the 48×2 oxblood tick under the Country · Region toggle —
      the caption becomes the crossfading label alone (the tick sat orphaned
      whenever nothing was hovered, diluting the section-tick grammar).

**Acceptance:** no dead affordances anywhere in the chrome; About and 404 exist
and read in the site's voice; a recipe with an `intro` shows an italic headnote
and one without is unchanged; grids look intentional with zero photos; the top of
the home preview changes when a new recipe lands.

---

## Ordering & the Fable-5 window

Principle: **spend the strong model where a weaker one would flounder; push
mechanical work past the window.**

1. **Phase 13** — hardest: generator variant, morph endpoints both directions,
   page restructure, mobile collapse. Maximum model on maximum difficulty.
2. **Phase 14** — contained but taste-heavy (on-plate optical tuning): a
   guaranteed same-session win.
3. **Phase 15** — art-risk with a hard timebox; a rabbit-hole can't eat the
   window because the bail-out ships the title change alone.
4. **Phase 16** — mechanical, fully specified above; fine outside the window.
   (The headnote/About *writing* is human work on no deadline.)

Build notes (carry over v2's discipline): minimal-diff; no new runtime
dependencies (the pot is inline SVG + CSS); Phases 13–15 touch shared files —
run sequentially, don't parallelise; Phase 16 items are independent of each
other. The v2 T4 known-risks checkbox stays open as-is.

---

## Design-context sync (do alongside the phases)

Update `recipe-site-design-context.md`:

- **Principles:** amend one-white to *"one white, plus exactly one sanctioned
  printed plate: the recipe-page ingredient panel (solid oxblood, paper text)"* —
  a named, functionally-motivated exception, not a repeal. Note **sage promoted
  from map-only to the place/material family**: map fills → cuisine chapter
  plates → card placeholder silhouettes. Olive unchanged: interaction colour
  only (and now on record: fails contrast as a plate fill).
- **Palette:** add the on-plate tokens (`--color-plate-text`,
  `--color-plate-muted`, `--color-plate-hairline`); `--color-surface` stays
  retired (sage-wash and parchment panel options considered and rejected in
  session).
- **Structure & components:** recipe detail gains the ingredient-plate spec
  (print grammar, inverted type, ingredients-block-only extent); `RecipeCard`
  placeholder = stone + light cuisine silhouette.
- **Cuisine pages:** chapter-opener composition (title on top, plate below,
  area-budget sizing, inside `--max-wide`); region plates as mini country-mode
  maps — live leaves navigate with map grammar, full-region grid always default;
  mobile keeps the plate, drops in-plate interactivity.
- **Splash:** tagline removed — site name at display size is the splash; pot
  figure (hairline line drawing, 4.2 L cocotte proportions, no branding), steam
  idle loop, dismiss burst during scroll-away, reduced-motion static.
- **Header/footer:** header search removed until NLP lands
  (`PUBLIC_NLP_API_URL`-gated on return); footer = name · About · © year; new
  `/about` and 404 pages.
- **Map:** caption tick removed — crossfading label only.
- **Motion:** add the pot idle/dismiss animation; morph endpoint is now the
  chapter plate (both directions).
- **Open copy & decisions:** splash title **resolved** (site name, no tagline);
  language **resolved** (recipe intros Norwegian, everything else English) —
  remove both from the open list.
- **Explicitly rejected additions:** cuisine descriptions (too blog-like); olive
  or tinted-paper panel fills; a second printed plate anywhere without a new
  amendment.
- **Backlog:** remove the `date`-field item (now in-plan); add "splash pot" only
  if the Phase 15 bail-out fires.
