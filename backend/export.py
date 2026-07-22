"""Export enriched per-recipe JSON consumed by the Astro build.

One small file per recipe under src/data/enriched/ — the static seam between
the ingest pipeline and the frontend (nutrition panel, facets, shopping list).
"""

import json
from pathlib import Path
from typing import Dict, List, Optional

from backend.models import NutritionPer100g, Recipe
from backend.nutrition import per_serving_totals
from backend.parser import parse_steps

_DEFAULT_EXPORT_DIR = Path(__file__).parent.parent / "src" / "data" / "enriched"


def _round1(value: float) -> float:
    return round(value, 1)


def _nutrition_json(recipe: Recipe, normalised_map, nutrition_map, quantity_map) -> Optional[dict]:
    ing_nutritions = []
    for raw in recipe.ingredients:
        normalised = normalised_map.get(raw)
        nutrition = nutrition_map.get(normalised) if normalised else None
        if nutrition:
            ing_nutritions.append((nutrition, quantity_map.get(raw)))
    totals = per_serving_totals(ing_nutritions, recipe.servings)
    if not totals:
        return None
    result = {
        "kcal": round(totals["kcal"]),
        "proteinG": _round1(totals["protein"]),
        "fatG": _round1(totals["fat"]),
        "carbsG": _round1(totals["carbs"]),
    }
    if totals["fibre"] > 0:
        result["fibreG"] = _round1(totals["fibre"])
    if totals["sodium"] > 0:
        result["sodiumMg"] = round(totals["sodium"])
    return result


def _recipe_json(
    recipe: Recipe,
    normalised_map: Dict[str, str],
    nutrition_map: Dict[str, Optional[NutritionPer100g]],
    quantity_map: Dict[str, Optional[float]],
    category_map: Dict[str, str],
    stated_quantity_map: Dict[str, Optional[dict]],
    step_links_map: Optional[Dict[str, list]] = None,
) -> dict:
    ingredients = []
    for idx, raw in enumerate(recipe.ingredients):
        section = recipe.ingredient_sections[idx] if idx < len(recipe.ingredient_sections) else None
        ingredients.append({
            "raw": raw,
            "section": section,
            "canonical": normalised_map.get(raw),
            "category": category_map.get(raw),
            "quantity": stated_quantity_map.get(raw),
            "grams": quantity_map.get(raw),
        })
    steps = parse_steps(recipe.body)
    links = (step_links_map or {}).get(recipe.slug) or []
    # align refs length to the step count (LLM may under/over-generate)
    links = (links + [[] for _ in steps])[: len(steps)]
    step_objs = [{"refs": refs} for refs in links]
    return {
        "slug": recipe.slug,
        "version": 2,
        "servings": recipe.servings,
        "nutritionPerServing": _nutrition_json(recipe, normalised_map, nutrition_map, quantity_map),
        "ingredients": ingredients,
        "steps": step_objs,
    }


def export_recipes(
    recipes: List[Recipe],
    *,
    normalised_map: Dict[str, str],
    nutrition_map: Dict[str, Optional[NutritionPer100g]],
    quantity_map: Dict[str, Optional[float]],
    category_map: Dict[str, str],
    stated_quantity_map: Dict[str, Optional[dict]],
    step_links_map: Optional[Dict[str, list]] = None,
    export_dir: Optional[Path] = None,
) -> None:
    if export_dir is None:
        export_dir = _DEFAULT_EXPORT_DIR
    export_dir.mkdir(parents=True, exist_ok=True)

    # drop exports for recipes that no longer exist
    slugs = {r.slug for r in recipes}
    for stale in export_dir.glob("*.json"):
        if stale.stem not in slugs:
            stale.unlink()

    for recipe in recipes:
        data = _recipe_json(
            recipe, normalised_map, nutrition_map, quantity_map,
            category_map, stated_quantity_map, step_links_map,
        )
        path = export_dir / f"{recipe.slug}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
