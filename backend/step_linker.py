"""LLM step→ingredient linking for inline amounts (cook mode).

Maps each recipe step to the ingredient lines it mentions, with the verbatim
phrase used, so the frontend can render scaled amounts inline in the prose.
Validation is strict: bad line indices or phrases not present in the step are
dropped — a missing ref degrades to plain text, never to a wrong amount.
"""

from typing import Any, Dict, List

import openai

from backend.normaliser import _parse_response, get_model

_SYSTEM_PROMPT = (
    "You link recipe steps to the ingredient lines they mention.\n"
    "Input: a numbered INGREDIENTS list (0-indexed), then numbered STEPS (0-indexed).\n"
    "Return a JSON array with EXACTLY one element per step. Each element is an array of "
    '{"line": <ingredient index>, "phrase": "<words copied verbatim from the step>"} objects.\n'
    "Rules:\n"
    "- \"phrase\" MUST be a verbatim substring of that step naming the ingredient "
    "(the shortest natural span, e.g. \"salt\" or \"the pork\").\n"
    "- Only link ingredients actually used or added in that step; use [] when none are.\n"
    "- At most one ref per ingredient line per step.\n"
    "Reply with only the JSON array, no markdown fencing."
)


def link_steps(
    ingredients: List[str], steps: List[str], client: openai.OpenAI
) -> List[List[Dict[str, Any]]]:
    if not steps:
        return []
    user = "INGREDIENTS:\n" + "\n".join(f"{i}: {ing}" for i, ing in enumerate(ingredients))
    user += "\n\nSTEPS:\n" + "\n".join(f"{i}: {s}" for i, s in enumerate(steps))
    response = client.chat.completions.create(
        model=get_model(),
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    )
    raw = _parse_response(response.choices[0].message.content.strip())
    if not isinstance(raw, list):
        raw = []
    # align length, then validate each ref
    raw = (raw + [[] for _ in steps])[: len(steps)]
    result: List[List[Dict[str, Any]]] = []
    for step_text, refs in zip(steps, raw):
        seen: set = set()
        clean: List[Dict[str, Any]] = []
        for ref in refs if isinstance(refs, list) else []:
            if not isinstance(ref, dict):
                continue
            line, phrase = ref.get("line"), ref.get("phrase")
            if not isinstance(line, int) or not (0 <= line < len(ingredients)):
                continue
            if not isinstance(phrase, str) or not phrase or phrase.lower() not in step_text.lower():
                continue
            if line in seen:
                continue
            seen.add(line)
            clean.append({"line": line, "phrase": phrase})
        result.append(clean)
    return result
