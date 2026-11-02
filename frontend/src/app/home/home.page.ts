import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ApiService } from '../core/api.service';
import { describeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
  ],
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly esAdmin = computed(() => this.user()?.role === 'ADMIN');

  readonly totalCursos = signal<number | null>(null);
  readonly errorCursos = signal('');

  constructor() {
    this.api.getCourses().subscribe({
      next: (cursos) => this.totalCursos.set(cursos.length),
      error: (err: unknown) => this.errorCursos.set(describeError(err)),
    });
  }

  irAPlanificacion() {
    void this.router.navigate(['/planificacion']);
  }

  irAHorarios() {
    void this.router.navigate(['/horarios']);
  }

  irATramites() {
    void this.router.navigate(['/tramites']);
  }

  irACalendario() {
    void this.router.navigate(['/calendario']);
  }

  irAAdmin() {
    void this.router.navigate(['/admin']);
  }

  cerrarSesion() {
    this.auth.logout();
  }
}