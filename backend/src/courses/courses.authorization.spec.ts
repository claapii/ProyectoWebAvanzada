import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { Role } from '../generated/prisma/enums.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

const SECRET = 'secreto-de-prueba';
const nuevoCurso = {
  code: 'INF-999',
  name: 'Asignatura de prueba',
  credits: 4,
  suggestedSemester: 3,
};

describe('Autorización de /courses (HTTP)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const coursesService = {
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn(),
    create: vi.fn().mockImplementation(async (dto: object) => ({ id: 1, ...dto })),
  };

  const token = (role: Role, options = {}) =>
    jwt.signAsync({ sub: 1, email: 'a@a.cl', role }, { expiresIn: '1h', ...options });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: [CoursesController],
      providers: [{ provide: CoursesService, useValue: coursesService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    coursesService.create.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /courses es público', async () => {
    await request(app.getHttpServer()).get('/courses').expect(200);
  });

  it('POST /courses sin token responde 401 y no crea nada', async () => {
    await request(app.getHttpServer()).post('/courses').send(nuevoCurso).expect(401);

    expect(coursesService.create).not.toHaveBeenCalled();
  });

  it('POST /courses con token expirado responde 401', async () => {
    const expirado = await token(Role.ADMIN, { expiresIn: -10 });

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${expirado}`)
      .send(nuevoCurso)
      .expect(401);
  });

  it('POST /courses con un token firmado con otro secreto responde 401', async () => {
    const falso = await new JwtService({ secret: 'otro' }).signAsync({
      sub: 1,
      email: 'a@a.cl',
      role: Role.ADMIN,
    });

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${falso}`)
      .send(nuevoCurso)
      .expect(401);
  });

  it('POST /courses con un estudiante responde 403: token válido no basta', async () => {
    const estudiante = await token(Role.STUDENT);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${estudiante}`)
      .send(nuevoCurso)
      .expect(403);

    expect(coursesService.create).not.toHaveBeenCalled();
  });

  it('POST /courses con un administrador responde 201', async () => {
    const admin = await token(Role.ADMIN);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${admin}`)
      .send(nuevoCurso)
      .expect(201);

    expect(coursesService.create).toHaveBeenCalledTimes(1);
  });

  it('un administrador igualmente recibe 400 si el cuerpo es inválido', async () => {
    const admin = await token(Role.ADMIN);

    await request(app.getHttpServer())
      .post('/courses')
      .set('Authorization', `Bearer ${admin}`)
      .send({ code: '' })
      .expect(400);
  });
});