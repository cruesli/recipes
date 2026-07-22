import hashlib
import json
from datetime import datetime
from pathlib import Path
import time
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

from backend.categories import coerce_category
from backend.entity_linker import fetch_properties, link_ingredient
from backend.export import export_recipes
from backend.graph import RecipeKnowledgeGraph, save_graph
from backend.models import NutritionPer100g, Recipe, WikidataEntity
from backend.normaliser import make_client, normalise_all
from backend.nutrition import fetch_nutrition
from backend.parser import load_all_recipes, parse_steps
from backend.step_linker import link_steps

_BATCH_SIZE = 50
_DEFAULT_CACHE_DIR = Path(__file__).parent / ".cache"
_DEFAULT_DATA_DIR = Path(__file__).parent / "data"
_DEFAULT_REPORT_PATH = Path(__file__).parent / "reports" / "ingest-report.json"
_MISSING = object()


def _load_cache(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def _save_cache(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def collect_unique_ingredients(recipes: List[Recipe]) -> List[str]:
    seen: set = set()
    result: List[str] = []
    for recipe in recipes:
        for ing in recipe.ingredients:
            if ing not in seen:
                seen.add(ing)
                result.append(ing)
    return result


def _check_lengths(raw: List[str], normalised: List[Dict[str, Any]]) -> None:
    if len(raw) != len(normalised):
        raise ValueError(
            f"Normaliser returned {len(normalised)} results for {len(raw)} inputs"
        )


def build_normalised_map(raw: List[str], normalised: List[Dict[str, Any]]) -> Dict[str, str]:
    _check_lengths(raw, normalised)
    return {r: n["name"] for r, n in zip(raw, normalised)}


def build_quantity_map(raw: List[str], normalised: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    _check_lengths(raw, normalised)
    return {r: n.get("quantity_g") for r, n in zip(raw, normalised)}


def build_category_map(raw: List[str], normalised: List[Dict[str, Any]]) -> Dict[str, str]:
    _check_lengths(raw, normalised)
    return {r: coerce_category(n.get("category")) for r, n in zip(raw, normalised)}


def build_stated_quantity_map(
    raw: List[str], normalised: List[Dict[str, Any]]
) -> Dict[str, Optional[dict]]:
    _check_lengths(raw, normalised)
    return {r: n.get("quantity") for r, n in zip(raw, normalised)}


def run_ingest(
    recipes_dir: Path,
    output_path: Path,
    *,
    llm_client=None,
    http_session: Optional[requests.Session] = None,
    cache_dir: Optional[Path] = None,
    data_dir: Optional[Path] = None,
    report_path: Optional[Path] = None,
    export_dir: Optional[Path] = None,
) -> None:
    load_dotenv(Path.home() / ".env")

    if cache_dir is None:
        cache_dir = _DEFAULT_CACHE_DIR
    if data_dir is None:
        data_dir = _DEFAULT_DATA_DIR
    if report_path is None:
        report_path = _DEFAULT_REPORT_PATH
    entity_overrides = _load_cache(data_dir / "entity_overrides.json")
    nutrition_overrides = _load_cache(data_dir / "nutrition_overrides.json")
    entity_cache_path = cache_dir / "entities.json"
    nutrition_cache_path = cache_dir / "nutrition.json"
    normalised_cache_path = cache_dir / "normalised.json"
    entity_cache = _load_cache(entity_cache_path)
    nutrition_cache = _load_cache(nutrition_cache_path)
    normalised_cache = _load_cache(normalised_cache_path)

    # parse
    print("Parsing recipes...")
    recipes = load_all_recipes(recipes_dir)
    print(f"  {len(recipes)} recipes parsed")

    # collect unique raw ingredients
    unique_raw = collect_unique_ingredients(recipes)
    print(f"  {len(unique_raw)} unique raw ingredients")

    # normalise in batches (incremental, cached per raw ingredient)
    print("Normalising ingredients...")
    # entries lacking "category" predate the N1 prompt — re-normalise them
    to_normalise = [
        r for r in unique_raw
        if r not in normalised_cache or "category" not in normalised_cache[r]
    ]
    if to_normalise:
        if llm_client is None:
            llm_client = make_client()
        for i in range(0, len(to_normalise), _BATCH_SIZE):
            batch = to_normalise[i : i + _BATCH_SIZE]
            batch_result = normalise_all(batch, llm_client)
            # Align length with input in case LLM returns wrong count
            if len(batch_result) > len(batch):
                batch_result = batch_result[: len(batch)]
            elif len(batch_result) < len(batch):
                for j in range(len(batch_result), len(batch)):
                    batch_result.append({
                        "name": batch[j].lower(), "quantity_g": None,
                        "category": "other", "quantity": None,
                    })
            for raw, norm in zip(batch, batch_result):
                normalised_cache[raw] = norm
            _save_cache(normalised_cache_path, normalised_cache)
            print(f"  normalised {min(i + _BATCH_SIZE, len(to_normalise))}/{len(to_normalise)} (new)")
        print(f"  all {len(unique_raw)} ingredients normalised, cache updated")
    else:
        print(f"  all {len(unique_raw)} ingredients cached, skipping LLM")
    normalised_list: List[Dict[str, Any]] = [normalised_cache[r] for r in unique_raw]
    normalised_map = build_normalised_map(unique_raw, normalised_list)
    quantity_map = build_quantity_map(unique_raw, normalised_list)
    category_map = build_category_map(unique_raw, normalised_list)
    stated_quantity_map = build_stated_quantity_map(unique_raw, normalised_list)

    # unique normalised names (preserving order)
    unique_normalised: List[str] = list(dict.fromkeys(n["name"] for n in normalised_list))
    print(f"  {len(unique_normalised)} unique normalised names")

    # step linking (per recipe, cached on steps+ingredients hash)
    print("Linking steps to ingredients...")
    steplinks_cache_path = cache_dir / "steplinks.json"
    steplinks_cache = _load_cache(steplinks_cache_path)
    step_links_map: Dict[str, list] = {}
    for recipe in recipes:
        steps = parse_steps(recipe.body)
        if not steps:
            step_links_map[recipe.slug] = []
            continue
        digest = hashlib.sha256(
            ("\n".join(recipe.ingredients) + "\0" + "\n".join(steps)).encode("utf-8")
        ).hexdigest()
        cached = steplinks_cache.get(recipe.slug)
        if cached and cached.get("hash") == digest:
            step_links_map[recipe.slug] = cached["links"]
            print(f"  {recipe.slug}: cached")
            continue
        if llm_client is None:
            llm_client = make_client()
        links = link_steps(recipe.ingredients, steps, llm_client)
        steplinks_cache[recipe.slug] = {"hash": digest, "links": links}
        _save_cache(steplinks_cache_path, steplinks_cache)
        step_links_map[recipe.slug] = links
        print(f"  {recipe.slug}: {sum(len(r) for r in links)} refs")

    # entity linking
    print("Linking entities to Wikidata...")
    if http_session is None:
        http_session = requests.Session()
    entity_map: Dict[str, Optional[WikidataEntity]] = {}
    link_sources: Dict[str, str] = {}
    for norm in unique_normalised:
        pinned = entity_overrides.get(norm, _MISSING)
        entity: Optional[WikidataEntity]
        if pinned is None:
            # explicit null override: force-unlink
            entity = None
            link_sources[norm] = "pin"
            print(f"  {norm}: pinned → not linked")
        elif pinned is not _MISSING:
            link_sources[norm] = "pin"
            cached = entity_cache.get(norm)
            if cached and cached.get("qid") == pinned:
                entity = WikidataEntity(**cached)
                print(f"  {norm}: pinned {pinned} (cached)")
            else:
                try:
                    entity = fetch_properties(pinned, norm, http_session)
                    entity_cache[norm] = entity.model_dump()
                    _save_cache(entity_cache_path, entity_cache)
                    print(f"  {norm}: pinned {pinned} (fetched)")
                except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError,
                        requests.HTTPError) as exc:
                    print(f"  {norm}: pin fetch failed ({type(exc).__name__}), skipping")
                    entity = None
                time.sleep(1)  # respect Wikidata rate limits
        elif norm in entity_cache:
            cached = entity_cache[norm]
            entity = WikidataEntity(**cached) if cached else None
            link_sources[norm] = "cache"
            print(f"  {norm}: (cached) {entity.qid if entity else 'not found'}")
        else:
            network_error = False
            link_sources[norm] = "network"
            try:
                entity = link_ingredient(norm, http_session)
            except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError) as exc:
                print(f"  {norm}: network error ({type(exc).__name__}), skipping")
                entity = None
                network_error = True
            except requests.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else "?"
                print(f"  {norm}: HTTP error {status}, skipping")
                entity = None
                network_error = True
            if not network_error:
                entity_cache[norm] = entity.model_dump() if entity else None
                _save_cache(entity_cache_path, entity_cache)
                status = entity.qid if entity else "not found"
                print(f"  {norm}: {status}")
            time.sleep(1)  # respect Wikidata rate limits
        entity_map[norm] = entity
    # nutrition
    print("Fetching nutrition from USDA...")
    nutrition_map: Dict[str, Optional[NutritionPer100g]] = {}
    for norm in unique_normalised:
        nutrition: Optional[NutritionPer100g]
        if norm in nutrition_overrides:
            # manual override wins over cache — edits take effect on re-run
            nutrition = NutritionPer100g(**nutrition_overrides[norm])
            print(f"  {norm}: {nutrition.kcal_per_100g} kcal/100g (override)")
        elif norm in nutrition_cache:
            cached_n = nutrition_cache[norm]
            nutrition = NutritionPer100g(**cached_n) if cached_n else None
            status_n = f"{nutrition.kcal_per_100g} kcal/100g (cached)" if nutrition else "not found (cached)"
            print(f"  {norm}: {status_n}")
        else:
            network_error = False
            try:
                nutrition = fetch_nutrition(norm, http_session)
            except requests.HTTPError as exc:
                print(f"  {norm}: HTTP error {exc.response.status_code}, skipping")
                nutrition = None
            except (requests.exceptions.ReadTimeout, requests.exceptions.ConnectionError) as exc:
                print(f"  {norm}: network error ({type(exc).__name__}), skipping")
                nutrition = None
                network_error = True
            if not network_error:
                nutrition_cache[norm] = nutrition.model_dump() if nutrition else None
                _save_cache(nutrition_cache_path, nutrition_cache)
                status_n = f"{nutrition.kcal_per_100g} kcal/100g" if nutrition else "not found"
                print(f"  {norm}: {status_n}")
        nutrition_map[norm] = nutrition

    # build graph
    print("Building knowledge graph...")
    kg = RecipeKnowledgeGraph()
    for recipe in recipes:
        kg.add_recipe(
            recipe, normalised_map, entity_map, nutrition_map, quantity_map,
            category_map=category_map, stated_quantity_map=stated_quantity_map,
        )

    # serialise
    print(f"Saving graph to {output_path}...")
    save_graph(kg, output_path)
    print(f"Done. {len(kg.graph)} triples written.")

    # provenance report for auditing linking + nutrition quality
    print(f"Writing ingest report to {report_path}...")
    report = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "summary": {
            "recipes": len(recipes),
            "uniqueRawLines": len(unique_raw),
            "uniqueIngredients": len(unique_normalised),
            "linked": sum(1 for e in entity_map.values() if e),
            "nutritionFound": sum(1 for n in nutrition_map.values() if n),
        },
        "ingredients": [
            {
                "canonical": norm,
                "qid": entity_map[norm].qid if entity_map[norm] else None,
                "linkSource": link_sources.get(norm),
                "foodCategory": entity_map[norm].food_category if entity_map[norm] else None,
                "originCountry": entity_map[norm].origin_country if entity_map[norm] else None,
                "usda": {
                    "found": nutrition_map[norm] is not None,
                    "source": "override" if norm in nutrition_overrides else "search",
                    "kcalPer100g": nutrition_map[norm].kcal_per_100g if nutrition_map[norm] else None,
                },
            }
            for norm in unique_normalised
        ],
        "lines": [
            {
                "raw": r,
                "canonical": normalised_map[r],
                "category": category_map[r],
                "quantity": stated_quantity_map[r],
                "grams": quantity_map[r],
            }
            for r in unique_raw
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    # static JSON consumed by the Astro build
    print("Exporting enriched recipe JSON...")
    export_recipes(
        recipes,
        normalised_map=normalised_map,
        nutrition_map=nutrition_map,
        quantity_map=quantity_map,
        category_map=category_map,
        stated_quantity_map=stated_quantity_map,
        step_links_map=step_links_map,
        export_dir=export_dir,
    )


if __name__ == "__main__":
    run_ingest(
        recipes_dir=Path(__file__).parent.parent / "src" / "content" / "recipes",
        output_path=Path(__file__).parent / "graph.ttl",
    )
