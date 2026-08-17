# Recipe NL Query Service

Stateless FastAPI service: turns a natural-language recipe question into a
structured filter object. The frontend applies those filters over its baked
enriched-recipe JSON, so this service holds **no knowledge graph** and never
needs redeploying when recipes change.

## Endpoints

- `GET /health` → `{"status": "ok", "model": "<llm-model>"}`
- `POST /api/v1/query` body `{"question": "..."}` →
  `{"question": "...", "filters": { "cuisine": "italian", "max_time": 30, ... }}`

Filter keys are whitelisted to the 12 known fields (`min_protein`, `max_kcal`,
`max_time`, `max_fat`, `max_carbs`, `max_sodium`, `min_fibre`, `cuisine`,
`dietary`, `origin_country`, `food_category`, `ingredient`).

## Configuration (env vars)

- `GEMINI_API_KEY` (or `LLM_API_KEY` / legacy `CAMPUSAI_API_KEY`) — the LLM key.
  Provider resolves as a coherent set; Gemini is the default endpoint/model.
- `ALLOWED_ORIGINS` — comma-separated CORS origins
  (default `https://cruesli.github.io,http://localhost:4321`).
- `PORT` — honoured by the container (Cloud Run injects `8080`); defaults to `7860`.

## Local run

```bash
docker build -t recipe-nl backend
docker run --rm -p 7860:7860 -e GEMINI_API_KEY=... recipe-nl
curl -X POST localhost:7860/api/v1/query -H 'content-type: application/json' \
  -d '{"question":"quick vegetarian dinner"}'
```

## Deploy (Google Cloud Run)

Deployed from source — Cloud Build reads the `Dockerfile`. Stateless + scale-to-zero,
so it costs ~nothing idle. The frontend reaches it via `PUBLIC_NLP_API_URL`.

```bash
gcloud run deploy recipe-nl --source backend \
  --project=magnus-recipes-nl --region=europe-north1 \
  --allow-unauthenticated --memory=2Gi --max-instances=3 \
  --set-env-vars=GEMINI_API_KEY=...
```

Re-run the same command to redeploy after a **code** change (recipe-data changes never
need a redeploy — see above). Cost guardrails in place: request-based billing +
scale-to-zero, `--max-instances=3`, and an Artifact Registry cleanup policy (keep the
3 most recent images, drop superseded untagged ones).

The full ingest pipeline (graph build, nutrition, enriched-JSON export) is a
separate offline step — see the repo root, not this service.
