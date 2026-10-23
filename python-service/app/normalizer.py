"""Limpieza, validacion, normalizacion y de duplicacion de asignaturas."""

import re
import unicodedata
from dataclasses import dataclass, field

from app.extractor import ROMAN, Candidate
from app.schemas import Course

SMALL_WORDS = {"a", "al", "de", "del", "el", "la", "las", "los", "y", "e", "en", "para", "con"}


def slugify(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")


def normalize_name(raw: str) -> str:
    text = unicodedata.normalize("NFC", raw)
    text = re.sub(r"\s+", " ", text).strip(" -:.,;")
    words = []
    for index, word in enumerate(text.split(" ")):
        if word.upper() in ROMAN or any(ch.isdigit() for ch in word):
            words.append(word.upper())
        elif index > 0 and word.lower() in SMALL_WORDS:
            words.append(word.lower())
        else:
            words.append(word.capitalize())
    return " ".join(words)


def rejection_reason(name: str, min_chars: int) -> str | None:
    slug = slugify(name)
    if len(slug) < min_chars:
        return "texto demasiado corto"
    if not re.search(r"[a-z]", slug):
        return "sin letras"
    return None


@dataclass
class BuildResult:
    courses: list[Course]
    rejected: list[tuple[str, str]] = field(default_factory=list)
    duplicates: int = 0


def build_courses(candidates: list[Candidate], min_chars: int = 4) -> BuildResult:
    result = BuildResult(courses=[])
    seen: set[str] = set()
    for candidate in sorted(candidates, key=lambda c: c.semester):
        name = normalize_name(candidate.text)
        reason = rejection_reason(name, min_chars)
        if reason:
            result.rejected.append((candidate.text, reason))
            continue
        code = slugify(name)
        if code in seen:
            result.duplicates += 1
            continue
        seen.add(code)
        result.courses.append(
            Course(code=code, name=name, semester=candidate.semester, category=candidate.category)
        )
    return result