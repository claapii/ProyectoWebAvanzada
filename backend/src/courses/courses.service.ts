import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto.js';

/** Minúsculas, sin acentos y con guiones: el mismo formato del campo `code`. */
export function toSlug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListCoursesQueryDto = {}) {
    const { semester, category, includeInactive } = query;
    const search = query.q?.trim();
    const slug = search ? toSlug(search) : '';

    const where: Prisma.CourseWhereInput = {
      // Por defecto solo las asignaturas vigentes en la última malla recuperada.
      ...(includeInactive ? {} : { active: true }),
      ...(semester !== undefined ? { suggestedSemester: semester } : {}),
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              // El código es un texto sin acentos: permite buscar "calculo" y
              // encontrar "Cálculo Diferencial e Integral".
              ...(slug ? [{ code: { contains: slug } }] : []),
            ],
          }
        : {}),
    };

    return this.prisma.course.findMany({
      where,
      orderBy: [{ suggestedSemester: 'asc' }, { name: 'asc' }],
      include: { source: { select: { key: true, name: true, url: true } } },
    });
  }

  findOne(id: number) {
    return this.prisma.course.findUnique({
      where: {
        id,
      },
    });
  }

  create(createCourseDto: CreateCourseDto) {
    return this.prisma.course.create({
      data: createCourseDto,
    });
  }
}