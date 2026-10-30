import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CurriculumResponseDto } from './dto/curriculum-response.dto.js';
import {
  PYTHON_REPORTED_CODES,
  PythonErrorCode,
  PythonServiceError,
} from './python.errors.js';

export interface CurriculumIngestResult {
  status: 'ok' | 'degraded';
  provenance: {
    sourceName: string;
    sourceUrl: string;
    fetchedAt: Date;
    sha256: string;
    contentLength: number;
    resolution: string | null;
    fromCache: boolean;
    changed: boolean | null;
    extractorVersion: string;
  };
  metrics: {
    candidates: number;
    valid: number;
    rejected: number;
    duplicates: number;
    semestersDetected: number;
    semestersExpected: number;
    coverage: number;
    validRatio: number;
    durationMs: number;
  };
  courses: {
    code: string;
    name: string;
    semester: number;
    category: string | null;
  }[];
  warnings: string[];
}

interface PythonErrorBody {
  error?: { code?: string; message?: string };
}

const HEALTH_TIMEOUT_MS = 3000;
// Errores transitorios: vale la pena reintentar. El resto (autenticación,
// robots.txt, extracción fallida) es determinista y reintentar no ayuda.
const RETRYABLE_STATUS = new Set([503, 504]);

/**
 * Cliente del servicio Python. Centraliza el contrato entre servicios:
 * autenticación interna, correlación por request-id, tiempo máximo de espera,
 * reintentos limitados, validación de la respuesta y errores clasificados.
 */
