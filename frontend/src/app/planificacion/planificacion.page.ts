import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBadge,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ApiService } from '../core/api.service';
import { describeError } from '../core/auth.interceptor';
import { Course } from '../core/model';

interface GrupoSemestre {
  semestre: number;
  cursos: Course[];
}

@Component({
  selector: 'app-planificacion',
  templateUrl: 'planificacion.page.html',
  styleUrls: ['planificacion.page.scss'],
  imports: [
    DatePipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonBadge,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonText,
  ],
})
export class PlanificacionPage {
  private readonly api = inject(ApiService);

  readonly semestres = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly cursos = signal<Course[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly semestre = signal<number | null>(null);
  readonly busqueda = signal('');

  /** Cursos agrupados por semestre sugerido. */
  readonly grupos = computed<GrupoSemestre[]>(() => {
    const porSemestre = new Map<number, Course[]>();
    for (const curso of this.cursos()) {
      const lista = porSemestre.get(curso.suggestedSemester) ?? [];
      lista.push(curso);
      porSemestre.set(curso.suggestedSemester, lista);
    }
    return [...porSemestre.entries()]
      .sort(([a], [b]) => a - b)
      .map(([semestre, cursos]) => ({ semestre, cursos }));
  });

  /** Fuente y fecha de la información mostrada (procedencia visible). */
  readonly procedencia = computed(() => {
    const conFuente = this.cursos().find((c) => c.source);
    if (!conFuente?.source) {
      return null;
    }
    const fechas = this.cursos()
      .map((c) => c.lastSeenAt)
      .filter((f): f is string => f !== null)
      .sort();
    return {
      fuente: conFuente.source,
      actualizado: fechas.length > 0 ? fechas[fechas.length - 1] : null,
    };
  });

  constructor() {
    this.cargar();
  }

  cambiarSemestre(valor: unknown) {
    this.semestre.set(typeof valor === 'number' ? valor : null);
    this.cargar();
  }

  buscar(evento: Event) {
    const valor = (evento as CustomEvent<{ value?: string | null }>).detail
      .value;
    this.busqueda.set(valor ?? '');
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set('');

    this.api
      .getCourses({
        semester: this.semestre() ?? undefined,
        q: this.busqueda(),
      })
      .subscribe({
        next: (cursos) => {
          this.cursos.set(cursos);
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          this.cursos.set([]);
          this.error.set(describeError(err));
          this.cargando.set(false);
        },
      });
  }
}