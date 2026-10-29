import { ConflictException, HttpException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types.js';
import { IngestionStatus, Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type {
  CurriculumIngestResult,
  PythonClient,
} from '../python/python-client.service.js';
import { PythonServiceError } from '../python/python.errors.js';
import { IngestionService } from './ingestion.service.js';

const ADMIN: AuthenticatedUser = { sub: 3, email: 'admin@listoco.cl', role: Role.ADMIN };
const FETCHED_AT = new Date('2026-10-23T23:25:13.000Z');

const course = (code: string, name: string, semester: number, category: string | null = null) => ({
  code,
  name,
  semester,
  category,
});

function pythonResult(
  courses: CurriculumIngestResult['courses'],
  overrides: Partial<CurriculumIngestResult> = {},
): CurriculumIngestResult {
  return {
    status: 'ok',
    provenance: {
      sourceName: 'PUCV - Plan de Estudios',
      sourceUrl: 'https://pucv.cl/plan.pdf',
      fetchedAt: FETCHED_AT,
      sha256: 'b'.repeat(64),
      contentLength: 100706,
      resolution: 'DRA 61/2020',
      fromCache: false,
      changed: null,
      extractorVersion: '2.0.0',
    },
    metrics: {
      candidates: courses.length,
      valid: courses.length,
      rejected: 0,
      duplicates: 0,
      semestersDetected: 11,
      semestersExpected: 11,
      coverage: 1,
      validRatio: 1,
      durationMs: 1200,
    },
    courses,
    warnings: [],
    ...overrides,
  };
}

function setup(existing: object[] = [], toDeactivate = 0) {
  const tx = {
    dataSource: { update: vi.fn().mockResolvedValue({}) },
    course: {
      findMany: vi.fn().mockResolvedValue(existing),
      count: vi.fn().mockResolvedValue(toDeactivate),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ingestionRun: {
      create: vi.fn().mockImplementation(async ({ data }: { data: { status: string } }) => ({
        id: 10,
        status: data.status,
      })),
    },
  };
  const prisma = {
    dataSource: { upsert: vi.fn().mockResolvedValue({ id: 1, key: 'pucv-plan-ici' }) },
    ingestionRun: { create: vi.fn().mockResolvedValue({ id: 99 }), findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const python = { ingestCurriculum: vi.fn() };
  const service = new IngestionService(
    prisma as unknown as PrismaService,
    python as unknown as PythonClient,
  );
  return { service, prisma, tx, python };
}

const stored = (code: string, name: string, semester: number, category: string | null = null, active = true) => ({
  code,
  name,
  suggestedSemester: semester,
  category,
  active,
});

describe('IngestionService.ingestCurriculum', () => {
  describe('persistencia', () => {
    it('crea las asignaturas nuevas con su procedencia y registra la corrida', async () => {
      const { service, tx, python } = setup();
      python.ingestCurriculum.mockResolvedValue(
        pythonResult([course('algebra-lineal', 'Álgebra Lineal', 2, 'Ciencias Básicas'), course('optativo-1', 'Optativo 1', 8)]),
      );

      const summary = await service.ingestCurriculum(ADMIN, 'req-1');

      expect(summary.persistence).toEqual({ created: 2, updated: 0, unchanged: 0, deactivated: 0 });
      expect(summary.status).toBe(IngestionStatus.SUCCESS);
      expect(summary.runId).toBe(10);

      const created = tx.course.createMany.mock.calls[0][0].data;
      expect(created).toHaveLength(2);
      expect(created[0]).toMatchObject({
        code: 'algebra-lineal',
        suggestedSemester: 2,
        category: 'Ciencias Básicas',
        active: true,
        sourceId: 1,
        lastRunId: 10,
        lastSeenAt: FETCHED_AT,
      });
      // la fuente web no publica créditos: no se inventan
      expect(created[0]).not.toHaveProperty('credits');
    });

    it('guarda en la corrida la procedencia del documento y las métricas de calidad', async () => {
      const { service, tx, python } = setup();
      python.ingestCurriculum.mockResolvedValue(pythonResult([course('algebra-lineal', 'Álgebra Lineal', 2)]));

      await service.ingestCurriculum(ADMIN, 'req-77');

      expect(tx.ingestionRun.create.mock.calls[0][0].data).toMatchObject({
        sourceId: 1,
        triggeredById: 3,
        requestId: 'req-77',
        status: IngestionStatus.SUCCESS,
        sha256: 'b'.repeat(64),
        resolution: 'DRA 61/2020',
        fromCache: false,
        extractorVersion: '2.0.0',
        validCount: 1,
        semestersDetected: 11,
        coverage: 1,
        createdCount: 1,
        updatedCount: 0,
        deactivatedCount: 0,
      });
    });

    it('actualiza solo lo que cambió y no vuelve a crear lo existente', async () => {
      const existing = [
        stored('a', 'Álgebra Lineal', 2, 'Ciencias Básicas'), // igual
        stored('b', 'Nombre viejo', 3), // cambió el nombre
        stored('c', 'Optativo 1', 8, null, false), // estaba inactiva: se reactiva
      ];
      const { service, tx, python } = setup(existing);
      python.ingestCurriculum.mockResolvedValue(
        pythonResult([
          course('a', 'Álgebra Lineal', 2, 'Ciencias Básicas'),
          course('b', 'Nombre nuevo', 3),
          course('c', 'Optativo 1', 8),
          course('d', 'Asignatura nueva', 4),
        ]),
      );

      const summary = await service.ingestCurriculum(ADMIN, 'req-2');

      expect(summary.persistence).toEqual({ created: 1, updated: 2, unchanged: 1, deactivated: 0 });
      expect(tx.course.createMany.mock.calls[0][0].data.map((c: { code: string }) => c.code)).toEqual(['d']);
      const updatedCodes = tx.course.update.mock.calls.map(
        (call) => (call[0] as { where: { code: string } }).where.code,
      );
      expect(updatedCodes).toEqual(['b', 'c']);
      expect(tx.course.updateMany).toHaveBeenCalledWith({
        where: { code: { in: ['a'] } },
        data: { sourceId: 1, lastRunId: 10, lastSeenAt: FETCHED_AT },
      });
    });

    it('nunca modifica los créditos al actualizar una asignatura', async () => {
      const { service, tx, python } = setup([stored('b', 'Nombre viejo', 3)]);
      python.ingestCurriculum.mockResolvedValue(pythonResult([course('b', 'Nombre nuevo', 3)]));

      await service.ingestCurriculum(ADMIN, 'req-3');

      expect(tx.course.update.mock.calls[0][0].data).not.toHaveProperty('credits');
    });

    it('marca como inactivas las asignaturas de la fuente que ya no aparecen, sin borrarlas', async () => {
      const { service, tx, python } = setup([], 2);
      python.ingestCurriculum.mockResolvedValue(pythonResult([course('a', 'Álgebra Lineal', 2)]));

      const summary = await service.ingestCurriculum(ADMIN, 'req-4');

      expect(summary.persistence.deactivated).toBe(2);
      expect(tx.course.updateMany).toHaveBeenCalledWith({
        where: { sourceId: 1, active: true, code: { notIn: ['a'] } },
        data: { active: false },
      });
    });

    it('una respuesta degradada se registra como DEGRADED con sus avisos', async () => {
      const { service, tx, python } = setup();
      python.ingestCurriculum.mockResolvedValue(
        pythonResult([course('a', 'Álgebra Lineal', 2)], {
          status: 'degraded',
          warnings: ['La fuente no respondió; se usó la última copia en caché'],
        }),
      );

      const summary = await service.ingestCurriculum(ADMIN, 'req-5');

      expect(summary.status).toBe(IngestionStatus.DEGRADED);
      expect(tx.ingestionRun.create.mock.calls[0][0].data.warnings).toEqual([
        'La fuente no respondió; se usó la última copia en caché',
      ]);
    });

    it('pasa el request-id al servicio Python para correlacionar los logs', async () => {
      const { service, python } = setup();
      python.ingestCurriculum.mockResolvedValue(pythonResult([course('a', 'Álgebra Lineal', 2)]));

      await service.ingestCurriculum(ADMIN, 'correlacion-9');

      expect(python.ingestCurriculum).toHaveBeenCalledWith('correlacion-9');
    });
  });

  describe('fallos del servicio Python', () => {
    it.each([
      ['PYTHON_UNAVAILABLE', 503],
      ['PYTHON_TIMEOUT', 503],
      ['SOURCE_UNAVAILABLE', 503],
      ['ROBOTS_DISALLOWED', 502],
      ['SOURCE_INVALID', 502],
      ['EXTRACTION_FAILED', 502],
      ['PYTHON_INVALID_RESPONSE', 502],
      ['PYTHON_AUTH_FAILED', 502],
      ['PYTHON_ERROR', 502],
    ] as const)('%s responde HTTP %i y deja una corrida FAILED', async (code, status) => {
      const { service, prisma, tx, python } = setup();
      python.ingestCurriculum.mockRejectedValue(new PythonServiceError(code, 'detalle interno'));

      const error = await service.ingestCurriculum(ADMIN, 'req-f').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(status);
      expect((error as HttpException).getResponse()).toMatchObject({ code, statusCode: status });
      expect(prisma.ingestionRun.create.mock.calls[0][0].data).toMatchObject({
        status: IngestionStatus.FAILED,
        errorCode: code,
        requestId: 'req-f',
        triggeredById: 3,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.course.createMany).not.toHaveBeenCalled();
    });

    it('el mensaje al cliente no contiene detalles internos del error', async () => {
      const { service, python } = setup();
      python.ingestCurriculum.mockRejectedValue(
        new PythonServiceError('PYTHON_ERROR', 'host 10.0.0.7 clave abc123'),
      );

      const error = (await service.ingestCurriculum(ADMIN, 'r').catch((e: unknown) => e)) as HttpException;

      expect(JSON.stringify(error.getResponse())).not.toContain('10.0.0.7');
      expect(JSON.stringify(error.getResponse())).not.toContain('abc123');
    });

    it('si tampoco se puede registrar la corrida fallida, igual responde el error original', async () => {
      const { service, prisma, python } = setup();
      python.ingestCurriculum.mockRejectedValue(new PythonServiceError('PYTHON_UNAVAILABLE', 'x'));
      prisma.ingestionRun.create.mockRejectedValue(new Error('base caída'));

      const error = (await service.ingestCurriculum(ADMIN, 'r').catch((e: unknown) => e)) as HttpException;

      expect(error.getStatus()).toBe(503);
    });
  });

  describe('fallos al guardar', () => {
    it('si la transacción falla responde 500, no filtra el motivo y deja una corrida FAILED', async () => {
      const { service, prisma, python } = setup();
      python.ingestCurriculum.mockResolvedValue(pythonResult([course('a', 'Álgebra Lineal', 2)]));
      prisma.$transaction.mockRejectedValue(new Error('duplicate key value violates unique constraint "Course_code_key"'));

      const error = (await service.ingestCurriculum(ADMIN, 'req-p').catch((e: unknown) => e)) as HttpException;

      expect(error.getStatus()).toBe(500);
      expect(error.getResponse()).toMatchObject({ code: 'PERSISTENCE_FAILED' });
      expect(JSON.stringify(error.getResponse())).not.toContain('Course_code_key');
      expect(prisma.ingestionRun.create.mock.calls[0][0].data).toMatchObject({
        status: IngestionStatus.FAILED,
        errorCode: 'PERSISTENCE_FAILED',
      });
    });
  });

  describe('concurrencia', () => {
    it('rechaza con 409 una segunda ingesta mientras hay una en curso', async () => {
      const { service, python } = setup();
      let release: (value: CurriculumIngestResult) => void = () => undefined;
      python.ingestCurriculum.mockReturnValueOnce(
        new Promise<CurriculumIngestResult>((resolve) => {
          release = resolve;
        }),
      );

      const first = service.ingestCurriculum(ADMIN, 'req-1');
      await expect(service.ingestCurriculum(ADMIN, 'req-2')).rejects.toBeInstanceOf(ConflictException);

      release(pythonResult([course('a', 'Álgebra Lineal', 2)]));
      await first;
    });

    it('libera el bloqueo aunque la ingesta falle', async () => {
      const { service, python } = setup();
      python.ingestCurriculum
        .mockRejectedValueOnce(new PythonServiceError('PYTHON_UNAVAILABLE', 'x'))
        .mockResolvedValueOnce(pythonResult([course('a', 'Álgebra Lineal', 2)]));

      await service.ingestCurriculum(ADMIN, 'r1').catch(() => undefined);

      await expect(service.ingestCurriculum(ADMIN, 'r2')).resolves.toMatchObject({ status: IngestionStatus.SUCCESS });
    });
  });
});

describe('IngestionService.listRuns', () => {
  it('lista las últimas corridas, las más recientes primero, con 20 por defecto', async () => {
    const { service, prisma } = setup();

    await service.listRuns();

    expect(prisma.ingestionRun.findMany).toHaveBeenCalledWith({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  });

  it('respeta el límite pedido', async () => {
    const { service, prisma } = setup();

    await service.listRuns(5);

    expect(prisma.ingestionRun.findMany.mock.calls[0][0].take).toBe(5);
  });
});