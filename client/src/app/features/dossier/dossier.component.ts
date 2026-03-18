import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ApiService, type AsteroidDetail, type DefenseRiskResponse } from '../../core/api.service';
import {
  ApproachTimelineComponent,
  type TimelineApproach,
} from '../../shared/components/approach-timeline/approach-timeline.component.js';
import {
  OrbitalCanvasComponent,
  asteroidDetailToOrbital,
  type OrbitalAsteroid,
} from '../orbital-canvas/orbital-canvas.component';

@Component({
  selector: 'app-dossier',
  standalone: true,
  imports: [RouterLink, OrbitalCanvasComponent, ApproachTimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Empty state when accessed directly without an id -->
    @if (!id()) {
      <div class="min-h-screen bg-space-950 flex flex-col items-center justify-center
                  px-6 text-center">
        <svg class="w-16 h-16 text-space-600 mb-4" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <h1 class="text-xl font-bold text-white mb-2">No asteroid selected</h1>
        <p class="text-space-300 text-sm mb-6 max-w-xs">
          Search for an asteroid to view its full dossier.
        </p>
        <a routerLink="/search"
           class="px-5 py-2.5 bg-nebula-600 hover:bg-nebula-500 text-white text-sm font-medium
                  rounded-lg transition-colors min-h-[44px] flex items-center">
          Go to Search
        </a>
      </div>
    }

    <!-- Dossier content -->
    @if (id()) {
      <div class="min-h-screen bg-space-950">

        <!-- Loading state -->
        @if (isLoading()) {
          <div class="px-4 pt-6 pb-4 md:px-8 md:pt-8">
            <div class="animate-pulse space-y-4">
              <div class="h-7 bg-space-800 rounded w-2/3"></div>
              <div class="h-4 bg-space-800 rounded w-1/3"></div>
              <div class="h-px bg-space-700 my-6"></div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                @for (_ of [1,2,3,4]; track $index) {
                  <div class="bg-space-900 rounded-xl p-4 space-y-2">
                    <div class="h-3 bg-space-800 rounded w-1/2"></div>
                    <div class="h-5 bg-space-800 rounded w-3/4"></div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Error state -->
        @if (error() && !isLoading()) {
          <div class="px-4 pt-8 md:px-8">
            <div class="rounded-lg bg-hazard-500/10 border border-hazard-500/30 p-6 text-center">
              <p class="text-hazard-400 font-medium mb-4">{{ error() }}</p>
              <a routerLink="/search"
                 class="text-sm text-nebula-400 hover:text-nebula-300 transition-colors">
                Back to search
              </a>
            </div>
          </div>
        }

        <!-- Asteroid data -->
        @if (asteroid() && !isLoading()) {
          <!-- Page header -->
          <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
            <div class="flex items-start gap-3 mb-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <a routerLink="/search"
                     class="text-space-400 hover:text-space-200 text-xs transition-colors">
                    ← Search
                  </a>
                </div>
                <h1 class="text-xl font-bold text-white md:text-2xl leading-tight">
                  {{ displayName() }}
                </h1>
                @if (asteroid()!.nasa_id !== displayName()) {
                  <p class="text-space-300 text-sm font-mono mt-0.5">
                    {{ asteroid()!.nasa_id }}
                  </p>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                @if (asteroid()!.is_pha) {
                  <span class="px-3 py-1 rounded-full text-xs font-semibold
                               bg-hazard-500/20 text-hazard-400 border border-hazard-500/30 uppercase tracking-wide">
                    Hazardous
                  </span>
                }
                <!-- Ask Analyst button -->
                <button (click)="openAnalyst()"
                        class="flex items-center gap-1.5 px-3 py-1.5
                               bg-nebula-600/20 hover:bg-nebula-600/30
                               border border-nebula-500/30 hover:border-nebula-500/50
                               text-nebula-400 hover:text-nebula-300
                               rounded-lg text-xs font-medium
                               transition-colors min-h-9">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="1.5"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Ask Analyst
                </button>
              </div>
            </div>
          </header>

          <!-- Stats strip — mobile: 2-col grid; desktop: 4-col -->
          <div class="px-4 py-4 md:px-8 md:py-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-space-800">
            <div class="bg-space-900 rounded-xl p-3 md:p-4">
              <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Spectral Type</p>
              <p class="mt-1 text-base font-mono text-ion-400 font-semibold">{{ spectralType() }}</p>
            </div>
            <div class="bg-space-900 rounded-xl p-3 md:p-4">
              <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Diameter</p>
              <p class="mt-1 text-base font-mono text-white font-semibold">{{ diameter() }}</p>
            </div>
            <div class="bg-space-900 rounded-xl p-3 md:p-4">
              <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Magnitude (H)</p>
              <p class="mt-1 text-base font-mono text-stellar-400 font-semibold">
                {{ asteroid()!.absolute_magnitude_h?.toFixed(1) ?? '—' }}
              </p>
            </div>
            <div class="bg-space-900 rounded-xl p-3 md:p-4">
              <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">NHATS Access</p>
              <p class="mt-1 text-base font-semibold" [class]="accessColor()">{{ accessLabel() }}</p>
            </div>
          </div>

          <!-- Main dossier sections — mobile: stacked; desktop: 2-col -->
          <div class="px-4 py-4 md:px-8 md:py-5 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

            <!-- Orbital data -->
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-4 h-4 text-nebula-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  <path d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.328l5.603 3.113Z" />
                </svg>
                Orbital Elements
              </h2>
              <dl class="space-y-2.5">
                {{ '' }}
                @for (field of orbitalFields(); track field.label) {
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-xs text-space-300 shrink-0">{{ field.label }}</dt>
                    <dd class="text-xs text-white font-mono text-right">{{ field.value }}</dd>
                  </div>
                }
              </dl>
            </section>

            <!-- Close approaches -->
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-4 h-4 text-asteroid-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
                Close Approaches
              </h2>
              <dl class="space-y-2.5">
                @for (field of approachFields(); track field.label) {
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-xs text-space-300 shrink-0">{{ field.label }}</dt>
                    <dd class="text-xs text-white font-mono text-right">{{ field.value }}</dd>
                  </div>
                }
              </dl>
            </section>

            <!-- Composition — pending analysis -->
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-4 h-4 text-plasma-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
                Composition
              </h2>
              @if (asteroid()!.composition_summary) {
                <p class="text-xs text-space-200 leading-relaxed">
                  {{ asteroid()!.composition_summary }}
                </p>
              } @else {
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 py-2">
                    <div class="w-8 h-8 rounded-full bg-space-800 flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-space-500" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                           aria-hidden="true">
                        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    </div>
                    <p class="text-sm font-medium text-space-300">Run agent analysis</p>
                  </div>
                  <a [routerLink]="['/analysis', id()]"
                     class="text-xs text-nebula-400 hover:text-nebula-300 transition-colors
                            min-h-[44px] flex items-center px-2">
                    Analyze →
                  </a>
                </div>
              }
            </section>

            <!-- Economics — pending analysis -->
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-4 h-4 text-stellar-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Resource Economics
              </h2>
              @if (resourceKeyResources().length > 0) {
                <div class="space-y-3">
                  @if (resourceSpectralClass()) {
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-space-400">Spectral class</span>
                      <span class="text-xs font-mono text-white font-semibold">
                        {{ resourceSpectralClass() }}-type
                      </span>
                    </div>
                  }
                  <div class="space-y-2">
                    @for (res of resourceKeyResources().slice(0, 3); track res.resource) {
                      <div>
                        <span class="text-xs text-stellar-400 font-medium">{{ res.resource }}</span>
                        <p class="text-[11px] text-space-200 mt-0.5 leading-relaxed">{{ res.significance }}</p>
                      </div>
                    }
                  </div>
                  <a [routerLink]="['/analysis', id()]"
                     class="text-xs text-stellar-400 hover:text-stellar-300 transition-colors
                            min-h-[44px] flex items-center">
                    Full economics analysis →
                  </a>
                </div>
              } @else {
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 py-2">
                    <div class="w-8 h-8 rounded-full bg-space-800 flex items-center justify-center shrink-0">
                      <svg class="w-4 h-4 text-space-500" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                           aria-hidden="true">
                        <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    </div>
                    <p class="text-sm font-medium text-space-300">Run agent analysis</p>
                  </div>
                  <a [routerLink]="['/analysis', id()]"
                     class="text-xs text-stellar-400 hover:text-stellar-300 transition-colors
                            min-h-[44px] flex items-center px-2">
                    Analyze →
                  </a>
                </div>
              }
            </section>

          </div>

          <!-- Close Approach Timeline -->
          <div class="px-4 pb-4 md:px-8">
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <svg class="w-4 h-4 text-nebula-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
                Close Approach History
              </h2>
              @if (timelineApproaches().length > 0) {
                <app-approach-timeline [approaches]="timelineApproaches()" />
              } @else {
                <div class="flex items-center justify-between gap-4">
                  <p class="text-xs text-space-400">
                    Run an AI analysis to populate this asteroid's notable close approach history.
                  </p>
                  <a [routerLink]="['/analysis', id()]"
                     class="text-xs text-nebula-400 hover:text-nebula-300 transition-colors
                            min-h-[44px] flex items-center px-2 shrink-0">
                    Analyze →
                  </a>
                </div>
              }
            </section>
          </div>

          <!-- NHATS mission details (if accessible) -->
          @if (asteroid()!.nhats_accessible) {
            <div class="px-4 pb-4 md:px-8 md:pb-5">
              <section class="bg-safe-500/10 border border-safe-500/30 rounded-xl p-4 md:p-5">
                <h2 class="text-sm font-semibold text-safe-400 mb-3 flex items-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                       aria-hidden="true">
                    <path d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                  </svg>
                  NHATS Mission Target
                </h2>
                <dl class="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  <div>
                    <dt class="text-[10px] text-space-300 uppercase tracking-wider">Min Delta-V</dt>
                    <dd class="text-sm text-white font-mono mt-0.5">
                      {{ asteroid()!.nhats_min_delta_v_kms?.toFixed(3) ?? '—' }} km/s
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] text-space-300 uppercase tracking-wider">Min Duration</dt>
                    <dd class="text-sm text-white font-mono mt-0.5">
                      {{ asteroid()!.nhats_min_duration_days ?? '—' }} days
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          }

          <!-- Orbital Canvas — shown when orbital elements are available -->
          @if (orbitalAsteroid()) {
            <div class="px-4 pb-6 md:px-8">
              <div class="mb-2 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-white">Orbital View</h2>
                <span class="text-[10px] text-space-500">
                  White orbit = {{ displayName() }} · yellow dot = current epoch position
                </span>
              </div>
              <app-orbital-canvas
                [asteroids]="[orbitalAsteroid()!]"
                [highlightId]="asteroid()!.nasa_id"
                (asteroidSelected)="onOrbitalSelect($event)" />
            </div>
          }

        }
      </div>
    }
  `,
})
export class DossierComponent implements OnInit {
  // Route param from withComponentInputBinding()
  readonly id = input<string | undefined>(undefined);

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly asteroid = signal<AsteroidDetail | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly riskAssessment = signal<DefenseRiskResponse | null>(null);

  readonly timelineApproaches = computed<TimelineApproach[]>(() =>
    this.riskAssessment()?.riskOutput.planetaryDefense.notableApproaches ?? []
  );

  /** Converted orbital data for the canvas — null when orbital elements missing */
  readonly orbitalAsteroid = computed<OrbitalAsteroid | null>(() => {
    const a = this.asteroid();
    if (!a) return null;
    if (a.semi_major_axis_au === null || a.eccentricity === null || a.inclination_deg === null) return null;
    return asteroidDetailToOrbital(a);
  });

  readonly displayName = computed(() => {
    const a = this.asteroid();
    if (!a) return '';
    return a.name ?? a.designation ?? a.nasa_id;
  });

  readonly spectralType = computed(() => {
    const a = this.asteroid();
    return a?.spectral_type_smass ?? a?.spectral_type_tholen ?? '—';
  });

  readonly diameter = computed(() => {
    const a = this.asteroid();
    if (!a) return '—';
    if (a.diameter_min_km !== null && a.diameter_max_km !== null) {
      const avg = (a.diameter_min_km + a.diameter_max_km) / 2;
      return avg < 1
        ? `${(avg * 1000).toFixed(0)} m`
        : `${avg.toFixed(3)} km`;
    }
    return '—';
  });

  readonly accessLabel = computed(() => {
    const a = this.asteroid();
    if (a?.nhats_accessible) return 'Accessible';
    return 'Not accessible';
  });

  readonly accessColor = computed(() =>
    this.asteroid()?.nhats_accessible
      ? 'text-safe-400 font-semibold'
      : 'text-space-400',
  );

  readonly resourceKeyResources = computed<{ resource: string; significance: string }[]>(() => {
    const profile = this.asteroid()?.resource_profile;
    if (!profile) return [];
    const raw = (profile as Record<string, unknown>)['keyResources'];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is { resource: string; significance: string } =>
        typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>)['resource'] === 'string',
    );
  });

  readonly resourceSpectralClass = computed<string | null>(() => {
    const profile = this.asteroid()?.resource_profile;
    if (!profile) return null;
    const sc = (profile as Record<string, unknown>)['spectralClass'];
    if (typeof sc === 'string' && sc !== 'unknown') return sc;
    return null;
  });

  readonly orbitalFields = computed(() => {
    const a = this.asteroid();
    if (!a) return [];
    return [
      { label: 'Semi-major axis', value: a.semi_major_axis_au != null ? `${a.semi_major_axis_au.toFixed(4)} AU` : '—' },
      { label: 'Eccentricity', value: a.eccentricity?.toFixed(6) ?? '—' },
      { label: 'Inclination', value: a.inclination_deg != null ? `${a.inclination_deg.toFixed(4)}°` : '—' },
      { label: 'Orbital period', value: a.orbital_period_yr != null ? `${a.orbital_period_yr.toFixed(3)} yr` : '—' },
      { label: 'Perihelion dist.', value: a.perihelion_distance_au != null ? `${a.perihelion_distance_au.toFixed(4)} AU` : '—' },
      { label: 'Aphelion dist.', value: a.aphelion_distance_au != null ? `${a.aphelion_distance_au.toFixed(4)} AU` : '—' },
      { label: 'MOID', value: a.min_orbit_intersection_au != null ? `${a.min_orbit_intersection_au.toFixed(6)} AU` : '—' },
    ];
  });

  readonly approachFields = computed(() => {
    const a = this.asteroid();
    if (!a) return [];
    return [
      { label: 'Next approach', value: a.next_approach_date ?? '—' },
      { label: 'Next approach dist.', value: a.next_approach_au != null ? `${a.next_approach_au.toFixed(4)} AU` : '—' },
      { label: 'Next miss distance', value: a.next_approach_miss_km != null ? `${a.next_approach_miss_km.toLocaleString()} km` : '—' },
      { label: 'Closest approach', value: a.closest_approach_date ?? '—' },
      { label: 'Closest dist.', value: a.closest_approach_au != null ? `${a.closest_approach_au.toFixed(4)} AU` : '—' },
    ];
  });

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      this.loadAsteroid(id);
    } else {
      const last = localStorage.getItem('lastDossierId');
      if (last) void this.router.navigate(['/dossier', last], { replaceUrl: true });
    }
  }

  openAnalyst(): void {
    const id = this.id();
    void this.router.navigate(['/analyst'], id ? { queryParams: { asteroid: id } } : {});
  }

  onOrbitalSelect(nasaId: string): void {
    // Already on this asteroid's dossier; clicking its marker just confirms we're here
    // In future, could navigate to that asteroid's dossier if showing neighbors
    void nasaId;
  }

  private loadAsteroid(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Fetch risk assessment in parallel; 404 = no analysis yet, handled silently
    this.api.getRiskAssessment(id).subscribe({
      next: (r) => this.riskAssessment.set(r),
      error: () => { /* 404 = no analysis run yet */ },
    });

    this.api.getAsteroid(id).subscribe({
      next: (data) => {
        this.asteroid.set(data);
        this.isLoading.set(false);
        localStorage.setItem('lastDossierId', data.nasa_id);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Failed to load asteroid');
        this.isLoading.set(false);
      },
    });
  }
}
