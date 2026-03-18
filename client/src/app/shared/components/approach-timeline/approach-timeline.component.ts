import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

// ── Input type ────────────────────────────────────────────────────────────────
// Structural subset compatible with CloseApproach (shared/types.d.ts) and with
// RiskOutput.planetaryDefense.notableApproaches from api.service.ts.
export interface TimelineApproach {
  close_approach_date: string;  // ISO date string
  miss_distance_km: number;
  relative_velocity_km_s?: number | null;
  orbiting_body?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtDist(km: number): string {
  if (km < 1_000)      return `${km.toFixed(0)} km`;
  if (km < 1_000_000)  return `${(km / 1000).toFixed(1)}k km`;
  return `${(km / 1_000_000).toFixed(2)}M km`;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-approach-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sorted().length === 0) {
      <p class="text-center py-6 text-space-500 text-sm">No close approach data available.</p>
    } @else {
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="border-b border-space-700">
              <th class="text-left text-[10px] text-space-400 uppercase tracking-wider pb-2 pr-4 font-medium">Date</th>
              <th class="text-right text-[10px] text-space-400 uppercase tracking-wider pb-2 pr-4 font-medium">Miss Distance</th>
              @if (hasVelocity()) {
                <th class="text-right text-[10px] text-space-400 uppercase tracking-wider pb-2 pr-4 font-medium">Velocity</th>
              }
              @if (hasOrbitingBody()) {
                <th class="text-right text-[10px] text-space-400 uppercase tracking-wider pb-2 font-medium">Body</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (a of sorted(); track a.close_approach_date) {
              <tr class="border-b border-space-800/60 last:border-0">
                <td class="py-2 pr-4 text-white font-medium whitespace-nowrap">
                  {{ formatDateLong(a.close_approach_date) }}
                </td>
                <td class="py-2 pr-4 text-right font-mono whitespace-nowrap" [class]="distColor(a.miss_distance_km)">
                  {{ formatDist(a.miss_distance_km) }}
                </td>
                @if (hasVelocity()) {
                  <td class="py-2 pr-4 text-right font-mono text-space-300 whitespace-nowrap">
                    @if (a.relative_velocity_km_s) {
                      {{ a.relative_velocity_km_s.toFixed(2) }} km/s
                    } @else {
                      —
                    }
                  </td>
                }
                @if (hasOrbitingBody()) {
                  <td class="py-2 text-right text-space-400 whitespace-nowrap">
                    {{ a.orbiting_body ?? '—' }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class ApproachTimelineComponent {
  readonly approaches = input<TimelineApproach[]>([]);

  // Sorted ascending by date
  readonly sorted = computed(() =>
    [...this.approaches()].sort(
      (a, b) =>
        new Date(a.close_approach_date).getTime() -
        new Date(b.close_approach_date).getTime(),
    )
  );

  readonly hasVelocity = computed(() =>
    this.sorted().some(a => a.relative_velocity_km_s != null)
  );

  readonly hasOrbitingBody = computed(() =>
    this.sorted().some(a => a.orbiting_body != null)
  );

  // Template helpers
  formatDateLong(iso: string): string { return fmtDateLong(iso); }
  formatDist(km: number): string { return fmtDist(km); }

  distColor(km: number): string {
    if (km < 50_000)    return 'text-amber-300';
    if (km < 500_000)   return 'text-orange-300';
    if (km < 2_000_000) return 'text-blue-300';
    return 'text-space-300';
  }
}
