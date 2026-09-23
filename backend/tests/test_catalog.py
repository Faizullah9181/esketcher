from collections import Counter

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
