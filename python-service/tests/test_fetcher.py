import hashlib

import pytest
import requests

from app import fetcher
from app.config import Settings
from app.errors import InvalidSource, RobotsDisallowed, SourceUnavailable
from tests.pdf_factory import sample_pdf


class FakeResponse:
    def __init__(self, status=200, content=b"", text="", headers=None):
        self.status_code = status
        self.content = content
        self.text = text
        self.headers = headers or {}

    def iter_content(self, chunk_size=1):
        yield self.content


@pytest.fixture
def settings(tmp_path):
    return Settings(cache_dir=str(tmp_path), source_url="https://example.org/malla.pdf")


def install_network(monkeypatch, robots, pdf):
    def fake_get(url, **kwargs):
        if isinstance(robots, Exception) and url.endswith("/robots.txt"):
            raise robots
        if url.endswith("/robots.txt"):
            return robots
        if isinstance(pdf, Exception):
            raise pdf
        return pdf

    monkeypatch.setattr(fetcher.requests, "get", fake_get)


def test_successful_fetch_computes_hash(monkeypatch, settings):
    content = sample_pdf()
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=content))

    result = fetcher.fetch_source(settings)

    assert result.sha256 == hashlib.sha256(content).hexdigest()
    assert result.from_cache is False
    assert result.changed is None  # primera descarga: sin version previa


def test_detects_changed_and_unchanged_content(monkeypatch, settings):
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=sample_pdf()))
    fetcher.fetch_source(settings)

    again = fetcher.fetch_source(settings)
    assert again.changed is False

    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=b"%PDF-1.4 otro"))
    modified = fetcher.fetch_source(settings)
    assert modified.changed is True


def test_robots_disallow_blocks_download(monkeypatch, settings):
    robots = FakeResponse(200, text="User-agent: *\nDisallow: /")
    install_network(monkeypatch, robots, FakeResponse(content=sample_pdf()))

    with pytest.raises(RobotsDisallowed):
        fetcher.fetch_source(settings)


def test_source_down_without_cache_raises(monkeypatch, settings):
    install_network(monkeypatch, FakeResponse(404), requests.ConnectTimeout("timeout"))

    with pytest.raises(SourceUnavailable):
        fetcher.fetch_source(settings)


def test_source_down_uses_cache_when_available(monkeypatch, settings):
    content = sample_pdf()
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=content))
    fetcher.fetch_source(settings)

    install_network(monkeypatch, FakeResponse(404), requests.ConnectionError("caida"))
    result = fetcher.fetch_source(settings)

    assert result.from_cache is True
    assert result.content == content


def test_cache_fallback_can_be_disabled(monkeypatch, settings):
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=sample_pdf()))
    fetcher.fetch_source(settings)

    install_network(monkeypatch, FakeResponse(404), requests.ConnectionError("caida"))
    with pytest.raises(SourceUnavailable):
        fetcher.fetch_source(settings, allow_cache_fallback=False)


def test_non_pdf_content_is_rejected(monkeypatch, settings):
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=b"<html>hola</html>"))

    with pytest.raises(InvalidSource):
        fetcher.fetch_source(settings)


def test_oversized_content_is_rejected(monkeypatch, tmp_path):
    small = Settings(cache_dir=str(tmp_path), source_url="https://example.org/m.pdf", max_bytes=10)
    install_network(monkeypatch, FakeResponse(404), FakeResponse(content=b"%PDF" + b"x" * 100))

    with pytest.raises(InvalidSource):
        fetcher.fetch_source(small)


def test_http_error_from_source_is_unavailable(monkeypatch, settings):
    install_network(monkeypatch, FakeResponse(404), FakeResponse(status=503))

    with pytest.raises(SourceUnavailable):
        fetcher.fetch_source(settings)


def test_error_message_does_not_leak_network_details(monkeypatch, settings):
    boom = requests.ConnectionError("HTTPConnectionPool(host='10.0.0.7', port=3128): refused")
    install_network(monkeypatch, FakeResponse(404), boom)

    with pytest.raises(SourceUnavailable) as caught:
        fetcher.fetch_source(settings)

    assert "10.0.0.7" not in caught.value.message
    assert "3128" not in caught.value.message