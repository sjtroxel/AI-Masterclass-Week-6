import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav';
import { SidebarNavComponent } from './shared/components/sidebar-nav/sidebar-nav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent, SidebarNavComponent],
  template: `
    <div class="min-h-screen bg-space-950 text-white font-sans md:flex">
      <!-- Desktop sidebar (hidden on mobile) -->
      <app-sidebar-nav />

      <!-- Main content -->
      <main class="flex-1 min-w-0">
        <router-outlet />
      </main>

      <!-- Mobile bottom nav (hidden on desktop) -->
      <app-bottom-nav />
    </div>
  `,
})
export class App {}
