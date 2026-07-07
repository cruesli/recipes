import json
import time
from pathlib import Path
from typing import Optional
import os
import requests

from backend.models import NutritionPer100g

# nutrient IDs from USDA FoodData Central
NUTRIENT_IDS = {
    "protein":        1003,
    "fat":            1004,
    "carbohydrates":  1005,
    "kcal":           1008,
    "fibre":          1079,
    "sugar":          2000,
    "saturated_fat":  1258,
    "sodium":         1093,
    "cholesterol":    1253,
}

_PREFERRED_DATA_TYPES = ["Foundation", "SR Legacy"]
_USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
_USER_AGENT = "recipe-kg/1.0 (geirdunma@gmail.com)"
_MAX_RETRIES = 3

# manual per-100g overrides for ingredients USDA search matches badly
_OVERRIDES_PATH = Path(__file__).parent / "data" / "nutrition_overrides.json"

# description words signalling a processed variant (penalised unless the query asks for it)
_PROCESSED_WORDS = (
    "dehydrated", "dried", "powder", "canned", "frozen",
    "cooked", "roasted", "smoked", "cured",
)
_FRESH_WORDS = ("raw", "fresh")


def _load_overrides() -> dict:
    if _OVERRIDES_PATH.exists():
        return json.loads(_OVERRIDES_PATH.read_text(encoding="utf-8"))
    return {}


def fetch_nutrition(ingredient: str, session: Optional[requests.Session] = None) -> Optional[NutritionPer100g]:
    override = _load_overrides().get(ingredient)
    if override:
        return NutritionPer100g(**override)
    if session is None:
        session = requests.Session()
    data = _search(ingredient, session)
    food = _pick_best(data.get("foods", []), ingredient)
    if food is None:
        return None
    return _extract_nutrition(food)


def _search(ingredient: str, session: requests.Session) -> dict:
    params = {
        "query": ingredient,
        "pageSize": 5,
        "api_key": os.getenv("USDA_API_KEY", "DEMO_KEY")  # fallback for testing
    }
    headers = {"User-Agent": _USER_AGENT}

    for attempt in range(_MAX_RETRIES):
        resp = session.get(_USDA_URL, params=params, headers=headers)
        if resp.status_code in (429, 503):
            if attempt == _MAX_RETRIES - 1:
                raise requests.HTTPError(
                    f"HTTP {resp.status_code} after {_MAX_RETRIES} retries", response=resp
                )
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else (2 ** attempt)
            time.sleep(delay)
            continue
        resp.raise_for_status()
        return resp.json()

    resp.raise_for_status()
    return {}


def per_serving_totals(ing_nutritions: list, servings: Optional[int]) -> Optional[dict]:
    """Per-serving macro totals from (NutritionPer100g, grams|None) pairs.

    Unquantified ingredients count as 100g — the same approximation the graph
    has always used. Returns None when there is nothing to compute.
    """
    if not ing_nutritions or not servings:
        return None
    totals = {"protein": 0.0, "kcal": 0.0, "fat": 0.0,
              "carbs": 0.0, "sodium": 0.0, "fibre": 0.0}
    for n, qty in ing_nutritions:
        factor = (qty / 100) if qty is not None else 1.0
        totals["protein"] += factor * n.protein_per_100g
        totals["kcal"]    += factor * n.kcal_per_100g
        totals["fat"]     += factor * n.fat_per_100g
        totals["carbs"]   += factor * n.carbs_per_100g
        if n.sodium_mg_per_100g is not None:
            totals["sodium"] += factor * n.sodium_mg_per_100g
        if n.fibre_per_100g is not None:
            totals["fibre"] += factor * n.fibre_per_100g
    return {k: v / servings for k, v in totals.items()}


def _has_nonzero_macros(food: dict) -> bool:
    nutrients = {n["nutrientId"]: n.get("value", 0.0) for n in food.get("foodNutrients", []) if "nutrientId" in n}
    macro_ids = [NUTRIENT_IDS["protein"], NUTRIENT_IDS["fat"], NUTRIENT_IDS["carbohydrates"]]
    return any(nutrients.get(nid, 0.0) != 0.0 for nid in macro_ids)


def _datatype_rank(food: dict) -> int:
    data_type = food.get("dataType")
    return _PREFERRED_DATA_TYPES.index(data_type) if data_type in _PREFERRED_DATA_TYPES else len(_PREFERRED_DATA_TYPES)


def _description_score(food: dict, query: str) -> int:
    """Prefer raw/fresh matches; penalise processed variants the query didn't ask for."""
    desc = (food.get("description") or "").lower()
    q = query.lower()
    score = 0
    for w in _PROCESSED_WORDS:
        if w in desc:
            score += 2 if w in q else -2
    if not any(w in q for w in _PROCESSED_WORDS):
        for w in _FRESH_WORDS:
            if w in desc:
                score += 1
    return score


def _pick_best(foods: list, query: str = "") -> Optional[dict]:
    # dedupe by fdcId, keeping API order
    seen: set = set()
    unique = []
    for food in foods:
        fid = food.get("fdcId")
        if fid not in seen:
            unique.append(food)
            seen.add(fid)

    # preferred data types first; description score breaks ties within a type
    ordered = sorted(unique, key=lambda f: (_datatype_rank(f), -_description_score(f, query)))

    for food in ordered:
        if _has_nonzero_macros(food):
            return food
    return ordered[0] if ordered else None


def _extract_nutrition(food: dict) -> NutritionPer100g:
    nutrients = {n["nutrientId"]: n.get("value", 0.0) for n in food.get("foodNutrients", []) if "nutrientId" in n}
    ids = NUTRIENT_IDS
    return NutritionPer100g(
        protein_per_100g=nutrients.get(ids["protein"], 0.0),
        fat_per_100g=nutrients.get(ids["fat"], 0.0),
        carbs_per_100g=nutrients.get(ids["carbohydrates"], 0.0),
        kcal_per_100g=nutrients.get(ids["kcal"], 0.0),
        fibre_per_100g=nutrients.get(ids["fibre"]),
        sugar_per_100g=nutrients.get(ids["sugar"]),
        saturated_fat_per_100g=nutrients.get(ids["saturated_fat"]),
        sodium_mg_per_100g=nutrients.get(ids["sodium"]),
        cholesterol_mg_per_100g=nutrients.get(ids["cholesterol"]),
    )
