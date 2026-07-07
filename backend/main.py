import json
import os
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer

import openai
from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.models import QueryFiltersResponse, QueryRequest
from backend.normaliser import _parse_response, get_model, make_client

load_dotenv(Path.home() / ".env")


def get_openai_client() -> openai.OpenAI:
    return make_client()


_BASE_SYSTEM_PROMPT = (
    "You are a recipe filter assistant. Extract structured filter criteria from a "
    "natural language question about recipes.\n\n"
    "Return a JSON object with zero or more of these fields:\n"
    '- "min_protein"    : minimum protein per serving in grams (number)\n'
    '- "max_kcal"       : maximum calories per serving (number)\n'
    '- "max_time"       : maximum total cook time in minutes (integer)\n'
    '- "max_fat"        : maximum fat per serving in grams (number)\n'
    '- "max_carbs"      : maximum carbohydrates per serving in grams (number)\n'
    '- "max_sodium"     : maximum sodium per serving in milligrams (number)\n'
    '- "min_fibre"      : minimum dietary fibre per serving in grams (number)\n'
    '- "cuisine"        : cuisine type string (e.g. "italian", "middle-eastern", "asian")\n'
    '- "dietary"        : dietary restriction — one of "vegan", "vegetarian", "halal", "kosher"\n'
    '- "origin_country" : country name — recipe must contain at least one ingredient from this country\n'
    '- "food_category"  : ingredient category — recipe must contain at least one ingredient of this type '
    '(e.g. "seafood", "poultry", "legume")\n\n'
    "Include only the fields explicitly mentioned or strongly implied. "
    "Return ONLY valid JSON, no other text."
)

_EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
 
# Extended example bank — covers all filter fields + satiety/texture/negative
_EXAMPLES: list[tuple[str, dict]] = [
    # --- protein ---
    ("give me a high protein recipe",           {"min_protein": 50}),
    ("something with lots of protein",          {"min_protein": 50}),
    ("protein rich meal",                       {"min_protein": 50}),
    ("high protein dinner for muscle gain",     {"min_protein": 40}),
    # --- time ---
    ("quick dinner under 30 minutes",           {"max_time": 30}),
    ("fast meal I can make tonight",            {"max_time": 30}),
    ("something I can cook in under an hour",   {"max_time": 60}),
    # --- calories ---
    ("low calorie option",                      {"max_kcal": 500}),
    ("light meal for lunch",                    {"max_kcal": 400}),
    ("something not too heavy",                 {"max_kcal": 500}),
    ("diet friendly recipe",                    {"max_kcal": 450}),
    # --- fat ---
    ("low fat meal",                            {"max_fat": 15}),
    ("something not too greasy",                {"max_fat": 20}),
    ("heart healthy recipe",                    {"max_fat": 15}),
    # --- sodium ---
    ("low sodium dish",                         {"max_sodium": 400}),
    ("something not too salty",                 {"max_sodium": 400}),
    ("good for high blood pressure",            {"max_sodium": 300}),
    # --- fibre / satiety ---
    ("something filling and hearty",            {"min_fibre": 5}),
    ("high fibre recipe",                       {"min_fibre": 8}),
    ("substantial meal that keeps me full",     {"min_fibre": 5}),
    ("light and fresh",                         {"max_kcal": 400}),
    # --- dietary ---
    ("something vegan",                         {"dietary": "vegan"}),
    ("vegetarian recipe please",                {"dietary": "vegetarian"}),
    ("halal meal",                              {"dietary": "halal"}),
    ("plant-based dinner",                      {"dietary": "vegan"}),
    # --- negative constraints ---
    ("no meat please",                          {"dietary": "vegetarian"}),
    ("without any animal products",             {"dietary": "vegan"}),
    ("dairy free option",                       {"dietary": "vegan"}),
    # --- cuisine ---
    ("italian food tonight",                    {"cuisine": "italian"}),
    ("middle eastern cuisine",                  {"cuisine": "middle-eastern"}),
    ("asian inspired dish",                     {"cuisine": "asian"}),
    ("mediterranean flavours",                  {"cuisine": "middle-eastern"}),
    # --- origin country ---
    ("something with mediterranean ingredients",    {"origin_country": "mediterranean"}),
    ("recipe using ingredients from asia",          {"origin_country": "asia"}),
    ("dish with south american flavours",           {"origin_country": "south america"}),
    # --- combos ---
    ("quick italian pasta dinner",              {"max_time": 30, "cuisine": "italian"}),
    ("high protein vegan recipe",               {"min_protein": 25, "dietary": "vegan"}),
    ("light quick meal under 30 minutes",       {"max_kcal": 500, "max_time": 30}),
    ("vegetarian low calorie dish",             {"dietary": "vegetarian", "max_kcal": 500}),
    ("low fat high protein lunch",              {"max_fat": 15, "min_protein": 30}),
    ("quick low sodium dinner",                 {"max_time": 30, "max_sodium": 400}),
    ("hearty vegetarian meal",                  {"dietary": "vegetarian", "min_fibre": 5}),
]
 
