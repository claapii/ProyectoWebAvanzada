import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { IngestionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CurriculumIngestResult,
  PythonClient,
} from '../python/python-client.service.js';
import { PythonErrorCode, PythonServiceError } from '../python/python.errors.js';

export const CURRICULUM_SOURCE_KEY = 'pucv-plan-ici';

const DEFAULT_SOURCE = {
  name: 'PUCV - Plan de Estudios Ingeniería Civil Informática',
  url: 'https://pucv.cl/pucv/site/docs/20150611/20150611175606/ingenieria_civil_informatica_act__1_.pdf',
};

const DEFAULT_RUNS_LIMIT = 20;
const TRANSACTION_TIMEOUT_MS = 20000;

/** Qué se le responde al cliente según el error clasificado del servicio Python. */
const HTTP_FOR_ERROR: Record<PythonErrorCode, { status: number; message: string }> = {
  PYTHON_UNAVAILABLE: {
    status: 503,
    message: 'El servicio de procesamiento no está disponible. Intenta más tarde.',
  },
  PYTHON_TIMEOUT: {
    status: 503,
    message: 'El servicio de procesamiento tardó demasiado en responder. Intenta más tarde.',
  },
  SOURCE_UNAVAILABLE: {
    status: 503,
    message: 'La fuente externa no está disponible en este momento. Intenta más tarde.',
  },
  ROBOTS_DISALLOWED: {
    status: 502,
    message: 'La fuente externa no permite la descarga automática.',
  },
  SOURCE_INVALID: {
    status: 502,
    message: 'La fuente externa entregó un documento que no se pudo procesar.',
  },
  EXTRACTION_FAILED: {
    status: 502,
    message: 'La fuente externa entregó un documento que no se pudo procesar.',
  },
  PYTHON_INVALID_RESPONSE: {
    status: 502,
    message: 'El servicio de procesamiento entregó una respuesta inválida.',
  },
  PYTHON_AUTH_FAILED: {
    status: 502,
    message: 'Error interno de comunicación entre servicios.',
  },
  PYTHON_ERROR: {
    status: 502,
    message: 'El servicio de procesamiento falló.',
  },
};

export interface IngestionSummary {
  runId: number;
  status: IngestionStatus;
  provenance: CurriculumIngestResult['provenance'];
  metrics: CurriculumIngestResult['metrics'];
  persistence: {
    created: number;
    updated: number;
    unchanged: number;
    deactivated: number;
  };
  warnings: string[];
}