@Injectable()
export class PythonClient {
  private readonly logger = new Logger(PythonClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(configService: ConfigService) {
    const read = (key: string) => configService.get<string>(key);
    const number = (key: string, fallback: number) => {
      const raw = read(key);
      const value = Number(raw);
      return raw !== undefined && raw !== '' && Number.isFinite(value) && value >= 0
        ? value
        : fallback;
    };

    this.baseUrl = (read('PYTHON_SERVICE_URL') ?? 'http://localhost:8000').replace(
      /\/+$/,
      '',
    );
    this.apiKey = read('INTERNAL_API_KEY') ?? '';
    this.timeoutMs = number('PYTHON_TIMEOUT_MS', 30000);
    this.maxRetries = number('PYTHON_MAX_RETRIES', 2);
    this.retryDelayMs = number('PYTHON_RETRY_DELAY_MS', 500);
  }

  async health(): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new PythonServiceError(
          'PYTHON_UNAVAILABLE',
          'El servicio Python respondió con error',
          response.status,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof PythonServiceError) {
        throw error;
      }
      throw this.classifyNetworkError(error);
    }
  }

  async ingestCurriculum(
    requestId: string = randomUUID(),
    allowCacheFallback = true,
  ): Promise<CurriculumIngestResult> {
    if (!this.apiKey) {
      throw new PythonServiceError(
        'PYTHON_AUTH_FAILED',
        'INTERNAL_API_KEY no está configurada',
      );
    }

    const attempts = this.maxRetries + 1;
    let lastError: PythonServiceError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const body = await this.callIngest(requestId, allowCacheFallback, attempt);
        return await this.parseResponse(body);
      } catch (error) {
        if (!(error instanceof PythonServiceError)) {
          throw error;
        }
        lastError = error;
        if (!this.isRetryable(error) || attempt === attempts) {
          throw error;
        }
        await this.sleep(this.retryDelayMs * attempt);
      }
    }

    // Inalcanzable: el ciclo siempre retorna o lanza.
    throw lastError ?? new PythonServiceError('PYTHON_ERROR', 'Error desconocido');
  }

  private async callIngest(
    requestId: string,
    allowCacheFallback: boolean,
    attempt: number,
  ): Promise<unknown> {
    const started = Date.now();
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/ingest/curriculum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': this.apiKey,
          'X-Request-Id': requestId,
        },
        body: JSON.stringify({ allow_cache_fallback: allowCacheFallback }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const classified = this.classifyNetworkError(error);
      this.log(requestId, attempt, classified.code, Date.now() - started);
      throw classified;
    }

    this.log(requestId, attempt, String(response.status), Date.now() - started);

    if (!response.ok) {
      throw await this.errorFromResponse(response);
    }

    try {
      return await response.json();
    } catch {
      throw new PythonServiceError(
        'PYTHON_INVALID_RESPONSE',
        'El servicio Python devolvió una respuesta que no es JSON',
        response.status,
      );
    }
  }

  private async errorFromResponse(response: Response): Promise<PythonServiceError> {
    const { status } = response;
    if (status === 401) {
      return new PythonServiceError(
        'PYTHON_AUTH_FAILED',
        'El servicio Python rechazó la autenticación interna',
        status,
      );
    }

    let reported: string | undefined;
    try {
      reported = ((await response.json()) as PythonErrorBody).error?.code;
    } catch {
      reported = undefined;
    }

    if (reported && (PYTHON_REPORTED_CODES as readonly string[]).includes(reported)) {
      return new PythonServiceError(
        reported as PythonErrorCode,
        'El servicio Python informó un error al procesar la fuente',
        status,
      );
    }

    if (RETRYABLE_STATUS.has(status)) {
      return new PythonServiceError(
        'PYTHON_UNAVAILABLE',
        'El servicio Python no está disponible temporalmente',
        status,
      );
    }

    return new PythonServiceError(
      'PYTHON_ERROR',
      `El servicio Python respondió con error HTTP ${status}`,
      status,
    );
  }

  private async parseResponse(body: unknown): Promise<CurriculumIngestResult> {
    const dto = plainToInstance(CurriculumResponseDto, body);
    const problems = await validate(dto, { forbidUnknownValues: true });

    if (problems.length > 0) {
      throw new PythonServiceError(
        'PYTHON_INVALID_RESPONSE',
        'La respuesta del servicio Python no cumple el contrato',
      );
    }

    const codes = new Set(dto.courses.map((course) => course.code));
    if (codes.size !== dto.courses.length) {
      throw new PythonServiceError(
        'PYTHON_INVALID_RESPONSE',
        'La respuesta del servicio Python contiene asignaturas duplicadas',
      );
    }

    const { provenance: p, metrics: m } = dto;
    return {
      status: dto.status,
      provenance: {
        sourceName: p.source_name,
        sourceUrl: p.source_url,
        fetchedAt: new Date(p.fetched_at),
        sha256: p.sha256,
        contentLength: p.content_length,
        resolution: p.resolution ?? null,
        fromCache: p.from_cache,
        changed: p.changed ?? null,
        extractorVersion: p.extractor_version,
      },
      metrics: {
        candidates: m.candidates,
        valid: m.valid,
        rejected: m.rejected,
        duplicates: m.duplicates,
        semestersDetected: m.semesters_detected,
        semestersExpected: m.semesters_expected,
        coverage: m.coverage,
        validRatio: m.valid_ratio,
        durationMs: m.duration_ms,
      },
      courses: dto.courses.map((course) => ({
        code: course.code,
        name: course.name,
        semester: course.semester,
        category: course.category ?? null,
      })),
      warnings: dto.warnings,
    };
  }

  private classifyNetworkError(error: unknown): PythonServiceError {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return new PythonServiceError(
        'PYTHON_TIMEOUT',
        'El servicio Python no respondió a tiempo',
      );
    }
    return new PythonServiceError(
      'PYTHON_UNAVAILABLE',
      'No se pudo conectar con el servicio Python',
    );
  }

  private isRetryable(error: PythonServiceError): boolean {
    return (
      error.code === 'PYTHON_TIMEOUT' || error.code === 'PYTHON_UNAVAILABLE'
    );
  }

  private log(requestId: string, attempt: number, result: string, ms: number) {
    this.logger.log(
      `python_call request_id=${requestId} attempt=${attempt} result=${result} duration_ms=${ms}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}