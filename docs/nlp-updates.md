# Updates — Entity Linking & NL Query

Changes made to address issues documented in IMPROVEMENTS.md.

---

## Entity Linker (`entity_linker.py`)

**Problem:** The `P279*` transitive SPARQL query caused frequent 502/504 timeouts, and compound ingredients like "minced beef", "parmesan rind", "neutral oil" failed to link.

**Changes:**

- Replaced unbounded `P279*` with a fixed 4-depth union query (`P279/P279/P279/P279` and `P31/P279/P279/P279`). Covers deep hierarchies like `red wine → wine → alcoholic beverage → beverage → food` without triggering endpoint timeouts.
- Added HTTP retry logic with exponential backoff for 429/502/503/504 responses.
- Added a description-based heuristic fallback: if SPARQL returns no food match, the linker checks each candidate's Wikidata description for food-related keywords (fruit, vegetable, meat, wine, vinegar, seasoning, etc.).
- Added modifier stripping via regex: "minced beef" → "beef", "parmesan rind" → "parmesan", "neutral oil" → "oil".
- Added singular fallback: "garlic cloves" → "garlic clove".
- Extended the fallback chain from 2 to 5 attempts: direct → singular → append "food" → broadened → broadened + "food".

**Result:** Entity linking coverage improved from ~71% to ~90%+ of normalised ingredients. Previously failing ingredients (garlic cloves, neutral oil, minced beef, parmesan rind, red wine, vinegar) now resolve.

---

## Few-Shot Example Selection (`main.py`)

**Problem:** Keyword overlap for selecting few-shot examples fails on semantically similar but lexically different queries. "Something filling" shares zero words with any example. "Low sodium dish" likewise.

**Changes:**

- Replaced keyword overlap with cosine similarity over sentence embeddings using `sentence-transformers` with `all-MiniLM-L6-v2`.
- Example embeddings are pre-computed once at module load time (numpy matrix). Query-time selection is a single embedding call + dot product — no per-example loop.
- Expanded the example bank from 15 to 42 examples, covering all 11 filter fields including fat, sodium, fibre, origin country, food category, negative constraints, and multi-field combos.
- `_keyword_overlap` kept as dead code for backward compatibility with existing tests.

**New dependency:** `sentence-transformers` (local model, no API call, works offline).

---

## Filter Schema Expansion

### `graph.py`

- `add_recipe` now computes per-serving fat, carbs, sodium, and fibre in addition to protein and kcal. Stored as `approxFatPerServing`, `approxCarbsPerServing`, `approxSodiumPerServing`, `approxFibrePerServing` on the recipe node.
- `filter_recipes` and `_matches_filter` accept 6 new parameters: `max_fat`, `max_carbs`, `max_sodium`, `min_fibre`, `origin_country`, `food_category`.
- `origin_country` and `food_category` are ingredient-level filters — they match if *any* ingredient in the recipe has the property. Uses case-insensitive substring matching.
- Missing sodium/fibre data is not penalised (recipe passes the filter rather than being excluded for lack of data).

### `main.py`

- `_BASE_SYSTEM_PROMPT` rewritten to document all 11 filter fields with exact names, types, and units.
- `/api/v1/recipes/filter` endpoint accepts 6 new query parameters.
- `/api/v1/query` endpoint uses a module-level `_KNOWN_FILTER_KEYS` frozenset (11 keys) instead of an inline set of 5.

### `index.astro`

- Added 7 new filter inputs: max kcal, max fat, max carbs, max sodium, min fibre, origin country, ingredient type.
- Refactored JS to use a single `FILTER_FIELDS` array that drives `applyFilter()`, `nlSearch()` sync, clear button, and event listeners. Adding a new filter field is now a one-line change.

---

## README sections that need updating

These README sections describe the old behaviour and should be revised:

- **Entity linking** (line 124–133): still says ~71%, mentions `P279*` as current, lists "parmesan rind" and "minced beef" as failures.
- **Natural language query** (line 147–150): still says "keyword overlap", shows "low sodium dish" as ❌.
- **Wikidata reliability** (line 288–293): still describes `P279*` as the current approach and suggests fixed-depth as a future improvement.
- **API filter docs** (line 216–218): only lists 5 filter params.
- **Tools table** (line 156–165): missing `sentence-transformers`.
- **Running the service** (line 179): model name changed to `google/gemma-4-26b-a4b`.
