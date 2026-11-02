import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isApiCall = req.url.startsWith(environment.apiUrl);
  const isLogin = req.url.endsWith('/auth/login');

  // El token solo viaja hacia nuestro API, nunca a otros dominios.
  const token = isApiCall && !isLogin ? auth.getToken() : null;
  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Sesión vencida o token inválido: se cierra y se vuelve al login.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiCall &&
        !isLogin
      ) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};

/** Mensaje para el usuario según el error HTTP; no expone trazas ni detalles internos. */
export function describeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Ocurrió un error inesperado.';
  }

  switch (error.status) {
    case 0:
      return 'No hay conexión con el servidor. Revisa tu conexión a Internet.';
    case 400: {
      const message = (error.error as { message?: string | string[] } | null)
        ?.message;
      const text = Array.isArray(message) ? message.join(' ') : message;
      return text ?? 'Los datos enviados no son válidos.';
    }
    case 401:
      return 'Credenciales incorrectas o sesión vencida.';
    case 403:
      return 'No tienes permisos para realizar esta acción.';
    case 404:
      return 'No se encontró lo solicitado.';
    case 409:
      return 'Ya hay una operación en curso. Intenta de nuevo en unos minutos.';
    case 502:
    case 503:
    case 504:
      return 'Un servicio no está disponible por ahora. Intenta más tarde.';
    default:
      return 'El servidor no pudo completar la operación.';
  }
}