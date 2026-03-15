import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/search',
    pathMatch: 'full',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'dossier',
    loadComponent: () =>
      import('./features/dossier/dossier.component').then((m) => m.DossierComponent),
  },
  {
    path: 'dossier/:id',
    loadComponent: () =>
      import('./features/dossier/dossier.component').then((m) => m.DossierComponent),
  },
  // Phase 5+ routes — placeholder components until those phases ship
  {
    path: 'analysis',
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'analyst',
    loadComponent: () =>
      import('./features/analyst-chat/analyst-chat.component').then(
        (m) => m.AnalystChatComponent,
      ),
  },
  {
    path: 'defense',
    loadComponent: () =>
      import('./features/search/search.component').then((m) => m.SearchComponent),
  },
  {
    path: '**',
    redirectTo: '/search',
  },
];
