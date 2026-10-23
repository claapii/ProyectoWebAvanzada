import io

import pytest
from reportlab.pdfgen import canvas

from app.errors import ExtractionFailed
from app.extractor import extract_candidates
from tests.pdf_factory import Box, build_pdf, sample_pdf


def texts_by_semester(result):
    grouped = {}
    for candidate in result.candidates:
        grouped.setdefault(candidate.semester, []).append(candidate.text)
    return grouped


def test_assigns_each_course_to_its_semester():
    grouped = texts_by_semester(extract_candidates(sample_pdf()))

    assert grouped[1] == ["INTRODUCCIÓN A LA INGENIERÍA INFORMÁTICA", "CÁLCULO DIFERENCIAL E INTEGRAL"]
    assert grouped[2] == ["ÁLGEBRA LINEAL", "INGLÉS 1"]
    assert grouped[3] == ["BASE DE DATOS", "BASE DE DATOS", "12"]


def test_each_box_is_one_course_even_with_multiple_lines():
    result = extract_candidates(sample_pdf())

    assert len(result.candidates) == 7


def test_legend_text_is_not_treated_as_a_course():
    texts = [c.text for c in extract_candidates(sample_pdf()).candidates]

    assert "Ciencias Básicas" not in texts
    assert "Programa Inglés" not in texts


def test_category_comes_from_box_color_and_legend():
    by_text = {c.text: c.category for c in extract_candidates(sample_pdf()).candidates}

    assert by_text["CÁLCULO DIFERENCIAL E INTEGRAL"] == "Ciencias Básicas"
    assert by_text["INGLÉS 1"] == "Programa Inglés"
    assert by_text["INTRODUCCIÓN A LA INGENIERÍA INFORMÁTICA"] is None  # color sin leyenda


def test_detects_semesters_and_resolution():
    result = extract_candidates(sample_pdf())

    assert result.semesters_detected == 3
    assert result.resolution == "DRA 61/2020 mod. por DRA 10/2021"
    assert len(result.legend) == 2


def test_missing_legend_is_reported_as_warning():
    pdf = build_pdf({1: [Box(["ÁLGEBRA LINEAL"])]}, legend=[])
    result = extract_candidates(pdf)

    assert result.warnings == ["No se pudo leer la leyenda de categorias"]
    assert result.candidates[0].category is None


def test_fails_explicitly_when_pdf_structure_changes():
    # Encabezados presentes pero sin cajas de asignatura (cambio de diseno del PDF)
    pdf = build_pdf({})

    with pytest.raises(ExtractionFailed, match="estructura del PDF cambio"):
        extract_candidates(pdf)


def test_pdf_without_semester_headers_fails():
    buffer = io.BytesIO()
    page = canvas.Canvas(buffer)
    page.drawString(50, 700, "Documento cualquiera sin malla")
    page.save()

    with pytest.raises(ExtractionFailed, match="encabezados de semestre"):
        extract_candidates(buffer.getvalue())


def test_corrupt_pdf_fails_with_domain_error():
    with pytest.raises(ExtractionFailed):
        extract_candidates(b"%PDF-1.4 esto esta roto")