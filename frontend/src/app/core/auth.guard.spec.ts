import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';

import { adminGuard, authGuard } from './auth.guard';
import { fakeJwt } from './test-utils';

const enUnaHora = () => Math.floor(Date.now() / 1000) + 3600;

function guardarSesion(role: 'ADMIN' | 'STUDENT') {
  localStorage.setItem('listoco.token', fakeJwt(enUnaHora()));
  localStorage.setItem(
    'listoco.user',
    JSON.stringify({ id: 1, email: 'x@pucv.cl', role }),
  );
}

function ejecutar(guard: typeof authGuard) {
  return TestBed.runInInjectionContext(() => guard({} as never, {} as never));
}

describe('guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('authGuard redirige al login si no hay sesión', () => {
    const resultado = ejecutar(authGuard);
    expect(resultado instanceof UrlTree).toBe(true);
    expect(String(resultado)).toBe('/login');
  });

  it('authGuard permite el paso con sesión vigente', () => {
    guardarSesion('STUDENT');
    expect(ejecutar(authGuard)).toBe(true);
  });

  it('adminGuard redirige al login si no hay sesión', () => {
    expect(String(ejecutar(adminGuard))).toBe('/login');
  });

  it('adminGuard envía a un estudiante al inicio', () => {
    guardarSesion('STUDENT');
    expect(String(ejecutar(adminGuard))).toBe('/home');
  });

  it('adminGuard permite el paso a un administrador', () => {
    guardarSesion('ADMIN');
    expect(ejecutar(adminGuard)).toBe(true);
  });
});