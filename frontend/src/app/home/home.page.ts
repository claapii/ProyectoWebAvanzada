import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
  private readonly http = inject(HttpClient);

  readonly respuestaCursos = signal('');
  readonly errorCursos = signal('');

  consultarCursos() {
    this.errorCursos.set('');

    this.http.get<unknown[]>('http://localhost:3000/courses').subscribe({
      next: (cursos) => {
        this.respuestaCursos.set(JSON.stringify(cursos, null, 2));
      },
      error: () => {
        this.respuestaCursos.set('');
        this.errorCursos.set('No fue posible consultar los cursos.');
      },
    });
  }

  irAPlanificacion() {
    this.router.navigate(['/planificacion']);
  }

  irAHorarios() {
    this.router.navigate(['/horarios']);
  }

  irATramites() {
    this.router.navigate(['/tramites']);
  }

  irACalendario() {
    this.router.navigate(['/calendario']);
  }
}