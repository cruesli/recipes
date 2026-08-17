# Stateless NL-query service — containerised for any Docker host (e.g. Google Cloud Run).
# Holds no graph — only turns a question into a filter object.
FROM python:3.11-slim

# CPU-only torch FIRST, or sentence-transformers drags multi-GB CUDA wheels.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Service runtime deps only (ingest-only deps like rdflib/requests are not needed here).
RUN pip install --no-cache-dir \
    "fastapi>=0.136.1" "uvicorn>=0.46.0" "openai" "python-dotenv" \
    "sentence-transformers>=5.5.1" "pydantic" "numpy"

# Pre-download the embedding model AFTER sentence-transformers exists (bakes it into the image).
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

WORKDIR /app
COPY . /app/backend/

# Run as a non-root uid so the baked model cache stays writable.
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Honour $PORT when the host injects one (Cloud Run sets 8080); default 7860 for local runs.
EXPOSE 7860
CMD ["sh", "-c", "exec uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
