import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string; // SVG path data
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Search',
    route: '/search',
    icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  },
  {
    label: 'Dossier',
    route: '/dossier',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    label: 'Analysis',
    route: '/analysis',
    icon: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
  },
  {
    label: 'Analyst',
    route: '/analyst',
    icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
  },
  {
    label: 'Plan',
    route: '/mission-planning',
    icon: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  },
  {
    label: 'Orbital Map',
    route: '/orbital-canvas',
    icon: 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
  },
];

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <!-- Desktop sidebar — hidden on mobile, visible md+ -->
    <aside class="hidden md:flex md:flex-col md:w-56 md:shrink-0
                  md:sticky md:top-0 md:h-screen
                  bg-space-900 border-r border-space-700 overflow-y-auto">

      <!-- Logo / app name -->
      <div class="px-5 py-5 border-b border-space-700">
        <p class="text-[10px] font-semibold tracking-widest uppercase text-space-300">
          Intelligence Platform
        </p>
        <h1 class="mt-0.5 text-stellar-400 font-bold text-base leading-tight tracking-tight">
          Asteroid Bonanza
        </h1>
      </div>

      <!-- Nav items -->
      <nav class="flex-1 p-3 space-y-0.5" aria-label="Main navigation">
        @for (item of navItems; track item.route) {
          <a [routerLink]="item.route"
             routerLinkActive="bg-space-800 text-nebula-400"
             [routerLinkActiveOptions]="{ exact: false }"
             class="flex items-center gap-3 px-3 py-2.5 rounded-lg
                    text-space-300 hover:text-white hover:bg-space-800
                    transition-colors duration-150
                    text-sm font-medium min-h-[44px]">
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
              <path [attr.d]="item.icon" />
            </svg>
            {{ item.label }}
          </a>
        }
      </nav>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-space-700">
        <p class="text-[10px] text-space-400 leading-relaxed">
          Data: NASA NeoWs · JPL SBDB<br>
          AI: Claude Sonnet 4.6
        </p>
      </div>
    </aside>
  `,
})
export class SidebarNavComponent {
  readonly navItems: NavItem[] = NAV_ITEMS;
}
