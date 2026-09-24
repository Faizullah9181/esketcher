def test_project_lifecycle(client) -> None:
    created = client.post("/api/projects", json={"name": "Desk", "snapshot": {"a": 1}})
    assert created.status_code == 201
    project = created.json()
    assert project["revision"] == 0

    fetched = client.get(f"/api/projects/{project['id']}").json()
    assert fetched["snapshot"] == {"a": 1}

    updated = client.put(
        f"/api/projects/{project['id']}", json={"snapshot": {"a": 2}, "revision": 0, "name": "B"}
    ).json()
    assert updated["revision"] == 1 and updated["name"] == "B"
    assert updated["snapshot"] == {"a": 2}

    unguarded = client.put(f"/api/projects/{project['id']}", json={"snapshot": {"a": 3}})
    assert unguarded.json()["revision"] == 2


def test_project_defaults(client) -> None:
    project = client.post("/api/projects", json={}).json()
    assert project["name"] == "Untitled universe"


def test_stale_revision_conflicts(client) -> None:
    project = client.post("/api/projects", json={}).json()
    client.put(f"/api/projects/{project['id']}", json={"snapshot": {}, "revision": 0})
    stale = client.put(f"/api/projects/{project['id']}", json={"snapshot": {}, "revision": 0})
    assert stale.status_code == 409
    assert stale.json()["detail"]["revision"] == 1


def test_missing_project(client) -> None:
    assert client.get("/api/projects/nope").status_code == 404
    assert client.put("/api/projects/nope", json={"snapshot": {}}).status_code == 404


def test_oversized_project_is_rejected(client_for) -> None:
    client = client_for(max_project_bytes=100)
    response = client.post("/api/projects", json={"snapshot": {"x": "y" * 200}})
    assert response.status_code == 413


def test_project_writes_are_rate_limited(client_for) -> None:
    client = client_for(project_writes_per_minute=2)
    created = client.post("/api/projects", json={"snapshot": {}}).json()
    assert (
        client.put(
            f"/api/projects/{created['id']}", json={"snapshot": {}, "revision": created["revision"]}
        ).status_code
        == 200
    )
    blocked = client.post("/api/projects", json={"snapshot": {}})
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert client.get(f"/api/projects/{created['id']}").status_code == 200  # reads are not writes
