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


def test_every_api_request_is_rate_limited_with_cors_headers(client_for) -> None:
    client = client_for(rate_limit_per_minute=2)
    origin = {"Origin": "http://localhost:5173"}
    assert client.get("/api/materials", headers=origin).status_code == 200
    assert client.get("/api/sketches", headers=origin).status_code == 200
    blocked = client.get("/api/health", headers=origin)
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) >= 1
    # the browser can read the refusal instead of seeing a CORS failure
    assert blocked.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "retry-after" in blocked.headers["access-control-expose-headers"].lower()


def test_bodies_must_declare_a_bounded_length(client_for) -> None:
    client = client_for(max_project_bytes=100)
    too_big = client.post(
        "/api/projects",
        content=b'{"snapshot":{"x":"' + b"y" * 200 + b'"}}',
        headers={"Content-Type": "application/json"},
    )
    assert too_big.status_code == 413
    assert too_big.json()["detail"]["code"] == "too_large"

    def chunks():
        yield b'{"snapshot":{}}'

    streamed = client.post(
        "/api/projects", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert streamed.status_code == 411
    assert streamed.json()["detail"]["code"] == "length_required"