interface RunContext {
  user: AuthenticatedUser;
  requestId: string;
  startedAt: Date;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  // Evita dos ingestas simultáneas dentro de esta instancia del backend.
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pythonClient: PythonClient,
  ) {}

  async ingestCurriculum(
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<IngestionSummary> {
    if (this.running) {
      throw new ConflictException('Ya hay una ingesta en curso');
    }
    this.running = true;

    try {
      const context: RunContext = { user, requestId, startedAt: new Date() };
      const source = await this.prisma.dataSource.upsert({
        where: { key: CURRICULUM_SOURCE_KEY },
        update: {},
        create: { key: CURRICULUM_SOURCE_KEY, ...DEFAULT_SOURCE },
      });
      this.logger.log(`ingestion_started request_id=${requestId} user=${user.sub}`);

      let result: CurriculumIngestResult;
      try {
        result = await this.pythonClient.ingestCurriculum(requestId);
      } catch (error) {
        throw await this.failFromPython(error, source.id, context);
      }

      try {
        const summary = await this.persist(source.id, result, context);
        this.logger.log(
          `ingestion_completed request_id=${requestId} run=${summary.runId} status=${summary.status} ` +
            `created=${summary.persistence.created} updated=${summary.persistence.updated} ` +
            `deactivated=${summary.persistence.deactivated}`,
        );
        return summary;
      } catch (error) {
        throw await this.failFromPersistence(error, source.id, context);
      }
    } finally {
      this.running = false;
    }
  }

  listRuns(limit = DEFAULT_RUNS_LIMIT) {
    return this.prisma.ingestionRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  private persist(
    sourceId: number,
    result: CurriculumIngestResult,
    context: RunContext,
  ): Promise<IngestionSummary> {
    const { provenance, metrics } = result;
    const codes = result.courses.map((course) => course.code);

    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.dataSource.update({
          where: { id: sourceId },
          data: { name: provenance.sourceName, url: provenance.sourceUrl },
        });

        const existing = await tx.course.findMany({
          where: { code: { in: codes } },
          select: {
            code: true,
            name: true,
            suggestedSemester: true,
            category: true,
            active: true,
          },
        });
        const current = new Map(existing.map((course) => [course.code, course]));

        const toCreate: CurriculumIngestResult['courses'] = [];
        const toUpdate: CurriculumIngestResult['courses'] = [];
        const unchanged: string[] = [];

        for (const course of result.courses) {
          const stored = current.get(course.code);
          if (!stored) {
            toCreate.push(course);
          } else if (
            stored.name !== course.name ||
            stored.suggestedSemester !== course.semester ||
            stored.category !== course.category ||
            !stored.active
          ) {
            toUpdate.push(course);
          } else {
            unchanged.push(course.code);
          }
        }

        // Las asignaturas de esta fuente que ya no aparecen se marcan inactivas:
        // no se borran, para conservar el historial.
        const missing = { sourceId, active: true, code: { notIn: codes } };
        const deactivated = await tx.course.count({ where: missing });

        const run = await tx.ingestionRun.create({
          data: {
            sourceId,
            triggeredById: context.user.sub,
            status:
              result.status === 'ok'
                ? IngestionStatus.SUCCESS
                : IngestionStatus.DEGRADED,
            requestId: context.requestId,
            startedAt: context.startedAt,
            finishedAt: new Date(),
            durationMs: Date.now() - context.startedAt.getTime(),
            sha256: provenance.sha256,
            contentLength: provenance.contentLength,
            resolution: provenance.resolution,
            fromCache: provenance.fromCache,
            changed: provenance.changed,
            extractorVersion: provenance.extractorVersion,
            candidates: metrics.candidates,
            validCount: metrics.valid,
            rejectedCount: metrics.rejected,
            duplicateCount: metrics.duplicates,
            semestersDetected: metrics.semestersDetected,
            semestersExpected: metrics.semestersExpected,
            coverage: metrics.coverage,
            validRatio: metrics.validRatio,
            createdCount: toCreate.length,
            updatedCount: toUpdate.length,
            deactivatedCount: deactivated,
            warnings: result.warnings,
          },
        });

        // Procedencia que se actualiza en toda asignatura vista en esta corrida.
        // `credits` no se toca nunca: lo completa la fuente curada.
        const seen = {
          sourceId,
          lastRunId: run.id,
          lastSeenAt: provenance.fetchedAt,
        };

        if (toCreate.length > 0) {
          await tx.course.createMany({
            data: toCreate.map((course) => ({
              code: course.code,
              name: course.name,
              suggestedSemester: course.semester,
              category: course.category,
              active: true,
              ...seen,
            })),
          });
        }

        for (const course of toUpdate) {
          await tx.course.update({
            where: { code: course.code },
            data: {
              name: course.name,
              suggestedSemester: course.semester,
              category: course.category,
              active: true,
              ...seen,
            },
          });
        }

        if (unchanged.length > 0) {
          await tx.course.updateMany({
            where: { code: { in: unchanged } },
            data: seen,
          });
        }

        if (deactivated > 0) {
          await tx.course.updateMany({
            where: missing,
            data: { active: false },
          });
        }

        return {
          runId: run.id,
          status: run.status,
          provenance,
          metrics,
          persistence: {
            created: toCreate.length,
            updated: toUpdate.length,
            unchanged: unchanged.length,
            deactivated,
          },
          warnings: result.warnings,
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  private async failFromPython(
    error: unknown,
    sourceId: number,
    context: RunContext,
  ): Promise<Error> {
    if (!(error instanceof PythonServiceError)) {
      await this.recordFailure(sourceId, context, 'UNEXPECTED_ERROR', 'Error inesperado');
      return error instanceof Error ? error : new Error('Error inesperado');
    }

    const mapped = HTTP_FOR_ERROR[error.code];
    this.logger.warn(
      `ingestion_failed request_id=${context.requestId} code=${error.code} http=${mapped.status}`,
    );
    await this.recordFailure(sourceId, context, error.code, mapped.message);
    return new HttpException(
      { statusCode: mapped.status, code: error.code, message: mapped.message },
      mapped.status,
    );
  }

  private async failFromPersistence(
    error: unknown,
    sourceId: number,
    context: RunContext,
  ): Promise<Error> {
    const message = 'No se pudieron guardar los datos recuperados.';
    this.logger.error(
      `ingestion_failed request_id=${context.requestId} code=PERSISTENCE_FAILED reason=${
        error instanceof Error ? error.message : 'desconocido'
      }`,
    );
    await this.recordFailure(sourceId, context, 'PERSISTENCE_FAILED', message);
    return new HttpException(
      { statusCode: 500, code: 'PERSISTENCE_FAILED', message },
      500,
    );
  }

  /** Deja constancia de la corrida fallida. Un error aquí no debe tapar el original. */
  private async recordFailure(
    sourceId: number,
    context: RunContext,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.prisma.ingestionRun.create({
        data: {
          sourceId,
          triggeredById: context.user.sub,
          status: IngestionStatus.FAILED,
          requestId: context.requestId,
          startedAt: context.startedAt,
          finishedAt: new Date(),
          durationMs: Date.now() - context.startedAt.getTime(),
          errorCode,
          errorMessage,
          warnings: [],
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la corrida fallida: ${error instanceof Error ? error.message : 'error'}`,
      );
    }
  }
}