import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Role } from '../generated/prisma/enums.js';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types.js';

const VALID_ROLES: string[] = Object.values(Role);

/**
 * Verifica el token JWT del header Authorization (Bearer) y deja al usuario
 * autenticado en `request.user`. Un token válido solo prueba identidad: los
 * permisos los decide RolesGuard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Se requiere iniciar sesión');
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    if (typeof payload.sub !== 'number' || !VALID_ROLES.includes(payload.role)) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    request.user = payload;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== 'string') {
      return undefined;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }
}