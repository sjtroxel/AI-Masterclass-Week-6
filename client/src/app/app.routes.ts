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
    path: 'analysis/:asteroidId',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent),
  },
  {
    path: 'analysis',
    pathMatch: 'full',
    redirectTo: () => {
      const id = localStorage.getItem('lastDossierId');
      return id ? `/analysis/${id}` : '/search';
    },
  },
  {
    path: 'analyst',
    loadComponent: () =>
      import('./features/analyst-chat/analyst-chat.component').then(
        (m) => m.AnalystChatComponent,
      ),
  },
  // Phase 6 — Mission Planning
  {
    path: 'mission-planning',
    loadComponent: () =>
      import('./features/mission-planning/mission-planning.component').then(
        (m) => m.MissionPlanningComponent,
      ),
  },
  // Phase 6 — Orbital Canvas (standalone route for full-screen view)
  {
    path: 'orbital-canvas',
    loadComponent: () =>
      import('./features/orbital-canvas/orbital-canvas-page.component').then(
        (m) => m.OrbitalCanvasPageComponent,
      ),
  },
  // Phase 7 — Planetary Defense Watch
  {
    path: 'defense',
    loadComponent: () =>
      import('./features/defense-watch/defense-watch.component').then(
        (m) => m.DefenseWatchComponent,
      ),
  },
  {
    path: 'defense/apophis',
    loadComponent: () =>
      import('./features/defense-watch/apophis-feature.component').then(
        (m) => m.ApophisFeatureComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '/search',
  },
];
