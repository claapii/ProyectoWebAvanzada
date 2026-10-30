import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { HealthController } from './health.controller.js';
import { HealthService, type HealthReport } from './health.service.js';

const report = (status: HealthReport['status']): HealthReport => ({
  status,
  service: 'nestjs-backend',
  timestamp: '2026-10-23T23:30:00.000Z',
  uptime_s: 120,
  checks: {
    database: { status: status === 'down' ? 'down' : 'up', latency_ms: 4 },
    python: { status: 'up', latency_ms: 9 },
    source: { status: 'unknown', last_run_at: null, last_run_status: null },
  },
});

describe('HealthController (HTTP)', () => {
  let app: INestApplication;
  const healthService = { check: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    healthService.check.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health es público y responde 200 con el detalle cuando todo funciona', async () => {
    healthService.check.mockResolvedValue(report('ok'));

    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', service: 'nestjs-backend' });
    expect(response.body.checks.database.status).toBe('up');
  });

  it('GET /health responde 200 aunque el sistema esté degradado, e informa el motivo', async () => {
    healthService.check.mockResolvedValue(report('degraded'));

    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('degraded');
  });

  it('GET /health responde 503 con el detalle cuando la base de datos no responde', async () => {
    healthService.check.mockResolvedValue(report('down'));

    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body.status).toBe('down');
    expect(response.body.checks.database.status).toBe('down');
  });

  it('GET /health/live solo indica que el proceso está vivo, sin consultar dependencias', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body).toEqual({ status: 'ok', service: 'nestjs-backend' });
    expect(healthService.check).not.toHaveBeenCalled();
  });
});