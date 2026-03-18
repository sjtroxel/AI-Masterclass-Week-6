import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import type { PhaListItem, UpcomingApproach } from '../../core/api.service';
import { formatMissDistance, formatDate, daysUntil } from './defense-utils.js';
export { formatMissDistance, formatDate, daysUntil };

type ActiveTab = 'pha' | 'upcoming';
type DaysFilter = 30 | 90 | 365;

@Component({
  selector: 'app-defense-watch',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950">

      <!-- Page header -->
      <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 p-2 rounded-lg bg-red-950/60 border border-red-800/50">
            <svg class="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-white md:text-2xl">Planetary Defense Watch</h1>
            <p class="text-space-300 text-sm mt-0.5">
              Real data on potentially hazardous asteroids and upcoming close approaches
            </p>
          </div>
        </div>

        <!-- Apophis featured link -->
        <a routerLink="/defense/apophis"
           class="mt-4 flex items-center justify-between gap-3
                  bg-amber-950/40 border border-amber-700/50 rounded-xl
                  px-4 py-3 hover:bg-amber-950/60 transition-colors group
                  min-h-[44px]">
          <div class="flex items-center gap-3">
            <div class="p-1.5 rounded-lg bg-amber-900/60">
              <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-amber-300">Apophis 2029 — Featured Case Study</p>
              <p class="text-xs text-amber-500/80">April 13, 2029 · 38,017 km flyby · Inside geostationary orbit</p>
            </div>
          </div>
          <svg class="w-4 h-4 text-amber-500 group-hover:text-amber-300 shrink-0 transition-colors"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </header>

      <!-- Tab bar -->
      <div class="flex gap-0 border-b border-space-800 bg-space-900/30 px-4 md:px-8">
        <button
          (click)="activeTab.set('pha')"
          [class.text-white]="activeTab() === 'pha'"
          [class.border-nebula-400]="activeTab() === 'pha'"
          [class.text-space-400]="activeTab() !== 'pha'"
          [class.border-transparent]="activeTab() !== 'pha'"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] -mb-px">
          PHAs
          @if (phaCount() !== null) {
            <span class="ml-1.5 text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded-full">
              {{ phaCount() }}
            </span>
          }
        </button>
        <button
          (click)="activeTab.set('upcoming')"
          [class.text-white]="activeTab() === 'upcoming'"
          [class.border-nebula-400]="activeTab() === 'upcoming'"
          [class.text-space-400]="activeTab() !== 'upcoming'"
          [class.border-transparent]="activeTab() !== 'upcoming'"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px] -mb-px">
          Upcoming Approaches
        </button>
      </div>

      <!-- PHA tab content -->
      @if (activeTab() === 'pha') {
        <div class="px-4 py-4 md:px-8">

          @if (phaLoading()) {
            <div class="flex items-center justify-center py-16">
              <div class="text-space-400 text-sm">Loading PHA data…</div>
            </div>
          } @else if (phaError()) {
            <div class="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-4 text-sm text-red-300">
              Failed to load PHA list. Please try again.
            </div>
          } @else {
            <p class="text-xs text-space-400 mb-4">
              {{ phaCount() }} potentially hazardous asteroids · sorted by next approach date
            </p>
            <div class="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              @for (pha of phas(); track pha.nasa_id) {
                <div class="bg-space-900 border border-space-700 rounded-xl p-4
                            hover:border-space-600 transition-colors">
                  <div class="flex items-start justify-between gap-2 mb-3">
                    <div class="min-w-0">
                      <h3 class="text-sm font-semibold text-white truncate">
                        {{ pha.name ?? pha.full_name ?? pha.nasa_id }}
                      </h3>
                      <p class="text-xs text-space-400 mt-0.5 truncate">{{ pha.full_name ?? pha.nasa_id }}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      @if (pha.is_sentry_object) {
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full
                                     bg-red-900/70 text-red-300 border border-red-700/50 uppercase tracking-wide">
                          Sentry
                        </span>
                      }
                      @if (pha.hazard_rating) {
                        <span [class]="hazardBadgeClass(pha.hazard_rating)"
                              class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {{ pha.hazard_rating }}
                        </span>
                      }
                    </div>
                  </div>

                  <dl class="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt class="text-space-400">Next Approach</dt>
                      <dd class="text-white mt-0.5 font-medium">{{ formatDate(pha.next_approach_date) }}</dd>
                      @if (daysUntilApproach(pha.next_approach_date) !== null) {
                        <dd class="text-space-400 mt-0.5">
                          in {{ daysUntilApproach(pha.next_approach_date) }} days
                        </dd>
                      }
                    </div>
                    <div>
                      <dt class="text-space-400">Miss Distance</dt>
                      <dd class="text-white mt-0.5 font-medium">{{ formatMissDistance(pha.next_approach_miss_km) }}</dd>
                    </div>
                    <div>
                      <dt class="text-space-400">Diameter</dt>
                      <dd class="text-white mt-0.5">
                        @if (pha.diameter_min_km !== null && pha.diameter_max_km !== null) {
                          {{ pha.diameter_min_km.toFixed(2) }}–{{ pha.diameter_max_km.toFixed(2) }} km
                        } @else {
                          —
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="text-space-400">MOID</dt>
                      <dd class="text-white mt-0.5">
                        @if (pha.min_orbit_intersection_au !== null) {
                          {{ pha.min_orbit_intersection_au.toFixed(4) }} AU
                        } @else {
                          —
                        }
                      </dd>
                    </div>
                  </dl>

                  <div class="mt-3 flex gap-2">
                    <a [routerLink]="['/dossier', pha.nasa_id]"
                       class="flex-1 text-center text-xs py-2 px-3 rounded-lg
                              bg-space-800 hover:bg-space-700 text-space-300 hover:text-white
                              transition-colors min-h-9 flex items-center justify-center">
                      Dossier
                    </a>
                    <a [routerLink]="['/analysis', pha.nasa_id]"
                       class="flex-1 text-center text-xs py-2 px-3 rounded-lg
                              bg-nebula-900/50 hover:bg-nebula-800/60 text-nebula-300 hover:text-nebula-200
                              border border-nebula-700/40 transition-colors
                              min-h-9 flex items-center justify-center">
                      Analysis
                    </a>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Upcoming Approaches tab content -->
      @if (activeTab() === 'upcoming') {
        <div class="px-4 py-4 md:px-8">

          <!-- Days filter pills -->
          <div class="flex gap-2 mb-4">
            @for (d of dayOptions; track d) {
              <button
                (click)="setDaysFilter(d)"
                [class.bg-nebula-700]="selectedDays() === d"
                [class.text-white]="selectedDays() === d"
                [class.border-nebula-500]="selectedDays() === d"
                [class.bg-space-800]="selectedDays() !== d"
                [class.text-space-300]="selectedDays() !== d"
                [class.border-space-600]="selectedDays() !== d"
                class="px-3 py-1.5 rounded-full text-xs font-medium border
                       transition-colors min-h-9">
                {{ d }}d
              </button>
            }
          </div>

          @if (upcomingLoading()) {
            <div class="flex items-center justify-center py-16">
              <div class="text-space-400 text-sm">Loading approach data…</div>
            </div>
          } @else if (upcomingError()) {
            <div class="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-4 text-sm text-red-300">
              Failed to load upcoming approaches. Please try again.
            </div>
          } @else if (upcomingApproaches().length === 0) {
            <div class="rounded-xl border border-space-700 bg-space-900/50 px-4 py-8 text-center">
              <p class="text-space-300 text-sm">No close approaches in the next {{ selectedDays() }} days.</p>
            </div>
          } @else {
            <p class="text-xs text-space-400 mb-4">
              {{ upcomingApproaches().length }} approaches in the next {{ selectedDays() }} days
            </p>
            <div class="space-y-2">
              @for (approach of upcomingApproaches(); track approach.nasa_id + approach.next_approach_date) {
                <a [routerLink]="['/dossier', approach.nasa_id]"
                   class="flex items-center gap-3 bg-space-900 border border-space-700 rounded-xl
                          px-4 py-3 hover:border-space-600 hover:bg-space-800/50
                          transition-colors group min-h-[44px]">

                  <!-- Date badge -->
                  <div class="text-center shrink-0 w-12">
                    <p class="text-[10px] text-space-400 uppercase tracking-wide leading-none">
                      {{ approachMonth(approach.next_approach_date) }}
                    </p>
                    <p class="text-lg font-bold text-white leading-tight">
                      {{ approachDay(approach.next_approach_date) }}
                    </p>
                    <p class="text-[10px] text-space-400 leading-none">
                      {{ approachYear(approach.next_approach_date) }}
                    </p>
                  </div>

                  <!-- Divider -->
                  <div class="w-px h-10 bg-space-700 shrink-0"></div>

                  <!-- Asteroid info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-medium text-white truncate">
                        {{ approach.name ?? approach.full_name ?? approach.nasa_id }}
                      </p>
                      @if (approach.is_pha) {
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                     bg-red-900/60 text-red-400 border border-red-800/40
                                     shrink-0 uppercase tracking-wide">
                          PHA
                        </span>
                      }
                      @if (approach.is_sentry_object) {
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                     bg-orange-900/60 text-orange-400 border border-orange-800/40
                                     shrink-0 uppercase tracking-wide">
                          Sentry
                        </span>
                      }
                    </div>
                    <p class="text-xs text-space-400 mt-0.5">
                      Miss: {{ formatMissDistance(approach.next_approach_miss_km) }}
                      @if (approach.diameter_max_km !== null) {
                        · {{ approach.diameter_max_km.toFixed(2) }} km dia.
                      }
                    </p>
                  </div>

                  <!-- Chevron -->
                  <svg class="w-4 h-4 text-space-600 group-hover:text-space-400 shrink-0 transition-colors"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              }
            </div>
          }
        </div>
      }

    </div>
  `,
})
export class DefenseWatchComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly activeTab = signal<ActiveTab>('pha');
  readonly selectedDays = signal<DaysFilter>(365);

  readonly phaLoading = signal(true);
  readonly phaError = signal(false);
  readonly phas = signal<PhaListItem[]>([]);
  readonly phaCount = computed(() => this.phas().length || null);

  readonly upcomingLoading = signal(false);
  readonly upcomingError = signal(false);
  readonly upcomingApproaches = signal<UpcomingApproach[]>([]);

  readonly dayOptions: DaysFilter[] = [30, 90, 365];

  readonly formatDate = formatDate;
  readonly formatMissDistance = formatMissDistance;

  ngOnInit(): void {
    this.loadPhas();
    this.loadUpcoming(365);
  }

  setDaysFilter(days: DaysFilter): void {
    this.selectedDays.set(days);
    this.loadUpcoming(days);
  }

  daysUntilApproach(date: string | null): number | null {
    return daysUntil(date);
  }

  approachMonth(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
  }

  approachDay(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric' });
  }

  approachYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric' });
  }

  hazardBadgeClass(rating: string): string {
    const map: Record<string, string> = {
      high:       'bg-red-900/70 text-red-300 border border-red-700/50',
      elevated:   'bg-orange-900/70 text-orange-300 border border-orange-700/50',
      moderate:   'bg-yellow-900/70 text-yellow-300 border border-yellow-700/50',
      low:        'bg-blue-900/70 text-blue-300 border border-blue-700/50',
      negligible: 'bg-space-800 text-space-300 border border-space-600',
      none:       'bg-space-800 text-space-400 border border-space-700',
    };
    return map[rating] ?? 'bg-space-800 text-space-400 border border-space-700';
  }

  private loadPhas(): void {
    this.phaLoading.set(true);
    this.phaError.set(false);
    this.api.getPhaList().subscribe({
      next: (res) => {
        this.phas.set(res.data);
        this.phaLoading.set(false);
      },
      error: () => {
        this.phaError.set(true);
        this.phaLoading.set(false);
      },
    });
  }

  private loadUpcoming(days: number): void {
    this.upcomingLoading.set(true);
    this.upcomingError.set(false);
    this.api.getUpcomingApproaches(days).subscribe({
      next: (res) => {
        this.upcomingApproaches.set(res.data);
        this.upcomingLoading.set(false);
      },
      error: () => {
        this.upcomingError.set(true);
        this.upcomingLoading.set(false);
      },
    });
  }
}
