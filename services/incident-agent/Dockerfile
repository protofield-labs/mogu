# syntax=docker/dockerfile:1

FROM python:3.11-slim AS runner

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

RUN groupadd --system --gid 1001 appuser \
  && useradd --system --uid 1001 --gid appuser appuser

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY agent ./agent
COPY app ./app
COPY db ./db
COPY jobs ./jobs
COPY playbooks ./playbooks
COPY scripts ./scripts

USER appuser
EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
