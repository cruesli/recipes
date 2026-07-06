"""Closed enum of shopping categories, ordered as the shopping walk."""

from typing import Optional

SHOPPING_CATEGORIES = (
    "produce",
    "meat-poultry",
    "fish-seafood",
    "dairy-eggs",
    "dry-goods",
    "canned-jarred",
    "oils-condiments",
    "spices-seasonings",
    "other",
)


def coerce_category(value: Optional[str]) -> str:
    """Validate an LLM-emitted category; anything out-of-enum coerces to 'other'."""
    if value in SHOPPING_CATEGORIES:
        return value
    if value is not None:
        print(f"  warning: unknown shopping category {value!r} → other")
    return "other"
