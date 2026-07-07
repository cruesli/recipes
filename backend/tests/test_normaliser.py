import json
from unittest.mock import MagicMock

import pytest

from backend.normaliser import normalise_ingredient


def _mock_client(response_text: str) -> MagicMock:
    client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = response_text
    client.chat.completions.create.return_value = mock_resp
    return client


def _json_resp(*items) -> str:
    """Build a JSON response string from (name, quantity_g) tuples."""
    return json.dumps([{"name": n, "quantity_g": q} for n, q in items])


def test_normalise_strips_quantity_and_unit():
    client = _mock_client(_json_resp(("chicken thigh", 400.0)))
    assert normalise_ingredient("400g Chicken thighs", client) == "chicken thigh"


def test_normalise_plain_name():
    client = _mock_client(_json_resp(("tahini", None)))
    assert normalise_ingredient("Tahini", client) == "tahini"


def test_normalise_strips_leading_trailing_whitespace():
    client = _mock_client(_json_resp(("butternut squash", 700.0)))
    result = normalise_ingredient("1 Butternut squash", client)
    assert result == "butternut squash"


def test_normalise_sends_raw_string_to_api():
    client = _mock_client(_json_resp(("chicken thigh", 400.0)))
    normalise_ingredient("400g Chicken thighs", client)
    call_kwargs = client.chat.completions.create.call_args.kwargs
    messages = call_kwargs["messages"]
    user_msg = next(m for m in messages if m["role"] == "user")
    assert "400g Chicken thighs" in user_msg["content"]


def test_normalise_includes_system_prompt():
    client = _mock_client(_json_resp(("chicken thigh", 400.0)))
    normalise_ingredient("400g Chicken thighs", client)
    call_kwargs = client.chat.completions.create.call_args.kwargs
    messages = call_kwargs["messages"]
    system_msg = next(m for m in messages if m["role"] == "system")
    assert len(system_msg["content"]) > 0


# --- normalise_all ---

from backend.normaliser import normalise_all


def test_normalise_all_returns_dicts():
    client = _mock_client(_json_resp(("chicken thigh", 400.0)))
    result = normalise_all(["400g Chicken thighs"], client)
    assert isinstance(result[0], dict)
    assert "name" in result[0]
    assert "quantity_g" in result[0]


def test_normalise_all_maps_list():
    client = _mock_client(_json_resp(
        ("chicken thigh", 400.0),
        ("butternut squash", 700.0),
        ("tahini", None),
    ))
    result = normalise_all(["400g Chicken thighs", "1 Butternut squash", "Tahini"], client)
    assert result == [
        {"name": "chicken thigh", "quantity_g": 400.0, "category": "other", "quantity": None},
        {"name": "butternut squash", "quantity_g": 700.0, "category": "other", "quantity": None},
        {"name": "tahini", "quantity_g": None, "category": "other", "quantity": None},
    ]


def test_normalise_all_quantity_g_in_grams():
    # 2 tbsp → 30g
    client = _mock_client(_json_resp(("olive oil", 30.0)))
    result = normalise_all(["2 tbsp olive oil"], client)
    assert result[0]["quantity_g"] == pytest.approx(30.0)


def test_normalise_all_returns_null_quantity_for_to_taste():
    client = _mock_client(_json_resp(("salt", None)))
    result = normalise_all(["salt to taste"], client)
    assert result[0]["quantity_g"] is None


def test_normalise_all_single_api_call():
    client = _mock_client(_json_resp(("chicken thigh", 400.0), ("butternut squash", 700.0)))
    normalise_all(["400g Chicken thighs", "1 Butternut squash"], client)
    client.chat.completions.create.assert_called_once()


def test_normalise_all_sends_all_ingredients_in_one_message():
    client = _mock_client(_json_resp(("chicken thigh", 400.0), ("butternut squash", 700.0)))
    normalise_all(["400g Chicken thighs", "1 Butternut squash"], client)
    call_kwargs = client.chat.completions.create.call_args.kwargs
    user_msg = next(m for m in call_kwargs["messages"] if m["role"] == "user")
    assert "400g Chicken thighs" in user_msg["content"]
    assert "1 Butternut squash" in user_msg["content"]


def test_normalise_all_empty_list():
    client = MagicMock()
    result = normalise_all([], client)
    assert result == []
    client.chat.completions.create.assert_not_called()


def test_normalise_all_preserves_order():
    client = _mock_client(_json_resp(("egg", None), ("olive oil", 30.0)))
    result = normalise_all(["2 Eggs", "2 tbsp olive oil"], client)
    assert result[0]["name"] == "egg"
    assert result[1]["name"] == "olive oil"


def test_normalise_all_strips_whitespace_from_name():
    client = _mock_client(_json_resp(("  butternut squash  ", 700.0)))
    result = normalise_all(["1 Butternut squash"], client)
    assert result[0]["name"] == "butternut squash"


# --- make_client / get_model ---

from backend.normaliser import get_model


_ENV_VARS = (
    "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL",
    "GEMINI_API_KEY",
    "CAMPUSAI_API_KEY", "CAMPUSAI_BASE_URL", "CAMPUSAI_MODEL",
)


def _clear_llm_env(monkeypatch):
    for var in _ENV_VARS:
        monkeypatch.delenv(var, raising=False)


