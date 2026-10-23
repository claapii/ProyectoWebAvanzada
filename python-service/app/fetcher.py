"""Descarga responsable de la fuente: robots.txt, timeouts, limite de tamano,
verificacion de contenido, hash de procedencia y respaldo en cache."""

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests

from app.config import Settings
from app.errors import InvalidSource, RobotsDisallowed, SourceUnavailable

logger = logging.getLogger("listoco.fetcher")

ROBOTS_AGENT = "LISTOCO-Academic-Bot"


def _unavailable(public_message: str, exc: Exception | None = None) -> SourceUnavailable:
    """El detalle tecnico va al log; la respuesta lleva solo un mensaje generico."""
    logger.warning(
        "source_error",
        extra={"event": "source_error", "reason": public_message, "detail": repr(exc)},
    )
    return SourceUnavailable(public_message)


@dataclass
class FetchResult:
    content: bytes
    sha256: str
    fetched_at: datetime
    from_cache: bool
    changed: bool | None


def _check_robots(settings: Settings) -> None:
    parts = urlsplit(settings.source_url)
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    timeout = (settings.connect_timeout, settings.read_timeout)
    try:
        resp = requests.get(
            robots_url, headers={"User-Agent": settings.user_agent}, timeout=timeout
        )
    except requests.RequestException as exc:
        raise _unavailable("No se pudo consultar robots.txt de la fuente", exc) from exc

    if resp.status_code >= 500:
        raise SourceUnavailable("robots.txt no disponible (error del servidor)")
    if resp.status_code >= 400:
        # Sin robots.txt valido: no hay restricciones declaradas.
        return

    parser = RobotFileParser()
    parser.parse(resp.text.splitlines())
    if not parser.can_fetch(ROBOTS_AGENT, settings.source_url):
        raise RobotsDisallowed("robots.txt no permite descargar la fuente")


def _download(settings: Settings) -> bytes:
    timeout = (settings.connect_timeout, settings.read_timeout)
    try:
        resp = requests.get(
            settings.source_url,
            headers={"User-Agent": settings.user_agent, "Accept": "application/pdf"},
            timeout=timeout,
            stream=True,
        )
    except requests.RequestException as exc:
        raise _unavailable("Fallo la descarga de la fuente", exc) from exc

    if resp.status_code >= 400:
        raise SourceUnavailable(f"La fuente respondio HTTP {resp.status_code}")

    declared = resp.headers.get("Content-Length")
    if declared and declared.isdigit() and int(declared) > settings.max_bytes:
        raise InvalidSource("La fuente excede el tamano maximo permitido")

    chunks: list[bytes] = []
    total = 0
    try:
        for chunk in resp.iter_content(chunk_size=64 * 1024):
            total += len(chunk)
            if total > settings.max_bytes:
                raise InvalidSource("La fuente excede el tamano maximo permitido")
            chunks.append(chunk)
    except requests.RequestException as exc:
        raise _unavailable("La descarga de la fuente fue interrumpida", exc) from exc

    content = b"".join(chunks)
    if not content.startswith(b"%PDF"):
        raise InvalidSource("El contenido descargado no es un PDF valido")
    return content


def _paths(settings: Settings) -> tuple[Path, Path]:
    base = Path(settings.cache_dir)
    return base / "curriculum.pdf", base / "curriculum.meta.json"


def _read_cache(settings: Settings) -> tuple[bytes, dict] | None:
    pdf_path, meta_path = _paths(settings)
    try:
        return pdf_path.read_bytes(), json.loads(meta_path.read_text("utf-8"))
    except (OSError, ValueError):
        return None


def _write_cache(settings: Settings, content: bytes, meta: dict) -> None:
    pdf_path, meta_path = _paths(settings)
    try:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_path.write_bytes(content)
        meta_path.write_text(json.dumps(meta), "utf-8")
    except OSError:
        # La cache es una optimizacion: si falla, el flujo principal continua.
        logger.warning("cache_write_failed", extra={"event": "cache_write_failed"})


def fetch_source(settings: Settings, allow_cache_fallback: bool = True) -> FetchResult:
    previous = _read_cache(settings)
    try:
        _check_robots(settings)
        content = _download(settings)
    except RobotsDisallowed:
        raise
    except (SourceUnavailable, InvalidSource) as exc:
        if allow_cache_fallback and previous is not None:
            cached, meta = previous
            logger.warning(
                "source_failed_using_cache",
                extra={"event": "source_failed_using_cache", "reason": exc.message},
            )
            return FetchResult(
                content=cached,
                sha256=meta.get("sha256") or hashlib.sha256(cached).hexdigest(),
                fetched_at=datetime.fromisoformat(meta["fetched_at"]),
                from_cache=True,
                changed=None,
            )
        raise

    digest = hashlib.sha256(content).hexdigest()
    now = datetime.now(timezone.utc)
    changed = None if previous is None else previous[1].get("sha256") != digest
    _write_cache(
        settings, content, {"sha256": digest, "fetched_at": now.isoformat()}
    )
    return FetchResult(
        content=content, sha256=digest, fetched_at=now, from_cache=False, changed=changed
    )