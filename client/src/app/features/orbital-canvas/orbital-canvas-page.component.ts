import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, type AsteroidWithOrbital } from '../../core/api.service.js';
import {
  OrbitalCanvasComponent,
  type OrbitalAsteroid,
} from './orbital-canvas.component.js';

@Component({
  selector: 'app-orbital-canvas-page',
  standalone: true,
  imports: [OrbitalCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950 pb-24 md:pb-8">

      <!-- Header -->
      <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
        <h1 class="text-lg font-bold text-white md:text-xl">Orbital Canvas</h1>
        <p class="text-xs text-space-400 mt-0.5">
          Inner solar system — {{ orbitalAsteroids().length }} asteroid{{ orbitalAsteroids().length === 1 ? '' : 's' }} plotted
        </p>
      </header>

      <div class="px-4 py-4 md:px-8 md:py-5 space-y-4">

        <!-- Canvas -->
        @if (loadError()) {
          <div class="bg-hazard-500/10 border border-hazard-500/30 rounded-xl p-5">
            <p class="text-sm text-hazard-400">Failed to load asteroid data.</p>
            <p class="text-xs text-space-300 mt-1">{{ loadError() }}</p>
          </div>
        } @else {
          <app-orbital-canvas
            [asteroids]="orbitalAsteroids()"
            (asteroidSelected)="onAsteroidSelected($event)" />
        }

        <!-- Legend note -->
        <div>
          <p class="text-[10px] text-space-500">
            Orbit colors: purple = Apollo · pink = Aten · emerald = Amor · blue = MBA · green dot = current position
          </p>
        </div>

        <!-- Tap to select hint -->
        @if (selectedId()) {
          <div class="bg-space-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p class="text-xs text-space-400">Selected asteroid</p>
              <p class="text-sm font-semibold text-white font-mono">{{ selectedId() }}</p>
            </div>
            <button
              (click)="navigateToDossier()"
              class="px-4 py-2 bg-nebula-600 hover:bg-nebula-500 text-white text-xs
                     font-semibold rounded-lg transition-colors min-h-[44px]">
              View Dossier
            </button>
          </div>
        }

        @if (loading()) {
          <div class="flex items-center gap-2 text-xs text-space-400">
            <div class="w-4 h-4 rounded-full border-2 border-nebula-500 border-t-transparent
                        animate-spin shrink-0"></div>
            Loading asteroid orbits…
          </div>
        }

      </div>
    </div>
  `,
})
export class OrbitalCanvasPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly details = signal<AsteroidWithOrbital[]>([]);
  readonly selectedId = signal<string | null>(null);

  readonly orbitalAsteroids = computed<OrbitalAsteroid[]>(() =>
    this.details()
      .filter(
        (d) =>
          d.semi_major_axis_au !== null &&
          d.eccentricity !== null &&
          d.inclination_deg !== null,
      )
      .map((d): OrbitalAsteroid => {
        const a = d.semi_major_axis_au;
        const orbitClass =
          a === null ? 'Apollo' :
          a < 1.0 ? 'Aten' :
          a < 2.0 ? 'Apollo' :
          a < 2.5 ? 'Amor' :
          a < 4.2 ? 'MBA' : 'OMB';
        return {
          id: d.nasa_id,
          name: d.name ?? d.designation ?? d.nasa_id,
          orbitClass,
          meanAnomalyDeg: d.mean_anomaly_deg,
          elements: {
            semiMajorAxis: d.semi_major_axis_au!,
            eccentricity: d.eccentricity!,
            inclination: d.inclination_deg!,
            longitudeAscNode: d.longitude_asc_node_deg ?? 0,
            argPerihelion: d.argument_perihelion_deg ?? 0,
          },
        };
      }),
  );

  ngOnInit(): void {
    this.loadAsteroids();
  }

  onAsteroidSelected(id: string): void {
    this.selectedId.set(id);
  }

  navigateToDossier(): void {
    const id = this.selectedId();
    if (id) void this.router.navigate(['/dossier', id]);
  }

  private loadAsteroids(): void {
    this.loading.set(true);
    this.api
      .listAsteroidsWithOrbital(1, 20, {
        nhats_accessible: true,
        sort_by: 'nhats_min_delta_v_kms',
        sort_dir: 'asc',
      })
      .subscribe({
        next: (resp) => {
          this.details.set(resp.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          const e = err as { message?: string };
          this.loadError.set(e?.message ?? 'Failed to load asteroids');
          this.loading.set(false);
        },
      });
  }
}
