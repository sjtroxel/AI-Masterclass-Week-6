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
  // Phase 5 — Agent Swarm Analysis
  {
    path: 'analysis/:id',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent),
  },
  {
    path: 'analysis',
    redirectTo: '/search',
    pathMatch: 'full',
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
