/**
 * Pruebas de integración contra una base PostgreSQL real.
 *
 * Solo se ejecutan si TEST_DATABASE_URL apunta a una base DESECHABLE (su nombre
 * debe contener "test"): cada prueba vacía las tablas. Las migraciones deben
 * estar aplicadas. En el CI se usa un servicio PostgreSQL efímero.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { Role } from '../generated/prisma/enums.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { CoursesService } from '../courses/courses.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type {
  CurriculumIngestResult,
  PythonClient,
} from '../python/python-client.service.js';
import { PythonServiceError } from '../python/python.errors.js';
import { IngestionService } from './ingestion.service.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const isDisposable = !!databaseUrl && /test/i.test(new URL(databaseUrl).pathname);
// En el CI estas pruebas son obligatorias: si la base no está configurada, fallar
// en vez de omitirlas en silencio y dar una falsa sensación de seguridad.
if (process.env.REQUIRE_DB_TESTS === 'true' && !isDisposable) {
  throw new Error(
    'REQUIRE_DB_TESTS=true, pero TEST_DATABASE_URL no apunta a una base de pruebas',
  );
}

describe.skipIf(!isDisposable)('Ingesta contra PostgreSQL real', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl ?? '' }),
  });
  const python = { ingestCurriculum: vi.fn() };
  const ingestion = new IngestionService(
    prisma as unknown as PrismaService,
    python as unknown as PythonClient,
  );
  const courses = new CoursesService(prisma as unknown as PrismaService);
  let adminId = 0;

  const c = (code: string, name: string, semester: number, category: string | null = null) => ({
    code, name, semester, category,
  });

  const result = (list: CurriculumIngestResult['courses'], sha = 'c'.repeat(64)): CurriculumIngestResult => ({
    status: 'ok',
    provenance: {
      sourceName: 'PUCV - Plan de Estudios',
      sourceUrl: 'https://pucv.cl/plan.pdf',
      fetchedAt: new Date('2026-10-23T23:25:13.000Z'),
      sha256: sha,
      contentLength: 100706,
      resolution: 'DRA 61/2020',
      fromCache: false,
      changed: null,
      extractorVersion: '2.0.0',
    },
    metrics: {
      candidates: list.length, valid: list.length, rejected: 0, duplicates: 0,
      semestersDetected: 11, semestersExpected: 11, coverage: 1, validRatio: 1, durationMs: 900,
    },
    courses: list,
    warnings: [],
  });

  const admin = () => ({ sub: adminId, email: 'admin@test.cl', role: Role.ADMIN });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Course","IngestionRun","DataSource","User" RESTART IDENTITY CASCADE',
    );
    const user = await prisma.user.create({
      data: { email: 'admin@test.cl', passwordHash: 'x', role: Role.ADMIN },
    });
    adminId = user.id;
    python.ingestCurriculum.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('la primera ingesta crea la fuente, la corrida y las asignaturas con su procedencia', async () => {
    python.ingestCurriculum.mockResolvedValue(
      result([c('algebra-lineal', 'Álgebra Lineal', 2, 'Ciencias Básicas'), c('optativo-1', 'Optativo 1', 8)]),
    );

    const summary = await ingestion.ingestCurriculum(admin(), 'req-1');

    expect(summary.persistence).toEqual({ created: 2, updated: 0, unchanged: 0, deactivated: 0 });
    const run = await prisma.ingestionRun.findUniqueOrThrow({ where: { id: summary.runId } });
    expect(run).toMatchObject({ status: 'SUCCESS', requestId: 'req-1', triggeredById: adminId, createdCount: 2 });
    expect(run.sha256).toBe('c'.repeat(64));

    const stored = await prisma.course.findMany({ include: { source: true } });
    expect(stored).toHaveLength(2);
    for (const course of stored) {
      expect(course.lastRunId).toBe(run.id);
      expect(course.source?.key).toBe('pucv-plan-ici');
      expect(course.credits).toBeNull();
      expect(course.active).toBe(true);
    }
  });

  it('repetir la ingesta con los mismos datos no duplica nada (idempotente)', async () => {
    python.ingestCurriculum.mockResolvedValue(
      result([c('algebra-lineal', 'Álgebra Lineal', 2), c('optativo-1', 'Optativo 1', 8)]),
    );

    await ingestion.ingestCurriculum(admin(), 'r1');
    const second = await ingestion.ingestCurriculum(admin(), 'r2');

    expect(second.persistence).toEqual({ created: 0, updated: 0, unchanged: 2, deactivated: 0 });
    expect(await prisma.course.count()).toBe(2);
    expect(await prisma.dataSource.count()).toBe(1);
    expect(await prisma.ingestionRun.count()).toBe(2);
    // la asignatura quedó asociada a la última corrida que la vio
    const latest = await prisma.course.findMany();
    expect(latest.every((course) => course.lastRunId === second.runId)).toBe(true);
  });

  it('una nueva versión de la malla actualiza, agrega y desactiva, y conserva los créditos', async () => {
    python.ingestCurriculum.mockResolvedValue(
      result([c('a', 'Álgebra', 1), c('b', 'Cálculo', 2), c('c', 'Se elimina', 3)]),
    );
    await ingestion.ingestCurriculum(admin(), 'v1');
    // un dato curado manualmente que la ingesta no debe pisar
    await prisma.course.update({ where: { code: 'b' }, data: { credits: 6 } });

    python.ingestCurriculum.mockResolvedValue(
      result([c('a', 'Álgebra', 1), c('b', 'Cálculo Diferencial', 2), c('d', 'Nueva', 4)], 'd'.repeat(64)),
    );
    const summary = await ingestion.ingestCurriculum(admin(), 'v2');

    expect(summary.persistence).toEqual({ created: 1, updated: 1, unchanged: 1, deactivated: 1 });
    const b = await prisma.course.findUniqueOrThrow({ where: { code: 'b' } });
    expect(b).toMatchObject({ name: 'Cálculo Diferencial', credits: 6, active: true });
    const removed = await prisma.course.findUniqueOrThrow({ where: { code: 'c' } });
    expect(removed.active).toBe(false); // no se borra: queda el historial
    expect(await prisma.course.count()).toBe(4);
  });

  it('una asignatura desactivada que vuelve a aparecer se reactiva', async () => {
    python.ingestCurriculum.mockResolvedValue(result([c('a', 'Álgebra', 1), c('b', 'Cálculo', 2)]));
    await ingestion.ingestCurriculum(admin(), 'v1');
    python.ingestCurriculum.mockResolvedValue(result([c('a', 'Álgebra', 1)]));
    await ingestion.ingestCurriculum(admin(), 'v2');
    expect((await prisma.course.findUniqueOrThrow({ where: { code: 'b' } })).active).toBe(false);

    python.ingestCurriculum.mockResolvedValue(result([c('a', 'Álgebra', 1), c('b', 'Cálculo', 2)]));
    const summary = await ingestion.ingestCurriculum(admin(), 'v3');

    expect(summary.persistence.updated).toBe(1);
    expect((await prisma.course.findUniqueOrThrow({ where: { code: 'b' } })).active).toBe(true);
  });

  it('si la fuente cae queda una corrida FAILED y las asignaturas no cambian', async () => {
    python.ingestCurriculum.mockResolvedValue(result([c('a', 'Álgebra', 1)]));
    await ingestion.ingestCurriculum(admin(), 'ok');
    python.ingestCurriculum.mockRejectedValue(new PythonServiceError('SOURCE_UNAVAILABLE', 'caída'));

    await expect(ingestion.ingestCurriculum(admin(), 'falla')).rejects.toMatchObject({ status: 503 });

    const runs = await prisma.ingestionRun.findMany({ orderBy: { id: 'asc' } });
    expect(runs.map((run) => run.status)).toEqual(['SUCCESS', 'FAILED']);
    expect(runs[1]).toMatchObject({ errorCode: 'SOURCE_UNAVAILABLE', requestId: 'falla' });
    expect(await prisma.course.count()).toBe(1);
  });

  it('si falla al guardar, la transacción se revierte por completo', async () => {
    python.ingestCurriculum.mockResolvedValue(result([c('a', 'Álgebra', 1)]));
    await ingestion.ingestCurriculum(admin(), 'base');
    // Datos corruptos: dos asignaturas con el mismo código violan la restricción única.
    python.ingestCurriculum.mockResolvedValue(
      result([c('a', 'Álgebra', 1), c('nueva', 'Nueva', 2), c('nueva', 'Nueva repetida', 3)]),
    );

    await expect(ingestion.ingestCurriculum(admin(), 'rota')).rejects.toMatchObject({ status: 500 });

    // nada de la corrida rota quedó guardado: ni asignaturas ni una corrida exitosa
    expect(await prisma.course.count()).toBe(1);
    const runs = await prisma.ingestionRun.findMany({ orderBy: { id: 'asc' } });
    expect(runs.map((run) => run.status)).toEqual(['SUCCESS', 'FAILED']);
    expect(runs[1].errorCode).toBe('PERSISTENCE_FAILED');
  });

  describe('consulta de asignaturas con filtros', () => {
    beforeEach(async () => {
      python.ingestCurriculum.mockResolvedValue(
        result([
          c('calculo-diferencial-e-integral', 'Cálculo Diferencial e Integral', 2, 'Ciencias Básicas'),
          c('algebra-lineal', 'Álgebra Lineal', 2, 'Ciencias Básicas'),
          c('base-de-datos', 'Base de Datos', 5, 'Sistemas de Información'),
          c('ingles-1', 'Inglés 1', 4, 'Programa Inglés'),
        ]),
      );
      await ingestion.ingestCurriculum(admin(), 'seed');
    });

    it('ordena por semestre', async () => {
      const list = await courses.findAll();

      expect(list.map((course) => course.suggestedSemester)).toEqual([2, 2, 4, 5]);
      // Dentro de un semestre el orden alfabético depende de la configuración
      // regional de la base de datos, así que solo se comprueba el contenido.
      expect(list.slice(0, 2).map((course) => course.code).sort()).toEqual([
        'algebra-lineal',
        'calculo-diferencial-e-integral',
      ]);
    });

    it('filtra por semestre y por categoría', async () => {
      expect(await courses.findAll({ semester: 2 })).toHaveLength(2);
      expect(await courses.findAll({ category: 'Programa Inglés' })).toHaveLength(1);
      expect(await courses.findAll({ semester: 2, category: 'Programa Inglés' })).toHaveLength(0);
    });

    it('busca sin distinguir mayúsculas ni acentos', async () => {
      expect((await courses.findAll({ q: 'calculo' })).map((x) => x.code)).toEqual([
        'calculo-diferencial-e-integral',
      ]);
      expect((await courses.findAll({ q: 'CÁLCULO' })).map((x) => x.code)).toEqual([
        'calculo-diferencial-e-integral',
      ]);
      expect((await courses.findAll({ q: 'datos' })).map((x) => x.code)).toEqual(['base-de-datos']);
    });

    it('oculta las inactivas salvo que se pidan', async () => {
      python.ingestCurriculum.mockResolvedValue(result([c('algebra-lineal', 'Álgebra Lineal', 2)]));
      await ingestion.ingestCurriculum(admin(), 'reduce');

      expect(await courses.findAll()).toHaveLength(1);
      expect(await courses.findAll({ includeInactive: true })).toHaveLength(4);
    });

    it('cada asignatura trae su fuente para mostrar la procedencia', async () => {
      const [first] = await courses.findAll({ q: 'algebra' });

      expect(first.source).toEqual({
        key: 'pucv-plan-ici',
        name: 'PUCV - Plan de Estudios',
        url: 'https://pucv.cl/plan.pdf',
      });
    });
  });
});