def test_make_client_prefers_llm_env(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.example/v1")
    monkeypatch.setenv("CAMPUSAI_API_KEY", "campus-key")
    monkeypatch.setenv("CAMPUSAI_BASE_URL", "https://campus.example/v1")
    client = make_client()
    assert client.api_key == "llm-key"
    assert "llm.example" in str(client.base_url)


def test_make_client_falls_back_to_campusai(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("CAMPUSAI_API_KEY", "campus-key")
    monkeypatch.setenv("CAMPUSAI_BASE_URL", "https://campus.example/v1")
    client = make_client()
    assert client.api_key == "campus-key"
    assert "campus.example" in str(client.base_url)


def test_make_client_defaults_to_gemini_base_url(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    client = make_client()
    assert "generativelanguage.googleapis.com" in str(client.base_url)


def test_make_client_raises_without_any_api_key(monkeypatch):
    _clear_llm_env(monkeypatch)
    with pytest.raises(ValueError, match="LLM_API_KEY"):
        make_client()


def test_get_model_prefers_llm_model(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    monkeypatch.setenv("LLM_MODEL", "llm-model")
    monkeypatch.setenv("CAMPUSAI_MODEL", "campus-model")
    assert get_model() == "llm-model"


def test_get_model_falls_back_to_campusai_model(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("CAMPUSAI_API_KEY", "campus-key")
    monkeypatch.setenv("CAMPUSAI_MODEL", "campus-model")
    assert get_model() == "campus-model"


def test_get_model_defaults_to_gemini_flash(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    assert "gemini" in get_model()


def test_normalise_all_uses_get_model(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    client = _mock_client(_json_resp(("onion", 150.0)))
    normalise_all(["1 onion"], client)
    assert client.chat.completions.create.call_args.kwargs["model"] == "test-model"


# --- GEMINI_API_KEY recognised as a coherent provider (regression) ---

def test_gemini_key_recognised(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    client = make_client()
    assert client.api_key == "gem-key"
    assert "generativelanguage.googleapis.com" in str(client.base_url)


def test_gemini_key_ignores_stale_campusai_config(monkeypatch):
    # A Gemini key must not get paired with a leftover CampusAI base URL / model.
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.setenv("CAMPUSAI_API_KEY", "campus-key")
    monkeypatch.setenv("CAMPUSAI_BASE_URL", "https://campus.example/v1")
    monkeypatch.setenv("CAMPUSAI_MODEL", "gemma-x")
    client = make_client()
    assert client.api_key == "gem-key"
    assert "generativelanguage.googleapis.com" in str(client.base_url)
    assert "gemini" in get_model()


# --- make_client (legacy) ---

import openai

from backend.normaliser import make_client


def test_make_client_returns_openai_client(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("CAMPUSAI_API_KEY", "test-key")
    monkeypatch.setenv("CAMPUSAI_BASE_URL", "https://example.com/v1")
    client = make_client()
    assert isinstance(client, openai.OpenAI)




# --- N1 fields: shopping category + stated quantity ---

from backend.categories import SHOPPING_CATEGORIES, coerce_category


def _json_resp_n1(*items) -> str:
    """Build a JSON response from (name, quantity_g, category, quantity) tuples."""
    return json.dumps([
        {"name": n, "quantity_g": g, "category": c, "quantity": q}
        for n, g, c, q in items
    ])


def test_categories_enum_has_nine_buckets():
    assert len(SHOPPING_CATEGORIES) == 9
    assert SHOPPING_CATEGORIES[0] == "produce"
    assert SHOPPING_CATEGORIES[-1] == "other"


def test_coerce_category_passes_valid_slug():
    assert coerce_category("dairy-eggs") == "dairy-eggs"


def test_coerce_category_coerces_unknown_to_other():
    assert coerce_category("weird-bucket") == "other"


def test_coerce_category_coerces_none_to_other():
    assert coerce_category(None) == "other"


def test_normalise_all_returns_category():
    client = _mock_client(_json_resp_n1(("onion", 150.0, "produce", {"amount": 1, "unit": "count"})))
    result = normalise_all(["1 onion"], client)
    assert result[0]["category"] == "produce"


def test_normalise_all_coerces_invalid_category():
    client = _mock_client(_json_resp_n1(("onion", 150.0, "vegetables", {"amount": 1, "unit": "count"})))
    result = normalise_all(["1 onion"], client)
    assert result[0]["category"] == "other"


def test_normalise_all_missing_category_becomes_other():
    client = _mock_client(_json_resp(("onion", 150.0)))
    result = normalise_all(["1 onion"], client)
    assert result[0]["category"] == "other"


def test_normalise_all_returns_stated_quantity():
    client = _mock_client(_json_resp_n1(("onion", 600.0, "produce", {"amount": 4, "unit": "count"})))
    result = normalise_all(["4 large onions"], client)
    assert result[0]["quantity"] == {"amount": 4, "unit": "count"}


def test_normalise_all_null_stated_quantity():
    client = _mock_client(_json_resp_n1(("salt", None, "spices-seasonings", None)))
    result = normalise_all(["salt to taste"], client)
    assert result[0]["quantity"] is None


def test_normalise_all_malformed_quantity_becomes_null():
    client = _mock_client(_json_resp_n1(("salt", None, "spices-seasonings", {"amount": "some"})))
    result = normalise_all(["salt"], client)
    assert result[0]["quantity"] is None


def test_system_prompt_lists_all_categories():
    from backend.normaliser import _SYSTEM_PROMPT
    for slug in SHOPPING_CATEGORIES:
        assert slug in _SYSTEM_PROMPT
