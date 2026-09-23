import asyncio

import httpx
import pytest
from pydantic import SecretStr

from app.services.jev import (
    JevAuthError,
    JevMalformedError,
    JevQuotaError,
    JevTimeoutError,
    JevUnavailableError,
    RealJevProvider,
)

OK = {"model": "jev-1.13.0", "answers": {}, "usage": {"input_tokens": 1, "output_tokens": 1}}


def _provider(handler) -> RealJevProvider:
    return RealJevProvider(
        api_key=SecretStr("secret-key"),
        base_url="https://api.typesafe.test",
        model="jev-latest",
        timeout_seconds=1,
        transport=httpx.MockTransport(handler),
    )


def _ask(provider: RealJevProvider):
    return asyncio.run(provider.ask({"s": 1}, {"q": {"type": "noul"}}))


def test_sends_authenticated_systemone_request() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=OK)

    assert _ask(_provider(handler)) == OK
    request = seen[0]
    assert request.url.path == "/v1/systemone"
    assert request.headers["authorization"] == "Bearer secret-key"
    assert b'"model":"jev-latest"' in request.content


def test_retries_server_errors_then_succeeds() -> None:
    responses = iter([httpx.Response(503), httpx.Response(200, json=OK)])
    assert _ask(_provider(lambda _: next(responses))) == OK


@pytest.mark.parametrize(
    ("status", "error"),
    [(401, JevAuthError), (403, JevAuthError), (402, JevQuotaError), (400, JevMalformedError)],
)
def test_client_errors_fail_fast(status, error) -> None:
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status)

    with pytest.raises(error):
        _ask(_provider(handler))
    assert len(calls) == 1


def test_persistent_server_error_is_unavailable() -> None:
    with pytest.raises(JevUnavailableError, match="HTTP 500"):
        _ask(_provider(lambda _: httpx.Response(500)))


def test_rate_limited_upstream_is_unavailable() -> None:
    with pytest.raises(JevUnavailableError, match="HTTP 429"):
        _ask(_provider(lambda _: httpx.Response(429)))


def test_timeout() -> None:
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(JevTimeoutError):
        _ask(_provider(handler))


def test_connection_error() -> None:
    def handler(request):
        raise httpx.ConnectError("no route", request=request)

    with pytest.raises(JevUnavailableError, match="connect"):
        _ask(_provider(handler))


def test_non_json_body() -> None:
    with pytest.raises(JevMalformedError):
        _ask(_provider(lambda _: httpx.Response(200, text="<html>")))


def test_health_checks_model_list_and_caches() -> None:
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"models": [{"name": "jev-latest"}, {"name": "x"}]})

    provider = _provider(handler)

    async def run():
        first = await provider.health()
        second = await provider.health()
        await provider.aclose()
        return first, second

    first, second = asyncio.run(run())
    assert first.online and first.available_models == ["jev-latest", "x"]
    assert second is first
    assert len(calls) == 1


def test_health_reports_missing_model_and_failures() -> None:
    missing = asyncio.run(
        _provider(lambda _: httpx.Response(200, json={"models": [{"name": "other"}]})).health()
    )
    assert not missing.online and "not available" in missing.error

    down = asyncio.run(_provider(lambda _: httpx.Response(500)).health())
    assert not down.online and down.error == "HTTPStatusError"


def test_key_never_appears_in_repr() -> None:
    from app.config import Settings

    settings = Settings(_env_file=None, jev_mode="real", typesafe_api_key="apikey_very_secret")
    assert "apikey_very_secret" not in repr(settings)
