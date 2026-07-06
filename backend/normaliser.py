import json
import os
import re
from typing import Any, Dict, List, Optional

import openai
from dotenv import load_dotenv

from backend.categories import coerce_category

load_dotenv()

_SYSTEM_PROMPT = (
    "You are an ingredient normaliser. Given a list of raw ingredient strings (one per line), "
    "return a JSON array where each element has these four fields:\n"
    "- \"name\": canonical lowercase English food name, no quantities or units.\n"
    "- \"quantity_g\": the quantity converted to grams as a float, or null if unquantifiable. "
    "Unit conversions: 1 tbsp = 15 g, 1 tsp = 5 g, 1 cup = 240 g, 1 oz = 28.35 g, 1 lb = 453.6 g, "
    "1 kg = 1000 g. For whole countable items estimate a reasonable weight (e.g. '1 butternut squash' "
    "→ 700 g, '2 garlic cloves' → 10 g, '1 onion' → 150 g, '1 egg' → 50 g). "
    "Use null for 'to taste', 'pinch', or any amount that cannot be quantified.\n"
    "- \"category\": exactly one shopping category slug from this list: "
    "\"produce\" (fruit, vegetables, fresh herbs), \"meat-poultry\", \"fish-seafood\", "
    "\"dairy-eggs\", \"dry-goods\" (pasta, rice, grains, flour, legumes, nuts), "
    "\"canned-jarred\", \"oils-condiments\" (oils, vinegars, sauces, pastes), "
    "\"spices-seasonings\" (salt, pepper, dried herbs and spices, stock cubes), "
    "\"other\" (anything that fits nowhere else, e.g. water).\n"
    "- \"quantity\": the quantity AS WRITTEN in the line, as {\"amount\": <number>, \"unit\": \"<unit>\"}, "
    "or null for unquantified lines ('to taste', 'to serve', 'for garnish'). "
    "Use unit \"count\" for whole items ('4 onions' → {\"amount\": 4, \"unit\": \"count\"}). "
    "Prefer these units: count, g, kg, ml, l, tbsp, tsp, cup; if the line uses another unit "
    "('1 bunch', '2 slices'), keep that word as the unit. Do NOT convert between units here.\n"
    "CRITICAL: you MUST return EXACTLY one JSON object per input line — never more, never fewer. "
    "Do NOT split a compound ingredient (e.g. 'salt and pepper') into two entries; pick the primary "
    "ingredient and return one object. "
    "The output array length must equal the number of input lines. "
    "Preserve the input order. Reply with only the JSON array, no markdown fencing or extra text. "
    "Example input: '400g Chicken thighs\\n2 tbsp olive oil\\nsalt and pepper to taste' "
    "Example output: ["
    "{\"name\": \"chicken thigh\", \"quantity_g\": 400.0, \"category\": \"meat-poultry\", "
    "\"quantity\": {\"amount\": 400, \"unit\": \"g\"}}, "
    "{\"name\": \"olive oil\", \"quantity_g\": 30.0, \"category\": \"oils-condiments\", "
    "\"quantity\": {\"amount\": 2, \"unit\": \"tbsp\"}}, "
    "{\"name\": \"salt\", \"quantity_g\": null, \"category\": \"spices-seasonings\", \"quantity\": null}]"
)


def _clean_quantity(value: Any) -> Optional[Dict[str, Any]]:
    """Validate an LLM-emitted stated quantity; malformed → null."""
    if (
        isinstance(value, dict)
        and isinstance(value.get("amount"), (int, float))
        and isinstance(value.get("unit"), str)
    ):
        return {"amount": value["amount"], "unit": value["unit"]}
    return None


def _parse_response(content: str) -> List[Dict[str, Any]]:
    content = re.sub(r"```(?:json)?\s*", "", content).strip()
    return json.loads(content)


# Provider config: LLM_* preferred, CAMPUSAI_* legacy fallback, Gemini defaults
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_DEFAULT_MODEL = "gemini-2.5-flash"


def make_client() -> openai.OpenAI:
    api_key = os.getenv("LLM_API_KEY") or os.getenv("CAMPUSAI_API_KEY")
    if not api_key:
        raise ValueError("LLM_API_KEY (or legacy CAMPUSAI_API_KEY) not set. Add it to your .env file.")
    base_url = os.getenv("LLM_BASE_URL") or os.getenv("CAMPUSAI_BASE_URL") or _GEMINI_BASE_URL
    return openai.OpenAI(api_key=api_key, base_url=base_url)


def get_model() -> str:
    return os.getenv("LLM_MODEL") or os.getenv("CAMPUSAI_MODEL") or _DEFAULT_MODEL


def normalise_all(ingredients: List[str], client: openai.OpenAI) -> List[Dict[str, Any]]:
    if not ingredients:
        return []
    # keep only the first alternative for "X or Y" ingredients
    cleaned = [re.split(r"\s+or\s+", ing, maxsplit=1, flags=re.IGNORECASE)[0].strip() for ing in ingredients]
    response = client.chat.completions.create(
        model=get_model(),
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": "\n".join(cleaned)},
        ],
    )
    items = _parse_response(response.choices[0].message.content.strip())
    return [
        {
            "name": item["name"].strip(),
            "quantity_g": item.get("quantity_g"),
            "category": coerce_category(item.get("category")),
            "quantity": _clean_quantity(item.get("quantity")),
        }
        for item in items
    ]


def normalise_ingredient(raw: str, client: openai.OpenAI) -> str:
    return normalise_all([raw], client)[0]["name"]
