# Magnus & Tessern's Recipes — Design Context

A guideline for all future design and build work on the recipe site. This is a
**personal household tool** (mainly for us, not an external audience), so it should
get us into the functional parts fast while still feeling calm and pleasant.

**North star:** a modern heirloom cookbook — simple, clean, warm, personal, authentic.
**Reference:** Phaidon's *Japan: The Cookbook* (Nancy Singleton Hachisu) — editorial
restraint, cream paper, type-led layout, photography treated as precious and used sparingly.

---

## Principles

- Editorial and book-like: **whitespace + hairline rules do the structural work**, not filled cards.
- Warmth comes from **paper tone + food photography**, not from coloured UI chrome.
- **Type-led identity** — all-serif (see Typography).
- **Calm first, function fast**: a brief splash, then straight into the tools.
- **Restraint**: accent colours are "spice", used sparingly.
- **Light mode only** — a cookbook is paper.

---

## Colour palette (single source of truth)

| Token | Hex / value | Role | Notes |
|---|---|---|---|
| `--color-paper` | `#FAF8F2` | Page background | Slightly creamier than the old `#FAF9F5` |
| `--color-surface` | `#F3EFE4` | Occasional raised surface | Use sparingly — **not** a default card fill |
| `--color-stone` | `#D4D0BF` | Image placeholders / empty states | |
| `--color-ink` | `#292F17` | Primary text | |
| `--color-ink-muted` | `rgba(41,47,23,0.58)` | Secondary text / meta | |
| `--color-hairline` | `rgba(41,47,23,0.12)` | Rules, dividers, borders | The default separator |
| `--color-oxblood` | `#7E2625` | Primary accent ("spice") | Eyebrows, primary actions, active states — sparingly |
| `--color-olive` | `#868B59` | Secondary accent | Seasonal cues, subtle highlights |

**Retired:** candle `#F1ECDB` is no longer a default fill.
**Usage rule:** most surfaces are paper + air; oxblood is rare, olive is secondary.

---

## Typography

All-serif. A secondary sans is deliberately **deferred** until a real need appears.

- **Family:** EB Garamond. Weights 400, 500, 600 + 400 italic.
- **Titles / display:** Garamond 500.
- **Body / editorial:** Garamond 400; italic for intros and personal notes.
- **Eyebrow labels:** Garamond **600**, uppercase, letter-spacing ~`0.22–0.26em`, oxblood.
  (The heavier weight keeps letterspaced caps from going thin.)
- **Numbers / meta:** enable oldstyle figures (`font-feature-settings: "onum" 1`) — treat
  them as a feature, not a bug.
- **If a sans is ever needed** (data-dense UI), the pre-chosen companion is **Schibsted
  Grotesk** — editorial, quietly Scandinavian, clean figures. Add only when warranted.

---

## Structure & components

- **Default separation:** whitespace + a single hairline rule. Avoid bordered/filled cards.
- **Recipe card (collection):** image, oxblood eyebrow (cuisine), Garamond title, hairline,
  muted meta (time · servings · a tag). No fill.
- **Badges / tags:** quiet — plain text or hairline, never loud filled pills.
- **Buttons:** hairline / outline; oxblood reserved for primary actions, used sparingly.
- **Recipe detail:** keep the existing functionality (servings scaler, step check-off,
  keep-awake) — restyle to editorial; add a nutrition panel (see NLP).
- **Radius:** keep subtle (existing `~0.625rem`) for the few rounded elements (images,
  inputs). Editorial leans squared + hairline.

---

## Homepage architecture

**Scroll-away splash (~100vh, shown every visit)**
- Masthead: name eyebrow, large Garamond title, thin rule, self-updating "in season" line,
  scroll-cue chevron.
- Living texture: slow-drifting blurred warm-tone blobs (oxblood / olive / amber, low
  opacity) + gentle staggered type reveal. **CSS only**, no JS libraries.
- A sticky header means that after one scroll the splash is gone and we're in the tool.
- **No featured-recipe hero** — the splash + collection replace it (this was the long-standing
  sticking point; resolved by not picking a hero at all).

**Functional zone (after the fold)**
1. Recipe collection — airy editorial grid.
2. Meal planner / "this week we're cooking".
3. Explore by place — the world map, **demoted** from a 70vh hero to a calmer secondary section.
4. Footer.

**Header (sticky):** brand, nav (Home, Meal Planner), slim search field (NLP placeholder).

---

## Motion

- **Locked (Phase 1):** living-texture splash + staggered type reveal. CSS only.
- **Phase 2 (optional):** a single organic "wipe" as the splash dissolves into the site on
  first scroll — once per visit, calm everywhere else. **Not** a Lucci-style fluid-everywhere
  treatment (too loud and too heavy for a daily-use tool).

---

## NLP integration (placeholder now, live later)

The static Astro frontend consumes the FastAPI backend (CORS already open).

- **Config:** a single `PUBLIC_NLP_API_URL` gates all API features, with graceful degradation
  when unset.
- **Search:** header field → `POST /api/v1/query` (natural language → filters). Placeholder /
  disabled until live.
- **Nutrition:** recipe-detail panel from `GET /api/v1/recipes/{slug}` and
  `/ingredients/{ingredient}/nutrition`; Garamond with oldstyle figures, hairline-separated
  rows. Skeleton/placeholder until live.
- **Future discovery facets:** `GET /api/v1/recipes/filter` (protein, kcal, time, fat, carbs,
  sodium, fibre, cuisine, dietary, origin_country, food_category).

---

## Explicitly rejected / out of scope

- Filled-card layouts as the default; candle `#F1ECDB` as a default fill.
- Dark mode.
- A big featured-recipe hero as the opener.
- Loud fluid/liquid page transitions across the whole site.
- Adding a sans font now (deferred to Schibsted Grotesk if/when needed).

---

## Open copy & decisions (for later)

- Splash title / welcome copy in your own voice (placeholder: *"A kitchen, written down"*).
- Language: the site currently mixes Norwegian (`Hjem`, `Ukemeny`) and English — decide on
  one, or make the bilingualism intentional.
- Optional evergreen atmospheric splash photo, if a mood-led variant is ever wanted.
