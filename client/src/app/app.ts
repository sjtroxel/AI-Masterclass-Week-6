import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent],
  template: `
    <div class="min-h-screen bg-space-950 text-white font-sans">
      <main class="w-full">
        <router-outlet />
      </main>
      <app-bottom-nav />
    </div>
  `,
})
export class App {}
