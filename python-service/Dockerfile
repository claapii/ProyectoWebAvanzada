FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY app ./app

# Usuario sin privilegios (minimo privilegio) y carpeta de cache escribible.
RUN useradd --create-home appuser && mkdir -p /app/cache && chown appuser /app/cache
USER appuser

ENV CACHE_DIR=/app/cache

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]