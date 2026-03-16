import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type CandidateScore } from '../../core/api.service.js';

@Component({
  selector: 'app-mission-results',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      @for (candidate of candidates(); track candidate.asteroidId) {
        <article class="bg-space-900 rounded-xl p-4 md:p-5">
          <!-- Rank + name row -->
          <div class="flex items-start gap-3 mb-3">
            <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                 [class]="rankBadgeClass(candidate.rank)">
              #{{ candidate.rank }}
            </div>
            <div class="min-w-0 flex-1">
              <a [routerLink]="['/dossier', candidate.asteroidId]"
                 class="text-sm font-semibold text-white hover:text-nebula-300 transition-colors
                        truncate block">
                {{ candidate.asteroidName }}
              </a>
              <span class="text-[10px] font-mono text-space-400">{{ candidate.asteroidId }}</span>
            </div>
            <!-- Score pill -->
            <div class="shrink-0 text-right">
              <div class="text-base font-bold font-mono" [class]="scoreColor(candidate.score)">
                {{ (candidate.score * 100).toFixed(0) }}
              </div>
              <div class="text-[9px] text-space-500 uppercase tracking-wide">score</div>
            </div>
          </div>

          <!-- Accessibility + delta-V row -->
          <div class="flex flex-wrap gap-2 mb-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                  [class]="accessibilityClass(candidate.accessibilityRating)">
              {{ candidate.accessibilityRating }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-space-800 text-[10px] font-mono text-space-300">
              {{ candidate.minDeltaV_kms !== null ? candidate.minDeltaV_kms.toFixed(2) + ' km/s' : '— km/s' }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-space-800 text-[10px] font-mono text-space-300">
              {{ candidate.missionDurationDays !== null ? candidate.missionDurationDays + ' d' : '— d' }}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-space-800 text-[10px] text-space-300">
              {{ candidate.orbitalClass }}
            </span>
          </div>

          <!-- Score breakdown -->
          <div class="grid grid-cols-3 gap-2 mb-3">
            @for (dim of scoreBreakdownDims(candidate); track dim.label) {
              <div class="bg-space-800 rounded-lg p-2 text-center">
                <div class="text-xs font-mono font-semibold" [class]="dim.colorClass">
                  {{ (dim.value * 100).toFixed(0) }}%
                </div>
                <div class="text-[9px] text-space-500 mt-0.5">{{ dim.label }}</div>
              </div>
            }
          </div>

          <!-- Rationale -->
          <p class="text-xs text-space-300 leading-relaxed border-t border-space-800 pt-3">
            {{ candidate.rationale }}
          </p>

          <!-- Constraint violations -->
          @if (!candidate.passesConstraints && candidate.constraintViolations.length > 0) {
            <div class="mt-2 p-2 bg-hazard-500/10 border border-hazard-500/30 rounded-lg">
              <p class="text-[10px] text-hazard-400 font-semibold mb-1 uppercase tracking-wide">
                Constraint violations
              </p>
              @for (v of candidate.constraintViolations; track $index) {
                <p class="text-[10px] text-hazard-300">• {{ v }}</p>
              }
            </div>
          }

          <!-- Dossier link -->
          <a [routerLink]="['/dossier', candidate.asteroidId]"
             class="mt-3 flex items-center gap-1.5 text-xs text-nebula-400 hover:text-nebula-300
                    transition-colors min-h-[44px]">
            View full dossier →
          </a>
        </article>
      }

      @if (candidates().length === 0) {
        <div class="bg-space-900 rounded-xl p-6 text-center">
          <p class="text-sm text-space-400">No candidates to display.</p>
        </div>
      }
    </div>
  `,
})
export class MissionResultsComponent {
  readonly candidates = input.required<CandidateScore[]>();

  rankBadgeClass(rank: number): string {
    if (rank === 1) return 'bg-stellar-500/30 text-stellar-300 border border-stellar-500/40';
    if (rank === 2) return 'bg-space-700 text-space-200 border border-space-600';
    if (rank === 3) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-space-800 text-space-400 border border-space-700';
  }

  scoreColor(score: number): string {
    if (score >= 0.7) return 'text-safe-400';
    if (score >= 0.45) return 'text-amber-400';
    return 'text-hazard-400';
  }

  accessibilityClass(rating: string): string {
    const map: Record<string, string> = {
      exceptional: 'bg-safe-500/20 text-safe-400',
      good: 'bg-nebula-500/20 text-nebula-300',
      marginal: 'bg-amber-500/20 text-amber-300',
      inaccessible: 'bg-hazard-500/20 text-hazard-400',
    };
    return map[rating] ?? 'bg-space-800 text-space-300';
  }

  scoreBreakdownDims(candidate: CandidateScore): { label: string; value: number; colorClass: string }[] {
    const b = candidate.scoreBreakdown;
    return [
      { label: 'Access', value: b.accessibility, colorClass: this.dimColor(b.accessibility) },
      { label: 'Econ', value: b.economics, colorClass: this.dimColor(b.economics) },
      { label: 'Constraints', value: b.constraintSatisfaction, colorClass: this.dimColor(b.constraintSatisfaction) },
    ];
  }

  private dimColor(v: number): string {
    if (v >= 0.7) return 'text-safe-400';
    if (v >= 0.45) return 'text-amber-400';
    return 'text-hazard-400';
  }
}
