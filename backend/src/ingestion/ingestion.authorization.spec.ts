import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { Role } from '../generated/prisma/enums.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';

describe('Autorización de /ingestion (HTTP)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const ingestionService = {
    ingestCurriculum: vi.fn().mockResolvedValue({ runId: 1 }),
    listRuns: vi.fn().mockResolvedValue([]),
  };

  const token = (role: Role, sub = 7) =>
    jwt.signAsync({ sub, email: 'a@a.cl', role }, { expiresIn: '1h' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [IngestionController],
      providers: [{ provide: IngestionService, useValue: ingestionService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    ingestionService.ingestCurriculum.mockClear();
    ingestionService.listRuns.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /ingestion/curriculum', () => {
    it('sin sesión responde 401 y no ejecuta nada', async () => {
      await request(app.getHttpServer()).post('/ingestion/curriculum').expect(401);

      expect(ingestionService.ingestCurriculum).not.toHaveBeenCalled();
    });

    it('con un estudiante responde 403 y no ejecuta nada', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/curriculum')
        .set('Authorization', `Bearer ${await token(Role.STUDENT)}`)
        .expect(403);

      expect(ingestionService.ingestCurriculum).not.toHaveBeenCalled();
    });

    it('con un administrador ejecuta la ingesta a nombre de ese usuario', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/curriculum')
        .set('Authorization', `Bearer ${await token(Role.ADMIN, 42)}`)
        .set('X-Request-Id', 'mi-solicitud-1')
        .expect(201);

      expect(ingestionService.ingestCurriculum).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 42, role: Role.ADMIN }),
        'mi-solicitud-1',
      );
    });

    it('si el X-Request-Id es sospechoso genera uno propio', async () => {
      await request(app.getHttpServer())
        .post('/ingestion/curriculum')
        .set('Authorization', `Bearer ${await token(Role.ADMIN)}`)
        .set('X-Request-Id', 'a b\tc;drop')
        .expect(201);

      const used = ingestionService.ingestCurriculum.mock.calls[0][1] as string;
      expect(used).not.toContain(';');
      expect(used).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('GET /ingestion/runs', () => {
    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer()).get('/ingestion/runs').expect(401);
    });

    it('con un estudiante responde 403', async () => {
      await request(app.getHttpServer())
        .get('/ingestion/runs')
        .set('Authorization', `Bearer ${await token(Role.STUDENT)}`)
        .expect(403);
    });

    it('con un administrador responde 200 y aplica el límite', async () => {
      await request(app.getHttpServer())
        .get('/ingestion/runs?limit=5')
        .set('Authorization', `Bearer ${await token(Role.ADMIN)}`)
        .expect(200);

      expect(ingestionService.listRuns).toHaveBeenCalledWith(5);
    });

    it.each(['limit=0', 'limit=1000', 'limit=abc'])('rechaza %s con 400', async (query) => {
      await request(app.getHttpServer())
        .get(`/ingestion/runs?${query}`)
        .set('Authorization', `Bearer ${await token(Role.ADMIN)}`)
        .expect(400);

      expect(ingestionService.listRuns).not.toHaveBeenCalled();
    });
  });
});