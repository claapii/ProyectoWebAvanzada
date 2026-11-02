import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { authInterceptor, describeError } from './auth.interceptor';
import { fakeJwt } from './test-utils';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let token: string;

  beforeEach(() => {
    localStorage.clear();
    token = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('listoco.token', token);
    localStorage.setItem(
      'listoco.user',
      JSON.stringify({ id: 1, email: 'x@pucv.cl', role: 'STUDENT' }),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', children: [] }]),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('agrega el token a las peticiones al API', () => {
    client.get(`${environment.apiUrl}/courses`).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/courses`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('no agrega el token al login', () => {
    client.post(`${environment.apiUrl}/auth/login`, {}).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no envía el token a otros dominios', () => {
    client.get('https://otro-sitio.example.com/datos').subscribe();
    const req = http.expectOne('https://otro-sitio.example.com/datos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('un 401 cierra la sesión', () => {
    client.get(`${environment.apiUrl}/courses`).subscribe({
      error: () => undefined,
    });
    http
      .expectOne(`${environment.apiUrl}/courses`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('listoco.token')).toBeNull();
  });
});

describe('describeError', () => {
  it('explica la falta de conexión', () => {
    expect(describeError(new HttpErrorResponse({ status: 0 }))).toContain(
      'conexión',
    );
  });

  it('explica la falta de permisos', () => {
    expect(describeError(new HttpErrorResponse({ status: 403 }))).toContain(
      'permisos',
    );
  });

  it('no expone detalles internos en un error 500', () => {
    const texto = describeError(
      new HttpErrorResponse({
        status: 500,
        error: { stack: 'SELECT * FROM users' },
      }),
    );
    expect(texto).not.toContain('SELECT');
  });

  it('maneja errores que no son HTTP', () => {
    expect(describeError(new Error('x'))).toContain('inesperado');
  });
});