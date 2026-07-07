# Stateless NL-query service for Hugging Face Spaces (Docker SDK, free CPU tier).
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

# HF Spaces runs containers as uid 1000; it needs write access to the model cache.
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
