from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.fetcher import FetchResult, fetch_source
from app.pipeline import run_curriculum_ingestion
from app.schemas import IngestRequest, IngestResponse
from app.security import require_internal_key

router = APIRouter(prefix="/ingest", dependencies=[Depends(require_internal_key)])


def get_fetcher():
    """Dependencia sustituible en pruebas para no usar la red."""
    return fetch_source


@router.post("/curriculum", response_model=IngestResponse)
def ingest_curriculum(
    settings: Annotated[Settings, Depends(get_settings)],
    fetcher: Annotated[object, Depends(get_fetcher)],
    body: IngestRequest | None = None,
) -> IngestResponse:
    request = body or IngestRequest()

    def call(s: Settings, allow_cache: bool) -> FetchResult:
        return fetcher(s, allow_cache)  # type: ignore[operator]

    return run_curriculum_ingestion(settings, request.allow_cache_fallback, call)