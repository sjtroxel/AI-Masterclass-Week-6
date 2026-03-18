import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import type { ApophisDetail } from '../../core/api.service';
import {
  OrbitalCanvasComponent,
  type OrbitalAsteroid,
} from '../orbital-canvas/orbital-canvas.component';
import { type OrbitalElements } from '../orbital-canvas/orbit-math.js';
import {
  ApproachTimelineComponent,
  type TimelineApproach,
} from '../../shared/components/approach-timeline/approach-timeline.component';
import { buildCountdown } from './apophis-utils.js';

function apophisToOrbital(d: ApophisDetail): OrbitalAsteroid | null {
  if (
    d.semi_major_axis_au === null ||
    d.eccentricity === null ||
    d.inclination_deg === null
  ) return null;

  const elements: OrbitalElements = {
    semiMajorAxis:  d.semi_major_axis_au,
    eccentricity:   d.eccentricity,
    inclination:    d.inclination_deg,
    longitudeAscNode: 204.4,   // Apophis Ω (J2000) — well-known value
    argPerihelion:    126.4,   // Apophis ω (J2000) — well-known value
  };
  return {
    id:         d.nasa_id,
    name:       d.name ?? 'Apophis',
    orbitClass: 'Aten',
    elements,
    meanAnomalyDeg: null,
  };
}

