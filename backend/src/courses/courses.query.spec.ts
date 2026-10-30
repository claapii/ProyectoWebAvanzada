import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

describe('Validación de los filtros de GET /courses (HTTP)', () => {
  let app: INestApplication;
  const coursesService = {
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba' })],
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    coursesService.findAll.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('convierte los parámetros a sus tipos y los entrega al servicio', async () => {
    await request(app.getHttpServer())
      .get('/courses')
      .query({
        semester: '3',
        category: 'Ciencias Básicas',
        q: 'algebra',
        includeInactive: 'true',
      })
      .expect(200);

    expect(coursesService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        semester: 3,
        category: 'Ciencias Básicas',
        q: 'algebra',
        includeInactive: true,
      }),
    );
  });

  it('sin parámetros sigue respondiendo la lista completa', async () => {
    await request(app.getHttpServer()).get('/courses').expect(200);

    expect(coursesService.findAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['semester=99', 'semestre fuera de rango'],
    ['semester=0', 'semestre cero'],
    ['semester=abc', 'semestre que no es número'],
    ['semester=2.5', 'semestre decimal'],
    ['includeInactive=quizas', 'booleano inválido'],
    [`q=${'x'.repeat(101)}`, 'búsqueda demasiado larga'],
  ])('rechaza %s (%s) con 400 y no consulta la base', async (query) => {
    await request(app.getHttpServer()).get(`/courses?${query}`).expect(400);

    expect(coursesService.findAll).not.toHaveBeenCalled();
  });

  it('descarta parámetros desconocidos en vez de pasarlos al servicio', async () => {
    await request(app.getHttpServer()).get('/courses?hack=1').expect(200);

    expect(coursesService.findAll.mock.calls[0][0]).not.toHaveProperty('hack');
  });
});