# NLP Integration — Update Plan

Companion to `recipe-site-update-plan-v2.md` (Phase 12 points here). Covers the
knowledge-graph pipeline changes, the API contract, and the shopping-list
categorisation framework resolved in the July 2026 grilling session. Supersedes the
original plan's Phase 3 skeleton where they overlap; the untouched Phase 3 items are
carried forward at the end.

> **STATUS (shipped, `feature/nlp-integration`).** Implemented **static-first**, which
> changes N2/N3 from the shape below:
> - **N1 — done.** Normaliser emits the 9-bucket shopping category + stated `{amount, unit}`;
>   parser keeps section headers; graph stores the triples. Full 20-recipe ingest committed.
> - **N2/N3 — rewritten.** No runtime `GET /recipes/{slug}`, no fetch/cache/hash layer. Ingest
>   **exports** `src/data/enriched/*.json`, consumed at build time via `src/lib/enrichment.ts`.
>   Degradation collapses to one rung: recipe/line missing from the export → day→recipe grouping.
> - **N4 — done.** Buckets + canonical merge + scaled day notes + reorder bar + mirrored `.txt`
>   live in `src/lib/shoppingList.mjs` (node-tested) and `MealPlannerIsland.tsx`.
> - **N5 — done.** Nutrition panel on the recipe page; client-side facets + NL search on
>   `/recipes`. The NL service (`POST /api/v1/query`) is **stateless** — returns filters only,
>   applied client-side; deployed to Hugging Face Spaces, gated by `PUBLIC_NLP_API_URL`.
> - **KG quality:** schema.org-aligned namespace, USDA raw/fresh + Atwater-energy fixes with a
>   manual override map, QID pins (linking ~90%), per-run `reports/ingest-report.json`.
>
> The section below is the original plan, kept for the N1/N4 detail it still describes accurately.

**Repos:** backend = `curesli/NLP-project` (Python / FastAPI / RDFLib);
frontend = `cruesli/recipes` (Astro).

**Guiding posture (unchanged):** categorisation is a **progressive enhancement
layered onto the current shopping list, never a dependency**. `PUBLIC_NLP_API_URL`
unset, API down, recipe not in graph, or line unmatched ⇒ that recipe's items fall
back to today's day→recipe grouping. The site stays fully static-functional.

---

## N1 — Pipeline changes (backend, Python)

Both new fields ride the **existing batched LLM normalisation call** — one prompt
revision, no new pipeline stage. The normaliser's existing guarantees carry over:
exactly one entry per input line (compounds collapsed, "or"-alternatives
pre-stripped to the first).

**Shopping category**

- [ ] Extend the normaliser prompt to also emit one value per line from a **closed
      enum** of shopping categories.
- [ ] Enum defined once as a backend Python constant, **validated at ingest** (any
      out-of-enum LLM output fails loudly or coerces to `other` — pick one,
      log either way). Stored as stable slugs; display labels are a frontend
      concern. Designed to be modular — adding/renaming buckets is a
      constant + prompt edit, and the frontend treats unknown slugs as `other`,
      so enum changes can never crash the site.
- [ ] The 9-bucket default, ordered as the shopping walk:
      `produce` → `meat-poultry` → `fish-seafood` → `dairy-eggs` →
      `dry-goods` (pasta, rice, grains, flour, legumes) → `canned-jarred` →
      `oils-condiments` → `spices-seasonings` → `other`.
      `other` is the honest bucket and the automatic home for unclassified/legacy
      nodes, so old graph builds degrade instead of breaking.
- [ ] New triple `recipe-kg:shoppingCategory` on the **ingredient node**
      (node-level, not per-recipe edge — "onion" is produce everywhere; canned vs
      fresh already split into distinct nodes at normalisation, so node-level
      loses nothing). Classification does **not** depend on Wikidata entity
      linking — even unlinked ingredients ("water", "spices", "minced beef") get a
      bucket, giving 100 % coverage by construction. Wikidata `food_category`
      stays what it is: semantic enrichment, not shopping infrastructure.

**Structured stated quantity**

- [ ] Extend the same prompt to emit the quantity **as written**:
      `{ amount, unit }` — e.g. `{4, "count"}`, `{400, "g"}`, `{2, "tbsp"}` —
      and `null` for unquantified lines ("salt to taste", "to serve").
- [ ] Stored on the **per-recipe ingredient edge** (quantity is recipe-specific;
      this is the shared-ingredient structure — one ingredient node, per-recipe
      quantity edges). Grams stay as a **secondary** field on the edge: nutrition
      math still needs them; whole-item gram weights remain LLM estimates and are
      never shown to the user.
- [ ] Verify (and add if missing) that the **raw ingredient line** and its
      **section header** survive into the graph as triples on the per-recipe edge
      — the frontend needs `raw` for degraded display and for matching against
      what `parseIngredients` produced locally.
- [ ] Re-run ingest over the full 20-recipe set (fixed-depth SPARQL food-class
      query is already in — this is also the run that retires the 5-recipe
      `graph.ttl`).

---

## N2 — API contract

- [ ] Extend the existing `GET /api/v1/recipes/{slug}` response — **field
      additions to an existing endpoint, no new endpoint**. Each ingredient entry
      becomes:

```json
{
  "raw": "4 large onions, finely diced",
  "section": null,
  "canonical": "onion",
  "category": "produce",
  "quantity": { "amount": 4, "unit": "count" },
  "grams": 600
}
```

