"""Writes the catalog as the API serves it, for the frontend's offline build.

The offline build (`VITE_OFFLINE=1`) has no backend to ask, so it bundles this
snapshot. It is generated, never edited: `make catalog` after catalog changes;
`tests/test_catalog.py` fails while the two disagree.
"""

import json
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.jev import MockJevProvider

SNAPSHOT = Path(__file__).resolve().parents[3] / "frontend" / "src" / "data" / "catalog.json"
ENDPOINTS = {
    "materials": "/api/materials",
    "sketches": "/api/sketches",
    "palettes": "/api/materials/palettes",
}


def snapshot() -> dict[str, Any]:
    settings = Settings(
        _env_file=None, env="test", jev_mode="mock", database_url="sqlite+aiosqlite://"
    )
    with TestClient(create_app(settings, MockJevProvider(0))) as client:
        return {key: client.get(path).raise_for_status().json() for key, path in ENDPOINTS.items()}


def render(data: dict[str, Any]) -> str:
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> None:
    target = Path((argv or sys.argv[1:] or [str(SNAPSHOT)])[0])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render(snapshot()), encoding="utf-8")
    print(f"wrote {target}")


if __name__ == "__main__":  # pragma: no cover
    main()
