import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'planificacion',
    loadComponent: () =>
      import('./planificacion/planificacion.page').then(
        (m) => m.PlanificacionPage
      ),
  },
  {
    path: 'horarios',
    loadComponent: () =>
      import('./horarios/horarios.page').then((m) => m.HorariosPage),
  },
  {
    path: 'tramites',
    loadComponent: () =>
      import('./tramites/tramites.page').then((m) => m.TramitesPage),
  },
  {
    path: 'calendario',
    loadComponent: () =>
      import('./calendario/calendario.page').then(
        (m) => m.CalendarioPage
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin.page').then((m) => m.AdminPage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];