install:
	uv sync --extra dev

dev:
	uv run --extra dev uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test:
	uv run --extra dev pytest -q

lint:
	uv run --extra dev ruff check . && uv run --extra dev ruff format --check .

catalog:
	uv run --extra dev python -m app.catalog.export

format:
	uv run --extra dev ruff format . && uv run --extra dev ruff check --fix .

.PHONY: install dev test lint format catalog
