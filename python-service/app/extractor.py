"""Extraccion de asignaturas desde la malla en PDF usando su geometria.

La malla es una grilla visual: una columna por semestre y una caja (rectangulo)
por asignatura, coloreada segun su categoria. El texto plano pierde esa
estructura, asi que se usa la geometria del PDF:
1. se ubican los encabezados "<romano> Semestre" y sus cajas grises;
2. se identifican las cajas de asignatura (mismo ancho que el encabezado);
3. cada palabra pertenece a la caja que la contiene, y cada caja al semestre
   cuyo encabezado esta mas cerca horizontalmente;
4. el color de la caja se traduce a categoria con las muestras de la leyenda.

Si la estructura del PDF cambia y no se encuentran las cajas, se falla de forma
explicita en vez de devolver datos incorrectos.
"""

import io
import re
import statistics
from dataclasses import dataclass, field

import pdfplumber

from app.errors import ExtractionFailed

EXTRACTOR_VERSION = "2.0.0"

ROMAN = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12,
}  # fmt: skip

RESOLUTION_RE = re.compile(r"DRA\s*\d+/\d{4}.*", re.IGNORECASE)
LINE_TOLERANCE = 2.5
MAX_SWATCH_SIZE = 20


@dataclass
class Candidate:
    semester: int
    text: str
    category: str | None = None


@dataclass
class ExtractionResult:
    candidates: list[Candidate]
    semesters_detected: int
    resolution: str | None
    legend: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def _find_headers(words: list[dict]) -> list[dict]:
    """Devuelve un dict por cada '<romano> Semestre' encontrado."""
    headers: dict[int, dict] = {}
    for word in words:
        number = ROMAN.get(word["text"].upper())
        if number is None or number in headers:
            continue
        for nxt in words:
            if (
                nxt["text"].casefold() == "semestre"
                and abs(nxt["top"] - word["top"]) < 3
                and 0 <= nxt["x0"] - word["x1"] < 12
            ):
                headers[number] = {
                    "semester": number,
                    "center": (word["x0"] + nxt["x1"]) / 2,
                    "top": min(word["top"], nxt["top"]),
                    "bottom": max(word["bottom"], nxt["bottom"]),
                }
                break
    return sorted(headers.values(), key=lambda h: h["semester"])


def _color(rect: dict) -> tuple | None:
    value = rect.get("non_stroking_color")
    if not isinstance(value, (tuple, list)) or not value:
        return None
    return tuple(round(float(v), 3) for v in value)


def _center(box: dict) -> tuple[float, float]:
    return (box["x0"] + box["x1"]) / 2, (box["top"] + box["bottom"]) / 2


def _contains(box: dict, word: dict, margin: float = 1.0) -> bool:
    cx, cy = (word["x0"] + word["x1"]) / 2, (word["top"] + word["bottom"]) / 2
    return (
        box["x0"] - margin <= cx <= box["x1"] + margin
        and box["top"] - margin <= cy <= box["bottom"] + margin
    )


def _text_of(words: list[dict]) -> str:
    """Une palabras en orden de lectura: lineas de arriba abajo, izquierda a derecha."""
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(word["top"] - lines[-1][0]["top"]) <= LINE_TOLERANCE:
            lines[-1].append(word)
        else:
            lines.append([word])
    return " ".join(
        w["text"] for line in lines for w in sorted(line, key=lambda w: w["x0"])
    )


def _course_boxes(rects: list[dict], headers: list[dict]) -> list[dict]:
    header_rects = []
    for header in headers:
        for rect in rects:
            if (
                rect["x0"] <= header["center"] <= rect["x1"]
                and rect["top"] <= header["top"]
                and rect["bottom"] >= header["bottom"]
            ):
                header_rects.append(rect)
                break
    if not header_rects:
        raise ExtractionFailed("No se encontraron las cajas de encabezado de semestre")

    ref_width = statistics.median(r["width"] for r in header_rects)
    ref_height = statistics.median(r["height"] for r in header_rects)
    header_bottom = max(r["bottom"] for r in header_rects)

    boxes: dict[tuple[int, int], dict] = {}
    for rect in rects:
        if (
            abs(rect["width"] - ref_width) <= 0.1 * ref_width
            and rect["height"] >= 2 * ref_height
            and rect["top"] >= header_bottom - 1
        ):
            boxes.setdefault((round(rect["x0"]), round(rect["top"])), rect)
    return list(boxes.values())


def _read_legend(rects: list[dict], words: list[dict], boxes: list[dict]) -> dict:
    """Asocia el color de cada muestra de la leyenda con su texto."""
    body_bottom = max(b["bottom"] for b in boxes)
    swatches = sorted(
        (
            r
            for r in rects
            if r["width"] <= MAX_SWATCH_SIZE
            and r["height"] <= MAX_SWATCH_SIZE
            and r["top"] > body_bottom
            and _color(r) is not None
        ),
        key=lambda r: r["x0"],
    )
    legend: dict[tuple, str] = {}
    for index, swatch in enumerate(swatches):
        right_limit = swatches[index + 1]["x0"] if index + 1 < len(swatches) else float("inf")
        label_words = [
            w
            for w in words
            if swatch["x1"] - 1 <= w["x0"] < right_limit
            and swatch["top"] - 4 <= w["top"] <= swatch["top"] + 16
        ]
        label = _text_of(label_words)
        if label:
            legend[_color(swatch)] = label
    return legend


def extract_candidates(pdf_bytes: bytes) -> ExtractionResult:
    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_bytes))
    except Exception as exc:  # pdfminer lanza varios tipos segun el dano
        raise ExtractionFailed(f"No se pudo abrir el PDF: {exc}") from exc

    with pdf:
        best = None
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=2, y_tolerance=2)
            headers = _find_headers(words)
            if headers and (best is None or len(headers) > len(best[2])):
                best = (page, words, headers)
        if best is None:
            raise ExtractionFailed("No se encontraron encabezados de semestre")
        page, words, headers = best

        match = RESOLUTION_RE.search(page.extract_text() or "")
        resolution = match.group(0).strip() if match else None

        rects = page.rects
        boxes = _course_boxes(rects, headers)
        if not boxes:
            raise ExtractionFailed(
                "No se encontraron cajas de asignaturas: la estructura del PDF cambio"
            )
        legend = _read_legend(rects, words, boxes)

    warnings: list[str] = []
    if not legend:
        warnings.append("No se pudo leer la leyenda de categorias")

    candidates = []
    for box in sorted(boxes, key=lambda b: (b["x0"], b["top"])):
        box_center_x, _ = _center(box)
        header = min(headers, key=lambda h: abs(h["center"] - box_center_x))
        text = _text_of([w for w in words if _contains(box, w)])
        candidates.append(
            Candidate(
                semester=header["semester"],
                text=text,
                category=legend.get(_color(box)),
            )
        )

    return ExtractionResult(
        candidates=candidates,
        semesters_detected=len(headers),
        resolution=resolution,
        legend={str(color): label for color, label in legend.items()},
        warnings=warnings,
    )