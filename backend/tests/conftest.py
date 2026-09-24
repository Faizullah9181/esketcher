from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.jev import JevProvider, MockJevProvider


def make_settings(tmp_path: Path, **overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "env": "test",
        "jev_mode": "mock",
        "database_url": f"sqlite+aiosqlite:///{tmp_path / 'test.db'}",
        "jev_rate_limit_per_minute": 1000,
        "rate_limit_per_minute": 10_000,
        "project_writes_per_minute": 1000,
        "jev_daily_limit_per_client": 0,
        "jev_daily_budget": 0,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def client_for(tmp_path: Path):
    """Build a TestClient around any provider / settings overrides."""
    clients: list[TestClient] = []

    def build(provider: JevProvider | None = None, **overrides: Any) -> TestClient:
        app = create_app(make_settings(tmp_path, **overrides), provider or MockJevProvider(0))
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()
        clients.append(client)
        return client

    yield build
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(client_for) -> Iterator[TestClient]:
    return client_for()


def decision_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "target": {
            "kind": "iris",
            "label": "left iris",
            "areaRatio": 0.08,
            "complexity": 0.72,
            "strokeDensity": 0.41,
            "symmetry": 0.81,
            "composition": "center-heavy",
            "dominantColor": "#aabbcc",
        },
        "context": {"sketchId": "sk-091", "neighborMaterialIds": ["chrome"], "chaos": False},
        "candidateMaterials": ["neon-liquid", "ink-wash", "liquid-chrome", "watercolor"],
        "scope": "region",
    }
    body.update(overrides)
    return body
