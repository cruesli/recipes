"""Tests for backend/main.py — stateless NL-query service (TDD).

The deployed service holds no graph: POST /api/v1/query returns only the
extracted filter object; the frontend applies filters over the baked JSON.
"""
import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import (
    _BASE_SYSTEM_PROMPT,
    _EXAMPLES,
    _build_prompt,
    _select_examples,
    app,
    get_openai_client,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_llm():
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(
            content=json.dumps({"cuisine": "middle-eastern", "max_time": 30})
        ))]
    )
    return mock


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client_with_mock_llm(mock_llm):
    app.dependency_overrides[get_openai_client] = lambda: mock_llm
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


def test_health_returns_200(client):
    assert client.get("/health").status_code == 200


def test_health_status_is_ok(client):
    assert client.get("/health").json()["status"] == "ok"


def test_health_reports_model_not_triples(client):
    data = client.get("/health").json()
    assert "model" in data
    assert "triples" not in data  # the service no longer holds a graph


# ---------------------------------------------------------------------------
# POST /api/v1/query — returns extracted filters only
# ---------------------------------------------------------------------------


def test_nl_query_returns_200(client_with_mock_llm):
    r = client_with_mock_llm.post("/api/v1/query", json={"question": "quick middle-eastern dinner"})
    assert r.status_code == 200


def test_nl_query_echoes_question(client_with_mock_llm):
    data = client_with_mock_llm.post("/api/v1/query", json={"question": "quick middle-eastern dinner"}).json()
    assert data["question"] == "quick middle-eastern dinner"


def test_nl_query_returns_extracted_filters(client_with_mock_llm):
    data = client_with_mock_llm.post("/api/v1/query", json={"question": "quick middle-eastern dinner"}).json()
    assert data["filters"] == {"cuisine": "middle-eastern", "max_time": 30}


def test_nl_query_has_no_results_field(client_with_mock_llm):
    # stateless: no graph matching, so no results are returned
    data = client_with_mock_llm.post("/api/v1/query", json={"question": "anything"}).json()
    assert "results" not in data


def test_nl_query_whitelists_unknown_keys():
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(
            content=json.dumps({"cuisine": "italian", "colour": "red", "drop_table": 1})
        ))]
    )
    app.dependency_overrides[get_openai_client] = lambda: mock
    try:
        with TestClient(app) as c:
            data = c.post("/api/v1/query", json={"question": "italian"}).json()
    finally:
        app.dependency_overrides.clear()
    assert data["filters"] == {"cuisine": "italian"}


def test_nl_query_passes_ingredient_filter():
    # A specific ingredient the user wants to cook with is allow-listed; junk keys drop.
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(
            content=json.dumps({"ingredient": "pork shoulder", "bogus": 1})
        ))]
    )
    app.dependency_overrides[get_openai_client] = lambda: mock
    try:
        with TestClient(app) as c:
            data = c.post("/api/v1/query", json={"question": "what can I make with pork shoulder"}).json()
    finally:
        app.dependency_overrides.clear()
    assert data["filters"] == {"ingredient": "pork shoulder"}


def test_nl_query_parses_markdown_fenced_json():
    # Gemini wraps JSON in ```json ... ``` fences — these must still parse.
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(
            content='```json\n{\n  "cuisine": "italian",\n  "max_time": 30\n}\n```'
        ))]
    )
    app.dependency_overrides[get_openai_client] = lambda: mock
    try:
        with TestClient(app) as c:
            data = c.post("/api/v1/query", json={"question": "quick italian"}).json()
    finally:
        app.dependency_overrides.clear()
    assert data["filters"] == {"cuisine": "italian", "max_time": 30}


def test_nl_query_empty_filters_on_unparseable_llm_output():
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="sorry, I cannot help with that"))]
    )
    app.dependency_overrides[get_openai_client] = lambda: mock
    try:
        with TestClient(app) as c:
            data = c.post("/api/v1/query", json={"question": "???"}).json()
    finally:
        app.dependency_overrides.clear()
    assert data["filters"] == {}


# ---------------------------------------------------------------------------
# Few-shot selection machinery (unchanged)
# ---------------------------------------------------------------------------


def test_select_examples_returns_k():
    assert len(_select_examples("high protein meal", _EXAMPLES, k=3)) == 3


def test_select_examples_returns_k_even_with_no_overlap():
    assert len(_select_examples("xyzzy plugh", _EXAMPLES, k=2)) == 2


def test_select_examples_ranks_protein_first_for_protein_query():
    results = _select_examples("high protein meal", _EXAMPLES, k=3)
    top = [q for q, _ in results]
    assert any("protein" in q for q in top)


def test_select_examples_ranks_cuisine_first_for_cuisine_query():
    results = _select_examples("italian pasta dinner tonight", _EXAMPLES, k=3)
    top = [q for q, _ in results]
    assert any("italian" in q for q in top)


def test_select_examples_ranks_vegan_first_for_vegan_query():
    results = _select_examples("something vegan and light", _EXAMPLES, k=2)
    top = [q for q, _ in results]
    assert any("vegan" in q or "plant-based" in q for q in top)


def test_select_examples_ranks_sodium_first_for_sodium_query():
    results = _select_examples("low sodium dish", _EXAMPLES, k=2)
    top = [q for q, _ in results]
    assert any("sodium" in q or "salty" in q for q in top)


def test_build_prompt_contains_all_filter_field_names():
    prompt = _build_prompt("anything")
    for field in ("min_protein", "max_kcal", "max_time", "cuisine", "dietary",
                  "max_fat", "max_carbs", "max_sodium", "min_fibre",
                  "origin_country", "food_category"):
        assert field in prompt


def test_build_prompt_includes_examples_section():
    assert "Examples:" in _build_prompt("italian food")


def test_build_prompt_base_prompt_has_no_examples():
    assert "Examples:" not in _BASE_SYSTEM_PROMPT
