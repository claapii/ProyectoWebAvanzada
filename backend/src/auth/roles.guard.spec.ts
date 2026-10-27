import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class SoloAdmin {
  @Roles(Role.ADMIN)
  accion(this: void) {}

  sinRestriccion(this: void) {}
}

function contextFor(
  handler: () => void,
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SoloAdmin,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const user = (role: Role) => ({ sub: 1, email: 'a@a.cl', role });

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const instancia = new SoloAdmin();

  it('permite el acceso a rutas sin roles declarados', () => {
    const context = contextFor(instancia.sinRestriccion, {});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite a un ADMIN en una ruta exclusiva de admin', () => {
    const context = contextFor(instancia.accion, { user: user(Role.ADMIN) });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('niega a un STUDENT en una ruta exclusiva de admin', () => {
    const context = contextFor(instancia.accion, { user: user(Role.STUDENT) });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('niega cuando no hay usuario autenticado', () => {
    const context = contextFor(instancia.accion, {});

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});