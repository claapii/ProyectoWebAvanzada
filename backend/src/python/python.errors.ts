export type PythonErrorCode =
  | 'PYTHON_UNAVAILABLE'
  | 'PYTHON_TIMEOUT'
  | 'PYTHON_AUTH_FAILED'
  | 'PYTHON_INVALID_RESPONSE'
  | 'PYTHON_ERROR'
  // Códigos que el propio servicio Python informa sobre la fuente web:
  | 'SOURCE_UNAVAILABLE'
  | 'ROBOTS_DISALLOWED'
  | 'SOURCE_INVALID'
  | 'EXTRACTION_FAILED';

/** Error del servicio Python, ya clasificado. Nunca contiene credenciales. */
export class PythonServiceError extends Error {
  constructor(
    readonly code: PythonErrorCode,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'PythonServiceError';
  }
}

export const PYTHON_REPORTED_CODES: readonly PythonErrorCode[] = [
  'SOURCE_UNAVAILABLE',
  'ROBOTS_DISALLOWED',
  'SOURCE_INVALID',
  'EXTRACTION_FAILED',
];