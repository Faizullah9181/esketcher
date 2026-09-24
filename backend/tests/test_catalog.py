from collections import Counter
from pathlib import Path

import pytest

from app.catalog.materials import MATERIALS
from app.catalog.sketches import SKETCHES


def test_library_sizes_and_variety() -> None:
    assert len(MATERIALS) >= 100
    assert len(SKETCHES) >= 100
    assert len({m.id for m in MATERIALS}) == len(MATERIALS)
    assert len({s.id for s in SKETCHES}) == len(SKETCHES)
    assert len(Counter(m.type for m in MATERIALS)) >= 12
    assert len(Counter(s.category for s in SKETCHES)) >= 20


def test_sketch_manifest_is_stable() -> None:
    first = SKETCHES[0]
    assert first.id == "sk-001"
    assert first.preview == f"procedural://{first.category}/{first.variant}/{first.seed}"
    assert all(0.3 <= s.complexity <= 0.95 for s in SKETCHES)


def test_list_materials_uses_camel_case(client) -> None:
    response = client.get("/api/materials")
    assert response.status_code == 200
    first = response.json()[0]
    assert {"colorFamily", "palette", "viscosity"} <= set(first)


def test_get_material(client) -> None:
    assert client.get("/api/materials/neon-liquid").json()["name"] == "Neon Liquid"
    assert client.get("/api/materials/nope").json()["detail"]["code"] == "not_found"


def test_sketches_list_filter_and_get(client) -> None:
    assert len(client.get("/api/sketches").json()) == len(SKETCHES)
    eyes = client.get("/api/sketches", params={"category": "eyes"}).json()
    assert eyes and all(s["category"] == "eyes" for s in eyes)
    assert client.get("/api/sketches/sk-001").json()["title"] == SKETCHES[0].title
    assert client.get("/api/sketches/sk-999").status_code == 404


def test_offline_snapshot_matches_the_api() -> None:
    from app.catalog.export import SNAPSHOT, render, snapshot

    if not SNAPSHOT.exists():  # pragma: no cover - backend-only checkout
        pytest.skip("frontend not checked out")
    assert SNAPSHOT.read_text(encoding="utf-8") == render(snapshot()), "run `make catalog`"


def test_export_writes_the_snapshot(tmp_path: Path) -> None:
    import json

    from app.catalog.export import main

    target = tmp_path / "data" / "catalog.json"
    main([str(target)])
    data = json.loads(target.read_text(encoding="utf-8"))
    assert (
        len(data["materials"]) == 121
        and len(data["sketches"]) == 105
        and len(data["palettes"]) == 7
    )
