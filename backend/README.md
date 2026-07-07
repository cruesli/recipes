---
title: Recipe NL Query
emoji: 🍲
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Recipe NL Query Service

Stateless FastAPI service: turns a natural-language recipe question into a
structured filter object. The frontend applies those filters over its baked
enriched-recipe JSON, so this service holds **no knowledge graph** and never
needs redeploying when recipes change.

## Endpoints

- `GET /health` → `{"status": "ok", "model": "<llm-model>"}`
- `POST /api/v1/query` body `{"question": "..."}` →
  `{"question": "...", "filters": { "cuisine": "italian", "max_time": 30, ... }}`

Filter keys are whitelisted to the 11 known fields (`min_protein`, `max_kcal`,
`max_time`, `max_fat`, `max_carbs`, `max_sodium`, `min_fibre`, `cuisine`,
`dietary`, `origin_country`, `food_category`).

## Configuration (Space secrets)

- `GEMINI_API_KEY` (or `LLM_API_KEY` / legacy `CAMPUSAI_API_KEY`) — the LLM key.
  Provider resolves as a coherent set; Gemini is the default endpoint/model.
- `ALLOWED_ORIGINS` — comma-separated CORS origins
  (default `https://cruesli.github.io,http://localhost:4321`).

## Local run

```bash
docker build -t recipe-nl backend
docker run --rm -p 7860:7860 -e GEMINI_API_KEY=... recipe-nl
curl -X POST localhost:7860/api/v1/query -H 'content-type: application/json' \
  -d '{"question":"quick vegetarian dinner"}'
```

The full ingest pipeline (graph build, nutrition, enriched-JSON export) is a
separate offline step — see the repo root, not this service.
