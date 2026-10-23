"""Autenticacion entre servicios: NestJS envia una clave interna compartida."""

import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.config import Settings, get_settings


def require_internal_key(
    settings: Annotated[Settings, Depends(get_settings)],
    x_internal_api_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.internal_api_key
    # Falla cerrado: sin clave configurada nadie puede usar los endpoints internos.
    if not expected or not x_internal_api_key:
        raise HTTPException(status_code=401, detail="No autorizado")
    if not hmac.compare_digest(x_internal_api_key, expected):
        raise HTTPException(status_code=401, detail="No autorizado")