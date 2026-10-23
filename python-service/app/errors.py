"""Errores de dominio. Cada uno se traduce a una respuesta JSON consistente."""


class IngestionError(Exception):
    code = "INGESTION_ERROR"
    status_code = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class SourceUnavailable(IngestionError):
    code = "SOURCE_UNAVAILABLE"
    status_code = 503


class RobotsDisallowed(IngestionError):
    code = "ROBOTS_DISALLOWED"
    status_code = 403


class InvalidSource(IngestionError):
    code = "SOURCE_INVALID"
    status_code = 502


class ExtractionFailed(IngestionError):
    code = "EXTRACTION_FAILED"
    status_code = 502