import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
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