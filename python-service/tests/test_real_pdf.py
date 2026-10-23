"""Regresion contra el PDF oficial real (DRA 61/2020 mod. DRA 10/2021 y 31/2021).

Si la PUCV publica una nueva version y estas pruebas fallan, no es
necesariamente un error: revisar con scripts/inspect_pdf.py y actualizar el
fixture y los valores esperados junto con el ADR de la fuente.
"""

from pathlib import Path

import pytest

from app.extractor import extract_candidates
from app.normalizer import build_courses

FIXTURE = Path(__file__).parent / "fixtures" / "malla_pucv_dra_2021.pdf"


@pytest.fixture(scope="module")
def built():
    extraction = extract_candidates(FIXTURE.read_bytes())
    return extraction, build_courses(extraction.candidates)


def test_extracts_all_semesters_and_resolution(built):
    extraction, _ = built

    assert extraction.semesters_detected == 11
    assert extraction.resolution == "DRA 61/2020 mod. por DRA 10/2021 y DRA 31/2021"
    assert len(extraction.legend) == 10
    assert extraction.warnings == []


def test_extracts_58_valid_courses_without_noise(built):
    _, result = built

    assert len(result.courses) == 58
    assert result.rejected == []
    assert result.duplicates == 0


def test_course_count_per_semester(built):
    _, result = built
    counts = {s: sum(1 for c in result.courses if c.semester == s) for s in range(1, 12)}

    assert counts == {1: 4, 2: 5, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6, 10: 5, 11: 2}


@pytest.mark.parametrize(
    ("name", "semester", "category"),
    [
        ("Cálculo Diferencial e Integral", 2, "Ciencias Básicas"),
        ("Estructura de Datos", 3, "Desarrollo de Aplicaciones Informáticas: Línea de Algoritmos y Programación"),
        ("Base de Datos", 5, "Desarrollo Aplicaciones Informáticas: Línea Sistemas de Información"),
        ("Redes de Computadores", 6, "Sistema de Computación y Redes"),
        ("Inglés 4", 7, "Programa Inglés"),
        ("Taller de Base de Datos", 8, "Integradoras de Dominio"),
        ("Proyecto de Título", 11, "Integradoras de Dominio"),
    ],
)
def test_known_courses_have_expected_semester_and_category(built, name, semester, category):
    _, result = built
    course = next(c for c in result.courses if c.name == name)

    assert course.semester == semester
    assert course.category == category


def test_multiline_names_are_complete(built):
    _, result = built
    names = {c.name for c in result.courses}

    assert "Negocios, Innovación y Emprendimiento" in names
    assert "Taller de Formulación de Proyectos Informáticos" in names
    assert "Desarrollo Integral y Comunicación para Ingeniería" in names