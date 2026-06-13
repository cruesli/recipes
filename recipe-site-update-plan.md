# Recipe Site — Update Plan

Ordered and phased. **Phase 0 unblocks everything else.** Items marked `(confirm)` are
recommendations we didn't explicitly decide together — veto any before building.

See `recipe-site-design-context.md` for the locked direction these tasks implement.

---

## Phase 0 — Design-system foundations (do first)

- [ ] **Single source of truth for tokens.** Define the locked palette / type / radius /
      spacing once as CSS custom properties; mirror into Tailwind `@theme` if keeping Tailwind utilities.
- [ ] **Delete the duplicate stylesheet.** Define tokens once in Tailwind `@theme`, consolidate
      base styles into a single `global.css`, and remove the standalone `public/styles/global.css`.
- [ ] **Apply locked token values:** paper `#FAF8F2`, surface `#F3EFE4`, stone `#D4D0BF`,
      ink, muted, hairline, oxblood, olive. Retire candle `#F1ECDB`.
- [ ] **Refactor React islands** (`WorldMap`, `DiscoverPanel`, `RecipePageIsland`,
      `MealPlannerIsland`, `RecipeSliderIsland`) to consume `var(--color-*)` — remove inline hardcoded hex.
- [ ] **Editorial utilities:** hairline rule, whitespace scale, eyebrow-label style,
      oldstyle figures on numeric text.
- [ ] **Fonts:** load EB Garamond 400 / 500 / 600 + italic; verify oldstyle figures and
      letterspaced caps render well.

---

## Phase 1 — Homepage rebuild

- [ ] **Splash component** (~100vh): CSS living texture (drifting warm blobs) + staggered
      type reveal + scroll cue. Shown every visit.
- [ ] **Sticky header:** brand, nav, slim placeholder search field.
- [ ] **Recipe collection:** replace the card grid with an editorial hairline/whitespace grid
      (image, oxblood eyebrow, Garamond title, muted meta).
- [ ] **Meal planner / "this week"** entry in the functional zone.
- [ ] **Demote `WorldMap`** → an "Explore by place" secondary section: drop from 70vh, calmer
      styling, consume tokens.
- [ ] **Remove `DiscoverPanel`** from the homepage (confirmed — discovery returns later via NLP facets).
- [ ] **Remove `RecipeSliderIsland`** from the homepage (confirmed — the collection grid covers browsing).
- [ ] **Seasonal data:** fold the "in season" line into the splash from a **single seasonal
      data source** (replace the hardcoded `SeasonalBanner` list). Optional quiet seasonal strip below.

---

## Phase 2 — Recipe, cuisine & planner polish

- [ ] Restyle the recipe-detail page to editorial; keep servings scaler, step check-off, keep-awake.
- [ ] Add a **nutrition panel** (placeholder/skeleton, token-styled, wired in Phase 3).
- [ ] Restyle cuisine pages + badges to editorial (quiet tags, hairlines).
- [ ] Restyle the meal planner + shopping list to editorial; tabular / oldstyle figures.

---

## Phase 3 — NLP integration (when the backend is ready)

- [ ] Add `PUBLIC_NLP_API_URL` config + graceful degradation when unset.
- [ ] Wire header search → `POST /api/v1/query`; build a results view.
- [ ] Wire nutrition panels → `GET /api/v1/recipes/{slug}` + `/ingredients/{ingredient}/nutrition`.
- [ ] (Optional) discovery facets from `GET /api/v1/recipes/filter`.

---

## Phase 4 — Later flourishes & functional upgrades

- [ ] **Motion level 2:** one-time organic "wipe" on the splash → site scroll-away.
- [ ] **Side-by-side collection + meal planner** with drag-and-drop recipe assignment.
- [ ] Revisit a **secondary sans** (Schibsted Grotesk) if data-dense UI calls for it.
- [ ] Optional mood-led splash variant with an evergreen photo.

---

## Notes

- Hosting: Netlify; CMS at `/admin` (Decap). Keep token/structure changes CMS-safe.
- Decide Norwegian/English language consistency intentionally.
