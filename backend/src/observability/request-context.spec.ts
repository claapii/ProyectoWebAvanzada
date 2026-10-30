import { Controller, Get, Headers, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { getRequestId, requestContextMiddleware } from './request-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller('probe')
class ProbeController {
  @Get()
  probe(@Headers('x-request-id') header?: string) {
    return { header, fromContext: getRequestId() };
  }

  @Get('slow')
  async slow() {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { id: getRequestId() };
  }
}

describe('requestContextMiddleware (HTTP)', () => {
  let app: INestApplication;
  const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(requestContextMiddleware);
    await app.init();
  });

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterAll(async () => {
    await app.close();
    logSpy.mockRestore();
  });

  it('genera un identificador si el cliente no envía ninguno y lo devuelve en el header', async () => {
    const response = await request(app.getHttpServer()).get('/probe').expect(200);

    const id = response.headers['x-request-id'];
    expect(id).toMatch(UUID);
    expect(response.body).toEqual({ header: id, fromContext: id });
  });

  it('conserva un identificador válido enviado por el cliente', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe')
      .set('X-Request-Id', 'mi-solicitud.123_a')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('mi-solicitud.123_a');
    expect(response.body.fromContext).toBe('mi-solicitud.123_a');
  });

  it.each([
    ['con espacios y símbolos', 'a b;c'],
    ['demasiado largo', 'x'.repeat(65)],
    ['con caracteres de control', 'abc\tdef'],
  ])('reemplaza un identificador inválido (%s) por uno propio', async (_caso, invalid) => {
    const response = await request(app.getHttpServer())
      .get('/probe')
      .set('X-Request-Id', invalid)
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(UUID);
    expect(response.body.header).toMatch(UUID);
  });

  it('registra cada solicitud con método, ruta sin query, estado y duración', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe?secreto=abc123')
      .expect(200);

    await vi.waitFor(() => expect(logSpy).toHaveBeenCalled());
    const entry = logSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      event: 'http_request',
      method: 'GET',
      path: '/probe',
      status: 200,
      request_id: response.headers['x-request-id'],
    });
    expect(typeof entry.duration_ms).toBe('number');
    expect(JSON.stringify(entry)).not.toContain('abc123');
  });

  it('mantiene separado el identificador de solicitudes simultáneas', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).get('/probe/slow').set('X-Request-Id', 'primera'),
      request(app.getHttpServer()).get('/probe/slow').set('X-Request-Id', 'segunda'),
    ]);

    expect(first.body.id).toBe('primera');
    expect(second.body.id).toBe('segunda');
  });
});