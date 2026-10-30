import { applyDecorators, UseGuards } from '@nestjs/common';

import type { Role } from '../generated/prisma/enums.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

/**
 * Exige sesión iniciada y, si se indican roles, que el usuario tenga alguno.
 * Uso: @Auth() para cualquier usuario autenticado, @Auth(Role.ADMIN) solo admins.
 */
export const Auth = (...roles: Role[]) =>
  applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(...roles));