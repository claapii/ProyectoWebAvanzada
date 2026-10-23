"""Genera un PDF sintetico con la misma estructura que la malla de la PUCV:
cajas grises de encabezado '<romano> Semestre', una caja coloreada por
asignatura y una leyenda de colores al pie."""

import io
from dataclasses import dataclass

from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = 842, 595
BOX_W, BOX_H, COLUMN_STEP, FIRST_X = 74, 51, 85, 56
HEADER_TOP, FIRST_ROW_TOP, ROW_STEP = 160, 190, 60
LEGEND_TOP = 560
LINE_PITCH = 7.8

BASICAS = Color(0.608, 0.761, 0.89)
INGLES = Color(0.827, 0.671, 0.663)
SIN_LEYENDA = Color(0.2, 0.9, 0.2)  # color que no aparece en la leyenda

LEGEND = [(BASICAS, "Ciencias Básicas"), (INGLES, "Programa Inglés")]
ROMAN = {1: "I", 2: "II", 3: "III"}


@dataclass
class Box:
    lines: list[str]
    color: Color = BASICAS


def _y(top: float) -> float:
    return PAGE_H - top  # reportlab mide desde abajo, pdfplumber desde arriba


def build_pdf(columns: dict[int, list[Box]], resolution: str | None = None, legend=LEGEND) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))
    if resolution:
        pdf.setFont("Helvetica", 8)
        pdf.drawString(56, _y(60), resolution)

    for semester, numeral in ROMAN.items():
        x = FIRST_X + (semester - 1) * COLUMN_STEP
        pdf.setFillColor(Color(0.9, 0.9, 0.9))
        pdf.rect(x, _y(HEADER_TOP + 14), BOX_W, 14, stroke=0, fill=1)
        pdf.setFillColor(Color(0, 0, 0))
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawCentredString(x + BOX_W / 2, _y(HEADER_TOP + 10), f"{numeral} Semestre")

    pdf.setFont("Helvetica", 6)
    for semester, boxes in columns.items():
        x = FIRST_X + (semester - 1) * COLUMN_STEP
        for row, box in enumerate(boxes):
            top = FIRST_ROW_TOP + row * ROW_STEP
            pdf.setFillColor(box.color)
            pdf.rect(x, _y(top + BOX_H), BOX_W, BOX_H, stroke=0, fill=1)
            pdf.setFillColor(Color(0, 0, 0))
            block = (len(box.lines) - 1) * LINE_PITCH
            first = top + BOX_H / 2 - block / 2
            for index, line in enumerate(box.lines):
                pdf.drawCentredString(x + BOX_W / 2, _y(first + index * LINE_PITCH), line)

    x = FIRST_X
    for color, label in legend:
        pdf.setFillColor(color)
        pdf.rect(x, _y(LEGEND_TOP + 11), 11, 11, stroke=0, fill=1)
        pdf.setFillColor(Color(0, 0, 0))
        pdf.setFont("Helvetica", 6)
        pdf.drawString(x + 15, _y(LEGEND_TOP + 8), label)
        x += 140
    pdf.save()
    return buffer.getvalue()


SAMPLE_COLUMNS = {
    1: [
        Box(["INTRODUCCIÓN A LA", "INGENIERÍA INFORMÁTICA"], SIN_LEYENDA),
        Box(["CÁLCULO DIFERENCIAL", "E INTEGRAL"]),
    ],
    2: [Box(["ÁLGEBRA LINEAL"]), Box(["INGLÉS 1"], INGLES)],
    3: [Box(["BASE DE DATOS"]), Box(["BASE DE DATOS"]), Box(["12"])],  # duplicado y ruido
}
SAMPLE_RESOLUTION = "DRA 61/2020 mod. por DRA 10/2021"


def sample_pdf() -> bytes:
    return build_pdf(SAMPLE_COLUMNS, SAMPLE_RESOLUTION)