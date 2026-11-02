import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ApiService, IngestionRun } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { describeError } from '../core/auth.interceptor';
import { IngestionResult, IngestionStatus } from '../core/model';

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  imports: [
    DatePipe,
    DecimalPipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonButton,
    IonSpinner,
    IonText,
  ],
})
export class AdminPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly ejecutando = signal(false);
  readonly error = signal('');
  readonly resultado = signal<IngestionResult | null>(null);
  readonly historial = signal<IngestionRun[]>([]);

  constructor() {
    this.cargarHistorial();
  }

  ejecutarIngesta() {
    this.ejecutando.set(true);
    this.error.set('');
    this.resultado.set(null);

    this.api.runCurriculumIngestion().subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.ejecutando.set(false);
        this.cargarHistorial();
      },
      error: (err: unknown) => {
        this.error.set(describeError(err));
        this.ejecutando.set(false);
        this.cargarHistorial();
      },
    });
  }

  cargarHistorial() {
    this.api.getIngestionRuns(10).subscribe({
      next: (runs) => this.historial.set(runs),
      error: () => this.historial.set([]),
    });
  }

  cerrarSesion() {
    this.auth.logout();
  }

  colorEstado(estado: IngestionStatus): string {
    switch (estado) {
      case 'SUCCESS':
        return 'success';
      case 'DEGRADED':
        return 'warning';
      default:
        return 'danger';
    }
  }

  etiquetaEstado(estado: IngestionStatus): string {
    switch (estado) {
      case 'SUCCESS':
        return 'Correcta';
      case 'DEGRADED':
        return 'Degradada (copia en caché)';
      default:
        return 'Fallida';
    }
  }
}