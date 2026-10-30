import type { LoggerService } from '@nestjs/common';

import { getRequestId } from './request-context.js';

type Level = 'info' | 'warn' | 'error' | 'debug' | 'fatal';

const SENSITIVE_KEY = /pass(word|wd)?|secret|token|authorization|api[_-]?key|cookie/i;
const MAX_DEPTH = 6;

/** Oculta tokens, contraseñas y claves que aparezcan dentro de un texto. */
export function redact(text: string): string {
  return (
    text
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED_TOKEN]')
      .replace(/\bBearer\s+[\w.~+/=-]+/gi, 'Bearer [REDACTED]')
      // Contraseña dentro de una URL de conexión: postgresql://usuario:clave@host
      .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)[^@\s]+@/gi, '$1[REDACTED]@')
      // clave=valor donde el nombre contiene una palabra sensible (INTERNAL_API_KEY, JWT_SECRET...)
      .replace(
        /\b(\w*(?:password|passwd|secret|api[_-]?key|token|authorization)\w*)(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
        '$1$2[REDACTED]',
      )
  );
}

function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return redact(value);
  }
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactValue(item, depth + 1),
    ]),
  );
}

/**
 * Logger de Nest que escribe una línea JSON por evento, con el identificador de
 * la solicitud y sin datos sensibles. Los errores van a stderr; el resto a stdout.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, ...params: unknown[]) {
    this.write('info', message, params);
  }

  warn(message: unknown, ...params: unknown[]) {
    this.write('warn', message, params);
  }

  error(message: unknown, ...params: unknown[]) {
    this.write('error', message, params);
  }

  debug(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params);
  }

  fatal(message: unknown, ...params: unknown[]) {
    this.write('fatal', message, params);
  }

  private write(level: Level, message: unknown, params: unknown[]) {
    let context: string | undefined;
    let stack: string | undefined;
    for (const param of params) {
      if (typeof param !== 'string') {
        continue;
      }
      if (/\n\s+at /.test(param)) {
        stack = param;
      } else {
        context = param;
      }
    }

    const fields =
      message !== null && typeof message === 'object' && !(message instanceof Error)
        ? (redactValue(message) as Record<string, unknown>)
        : {
            message: redactValue(
              message instanceof Error ? message.message : message,
            ),
          };

    if (message instanceof Error && message.stack) {
      stack = message.stack;
    }

    const entry = {
      ts: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      request_id: getRequestId(),
      ...fields,
      ...(stack ? { stack: redact(stack) } : {}),
    };

    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}