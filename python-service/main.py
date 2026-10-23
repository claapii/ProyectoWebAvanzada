import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.errors import IngestionError
from app.logging_config import configure_logging, request_id_var
from app.routes import router

configure_logging()
logger = logging.getLogger("listoco.http")

app = FastAPI(title="Python Specialized Service", version="1.1")
app.include_router(router)


def _error(status: int, code: str, message: str) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "request_id": request_id_var.get()}}
    return JSONResponse(status_code=status, content=body)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    token = request_id_var.set(request_id)
    started = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        elapsed = int((time.perf_counter() - started) * 1000)
        request_id_var.reset(token)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    logger.info(
        "request_completed",
        extra={
            "event": "request_completed",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": elapsed,
            "request_id": request_id,
        },
    )
    return response


@app.exception_handler(IngestionError)
async def ingestion_error_handler(_: Request, exc: IngestionError):
    logger.warning("ingestion_failed", extra={"event": exc.code, "reason": exc.message})
    return _error(exc.status_code, exc.code, exc.message)


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException):
    return _error(exc.status_code, "HTTP_ERROR", str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    return _error(422, "VALIDATION_ERROR", "La solicitud no cumple el contrato")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "python-fastapi"}


@app.get("/")
def read_root():
    return {
        "message": "Servicio FastAPI conectado correctamente con la arquitectura de Ingeniería Web"
    }