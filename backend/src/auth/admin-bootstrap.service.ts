import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';

import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Garantiza un administrador inicial a partir de ADMIN_EMAIL y ADMIN_PASSWORD.
 * Sin esas variables no hace nada. El registro público siempre crea
 * estudiantes, así que esta es la única vía para obtener el primer ADMIN.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureAdmin();
  }

  async ensureAdmin() {
    const email = this.configService.get<string>('ADMIN_EMAIL')?.trim();
    const password = this.configService.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      this.logger.error(
        `ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres; no se crea el administrador`,
      );
      return;
    }

    try {
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (!existing) {
        const user = await this.prisma.user.create({
          data: {
            email,
            passwordHash: await hash(password, 10),
            role: Role.ADMIN,
          },
        });
        this.logger.log(`Administrador inicial creado (id ${user.id})`);
        return;
      }

      if (existing.role !== Role.ADMIN) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { role: Role.ADMIN },
        });
        this.logger.log(`Usuario ${existing.id} promovido a administrador`);
      }
    } catch (error) {
      // No debe impedir el arranque del servicio (por ejemplo, otra réplica lo creó antes).
      this.logger.error(
        `No se pudo asegurar el administrador inicial: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }
  }
}