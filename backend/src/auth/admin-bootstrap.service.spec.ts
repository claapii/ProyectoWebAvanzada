import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';

import { Role } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';

function setup(env: Record<string, string | undefined>, existing: object | null) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const service = new AdminBootstrapService(
    prisma as unknown as PrismaService,
    config,
  );
  return { prisma, service };
}

describe('AdminBootstrapService', () => {
  it('no hace nada si faltan las variables de entorno', async () => {
    const { prisma, service } = setup({}, null);

    await service.ensureAdmin();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña demasiado corta', async () => {
    const { prisma, service } = setup(
      { ADMIN_EMAIL: 'admin@listoco.cl', ADMIN_PASSWORD: '1234' },
      null,
    );

    await service.ensureAdmin();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('crea el administrador con la contraseña cifrada', async () => {
    const { prisma, service } = setup(
      { ADMIN_EMAIL: 'admin@listoco.cl', ADMIN_PASSWORD: 'clave-segura-1' },
      null,
    );

    await service.ensureAdmin();

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.email).toBe('admin@listoco.cl');
    expect(data.role).toBe(Role.ADMIN);
    expect(data.passwordHash).not.toBe('clave-segura-1');
    await expect(compare('clave-segura-1', data.passwordHash)).resolves.toBe(true);
  });

  it('promueve a ADMIN a un usuario existente sin tocar su contraseña', async () => {
    const { prisma, service } = setup(
      { ADMIN_EMAIL: 'ana@correo.cl', ADMIN_PASSWORD: 'clave-segura-1' },
      { id: 5, role: Role.STUDENT },
    );

    await service.ensureAdmin();

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { role: Role.ADMIN },
    });
  });

  it('no modifica a un usuario que ya es ADMIN', async () => {
    const { prisma, service } = setup(
      { ADMIN_EMAIL: 'admin@listoco.cl', ADMIN_PASSWORD: 'clave-segura-1' },
      { id: 1, role: Role.ADMIN },
    );

    await service.ensureAdmin();

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('no interrumpe el arranque si la base falla', async () => {
    const { prisma, service } = setup(
      { ADMIN_EMAIL: 'admin@listoco.cl', ADMIN_PASSWORD: 'clave-segura-1' },
      null,
    );
    prisma.user.findUnique.mockRejectedValue(new Error('base caída'));

    await expect(service.ensureAdmin()).resolves.toBeUndefined();
  });
});