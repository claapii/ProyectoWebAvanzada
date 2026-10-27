import type { Role } from '../generated/prisma/enums.js';

export interface AuthenticatedUser {
  sub: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}