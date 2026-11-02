import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Exige sesión iniciada; si no la hay, redirige al login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

/** Exige además el rol ADMIN; un estudiante vuelve al inicio. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }
  return auth.hasRole('ADMIN') ? true : router.createUrlTree(['/home']);
};