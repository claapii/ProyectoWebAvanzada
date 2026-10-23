"""Herramienta de diagnostico: muestra como se extrae la malla de un PDF.

Uso (desde python-service/):
    python scripts/inspect_pdf.py ruta/malla.pdf            # resumen + asignaturas
    python scripts/inspect_pdf.py ruta/malla.pdf --words    # ademas, palabras con coordenadas

Sirve para verificar la extraccion cuando la PUCV publique una nueva version.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pdfplumber

from app.extractor import extract_candidates
from app.normalizer import build_courses


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--words", action="store_true")
    args = parser.parse_args()

    data = Path(args.pdf).read_bytes()

    if args.words:
        with pdfplumber.open(args.pdf) as pdf:
            for number, page in enumerate(pdf.pages, start=1):
                print(f"--- pagina {number} ({page.width}x{page.height}) rects={len(page.rects)}")
                for w in page.extract_words(x_tolerance=2, y_tolerance=2):
                    print(f"x0={w['x0']:7.1f} x1={w['x1']:7.1f} top={w['top']:7.1f}  {w['text']}")

    extraction = extract_candidates(data)
    built = build_courses(extraction.candidates)
    print(f"\nSemestres detectados: {extraction.semesters_detected}")
    print(f"Resolucion: {extraction.resolution}")
    print(f"Categorias en la leyenda: {len(extraction.legend)}")
    print(
        f"Cajas: {len(extraction.candidates)} | validas: {len(built.courses)} "
        f"| rechazadas: {len(built.rejected)} | duplicadas: {built.duplicates}\n"
    )
    for course in sorted(built.courses, key=lambda c: c.semester):
        print(f"  S{course.semester:<2} {course.name}  [{course.category}]")
    if built.rejected:
        print("\nDescartadas:")
        for text, reason in built.rejected:
            print(f"  - {text!r}: {reason}")
    for warning in extraction.warnings:
        print(f"\nAVISO: {warning}")


if __name__ == "__main__":
    main()