import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Solo se acepta un identificador simple del cliente; si no, se genera uno.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

const storage = new AsyncLocalStorage<{ requestId: string }>();
const httpLogger = new Logger('HTTP');

/** Identificador de la solicitud en curso (disponible en cualquier capa). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Ejecuta `fn` con un identificador de solicitud activo (útil fuera de HTTP y en pruebas). */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

export function resolveRequestId(candidate: unknown): string {
  return typeof candidate === 'string' && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

/**
 * Asigna un identificador a cada solicitud, lo devuelve en el header
 * X-Request-Id y registra una línea por solicitud con su duración.
 * Reescribe el header de entrada con el valor ya validado, de modo que el
 * resto del código siempre reciba un identificador seguro.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.headers['x-request-id']);
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    httpLogger.log({
      event: 'http_request',
      request_id: requestId,
      method: req.method,
      // Sin query string: puede contener datos que no deben quedar en los logs.
      path: req.path,
      status: res.statusCode,
      duration_ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
    });
  });

  storage.run({ requestId }, next);
}