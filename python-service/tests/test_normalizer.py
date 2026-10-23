from app.extractor import Candidate
from app.normalizer import build_courses, normalize_name, rejection_reason, slugify


def test_normalize_name_title_cases_and_keeps_small_words():
    assert normalize_name("ESTRUCTURA  DE   DATOS") == "Estructura de Datos"
    assert normalize_name("INGLÉS 1") == "Inglés 1"
    assert normalize_name("OPTATIVO 3") == "Optativo 3"
    assert normalize_name("SISTEMAS DE INFORMACIÓN II") == "Sistemas de Información II"
    assert normalize_name("LEGISLACIÓN, ÉTICA Y TECNOLÓGICA") == "Legislación, Ética y Tecnológica"


def test_slugify_removes_accents_and_symbols():
    assert slugify("Cálculo en Varias Variables") == "calculo-en-varias-variables"


def test_rejects_noise():
    assert rejection_reason("12", 4) == "texto demasiado corto"
    assert rejection_reason("1234 5678", 4) == "sin letras"
    assert rejection_reason("Base de Datos", 4) is None


def test_build_courses_deduplicates_counts_and_keeps_category():
    candidates = [
        Candidate(1, "BASE DE DATOS", "Cat A"),
        Candidate(3, "BASE DE DATOS", "Cat A"),
        Candidate(2, "ÁLGEBRA LINEAL"),
        Candidate(1, "12"),
    ]
    result = build_courses(candidates)

    assert [c.code for c in result.courses] == ["base-de-datos", "algebra-lineal"]
    assert result.courses[0].category == "Cat A"
    assert result.courses[1].category is None
    assert result.duplicates == 1
    assert result.rejected == [("12", "texto demasiado corto")]