- [ ] `category` and `canonical` nullable (legacy nodes); `quantity` nullable
      (to-taste lines). One entry per raw line, order preserved.
- [ ] 404 for a slug not in the graph is a **normal state, not an error** — the
      live graph currently holds 5 of 20 recipes; the frontend treats 404 as
      per-recipe degradation.

---

## N3 — Frontend enrichment framework

- [ ] Enrichment happens at **shopping-list generation time**: fetch
      `GET /recipes/{slug}` for each planned recipe slug (≤ 28 meals ⇒ ≤ ~20
      unique slugs, in parallel).
- [ ] **Cache** responses in `localStorage`, keyed by slug + a content hash of the
      recipe's raw ingredient block — repeat weeks are free, edited recipes
      invalidate naturally.
- [ ] Enriched items join on `raw` line against the locally parsed ingredients;
      each `ShoppingItem` gains `canonical`, `category`, `quantity` (nullable).
- [ ] **Degradation ladder**, per recipe, silent: env var unset → whole list
      degraded; API unreachable → whole list degraded; slug 404 / hash mismatch →
      that recipe's items degraded; single line unmatched → that item degraded.
      "Degraded" always means: today's day→recipe grouping and raw-text display
      for the affected items — never an empty or broken list.

---

## N4 — Shopping-list rework (frontend)

**Structure** *(structural consequence, confirmed)*: in enriched mode, **category
buckets replace day→recipe grouping as the primary structure**; day information
lives only in per-ingredient notes. Day→recipe grouping survives solely as the
degraded mode.

**Merging + day notes**

- [ ] Merge key = **canonical name**; fallback for unenriched items = exact raw
      text (rarely merges — honestly so).
- [ ] Merged line format: canonical name headline, muted note to the right listing
      days with **scaled stated quantities**:
      `Onion — Mon: 4, Thu: 1`.
      Rules: quantities scale by each meal's servings factor (site plan P3) before
      summing; multiple same-day occurrences **sum into one day entry**; unit
      rendered per its kind (counts unitless, `Mon: 400 g` for weights/volumes);
      **mixed units within a day are never converted** — list both
      (`Mon: 2 + 200 g`; converting via estimated gram weights would manufacture
      precision the pipeline doesn't have); `null` quantities show the day only
      (`Salt — Mon, Wed`) and are excluded from scaling (same rule the nutrition
      calc already applies).
- [ ] Checking a merged item checks it for the whole week (one purchase covers all
      its days) — checked state keys on item id, not position.
- [ ] Degraded items render as today: raw line under their day/recipe group.
      Degraded-mode scaling uses the **shared quantity util** (site plan P4) on
      the raw text.

**Bucket reorder bar**

- [ ] Horizontal bar above the list: quiet Garamond text chips, one per bucket
      present in the current list, in `bucketOrder` order — no pills, oxblood tick
      marks the active drag target, matching the site's toggle grammar.
- [ ] `bucketOrder` held in state + persisted to `localStorage`; default = the
      9-bucket walk. The bar renders whatever slugs the frontend's label/order map
      knows; unknown slugs group under `other`.
- [ ] Reordering is **dynamic, not a reload**: grouping is a derived view over the
      flat item array, so a reorder just re-sorts rendered groups — checked states
      and generated data untouched.
- [ ] Interactions mirror planner grammar: HTML5 drag on desktop,
      tap-to-arm-then-tap-position on touch (doubles as the keyboard path); muted
      "reset order" affordance restores the default walk.

**Download**

- [ ] The `.txt` export mirrors the enriched view: category sections in the user's
      bucket order, merged entries with day-note detail; degraded portions keep
      the current day→recipe format.

---

## N5 — Carried forward from original Phase 3 (unchanged)

- [ ] `PUBLIC_NLP_API_URL` config + graceful degradation (now specified by N3's
      ladder).
- [ ] Header search → `POST /api/v1/query` + results view (NL query improvements —
      cosine-distance few-shot selection — already landed backend-side).
- [ ] Nutrition panels → `GET /api/v1/recipes/{slug}` +
      `/ingredients/{ingredient}/nutrition`.
- [ ] (Optional) discovery facets from `GET /api/v1/recipes/filter`.

---

## Order of work + dependencies

1. **N1 → N2** (backend: prompt + triples + ingest re-run, then API fields) — no
   frontend dependency, can start immediately.
2. **Site plan Phase 11** (planner data model, scaler, shared quantity util) —
   parallel to 1.
3. **N3 → N4** (frontend framework, then UI rework) — needs both of the above.

**Acceptance criteria**

- Every ingredient node in a fresh ingest carries a valid enum `shoppingCategory`;
  every per-recipe edge carries `raw`, `section`, `quantity` (nullable), `grams`.
- `GET /recipes/{slug}` returns the N2 shape for all 20 recipes.
- With the API up: the shopping list renders category buckets in the user's order,
  merged lines read `Onion — Mon: 4, Thu: 1` with correctly scaled, same-day-summed,
  never-unit-converted quantities; reordering buckets never resets checked items.
- With the API down or a recipe missing from the graph: the affected items render
  exactly as the list does today, with no error surface.
- Renaming or adding a bucket in the backend constant requires only a frontend
  label/order map edit — stale frontends bucket unknown slugs under `other` without
  breaking.
