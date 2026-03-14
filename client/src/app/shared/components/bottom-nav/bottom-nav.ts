import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string; // SVG path data
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <!-- Mobile bottom nav — visible below md breakpoint -->
    <nav class="fixed bottom-0 left-0 right-0 z-50 block md:hidden
                bg-space-900 border-t border-space-700
                safe-area-pb">
      <ul class="flex items-stretch justify-around h-16">
        @for (item of navItems; track item.route) {
          <li class="flex-1">
            <a [routerLink]="item.route"
               routerLinkActive="text-nebula-400"
               [routerLinkActiveOptions]="{ exact: item.route === '/' }"
               class="flex flex-col items-center justify-center gap-1
                      min-h-[44px] w-full h-full
                      text-space-600 hover:text-nebula-400
                      transition-colors duration-150
                      text-[10px] font-medium tracking-wide uppercase">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round"
                   aria-hidden="true">
                <path [attr.d]="item.icon" />
              </svg>
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
    </nav>

    <!-- Spacer so content isn't hidden behind the nav on mobile -->
    <div class="h-16 block md:hidden" aria-hidden="true"></div>
  `,
})
export class BottomNavComponent {
  readonly navItems: NavItem[] = [
    {
      label: 'Search',
      route: '/search',
      // magnifying glass
      icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
    },
    {
      label: 'Analysis',
      route: '/analysis',
      // cpu / chip
      icon: 'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
    },
    {
      label: 'Analyst',
      route: '/analyst',
      // chat bubble
      icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
    },
    {
      label: 'Defense',
      route: '/defense',
      // shield
      icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    },
  ];
}