@Component({
  selector: 'app-apophis-feature',
  standalone: true,
  imports: [RouterLink, OrbitalCanvasComponent, DecimalPipe, ApproachTimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950">

      <!-- ── Hero ─────────────────────────────────────────────── -->
      <div class="relative overflow-hidden bg-linear-to-b from-amber-950/40 via-space-950 to-space-950
                  border-b border-amber-800/30">
        <div class="px-4 pt-8 pb-6 md:px-8 md:pt-12 md:pb-8 max-w-3xl">

          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold px-2 py-0.5 rounded-full
                         bg-amber-900/70 text-amber-300 border border-amber-700/40
                         uppercase tracking-widest">
              Featured Case Study
            </span>
          </div>

          <h1 class="text-3xl font-extrabold text-white tracking-tight md:text-4xl">
            Apophis 2029
          </h1>
          <p class="mt-2 text-lg text-amber-200/80 font-medium">
            The closest pass of a large asteroid in recorded history
          </p>
          <p class="mt-3 text-space-300 text-sm leading-relaxed max-w-xl">
            On April 13, 2029, asteroid 99942 Apophis will pass within
            <strong class="text-white">38,017 km</strong> of Earth — closer than our
            geostationary satellites and visible to the naked eye across Europe, Africa,
            and western Asia.
          </p>

          <!-- Countdown -->
          @if (!countdown().past) {
            <div class="mt-6">
              <p class="text-xs text-space-400 uppercase tracking-widest mb-2">
                Countdown to April 13, 2029
              </p>
              <div class="flex items-end gap-3">
                @for (unit of countdownUnits(); track unit.label) {
                  <div class="text-center">
                    <div class="text-2xl font-mono font-bold text-amber-300 tabular-nums md:text-3xl">
                      {{ unit.value | number:'2.0-0' }}
                    </div>
                    <div class="text-[10px] text-space-400 uppercase tracking-wider mt-0.5">
                      {{ unit.label }}
                    </div>
                  </div>
                  @if (!$last) {
                    <div class="text-amber-600 text-xl font-bold pb-4">:</div>
                  }
                }
              </div>
            </div>
          } @else {
            <div class="mt-6 inline-block px-3 py-1.5 rounded-full
                        bg-space-800 border border-space-600 text-space-300 text-sm">
              The flyby has occurred
            </div>
          }

          <!-- CTAs -->
          <div class="mt-6 flex flex-wrap gap-3">
            <a routerLink="/dossier/99942"
               class="px-4 py-2.5 bg-space-800 hover:bg-space-700 border border-space-600
                      text-white text-sm font-medium rounded-lg transition-colors
                      min-h-[44px] flex items-center gap-2">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Raw Dossier
            </a>
            <a routerLink="/analysis/99942"
               class="px-4 py-2.5 bg-nebula-700 hover:bg-nebula-600 border border-nebula-500
                      text-white text-sm font-medium rounded-lg transition-colors
                      min-h-[44px] flex items-center gap-2">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
              </svg>
              AI Analysis
            </a>
          </div>
        </div>
      </div>

      <!-- ── Key Facts strip ───────────────────────────────────── -->
      <div class="border-b border-space-800 bg-space-900/40 overflow-x-auto">
        <dl class="flex gap-0 min-w-max px-4 py-4 md:px-8">
          @for (fact of keyFacts(); track fact.label) {
            <div class="flex flex-col px-4 py-1 border-r border-space-700 last:border-0 first:pl-0">
              <dt class="text-[10px] text-space-400 uppercase tracking-widest whitespace-nowrap">
                {{ fact.label }}
              </dt>
              <dd class="mt-0.5 text-sm font-semibold text-white whitespace-nowrap">
                {{ fact.value }}
              </dd>
              @if (fact.note) {
                <dd class="text-[10px] text-space-400 whitespace-nowrap">{{ fact.note }}</dd>
              }
            </div>
          }
        </dl>
      </div>

      <div class="px-4 py-6 md:px-8 max-w-3xl space-y-10">

        <!-- ── Orbital Canvas ────────────────────────────────────── -->
        @if (orbitalAsteroid() !== null) {
          <section>
            <h2 class="text-sm font-semibold text-space-300 uppercase tracking-widest mb-3">
              Orbital Path
            </h2>
            <app-orbital-canvas
              [asteroids]="[orbitalAsteroid()!]"
              highlightId="99942"
            />
            <p class="mt-2 text-xs text-space-400">
              Apophis orbit highlighted in white. Aten-class asteroid — crosses Earth's orbit.
            </p>
          </section>
        }

        <!-- ── Discovery ─────────────────────────────────────────── -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-amber-400 tabular-nums">2004</span>
            <div class="flex-1 h-px bg-space-700"></div>
          </div>
          <h2 class="text-lg font-bold text-white mb-2">Discovery and the First Scare</h2>
          <div class="text-sm text-space-300 leading-relaxed space-y-3">
            <p>
              Apophis was discovered on June 19, 2004 by astronomers Roy Tucker,
              David Tholen, and Fabrizio Bernardi at the Kitt Peak National Observatory.
              It was initially catalogued as a routine near-Earth asteroid — until the
              numbers came in.
            </p>
            <p>
              On December 20, 2004, refined orbital calculations gave Apophis a
              <strong class="text-white">2.7% probability of impacting Earth in 2029</strong> —
              the highest impact probability ever recorded for a known asteroid. For a brief
              period it reached a rating of 4 on the Torino Impact Hazard Scale, the highest
              any asteroid has ever reached for more than a few days.
            </p>
            <p>
              The global astronomy community mobilized. Emergency observing campaigns ran at
              telescopes worldwide. Within weeks of its discovery, Apophis became the most
              closely watched asteroid in history.
            </p>
          </div>
        </section>

        <!-- ── Reassessment ──────────────────────────────────────── -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-amber-400 tabular-nums">2005 – 2021</span>
            <div class="flex-1 h-px bg-space-700"></div>
          </div>
          <h2 class="text-lg font-bold text-white mb-2">Relief, Then Final Clarity</h2>
          <div class="text-sm text-space-300 leading-relaxed space-y-3">
            <p>
              In early 2005, additional observations from archival data narrowed
              Apophis's orbit enough to rule out a 2029 impact. The probability collapsed
              to effectively zero. The 2036 and 2068 windows remained technically open
              for years, but each was progressively eliminated as measurements improved.
            </p>
            <p>
              In March 2021, radar observations from the Goldstone Solar System Radar
              and the Arecibo Observatory (before its collapse in 2020) combined with
              optical data to produce definitive trajectory calculations. NASA officially
              ruled out any impact risk from Apophis for at least the next
              <strong class="text-white">100 years</strong>.
            </p>
            <p>
              What remained — confirmed and immovable — was the 2029 flyby. Not a threat.
              A gift.
            </p>
          </div>
        </section>

        <!-- ── 2029 Flyby ─────────────────────────────────────────── -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-amber-400 tabular-nums">April 13, 2029</span>
            <div class="flex-1 h-px bg-space-700"></div>
          </div>
          <h2 class="text-lg font-bold text-white mb-2">The 2029 Flyby</h2>
          <div class="text-sm text-space-300 leading-relaxed space-y-3">
            <p>
              At approximately 21:46 UTC on April 13, 2029, Apophis will pass
              <strong class="text-white">38,017 km</strong> from Earth's center — about
              one-tenth the Moon's distance, and closer than the ring of geostationary
              satellites orbiting at 42,164 km. No asteroid of this size has been
              observed this close in recorded history.
            </p>

            <!-- Stats block -->
            <div class="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              @for (stat of flybyfacts; track stat.label) {
                <div class="bg-space-900 border border-space-700 rounded-xl px-3 py-3">
                  <p class="text-[10px] text-space-400 uppercase tracking-wide">{{ stat.label }}</p>
                  <p class="text-sm font-bold text-white mt-0.5">{{ stat.value }}</p>
                  @if (stat.note) {
                    <p class="text-[10px] text-space-400 mt-0.5">{{ stat.note }}</p>
                  }
                </div>
              }
            </div>

            <p>
              Apophis will be visible to the naked eye — a moving point of light crossing
              the sky over Australia, then over the Indian Ocean, reaching peak brightness
              as it sweeps across Europe and Africa. No telescope required. It will be the
              first time most people alive today have ever seen an asteroid with their own eyes.
            </p>
            <p>
              Earth's gravity will alter Apophis's orbit during the flyby. Astronomers will
              measure the Yarkovsky effect — a tiny but cumulative thermal thrust from
              sunlight — in real time, watching orbital mechanics play out at human timescales.
              What emerges on the far side will be a well-characterized asteroid on a known
              trajectory for decades to come.
            </p>
          </div>
        </section>

        <!-- ── Scientific significance ───────────────────────────── -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold text-amber-400">Why It Matters</span>
            <div class="flex-1 h-px bg-space-700"></div>
          </div>
          <h2 class="text-lg font-bold text-white mb-2">A Landmark for Planetary Defense</h2>
          <div class="text-sm text-space-300 leading-relaxed space-y-3">
            <p>
              Every planetary defense scenario depends on early detection and accurate
              trajectory prediction. Apophis is the first major asteroid that will let
              us test our models against a real, high-stakes pass — in real time, with
              hardware deployed beforehand.
            </p>
            <p>
              Multiple space agencies have proposed or planned missions timed to the flyby.
              The European Space Agency's
              <strong class="text-white">RAMSES</strong> mission is designed to arrive at
              Apophis before the flyby and remain in proximity during the closest approach,
              measuring the asteroid's response to Earth's tidal forces and the gravitational
              keyhole region. NASA's
              <strong class="text-white">OSIRIS-APEX</strong> (the renamed OSIRIS-REx spacecraft)
              will arrive shortly after, sampling fresh surface material disturbed by the flyby.
            </p>
            <p>
              The 2029 encounter will also test the
              <strong class="text-white">gravitational keyhole</strong> concept: a narrow
              corridor in space where a small gravitational nudge during one flyby sets up
              an impact on a subsequent pass. Apophis's well-mapped keyhole for the 2029
              encounter has already been ruled out — but the methodology being validated
              here will define how we handle the next generation of uncertain objects.
            </p>
          </div>
        </section>

        <!-- ── Physical profile ──────────────────────────────────── -->
        @if (data()) {
          <section>
            <div class="flex items-center gap-2 mb-3">
              <span class="text-xs font-bold text-amber-400">The Asteroid</span>
              <div class="flex-1 h-px bg-space-700"></div>
            </div>
            <h2 class="text-lg font-bold text-white mb-3">Physical Profile</h2>
            <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
              @for (field of physicalFields(); track field.label) {
                <div class="bg-space-900 border border-space-700 rounded-xl px-3 py-3">
                  <dt class="text-[10px] text-space-400 uppercase tracking-wide">{{ field.label }}</dt>
                  <dd class="text-white font-semibold mt-0.5">{{ field.value }}</dd>
                </div>
              }
            </dl>
          </section>
        }

        <!-- ── Close Approach Timeline ───────────────────────────── -->
        @if (apophisApproaches().length > 0) {
          <section>
            <div class="flex items-center gap-2 mb-3">
              <span class="text-xs font-bold text-amber-400">Approaches</span>
              <div class="flex-1 h-px bg-space-700"></div>
            </div>
            <h2 class="text-lg font-bold text-white mb-3">Close Approach Data</h2>
            <div class="bg-space-900 border border-space-700 rounded-xl px-3 py-4">
              <app-approach-timeline [approaches]="apophisApproaches()" />
            </div>
          </section>
        }

        <!-- ── Bottom CTAs ───────────────────────────────────────── -->
        <section class="pb-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="flex-1 h-px bg-space-700"></div>
          </div>
          <p class="text-sm text-space-300 mb-4">
            Explore the full orbital data and run the AI agent swarm on Apophis:
          </p>
          <div class="flex flex-wrap gap-3">
            <a routerLink="/dossier/99942"
               class="flex-1 min-w-35 text-center px-4 py-3 bg-space-800 hover:bg-space-700
                      border border-space-600 text-white text-sm font-medium rounded-xl
                      transition-colors min-h-[44px] flex items-center justify-center gap-2">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              View Dossier
            </a>
            <a routerLink="/analysis/99942"
               class="flex-1 min-w-35 text-center px-4 py-3 bg-nebula-800 hover:bg-nebula-700
                      border border-nebula-600 text-nebula-200 hover:text-white text-sm font-medium
                      rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
              Run AI Analysis
            </a>
            <a routerLink="/defense"
               class="text-center px-4 py-3 text-space-400 hover:text-white text-sm
                      transition-colors min-h-[44px] flex items-center gap-2">
              ← Defense Watch
            </a>
          </div>
        </section>

      </div>
    </div>
  `,
})
export class ApophisFeatureComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = signal<ApophisDetail | null>(null);
  readonly loading = signal(true);
  readonly now = signal(Date.now());

  readonly countdown = computed(() => buildCountdown(this.now()));

  readonly countdownUnits = computed(() => {
    const c = this.countdown();
    return [
      { label: 'Days',    value: c.days    },
      { label: 'Hours',   value: c.hours   },
      { label: 'Minutes', value: c.minutes },
      { label: 'Seconds', value: c.seconds },
    ];
  });

  readonly orbitalAsteroid = computed<OrbitalAsteroid | null>(() => {
    const d = this.data();
    return d ? apophisToOrbital(d) : null;
  });

  readonly keyFacts = computed(() => {
    const d = this.data();
    return [
      { label: 'Miss Distance',  value: '38,017 km',  note: 'Inside GEO orbit'  },
      { label: 'Diameter',       value: d ? `${d.diameter_min_km?.toFixed(2) ?? '—'}–${d.diameter_max_km?.toFixed(2) ?? '—'} km` : '~0.34 km', note: null },
      { label: 'Spectral Class', value: d?.spectral_type_smass ?? 'Sq',  note: 'Stony-olivine' },
      { label: 'Flyby Date',     value: 'Apr 13, 2029', note: '~21:46 UTC'       },
      { label: 'NHATS Δv',       value: d?.nhats_min_delta_v_kms ? `${d.nhats_min_delta_v_kms} km/s` : '5.76 km/s', note: 'Human-accessible' },
      { label: 'MOID',           value: d?.min_orbit_intersection_au ? `${d.min_orbit_intersection_au.toFixed(5)} AU` : '0.00021 AU', note: null },
    ];
  });

  readonly physicalFields = computed(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'NASA ID',        value: d.nasa_id },
      { label: 'Full Name',      value: d.full_name ?? '—' },
      { label: 'Spectral Type',  value: d.spectral_type_smass ?? '—' },
      { label: 'Semi-Major Axis', value: d.semi_major_axis_au ? `${d.semi_major_axis_au} AU` : '—' },
      { label: 'Eccentricity',   value: d.eccentricity?.toFixed(4) ?? '—' },
      { label: 'Inclination',    value: d.inclination_deg ? `${d.inclination_deg}°` : '—' },
      { label: 'Orbital Period', value: d.orbital_period_yr ? `${d.orbital_period_yr.toFixed(3)} yr` : '—' },
      { label: 'H Magnitude',    value: d.absolute_magnitude_h?.toFixed(1) ?? '—' },
      { label: 'NHATS Accessible', value: d.nhats_accessible ? 'Yes' : 'No' },
    ];
  });

  readonly apophisApproaches = computed<TimelineApproach[]>(() => {
    const d = this.data();
    if (!d) return [];
    const items: TimelineApproach[] = [];
    // 2029 flyby — the featured event
    if (d.next_approach_date !== null && d.next_approach_miss_km !== null) {
      items.push({
        close_approach_date: d.next_approach_date,
        miss_distance_km: d.next_approach_miss_km,
        relative_velocity_km_s: 7.42, // well-known value for 2029 flyby
        orbiting_body: 'Earth',
      });
    }
    // Closest historical approach (if different from next)
    if (
      d.closest_approach_date !== null &&
      d.closest_approach_au !== null &&
      d.closest_approach_date !== d.next_approach_date
    ) {
      items.push({
        close_approach_date: d.closest_approach_date,
        miss_distance_km: Math.round(d.closest_approach_au * 149_597_870.7),
        orbiting_body: 'Earth',
      });
    }
    return items.sort(
      (a, b) =>
        new Date(a.close_approach_date).getTime() -
        new Date(b.close_approach_date).getTime(),
    );
  });

  readonly flybyfacts = [
    { label: 'Miss Distance',    value: '38,017 km',   note: 'Earth center' },
    { label: 'vs. GEO Orbit',    value: '~4,147 km',   note: 'Inside by this much' },
    { label: 'vs. Moon',         value: '~10× closer', note: 'Moon is 384,400 km' },
    { label: 'Closest Approach', value: '21:46 UTC',   note: 'Apr 13, 2029' },
    { label: 'Visible to Naked Eye', value: 'Yes',     note: 'Magnitude ~3.4' },
    { label: 'Duration Visible', value: '~8 hours',    note: 'Europe, Africa, Asia' },
  ];

  ngOnInit(): void {
    // Live countdown tick
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(tick));

    // Load Apophis data for orbital canvas + physical fields
    this.api.getApophis().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        // Editorial content renders without API data; orbital canvas simply won't show
        this.loading.set(false);
      },
    });
  }
}
