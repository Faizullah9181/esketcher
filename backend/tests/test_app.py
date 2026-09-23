from app.models.decision import JevHealth


def test_health_reports_jev(client) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["jev"] == {
        "mode": "mock",
        "model": "jev-mock",
        "online": True,
        "latencyMs": 0,
        "availableModels": ["jev-mock"],
        "error": None,
    }
    assert response.headers["x-request-id"]


def test_request_id_is_echoed(client) -> None:
    assert client.get("/api/health", headers={"X-Request-ID": "r1"}).headers["x-request-id"] == "r1"


def test_cors_allows_configured_origin(client) -> None:
    response = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unhandled_errors_are_json(client_for) -> None:
    class Exploding:
        mode = "mock"
        model = "boom"

        async def health(self) -> JevHealth:
            raise RuntimeError("kaboom")

        async def aclose(self) -> None:
            return None

    response = client_for(Exploding()).get("/api/health")
    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "internal"


def test_docs_disabled_in_production(client_for) -> None:
    assert client_for(env="production").get("/docs").status_code == 404
