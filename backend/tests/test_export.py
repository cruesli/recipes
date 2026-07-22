"""Tests for backend/export.py — per-recipe enriched JSON for the frontend."""

import json

import pytest

from backend.export import export_recipes
from backend.models import NutritionPer100g, Recipe
from backend.nutrition import per_serving_totals


# --- fixtures ---

@pytest.fixture
def recipe():
    return Recipe(
        slug="tahini-chicken",
        title="Tahini Chicken",
        cuisine="middle-eastern",
        servings=2,
        ingredients=["400g Chicken thighs", "2 tbsp Tahini", "salt to taste"],
        ingredient_sections=["Marinade", None, None],
    )


@pytest.fixture
def maps():
    nutrition_chicken = NutritionPer100g(
        protein_per_100g=17.4, fat_per_100g=9.6, carbs_per_100g=0.0,
        kcal_per_100g=177.0, fibre_per_100g=0.3, sodium_mg_per_100g=79.0,
    )
    return dict(
        normalised_map={
            "400g Chicken thighs": "chicken thigh",
            "2 tbsp Tahini": "tahini",
            "salt to taste": "salt",
        },
        nutrition_map={"chicken thigh": nutrition_chicken, "tahini": None, "salt": None},
        quantity_map={"400g Chicken thighs": 400.0, "2 tbsp Tahini": 30.0, "salt to taste": None},
        category_map={
            "400g Chicken thighs": "meat-poultry",
            "2 tbsp Tahini": "oils-condiments",
            "salt to taste": "spices-seasonings",
        },
        stated_quantity_map={
            "400g Chicken thighs": {"amount": 400, "unit": "g"},
            "2 tbsp Tahini": {"amount": 2, "unit": "tbsp"},
            "salt to taste": None,
        },
    )


def _export(recipe, maps, tmp_path):
    out = tmp_path / "enriched"
    export_recipes([recipe], export_dir=out, **maps)
    return json.loads((out / f"{recipe.slug}.json").read_text())


# --- per_serving_totals (shared math) ---

def test_per_serving_totals_divides_by_servings():
    n = NutritionPer100g(protein_per_100g=10.0, fat_per_100g=0.0, carbs_per_100g=0.0, kcal_per_100g=100.0)
    totals = per_serving_totals([(n, 200.0)], 2)
    assert totals["protein"] == pytest.approx(10.0)  # 200g → 20g protein / 2 servings
    assert totals["kcal"] == pytest.approx(100.0)


def test_per_serving_totals_excludes_unquantified():
    # "salt to taste" (grams=None) must not count as 100g — it contributes nothing.
    n = NutritionPer100g(protein_per_100g=10.0, fat_per_100g=0.0, carbs_per_100g=0.0, kcal_per_100g=100.0)
    quantified = NutritionPer100g(protein_per_100g=20.0, fat_per_100g=0.0, carbs_per_100g=0.0, kcal_per_100g=200.0)
    totals = per_serving_totals([(quantified, 100.0), (n, None)], 1)
    assert totals["protein"] == pytest.approx(20.0)  # only the 100g quantified item


def test_per_serving_totals_none_when_nothing_quantified():
    n = NutritionPer100g(protein_per_100g=10.0, fat_per_100g=0.0, carbs_per_100g=0.0, kcal_per_100g=100.0)
    assert per_serving_totals([(n, None)], 1) is None


def test_per_serving_totals_none_without_servings():
    n = NutritionPer100g(protein_per_100g=10.0, fat_per_100g=0.0, carbs_per_100g=0.0, kcal_per_100g=100.0)
    assert per_serving_totals([(n, 100.0)], None) is None
    assert per_serving_totals([], 2) is None


# --- export shape ---

def test_export_writes_one_file_per_recipe(recipe, maps, tmp_path):
    out = tmp_path / "enriched"
    export_recipes([recipe], export_dir=out, **maps)
    assert (out / "tahini-chicken.json").exists()


def test_export_top_level_shape(recipe, maps, tmp_path):
    data = _export(recipe, maps, tmp_path)
    assert data["slug"] == "tahini-chicken"
    assert data["version"] == 2
    assert data["servings"] == 2


def test_export_nutrition_per_serving(recipe, maps, tmp_path):
    data = _export(recipe, maps, tmp_path)
    n = data["nutritionPerServing"]
    # chicken only: 400g of per-100g values / 2 servings
    assert n["kcal"] == pytest.approx(354, abs=1)
    assert n["proteinG"] == pytest.approx(34.8, abs=0.1)
    assert n["fatG"] == pytest.approx(19.2, abs=0.1)
    assert n["carbsG"] == pytest.approx(0.0)
    assert n["fibreG"] == pytest.approx(0.6, abs=0.1)
    assert n["sodiumMg"] == pytest.approx(158, abs=1)


def test_export_nutrition_null_without_servings(recipe, maps, tmp_path):
    recipe = recipe.model_copy(update={"servings": None})
    data = _export(recipe, maps, tmp_path)
    assert data["nutritionPerServing"] is None


def test_export_ingredients_order_and_fields(recipe, maps, tmp_path):
    data = _export(recipe, maps, tmp_path)
    ings = data["ingredients"]
    assert [i["raw"] for i in ings] == ["400g Chicken thighs", "2 tbsp Tahini", "salt to taste"]
    first = ings[0]
    assert first["section"] == "Marinade"
    assert first["canonical"] == "chicken thigh"
    assert first["category"] == "meat-poultry"
    assert first["quantity"] == {"amount": 400, "unit": "g"}
    assert first["grams"] == 400.0
    salt = ings[2]
    assert salt["section"] is None
    assert salt["quantity"] is None
    assert salt["grams"] is None


def test_export_removes_stale_files(recipe, maps, tmp_path):
    out = tmp_path / "enriched"
    out.mkdir(parents=True)
    (out / "gone-recipe.json").write_text("{}")
    export_recipes([recipe], export_dir=out, **maps)
    assert not (out / "gone-recipe.json").exists()
    assert (out / "tahini-chicken.json").exists()


# --- step refs (v2) ---

def test_export_includes_step_refs_and_version_2(tmp_path):
    recipe = Recipe(
        slug="t", title="T", cuisine="x", servings=2,
        ingredients=["30g salt"], ingredient_sections=[None],
        body="1. Add the salt\n\n2. Serve",
    )
    export_recipes(
        [recipe],
        normalised_map={"30g salt": "salt"},
        nutrition_map={"salt": None},
        quantity_map={"30g salt": 30.0},
        category_map={"30g salt": "spices-seasonings"},
        stated_quantity_map={"30g salt": {"amount": 30, "unit": "g"}},
        step_links_map={"t": [[{"line": 0, "phrase": "salt"}], []]},
        export_dir=tmp_path,
    )
    data = json.loads((tmp_path / "t.json").read_text())
    assert data["version"] == 2
    assert data["steps"] == [{"refs": [{"line": 0, "phrase": "salt"}]}, {"refs": []}]


def test_export_without_links_emits_empty_refs(tmp_path):
    recipe = Recipe(
        slug="t", title="T", cuisine="x", servings=2,
        ingredients=[], ingredient_sections=[], body="1. Serve",
    )
    export_recipes(
        [recipe], normalised_map={}, nutrition_map={}, quantity_map={},
        category_map={}, stated_quantity_map={}, export_dir=tmp_path,
    )
    data = json.loads((tmp_path / "t.json").read_text())
    assert data["steps"] == [{"refs": []}]
