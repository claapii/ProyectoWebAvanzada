import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { AuthService, isTokenExpired } from './auth.service';

import { fakeJwt } from './test-utils';

const enUnaHora = () => Math.floor(Date.now() / 1000) + 3600;

describe('isTokenExpired', () => {
  it('acepta un token que vence en el futuro', () => {
    expect(isTokenExpired(fakeJwt(enUnaHora()))).toBe(false);
  });

  it('rechaza un token vencido', () => {
    expect(isTokenExpired(fakeJwt(Math.floor(Date.now() / 1000) - 60))).toBe(
      true,
    );
  });

  it('rechaza un token sin fecha de expiración', () => {
    expect(isTokenExpired(fakeJwt(null))).toBe(true);
  });

  it('rechaza un texto que no es un token', () => {
    expect(isTokenExpired('esto-no-es-un-jwt')).toBe(true);
  });
});

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', children: [] }]),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin sesión no está autenticado', () => {
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.getToken()).toBeNull();
  });

  it('inicia sesión y guarda el token y el usuario', () => {
    const token = fakeJwt(enUnaHora());
    auth.login('admin@pucv.cl', 'clave-segura').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'admin@pucv.cl',
      password: 'clave-segura',
    });
    req.flush({
      accessToken: token,
      user: { id: 1, email: 'admin@pucv.cl', role: 'ADMIN' },
    });

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.getToken()).toBe(token);
    expect(auth.hasRole('ADMIN')).toBe(true);
    expect(auth.hasRole('STUDENT')).toBe(false);
  });

  it('un token vencido cierra la sesión', () => {
    auth.login('a@pucv.cl', 'clave-segura').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: fakeJwt(Math.floor(Date.now() / 1000) - 60),
      user: { id: 2, email: 'a@pucv.cl', role: 'STUDENT' },
    });

    expect(auth.getToken()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('logout limpia la sesión guardada', () => {
    auth.login('a@pucv.cl', 'clave-segura').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: fakeJwt(enUnaHora()),
      user: { id: 2, email: 'a@pucv.cl', role: 'STUDENT' },
    });

    auth.logout();

    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem('listoco.token')).toBeNull();
    expect(auth.user()).toBeNull();
  });
});