# Pre-compute once at load time — shape (n_examples, embedding_dim)
_EXAMPLE_QUESTIONS = [q for q, _ in _EXAMPLES]
_EXAMPLE_EMBEDDINGS: np.ndarray = _EMBED_MODEL.encode(
    _EXAMPLE_QUESTIONS, normalize_embeddings=True
)
 
 
def _select_examples(
    question: str, examples: list[tuple[str, dict]], k: int = 3
) -> list[tuple[str, dict]]:
    """Return the k most semantically similar examples using cosine similarity."""
    questions = [q for q, _ in examples]
    # use pre-computed matrix when called with the global example bank
    if questions == _EXAMPLE_QUESTIONS:
        ex_embs = _EXAMPLE_EMBEDDINGS
    else:
        ex_embs = _EMBED_MODEL.encode(questions, normalize_embeddings=True)
 
    # normalised embeddings → cosine similarity = dot product
    q_emb = _EMBED_MODEL.encode([question], normalize_embeddings=True)[0]
    scores = ex_embs @ q_emb
    top_k = np.argsort(scores)[::-1][:k]
    return [examples[i] for i in top_k]
 

def _build_prompt(question: str) -> str:
    examples = _select_examples(question, _EXAMPLES)
    shots = "\n".join(f'"{q}" -> {json.dumps(f)}' for q, f in examples)
    return _BASE_SYSTEM_PROMPT + f"\n\nExamples:\n{shots}"


def interpret_query(question: str, client: openai.OpenAI) -> dict:
    response = client.chat.completions.create(
        model=get_model(),
        messages=[
            {"role": "system", "content": _build_prompt(question)},
            {"role": "user", "content": question},
        ],
    )
    text = response.choices[0].message.content.strip()
    try:
        # _parse_response strips markdown fences (Gemini wraps JSON in ```json ... ```)
        result = _parse_response(text)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, ValueError):
        return {}


app = FastAPI(title="Recipe NL Query Service", version="2.0.0")

# CORS: production origin(s) + local dev, from env (comma-separated).
_ALLOWED_ORIGINS = [
    o.strip() for o in
    os.getenv("ALLOWED_ORIGINS", "https://cruesli.github.io,http://localhost:4321").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model": get_model()}


_KNOWN_FILTER_KEYS = frozenset({
    "min_protein", "max_kcal", "max_time", "cuisine", "dietary",
    "max_fat", "max_carbs", "max_sodium", "min_fibre",
    "origin_country", "food_category",
})


@app.post("/api/v1/query", response_model=QueryFiltersResponse)
def nl_query(
    body: QueryRequest,
    llm: openai.OpenAI = Depends(get_openai_client),
):
    raw_filters = interpret_query(body.question, llm)
    filters = {k: v for k, v in raw_filters.items() if k in _KNOWN_FILTER_KEYS}
    return QueryFiltersResponse(question=body.question, filters=filters)
