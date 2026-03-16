import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { type MissionConstraints } from '../../core/api.service.js';
import { MissionPlanningService, type PlanningMode } from './mission-planning.service.js';
import { MissionResultsComponent } from './mission-results.component.js';
import { MissionPortfolioComponent } from './mission-portfolio.component.js';

@Component({
  selector: 'app-mission-planning',
  standalone: true,
  imports: [FormsModule, RouterLink, MissionResultsComponent, MissionPortfolioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950 pb-24 md:pb-8">

      <!-- Header -->
      <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
        <h1 class="text-lg font-bold text-white md:text-xl">Mission Planning</h1>
        <p class="text-xs text-space-400 mt-0.5">
          Score and rank asteroids for mission feasibility
        </p>
      </header>

      <div class="px-4 py-4 md:px-8 md:py-5 space-y-4 max-w-4xl">

        <!-- Mode selector -->
        <div class="flex gap-2">
          @for (m of modes; track m.id) {
            <button (click)="mode.set(m.id)"
                    class="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[44px]"
                    [class]="mode() === m.id
                      ? 'bg-nebula-600 text-white'
                      : 'bg-space-900 text-space-400 hover:bg-space-800 hover:text-space-200'">
              {{ m.label }}
            </button>
          }
        </div>

        <!-- Input form -->
        <section class="bg-space-900 rounded-xl p-4 md:p-5 space-y-4">
          <h2 class="text-sm font-semibold text-white">Asteroid Selection</h2>

          <!-- Asteroid IDs textarea -->
          <div>
            <label class="block text-xs text-space-400 mb-1.5" for="asteroid-ids">
              Asteroid IDs
              <span class="text-space-500 ml-1">(one per line — use NASA IDs from dossiers)</span>
            </label>
            <textarea
              id="asteroid-ids"
              [value]="asteroidIdsText()"
              (input)="onAsteroidIdsInput($event)"
              rows="4"
              placeholder="2000433&#10;2101955&#10;2162173"
              class="w-full bg-space-800 border border-space-700 rounded-lg px-3 py-2
                     text-xs font-mono text-white placeholder-space-600
                     focus:outline-none focus:border-nebula-500 resize-none"></textarea>
            <p class="text-[10px] text-space-500 mt-1">
              {{ parsedIds().length }} asteroid{{ parsedIds().length === 1 ? '' : 's' }} entered
            </p>
          </div>

          <!-- Constraints -->
          <h2 class="text-sm font-semibold text-white pt-1">Mission Constraints</h2>

          <!-- Delta-V -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs text-space-400" for="delta-v">
                Max delta-V budget (km/s)
              </label>
              <span class="text-xs font-mono text-white">
                {{ maxDeltaV() !== null ? maxDeltaV()!.toFixed(1) : 'no limit' }}
              </span>
            </div>
            <input
              id="delta-v"
              type="range"
              min="3"
              max="30"
              step="0.5"
              [value]="maxDeltaV() ?? 30"
              (input)="onDeltaVInput($event)"
              class="w-full accent-nebula-500 min-h-[44px] cursor-pointer" />
            <div class="flex justify-between text-[9px] text-space-600 mt-0.5">
              <span>3 km/s</span><span>30 km/s</span>
            </div>
          </div>

          <!-- Mission type -->
          <div>
            <label class="block text-xs text-space-400 mb-1.5" for="mission-type">
              Mission type
            </label>
            <select
              id="mission-type"
              [value]="missionType()"
              (change)="onMissionTypeChange($event)"
              class="w-full bg-space-800 border border-space-700 rounded-lg px-3 py-2
                     text-xs text-white focus:outline-none focus:border-nebula-500 min-h-[44px]">
              <option value="">Any</option>
              <option value="flyby">Flyby</option>
              <option value="rendezvous">Rendezvous</option>
              <option value="sample_return">Sample Return</option>
              <option value="mining">Mining</option>
            </select>
          </div>

          <!-- Priority weights -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs text-space-400">Priority weights</p>
              <span class="text-[10px] font-mono"
                    [class]="priorityTotal() === 100 ? 'text-safe-400' : 'text-hazard-400'">
                {{ priorityTotal() }}% total
              </span>
            </div>
            <div class="space-y-3">
              @for (p of prioritySliders; track p.key) {
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] text-space-400">{{ p.label }}</label>
                    <span class="text-[10px] font-mono text-white">{{ priorities()[p.key] }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    [value]="priorities()[p.key]"
                    (input)="onPriorityInput(p.key, $event)"
                    class="w-full accent-nebula-500 min-h-[44px] cursor-pointer" />
                </div>
              }
            </div>
          </div>

          <!-- Portfolio size (only for portfolio mode) -->
          @if (mode() === 'portfolio') {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs text-space-400" for="portfolio-size">
                  Portfolio size
                </label>
                <span class="text-xs font-mono text-white">{{ portfolioSize() }}</span>
              </div>
              <input
                id="portfolio-size"
                type="range"
                min="2"
                max="10"
                step="1"
                [value]="portfolioSize()"
                (input)="onPortfolioSizeInput($event)"
                class="w-full accent-nebula-500 min-h-[44px] cursor-pointer" />
            </div>
          }

          <!-- Submit -->
          <button
            (click)="submit()"
            [disabled]="!canSubmit()"
            class="w-full py-3 rounded-lg text-sm font-semibold transition-colors min-h-[44px]"
            [class]="canSubmit()
              ? 'bg-nebula-600 hover:bg-nebula-500 active:bg-nebula-700 text-white'
              : 'bg-space-800 text-space-600 cursor-not-allowed'">
            @if (planning.state() === 'loading') {
              <span class="flex items-center justify-center gap-2">
                <span class="w-4 h-4 rounded-full border-2 border-white border-t-transparent
                             animate-spin"></span>
                Running…
              </span>
            } @else {
              {{ submitLabel() }}
            }
          </button>
        </section>

        <!-- Error -->
        @if (planning.state() === 'error') {
          <div class="bg-hazard-500/10 border border-hazard-500/30 rounded-xl p-4">
            <p class="text-sm font-medium text-hazard-400 mb-1">Request failed</p>
            <p class="text-xs text-space-300">{{ planning.errorMessage() }}</p>
          </div>
        }

        <!-- Results -->
        @if (planning.state() === 'complete') {

          <!-- Scenario results -->
          @if (planning.scenarioResult(); as sr) {
            <section>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-white">
                  Recommendations
                  <span class="text-space-400 font-normal ml-1.5">
                    ({{ sr.feasibleCount }} feasible of {{ sr.recommendations.length }})
                  </span>
                </h2>
                <button (click)="planning.reset()"
                        class="text-xs text-space-400 hover:text-space-200 transition-colors
                               min-h-[44px] flex items-center">
                  Reset
                </button>
              </div>

              @if (sr.topPick) {
                <div class="mb-3 px-4 py-3 bg-safe-500/10 border border-safe-500/20 rounded-xl">
                  <p class="text-[10px] text-safe-400 font-semibold uppercase tracking-wide mb-0.5">
                    Top pick
                  </p>
                  <a [routerLink]="['/dossier', sr.topPick.asteroidId]"
                     class="text-sm font-semibold text-white hover:text-safe-300 transition-colors
                            min-h-[44px] flex items-center">
                    {{ sr.topPick.asteroidName }}
                  </a>
                </div>
              }

              <app-mission-results [candidates]="sr.recommendations" />
            </section>
          }

          <!-- Comparison results -->
          @if (planning.comparisonResult(); as cr) {
            <section>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-white">
                  Comparison
                  <span class="text-space-400 font-normal ml-1.5">({{ cr.candidates.length }} candidates)</span>
                </h2>
                <button (click)="planning.reset()"
                        class="text-xs text-space-400 hover:text-space-200 transition-colors
                               min-h-[44px] flex items-center">
                  Reset
                </button>
              </div>
              <app-mission-results [candidates]="cr.candidates" />
            </section>
          }

          <!-- Portfolio results -->
          @if (planning.portfolioResult(); as pr) {
            <section>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-white">Portfolio</h2>
                <button (click)="planning.reset()"
                        class="text-xs text-space-400 hover:text-space-200 transition-colors
                               min-h-[44px] flex items-center">
                  Reset
                </button>
              </div>
              <app-mission-portfolio [portfolio]="pr" />
            </section>
          }

        }

      </div>
    </div>
  `,
})
export class MissionPlanningComponent {
  readonly planning = inject(MissionPlanningService);

  // ── Form state ──────────────────────────────────────────────────────────────

  readonly mode = signal<PlanningMode>('scenario');
  readonly asteroidIdsText = signal('');
  readonly maxDeltaV = signal<number | null>(null);
  readonly missionType = signal<string>('');
  readonly portfolioSize = signal(3);
  readonly priorities = signal({ accessibility: 50, economics: 30, risk: 20 });

  readonly modes: { id: PlanningMode; label: string }[] = [
    { id: 'scenario', label: 'Scenario' },
    { id: 'compare', label: 'Compare' },
    { id: 'portfolio', label: 'Portfolio' },
  ];

  readonly prioritySliders: { key: 'accessibility' | 'economics' | 'risk'; label: string }[] = [
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'economics', label: 'Economics' },
    { key: 'risk', label: 'Risk (lower = prefer safer)' },
  ];

  readonly parsedIds = computed(() =>
    this.asteroidIdsText()
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

  readonly priorityTotal = computed(() => {
    const p = this.priorities();
    return p.accessibility + p.economics + p.risk;
  });

  readonly canSubmit = computed(() =>
    this.parsedIds().length >= 1 &&
    this.planning.state() !== 'loading' &&
    this.priorityTotal() === 100,
  );

  readonly submitLabel = computed(() => {
    const m = this.mode();
    if (m === 'scenario') return `Build Scenario (${this.parsedIds().length} asteroids)`;
    if (m === 'compare') return `Compare (${this.parsedIds().length} asteroids)`;
    return `Build Portfolio (${this.parsedIds().length} asteroids)`;
  });

  // ── Event handlers ──────────────────────────────────────────────────────────

  onAsteroidIdsInput(event: Event): void {
    this.asteroidIdsText.set((event.target as HTMLTextAreaElement).value);
  }

  onDeltaVInput(event: Event): void {
    const v = parseFloat((event.target as HTMLInputElement).value);
    this.maxDeltaV.set(v >= 30 ? null : v);
  }

  onMissionTypeChange(event: Event): void {
    this.missionType.set((event.target as HTMLSelectElement).value);
  }

  onPortfolioSizeInput(event: Event): void {
    this.portfolioSize.set(parseInt((event.target as HTMLInputElement).value, 10));
  }

  onPriorityInput(key: 'accessibility' | 'economics' | 'risk', event: Event): void {
    const v = parseInt((event.target as HTMLInputElement).value, 10);
    this.priorities.update((p) => ({ ...p, [key]: v }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  submit(): void {
    if (!this.canSubmit()) return;

    const ids = this.parsedIds();
    const p = this.priorities();
    const constraints: MissionConstraints = {
      ...(this.maxDeltaV() !== null && { maxDeltaV_kms: this.maxDeltaV()! }),
      ...(this.missionType() && { missionType: this.missionType() as MissionConstraints['missionType'] }),
      priorities: {
        accessibility: p.accessibility / 100,
        economics: p.economics / 100,
        risk: p.risk / 100,
      },
    };

    const m = this.mode();
    if (m === 'scenario') {
      this.planning.runScenario(ids, constraints);
    } else if (m === 'compare') {
      this.planning.runComparison(ids, constraints);
    } else {
      this.planning.runPortfolio(ids, constraints, this.portfolioSize());
    }
  }
}
