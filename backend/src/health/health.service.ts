import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { PythonClient } from '../python/python-client.service.js';

const CHECK_TIMEOUT_MS = 3000;

type UpDown = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  service: 'nestjs-backend';
  timestamp: string;
  uptime_s: number;
  checks: {
    database: { status: UpDown; latency_ms: number };
    python: { status: UpDown; latency_ms: number };
    source: {
      status: 'up' | 'degraded' | 'down' | 'unknown';
      last_run_at: string | null;
      last_run_status: string | null;
    };
  };
}

/** Rechaza si la operación no termina a tiempo, para que un componente colgado no bloquee el /health. */
function withTimeout<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pythonClient: PythonClient,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, python] = await Promise.all([
      this.timed(() => this.prisma.$queryRaw`SELECT 1`),
      this.timed(() => this.pythonClient.health()),
    ]);
    // El estado de la fuente se deduce de la última ingesta registrada en la
    // base: no se consulta el sitio externo en cada verificación de salud.
    const source =
      database.status === 'up'
        ? await this.sourceStatus()
        : { status: 'unknown' as const, last_run_at: null, last_run_status: null };

    const degraded =
      python.status === 'down' ||
      source.status === 'down' ||
      source.status === 'degraded';
    const status =
      database.status === 'down' ? 'down' : degraded ? 'degraded' : 'ok';

    return {
      status,
      service: 'nestjs-backend',
      timestamp: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      checks: { database, python, source },
    };
  }

  private async timed(
    operation: () => Promise<unknown>,
  ): Promise<{ status: UpDown; latency_ms: number }> {
    const started = Date.now();
    try {
      await withTimeout(operation(), CHECK_TIMEOUT_MS);
      return { status: 'up', latency_ms: Date.now() - started };
    } catch {
      return { status: 'down', latency_ms: Date.now() - started };
    }
  }

  private async sourceStatus(): Promise<HealthReport['checks']['source']> {
    try {
      const last = await this.prisma.ingestionRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { status: true, startedAt: true, finishedAt: true },
      });
      if (!last) {
        return { status: 'unknown', last_run_at: null, last_run_status: null };
      }
      const status =
        last.status === 'SUCCESS'
          ? 'up'
          : last.status === 'DEGRADED'
            ? 'degraded'
            : 'down';
      return {
        status,
        last_run_at: (last.finishedAt ?? last.startedAt).toISOString(),
        last_run_status: last.status,
      };
    } catch {
      return { status: 'unknown', last_run_at: null, last_run_status: null };
    }
  }
}