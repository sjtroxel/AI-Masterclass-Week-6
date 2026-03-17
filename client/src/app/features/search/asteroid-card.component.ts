import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AsteroidListItem, AsteroidSearchResult } from '../../core/api.service';

@Component({
  selector: 'app-asteroid-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="['/dossier', asteroid().nasa_id]"
       class="group block bg-space-900 border border-space-700
              rounded-xl p-4 hover:border-nebula-500 hover:bg-space-800
              transition-all duration-150 min-h-[44px]">

      <!-- Header row -->
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="min-w-0">
          <h3 class="text-white font-semibold text-sm leading-snug truncate
                     group-hover:text-nebula-400 transition-colors">
            {{ displayName() }}
          </h3>
          @if (asteroid().designation && asteroid().designation !== displayName()) {
            <p class="text-space-300 text-xs mt-0.5 font-mono">{{ asteroid().designation }}</p>
          }
        </div>

        <!-- Hazard badge -->
        @if (asteroid().is_pha) {
          <span class="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold
                       bg-hazard-500/20 text-hazard-400 border border-hazard-500/30 uppercase tracking-wide">
            PHA
          </span>
        }
      </div>

      <!-- Data row -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">

        <!-- Spectral type -->
        <div>
          <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Type</p>
          <p class="text-xs text-ion-400 font-mono mt-0.5">
            {{ spectralType() }}
          </p>
        </div>

        <!-- Diameter -->
        <div>
          <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Diameter</p>
          <p class="text-xs text-white font-mono mt-0.5">{{ diameter() }}</p>
        </div>

        <!-- Accessibility -->
        <div>
          <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Access</p>
          <p class="text-xs mt-0.5" [class]="accessColor()">{{ accessLabel() }}</p>
        </div>

        <!-- Economic tier / similarity -->
        <div>
          @if (hasSimilarity()) {
            <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Match</p>
            <p class="text-xs text-plasma-400 font-mono mt-0.5">{{ similarityPct() }}%</p>
          } @else {
            <p class="text-[10px] text-space-300 uppercase tracking-wider font-medium">Econ tier</p>
            <p class="text-xs text-stellar-400 mt-0.5">{{ economicTier() }}</p>
          }
        </div>
      </div>

      <!-- Next approach -->
      @if (asteroid().next_approach_date) {
        <div class="mt-3 pt-3 border-t border-space-700/60 flex items-center gap-1.5">
          <svg class="w-3 h-3 text-space-300 flex-shrink-0" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <p class="text-[10px] text-space-300">
            Next approach: <span class="text-white font-mono">{{ asteroid().next_approach_date }}</span>
          </p>
        </div>
      }
    </a>
  `,
})
export class AsteroidCardComponent {
  readonly asteroid = input.required<AsteroidListItem | AsteroidSearchResult>();

  readonly displayName = computed(() => {
    const a = this.asteroid();
    return a.full_name ?? a.name ?? a.designation ?? a.nasa_id;
  });

  readonly spectralType = computed(() => {
    const a = this.asteroid();
    return a.spectral_type_smass ?? a.spectral_type_tholen ?? '—';
  });

  readonly diameter = computed(() => {
    const a = this.asteroid();
    if (a.diameter_min_km !== null && a.diameter_max_km !== null) {
      const avg = (a.diameter_min_km + a.diameter_max_km) / 2;
      return avg < 1
        ? `${(avg * 1000).toFixed(0)} m`
        : `${avg.toFixed(2)} km`;
    }
    return '—';
  });

  readonly accessLabel = computed(() => {
    const a = this.asteroid();
    if (a.nhats_accessible) {
      const dv = a.nhats_min_delta_v_kms;
      return dv !== null ? `${dv.toFixed(2)} km/s` : 'Accessible';
    }
    return 'Not accessible';
  });

  readonly accessColor = computed(() =>
    this.asteroid().nhats_accessible
      ? 'text-safe-400 font-mono text-xs'
      : 'text-space-400 text-xs',
  );

  readonly economicTier = computed(() => {
    const tier = this.asteroid().economic_tier;
    return tier ?? 'Pending analysis';
  });

  readonly hasSimilarity = computed(() =>
    'similarity' in this.asteroid(),
  );

  readonly similarityPct = computed(() => {
    const a = this.asteroid();
    if ('similarity' in a) {
      return ((a as AsteroidSearchResult).similarity * 100).toFixed(0);
    }
    return '';
  });
}
