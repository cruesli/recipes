import json
from unittest.mock import MagicMock

from backend.parser import parse_steps
from backend.step_linker import link_steps


def _mock_client(response_text: str) -> MagicMock:
    client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = response_text
    client.chat.completions.create.return_value = mock_resp
    return client


STEPS = ["Cut pork into cubes", "Add the salt and water"]
INGREDIENTS = ["2.5 kg Pork shoulder", "30g salt", "Roughly 500ml Water"]


def test_parse_steps_mirrors_frontend_split():
    body = "1. First step\n\n2. Second step\n continued line"
    assert parse_steps(body) == ["First step", "Second step\n continued line"]
    assert parse_steps("") == []


def test_valid_links_pass_through():
    links = json.dumps([
        [{"line": 0, "phrase": "pork"}],
        [{"line": 1, "phrase": "salt"}, {"line": 2, "phrase": "water"}],
    ])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[0] == [{"line": 0, "phrase": "pork"}]
    assert [r["line"] for r in result[1]] == [1, 2]


def test_invalid_refs_dropped():
    links = json.dumps([
        [{"line": 99, "phrase": "pork"}, {"line": 0, "phrase": "not in step"}],
        [{"line": 1, "phrase": "salt"}, {"line": 1, "phrase": "salt"}],
    ])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[0] == []                      # out of range + phrase mismatch
    assert result[1] == [{"line": 1, "phrase": "salt"}]  # deduped by line


def test_wrong_length_padded_or_truncated():
    result = link_steps(INGREDIENTS, STEPS, _mock_client(json.dumps([[]])))
    assert len(result) == 2
    result = link_steps(INGREDIENTS, STEPS, _mock_client(json.dumps([[], [], []])))
    assert len(result) == 2


def test_empty_phrase_is_dropped():
    links = json.dumps([[{"line": 1, "phrase": ""}], []])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[0] == []


def test_phrase_match_is_case_insensitive():
    links = json.dumps([[], [{"line": 1, "phrase": "SALT"}]])
    result = link_steps(INGREDIENTS, STEPS, _mock_client(links))
    assert result[1] == [{"line": 1, "phrase": "SALT"}]


def test_no_steps_returns_empty_without_calling_llm():
    client = _mock_client("[]")
    assert link_steps(INGREDIENTS, [], client) == []
    client.chat.completions.create.assert_not_called()


def test_non_list_response_yields_empty_refs_per_step():
    result = link_steps(INGREDIENTS, STEPS, _mock_client(json.dumps({"oops": 1})))
    assert result == [[], []]
