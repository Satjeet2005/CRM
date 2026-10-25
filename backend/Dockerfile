FROM python:3.12-slim

# Install native libraries and fonts for WeasyPrint PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libjpeg62-turbo \
    libopenjp2-7 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install uv from official binary
COPY --from=ghcr.io/astral-sh/uv:0.5.21 /uv /uvx /bin/

WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install project dependencies using lockfile
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev

# Copy application source and alembic configuration
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

EXPOSE 8000

# Startup: run migrations then start uvicorn
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
