import type { PrismaService } from '../prisma/prisma.service.js';
import { CoursesService, toSlug } from './courses.service.js';

function setup() {
  const prisma = { course: { findMany: vi.fn().mockResolvedValue([]) } };
  const service = new CoursesService(prisma as unknown as PrismaService);
  const lastWhere = () => prisma.course.findMany.mock.calls.at(-1)?.[0].where;
  return { prisma, service, lastWhere };
}

describe('toSlug', () => {
  it('quita acentos, pasa a minúsculas y usa guiones', () => {
    expect(toSlug('Cálculo Diferencial e Integral')).toBe(
      'calculo-diferencial-e-integral',
    );
    expect(toSlug('  Ética, Y Tecnológica ')).toBe('etica-y-tecnologica');
  });

  it('devuelve vacío cuando solo hay símbolos', () => {
    expect(toSlug('¿¡?!')).toBe('');
  });
});

describe('CoursesService.findAll', () => {
  it('por defecto lista solo las asignaturas activas, ordenadas por semestre y nombre', async () => {
    const { prisma, service, lastWhere } = setup();

    await service.findAll();

    expect(lastWhere()).toEqual({ active: true });
    expect(prisma.course.findMany.mock.calls[0][0].orderBy).toEqual([
      { suggestedSemester: 'asc' },
      { name: 'asc' },
    ]);
  });

  it('incluye la fuente de cada asignatura para mostrar su procedencia', async () => {
    const { prisma, service } = setup();

    await service.findAll();

    expect(prisma.course.findMany.mock.calls[0][0].include).toEqual({
      source: { select: { key: true, name: true, url: true } },
    });
  });

  it('filtra por semestre y categoría', async () => {
    const { service, lastWhere } = setup();

    await service.findAll({ semester: 5, category: 'Programa Inglés' });

    expect(lastWhere()).toEqual({
      active: true,
      suggestedSemester: 5,
      category: 'Programa Inglés',
    });
  });

  it('busca por nombre sin distinguir mayúsculas y por código sin acentos', async () => {
    const { service, lastWhere } = setup();

    await service.findAll({ q: 'Cálculo' });

    expect(lastWhere().OR).toEqual([
      { name: { contains: 'Cálculo', mode: 'insensitive' } },
      { code: { contains: 'calculo' } },
    ]);
  });

  it('con una búsqueda de solo símbolos no agrega una condición de código vacía', async () => {
    const { service, lastWhere } = setup();

    await service.findAll({ q: '¿?!' });

    expect(lastWhere().OR).toEqual([
      { name: { contains: '¿?!', mode: 'insensitive' } },
    ]);
  });

  it('ignora una búsqueda formada solo por espacios', async () => {
    const { service, lastWhere } = setup();

    await service.findAll({ q: '   ' });

    expect(lastWhere()).toEqual({ active: true });
  });

  it('includeInactive quita el filtro de vigentes', async () => {
    const { service, lastWhere } = setup();

    await service.findAll({ includeInactive: true });

    expect(lastWhere()).toEqual({});
  });
});