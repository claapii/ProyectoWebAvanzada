"""Orquesta la ingesta: descarga -> extraccion -> limpieza -> metricas."""

import logging
import time
from collections.abc import Callable

from app.config import Settings
from app.errors import ExtractionFailed
from app.extractor import EXTRACTOR_VERSION, extract_candidates
from app.fetcher import FetchResult, fetch_source
from app.normalizer import build_courses
from app.schemas import IngestResponse, Provenance, QualityMetrics

logger = logging.getLogger("listoco.pipeline")

Fetcher = Callable[[Settings, bool], FetchResult]


def run_curriculum_ingestion(
    settings: Settings,
    allow_cache_fallback: bool = True,
    fetcher: Fetcher = fetch_source,
) -> IngestResponse:
    started = time.perf_counter()
    fetched = fetcher(settings, allow_cache_fallback)
    extraction = extract_candidates(fetched.content)
    built = build_courses(extraction.candidates, settings.min_course_chars)

    if not built.courses:
        raise ExtractionFailed("No se obtuvo ninguna asignatura valida del PDF")

    warnings = list(extraction.warnings)
    if fetched.from_cache:
        warnings.append("La fuente no respondio; se uso la ultima copia en cache")
    if extraction.semesters_detected < settings.expected_semesters:
        warnings.append(
            f"Se detectaron {extraction.semesters_detected} de "
            f"{settings.expected_semesters} semestres esperados"
        )
    if built.rejected:
        warnings.append(f"{len(built.rejected)} textos descartados por validacion")
    uncategorized = sum(1 for course in built.courses if course.category is None)
    if uncategorized:
        warnings.append(f"{uncategorized} asignaturas sin categoria reconocida")

    total = len(extraction.candidates)
    metrics = QualityMetrics(
        candidates=total,
        valid=len(built.courses),
        rejected=len(built.rejected),
        duplicates=built.duplicates,
        semesters_detected=extraction.semesters_detected,
        semesters_expected=settings.expected_semesters,
        coverage=min(extraction.semesters_detected / settings.expected_semesters, 1.0),
        valid_ratio=len(built.courses) / total if total else 0.0,
        duration_ms=int((time.perf_counter() - started) * 1000),
    )
    provenance = Provenance(
        source_name=settings.source_name,
        source_url=settings.source_url,
        fetched_at=fetched.fetched_at,
        sha256=fetched.sha256,
        content_length=len(fetched.content),
        resolution=extraction.resolution,
        from_cache=fetched.from_cache,
        changed=fetched.changed,
        extractor_version=EXTRACTOR_VERSION,
    )
    logger.info(
        "ingestion_completed",
        extra={
            "event": "ingestion_completed",
            "valid": metrics.valid,
            "rejected": metrics.rejected,
            "duplicates": metrics.duplicates,
            "from_cache": fetched.from_cache,
            "duration_ms": metrics.duration_ms,
        },
    )
    degraded = fetched.from_cache or metrics.coverage < 1.0
    return IngestResponse(
        status="degraded" if degraded else "ok",
        provenance=provenance,
        metrics=metrics,
        courses=built.courses,
        warnings=warnings,
    )