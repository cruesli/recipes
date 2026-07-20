import re
from pathlib import Path
from typing import List, Optional, Tuple

import frontmatter

from backend.models import Recipe

_STEP_SPLIT = re.compile(r"\n(?=\d+\.)")
_STEP_PREFIX = re.compile(r"^\d+\.\s*")


def parse_steps(body: str) -> List[str]:
    """Numbered steps from a recipe body — MUST mirror the frontend split in
    src/pages/recipes/[slug].astro exactly, or exported refs misalign."""
    return [s for s in (_STEP_PREFIX.sub("", c).strip() for c in _STEP_SPLIT.split(body)) if s]


def _clean_ingredient_lines(raw) -> Tuple[List[str], List[Optional[str]]]:
    """Split raw ingredient input into item lines + a parallel section list."""
    if isinstance(raw, list):
        lines = raw
    else:
        lines = str(raw).splitlines()

    items: List[str] = []
    sections: List[Optional[str]] = []
    current: Optional[str] = None
    for line in lines:
        line = str(line).strip()
        line = re.sub(r"^-+\s*", "", line)
        line = line.strip()
        if not line:
            continue
        if line.endswith(":"):
            current = line.rstrip(":").strip()
            continue
        items.append(line)
        sections.append(current)
    return items, sections


def _clean_ingredients(raw) -> List[str]:
    return _clean_ingredient_lines(raw)[0]


def _derive_total_time(fm) -> Optional[int]:
    """Prefer explicit totalTimeMinutes, else sum prep + cook (mirror of the frontend)."""
    if fm.get("totalTimeMinutes") is not None:
        return fm["totalTimeMinutes"]
    prep, cook = fm.get("prepTimeMinutes"), fm.get("cookTimeMinutes")
    if prep is not None or cook is not None:
        return (prep or 0) + (cook or 0)
    return None


def parse_recipe(path: Path) -> Recipe:
    post = frontmatter.load(str(path))
    fm = post.metadata
    ingredients, sections = _clean_ingredient_lines(fm.get("ingredients", []))

    return Recipe(
        slug=path.stem,
        title=fm["title"],
        cuisine=fm["cuisine"],
        food_type=fm.get("foodType"),
        tags=[t for t in fm.get("tags", []) if t],
        servings=fm.get("servings"),
        total_time_minutes=_derive_total_time(fm),
        image=fm.get("image"),
        ingredients=ingredients,
        ingredient_sections=sections,
        body=post.content,
    )


def load_all_recipes(recipes_dir: Path) -> List[Recipe]:
    return [parse_recipe(p) for p in sorted(recipes_dir.glob("*.md"))]
