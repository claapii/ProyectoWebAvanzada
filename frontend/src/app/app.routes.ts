import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'planificacion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./planificacion/planificacion.page').then(
        (m) => m.PlanificacionPage,
      ),
  },
  {
    path: 'horarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./horarios/horarios.page').then((m) => m.HorariosPage),
  },
  {
    path: 'tramites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./tramites/tramites.page').then((m) => m.TramitesPage),
  },
  {
    path: 'calendario',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./calendario/calendario.page').then((m) => m.CalendarioPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/admin.page').then((m) => m.AdminPage),
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];