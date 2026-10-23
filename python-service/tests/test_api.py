import hashlib
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.errors import RobotsDisallowed, SourceUnavailable
from app.fetcher import FetchResult
from app.routes import get_fetcher
from main import app
from tests.pdf_factory import sample_pdf

KEY = "clave-de-prueba"
HEADERS = {"X-Internal-Api-Key": KEY}


def ok_fetcher(settings, allow_cache):
    content = sample_pdf()
    return FetchResult(
        content=content,
        sha256=hashlib.sha256(content).hexdigest(),
        fetched_at=datetime(2026, 10, 20, tzinfo=timezone.utc),
        from_cache=False,
        changed=None,
    )


@pytest.fixture
def client():
    settings = Settings(internal_api_key=KEY, expected_semesters=3)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_fetcher] = lambda: ok_fetcher
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_requires_internal_key(client):
    assert client.post("/ingest/curriculum").status_code == 401
    assert client.post("/ingest/curriculum", headers={"X-Internal-Api-Key": "mala"}).status_code == 401


def test_fails_closed_when_key_not_configured():
    app.dependency_overrides[get_settings] = lambda: Settings(internal_api_key="")
    try:
        response = TestClient(app).post("/ingest/curriculum", headers=HEADERS)
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 401


def test_ingest_returns_courses_provenance_and_metrics(client):
    response = client.post("/ingest/curriculum", headers=HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["metrics"]["candidates"] == 7
    assert body["metrics"]["valid"] == 5  # 7 cajas - 1 duplicado - 1 ruido ("12")
    assert body["metrics"]["duplicates"] == 1
    assert body["metrics"]["rejected"] == 1
    assert body["metrics"]["coverage"] == 1.0
    assert body["provenance"]["resolution"] == "DRA 61/2020 mod. por DRA 10/2021"
    assert len(body["provenance"]["sha256"]) == 64
    by_name = {c["name"]: c for c in body["courses"]}
    assert by_name["Cálculo Diferencial e Integral"]["category"] == "Ciencias Básicas"
    assert "Ciencias Básicas" not in by_name  # la leyenda no es una asignatura
    assert any("sin categoria" in w for w in body["warnings"])


def test_degraded_when_semesters_are_missing():
    settings = Settings(internal_api_key=KEY, expected_semesters=11)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_fetcher] = lambda: ok_fetcher
    try:
        body = TestClient(app).post("/ingest/curriculum", headers=HEADERS).json()
    finally:
        app.dependency_overrides.clear()

    assert body["status"] == "degraded"
    assert any("3 de 11" in w for w in body["warnings"])


def test_rejects_source_url_in_body(client):
    response = client.post(
        "/ingest/curriculum", headers=HEADERS, json={"source_url": "http://169.254.169.254"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (SourceUnavailable("fuente caida"), 503, "SOURCE_UNAVAILABLE"),
        (RobotsDisallowed("no permitido"), 403, "ROBOTS_DISALLOWED"),
    ],
)
def test_source_errors_map_to_structured_responses(client, error, status, code):
    def failing(settings, allow_cache):
        raise error

    app.dependency_overrides[get_fetcher] = lambda: failing
    response = client.post("/ingest/curriculum", headers=HEADERS)

    assert response.status_code == status
    body = response.json()["error"]
    assert body["code"] == code
    assert body["request_id"] != "-"


def test_request_id_is_propagated_and_timing_exposed(client):
    response = client.get("/health", headers={"X-Request-Id": "abc-123"})

    assert response.headers["X-Request-Id"] == "abc-123"
    assert response.headers["X-Process-Time-Ms"].isdigit()