"""Configuracion del servicio, leida desde variables de entorno."""

import os
from dataclasses import dataclass
from functools import lru_cache

DEFAULT_SOURCE_URL = (
    "https://pucv.cl/pucv/site/docs/20150611/20150611175606/"
    "ingenieria_civil_informatica_act__1_.pdf"
)


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    source_name: str = "PUCV - Plan de Estudios Ingenieria Civil Informatica"
    source_url: str = DEFAULT_SOURCE_URL
    contact: str = "contacto-no-configurado"
    internal_api_key: str = ""
    cache_dir: str = "/tmp/listoco-cache"
    connect_timeout: float = 5.0
    read_timeout: float = 20.0
    max_bytes: int = 10 * 1024 * 1024
    expected_semesters: int = 11
    min_course_chars: int = 4

    @property
    def user_agent(self) -> str:
        return (
            "LISTOCO-Academic-Bot/1.0 "
            f"(proyecto academico Ingenieria Web Avanzada; {self.contact})"
        )

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            source_url=os.getenv("SOURCE_URL", DEFAULT_SOURCE_URL),
            contact=os.getenv("SCRAPER_CONTACT", "contacto-no-configurado"),
            internal_api_key=os.getenv("INTERNAL_API_KEY", ""),
            cache_dir=os.getenv("CACHE_DIR", "/tmp/listoco-cache"),
            connect_timeout=_float("SOURCE_CONNECT_TIMEOUT", 5.0),
            read_timeout=_float("SOURCE_READ_TIMEOUT", 20.0),
            max_bytes=_int("SOURCE_MAX_BYTES", 10 * 1024 * 1024),
            expected_semesters=_int("EXPECTED_SEMESTERS", 11),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()