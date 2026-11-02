import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoginResponse, Role, User } from './model';

const TOKEN_KEY = 'listoco.token';
const USER_KEY = 'listoco.user';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Sin almacenamiento disponible: la sesión dura solo mientras la app esté abierta.
  }
}

/** Lee la fecha de expiración (en segundos) del payload del JWT. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const exp = tokenExpiry(token);
  // Un token sin fecha legible se trata como inválido.
  return exp === null || exp * 1000 <= now + 5000;
}

function readUser(): User | null {
  const raw = readStorage(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenState = signal<string | null>(readStorage(TOKEN_KEY));
  private readonly userState = signal<User | null>(readUser());

  readonly user = this.userState.asReadonly();

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(tap((response) => this.saveSession(response)));
  }

  /** Cierra la sesión y vuelve al login. */
  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  /** Token vigente o null; si expiró, limpia la sesión. */
  getToken(): string | null {
    const token = this.tokenState();
    if (!token) {
      return null;
    }
    if (isTokenExpired(token)) {
      this.clearSession();
      return null;
    }
    return token;
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  hasRole(role: Role): boolean {
    return this.isLoggedIn() && this.userState()?.role === role;
  }

  private saveSession(response: LoginResponse): void {
    writeStorage(TOKEN_KEY, response.accessToken);
    writeStorage(USER_KEY, JSON.stringify(response.user));
    this.tokenState.set(response.accessToken);
    this.userState.set(response.user);
  }

  private clearSession(): void {
    writeStorage(TOKEN_KEY, null);
    writeStorage(USER_KEY, null);
    this.tokenState.set(null);
    this.userState.set(null);
  }
}