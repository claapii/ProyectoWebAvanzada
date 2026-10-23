"""Contratos de entrada y salida del servicio (version 1)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class IngestRequest(BaseModel):
    # La URL de la fuente NO es parametro: evita SSRF y uso como proxy abierto.
    model_config = ConfigDict(extra="forbid")

    allow_cache_fallback: bool = True


class Course(BaseModel):
    code: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=200)
    semester: int = Field(ge=1, le=12)
    category: str | None = Field(default=None, max_length=200)


class Provenance(BaseModel):
    source_name: str
    source_url: str
    fetched_at: datetime
    sha256: str = Field(min_length=64, max_length=64)
    content_length: int = Field(ge=0)
    resolution: str | None = None
    from_cache: bool = False
    # None = no hay version previa para comparar; True/False = cambio detectado.
    changed: bool | None = None
    extractor_version: str


class QualityMetrics(BaseModel):
    candidates: int
    valid: int
    rejected: int
    duplicates: int
    semesters_detected: int
    semesters_expected: int
    coverage: float = Field(ge=0, le=1)
    valid_ratio: float = Field(ge=0, le=1)
    duration_ms: int


class IngestResponse(BaseModel):
    status: Literal["ok", "degraded"]
    provenance: Provenance
    metrics: QualityMetrics
    courses: list[Course]
    warnings: list[str] = []