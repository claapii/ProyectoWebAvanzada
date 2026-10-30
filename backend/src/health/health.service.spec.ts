import type { PrismaService } from '../prisma/prisma.service.js';
import type { PythonClient } from '../python/python-client.service.js';
import { HealthService } from './health.service.js';

interface Options {
  database?: 'up' | 'down' | 'hang';
  python?: 'up' | 'down';
  lastRun?: { status: string; startedAt: Date; finishedAt: Date | null } | null;
  lastRunFails?: boolean;
}

function setup({ database = 'up', python = 'up', lastRun = null, lastRunFails = false }: Options = {}) {
  const prisma = {
    $queryRaw: vi.fn().mockImplementation(() => {
      if (database === 'down') return Promise.reject(new Error('conexión rechazada'));
      if (database === 'hang') return new Promise(() => undefined);
      return Promise.resolve([{ '?column?': 1 }]);
    }),
    ingestionRun: {
      findFirst: vi.fn().mockImplementation(() =>
        lastRunFails ? Promise.reject(new Error('falló')) : Promise.resolve(lastRun),
      ),
    },
  };
  const pythonClient = {
    health: vi.fn().mockImplementation(() =>
      python === 'down'
        ? Promise.reject(new Error('sin conexión'))
        : Promise.resolve({ status: 'ok', service: 'python-fastapi' }),
    ),
  };
  const service = new HealthService(
    prisma as unknown as PrismaService,
    pythonClient as unknown as PythonClient,
  );
  return { service, prisma, pythonClient };
}

const run = (status: string) => ({
  status,
  startedAt: new Date('2026-10-23T23:25:00.000Z'),
  finishedAt: new Date('2026-10-23T23:25:02.000Z'),
});

describe('HealthService', () => {
  it('todo operativo: estado ok, con la latencia de cada componente', async () => {
    const { service } = setup({ lastRun: run('SUCCESS') });

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.service).toBe('nestjs-backend');
    expect(report.checks.database).toMatchObject({ status: 'up' });
    expect(report.checks.python).toMatchObject({ status: 'up' });
    expect(typeof report.checks.database.latency_ms).toBe('number');
    expect(report.checks.source).toEqual({
      status: 'up',
      last_run_at: '2026-10-23T23:25:02.000Z',
      last_run_status: 'SUCCESS',
    });
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
    expect(report.uptime_s).toBeGreaterThanOrEqual(0);
  });

  it('si Python no responde el sistema queda degradado, no caído', async () => {
    const { service } = setup({ python: 'down', lastRun: run('SUCCESS') });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.python.status).toBe('down');
    expect(report.checks.database.status).toBe('up');
  });

  it('si PostgreSQL no responde el sistema está caído y no consulta la última ingesta', async () => {
    const { service, prisma } = setup({ database: 'down' });

    const report = await service.check();

    expect(report.status).toBe('down');
    expect(report.checks.database.status).toBe('down');
    expect(report.checks.source.status).toBe('unknown');
    expect(prisma.ingestionRun.findFirst).not.toHaveBeenCalled();
  });

  it('una consulta a la base que nunca responde se corta por tiempo', async () => {
    vi.useFakeTimers();
    try {
      const { service } = setup({ database: 'hang' });

      const pending = service.check();
      await vi.advanceTimersByTimeAsync(3500);
      const report = await pending;

      expect(report.status).toBe('down');
      expect(report.checks.database.status).toBe('down');
    } finally {
      vi.useRealTimers();
    }
  });

  it('si la última ingesta falló, el acceso a la fuente aparece caído y el sistema degradado', async () => {
    const { service } = setup({ lastRun: run('FAILED') });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.source).toMatchObject({ status: 'down', last_run_status: 'FAILED' });
  });

  it('si la última ingesta usó la caché, la fuente aparece degradada', async () => {
    const { service } = setup({ lastRun: run('DEGRADED') });

    const report = await service.check();

    expect(report.status).toBe('degraded');
    expect(report.checks.source.status).toBe('degraded');
  });

  it('sin ingestas registradas la fuente es desconocida y no afecta el estado general', async () => {
    const { service } = setup({ lastRun: null });

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.checks.source).toEqual({
      status: 'unknown',
      last_run_at: null,
      last_run_status: null,
    });
  });

  it('si no se puede leer la última ingesta no falla la verificación', async () => {
    const { service } = setup({ lastRunFails: true });

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.checks.source.status).toBe('unknown');
  });
});