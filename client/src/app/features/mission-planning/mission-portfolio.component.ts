import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type PortfolioResponse, type CandidateScore } from '../../core/api.service.js';

@Component({
  selector: 'app-mission-portfolio',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <!-- Portfolio summary -->
      <div class="bg-nebula-600/10 border border-nebula-500/20 rounded-xl p-4 md:p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <h2 class="text-sm font-semibold text-nebula-300">Optimal Portfolio</h2>
          <div class="text-right shrink-0">
            <div class="text-base font-bold font-mono text-nebula-300">
              {{ (portfolio().portfolioScore * 100).toFixed(0) }}
            </div>
            <div class="text-[9px] text-space-500 uppercase tracking-wide">portfolio score</div>
          </div>
        </div>
        <p class="text-xs text-space-300 leading-relaxed">
          {{ portfolio().portfolioRationale }}
        </p>
      </div>

      <!-- Optimal candidates grid — stacked on mobile, side-by-side on md+ -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        @for (candidate of portfolio().optimalPortfolio; track candidate.asteroidId) {
          <article class="bg-space-900 border border-nebula-500/20 rounded-xl p-4">
            <!-- Rank + name -->
            <div class="flex items-center gap-2 mb-3">
              <span class="w-6 h-6 rounded-full bg-nebula-600/30 text-nebula-300 text-[10px]
                           font-bold flex items-center justify-center shrink-0">
                {{ candidate.rank }}
              </span>
              <a [routerLink]="['/dossier', candidate.asteroidId]"
                 class="text-sm font-semibold text-white hover:text-nebula-300
                        transition-colors truncate min-h-[44px] flex items-center">
                {{ candidate.asteroidName }}
              </a>
            </div>

            <!-- Key metrics -->
            <dl class="space-y-1.5 mb-3">
              <div class="flex justify-between items-baseline">
                <dt class="text-[10px] text-space-400">Accessibility</dt>
                <dd>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        [class]="accessibilityClass(candidate.accessibilityRating)">
                    {{ candidate.accessibilityRating }}
                  </span>
                </dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-[10px] text-space-400">Min delta-V</dt>
                <dd class="text-[10px] font-mono text-white">
                  {{ candidate.minDeltaV_kms !== null ? candidate.minDeltaV_kms.toFixed(2) + ' km/s' : '—' }}
                </dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-[10px] text-space-400">Duration</dt>
                <dd class="text-[10px] font-mono text-white">
                  {{ candidate.missionDurationDays !== null ? candidate.missionDurationDays + ' days' : '—' }}
                </dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-[10px] text-space-400">Orbit class</dt>
                <dd class="text-[10px] font-mono text-white">{{ candidate.orbitalClass }}</dd>
              </div>
              <div class="flex justify-between items-baseline">
                <dt class="text-[10px] text-space-400">Score</dt>
                <dd class="text-[10px] font-mono font-bold" [class]="scoreColor(candidate.score)">
                  {{ (candidate.score * 100).toFixed(0) }}/100
                </dd>
              </div>
            </dl>

            <p class="text-[10px] text-space-300 leading-relaxed border-t border-space-800 pt-2">
              {{ candidate.rationale }}
            </p>
          </article>
        }
      </div>

      <!-- All candidates (collapsed) -->
      @if (portfolio().allCandidates.length > portfolio().optimalPortfolio.length) {
        <details class="bg-space-900 rounded-xl overflow-hidden">
          <summary class="px-4 py-3 cursor-pointer list-none flex items-center justify-between
                          hover:bg-space-800 transition-colors min-h-[44px]">
            <span class="text-xs font-semibold text-space-400 uppercase tracking-wide">
              All Candidates ({{ portfolio().allCandidates.length }})
            </span>
            <span class="text-[10px] text-space-500">expand</span>
          </summary>
          <div class="px-4 pb-4 pt-1">
            <div class="space-y-2">
              @for (c of portfolio().allCandidates; track c.asteroidId) {
                <div class="flex items-center gap-3 py-2 border-b border-space-800 last:border-0">
                  <span class="text-[10px] font-mono text-space-500 w-5 text-right shrink-0">
                    {{ c.rank }}
                  </span>
                  <a [routerLink]="['/dossier', c.asteroidId]"
                     class="flex-1 text-xs text-space-200 hover:text-white transition-colors
                            truncate min-h-[44px] flex items-center">
                    {{ c.asteroidName }}
                  </a>
                  <span class="text-[10px] font-mono shrink-0" [class]="scoreColor(c.score)">
                    {{ (c.score * 100).toFixed(0) }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0"
                        [class]="accessibilityClass(c.accessibilityRating)">
                    {{ c.accessibilityRating }}
                  </span>
                </div>
              }
            </div>
          </div>
        </details>
      }
    </div>
  `,
})
export class MissionPortfolioComponent {
  readonly portfolio = input.required<PortfolioResponse>();

  accessibilityClass(rating: CandidateScore['accessibilityRating']): string {
    const map: Record<string, string> = {
      exceptional: 'bg-safe-500/20 text-safe-400',
      good: 'bg-nebula-500/20 text-nebula-300',
      marginal: 'bg-amber-500/20 text-amber-300',
      inaccessible: 'bg-hazard-500/20 text-hazard-400',
    };
    return map[rating] ?? 'bg-space-800 text-space-300';
  }

  scoreColor(score: number): string {
    if (score >= 0.7) return 'text-safe-400';
    if (score >= 0.45) return 'text-amber-400';
    return 'text-hazard-400';
  }
}
