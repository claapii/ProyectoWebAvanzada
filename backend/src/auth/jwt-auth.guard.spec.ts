import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'secreto-de-prueba';

function contextWith(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwtService = new JwtService({ secret: SECRET });
  const guard = new JwtAuthGuard(jwtService);

  const sign = (payload: object, options = {}) =>
    jwtService.signAsync(payload, { expiresIn: '1h', ...options });

  it('rechaza solicitudes sin header Authorization', async () => {
    await expect(guard.canActivate(contextWith({ headers: {} }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un esquema distinto de Bearer', async () => {
    const token = await sign({ sub: 1, email: 'a@a.cl', role: Role.ADMIN });
    const request = { headers: { authorization: `Basic ${token}` } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token que no es un JWT', async () => {
    const request = { headers: { authorization: 'Bearer cualquier-cosa' } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const otro = new JwtService({ secret: 'otro-secreto' });
    const token = await otro.signAsync({ sub: 1, email: 'a@a.cl', role: Role.ADMIN });
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token expirado', async () => {
    const token = await sign(
      { sub: 1, email: 'a@a.cl', role: Role.STUDENT },
      { expiresIn: -10 },
    );
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token válido cuyo rol no existe', async () => {
    const token = await sign({ sub: 1, email: 'a@a.cl', role: 'SUPERUSUARIO' });
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextWith(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('acepta un token válido y deja al usuario en la solicitud', async () => {
    const token = await sign({ sub: 7, email: 'ana@correo.cl', role: Role.STUDENT });
    const request: AuthenticatedRequest = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({
      sub: 7,
      email: 'ana@correo.cl',
      role: Role.STUDENT,
    });
  });
});