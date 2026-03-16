import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ApiService,
  type MissionConstraints,
  type ScenarioResponse,
  type PortfolioResponse,
  type ComparisonResponse,
} from '../../core/api.service.js';

export type PlanningMode = 'scenario' | 'portfolio' | 'compare';
export type PlanningState = 'idle' | 'loading' | 'complete' | 'error';

@Injectable({ providedIn: 'root' })
export class MissionPlanningService {
  private readonly api = inject(ApiService);

  readonly state = signal<PlanningState>('idle');
  readonly errorMessage = signal<string | null>(null);
  readonly scenarioResult = signal<ScenarioResponse | null>(null);
  readonly portfolioResult = signal<PortfolioResponse | null>(null);
  readonly comparisonResult = signal<ComparisonResponse | null>(null);

  readonly hasResult = computed(() =>
    this.scenarioResult() !== null ||
    this.portfolioResult() !== null ||
    this.comparisonResult() !== null,
  );

  runScenario(asteroidIds: string[], constraints: MissionConstraints): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.scenarioResult.set(null);
    this.portfolioResult.set(null);
    this.comparisonResult.set(null);

    this.api.buildScenario(asteroidIds, constraints).subscribe({
      next: (result) => {
        this.scenarioResult.set(result);
        this.state.set('complete');
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.extractMessage(err));
        this.state.set('error');
      },
    });
  }

  runPortfolio(
    asteroidIds: string[],
    constraints: MissionConstraints,
    portfolioSize?: number,
  ): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.scenarioResult.set(null);
    this.portfolioResult.set(null);
    this.comparisonResult.set(null);

    this.api.buildPortfolio(asteroidIds, constraints, portfolioSize).subscribe({
      next: (result) => {
        this.portfolioResult.set(result);
        this.state.set('complete');
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.extractMessage(err));
        this.state.set('error');
      },
    });
  }

  runComparison(asteroidIds: string[], constraints: MissionConstraints): void {
    this.state.set('loading');
    this.errorMessage.set(null);
    this.scenarioResult.set(null);
    this.portfolioResult.set(null);
    this.comparisonResult.set(null);

    this.api.compareAsteroids(asteroidIds, constraints).subscribe({
      next: (result) => {
        this.comparisonResult.set(result);
        this.state.set('complete');
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.extractMessage(err));
        this.state.set('error');
      },
    });
  }

  reset(): void {
    this.state.set('idle');
    this.errorMessage.set(null);
    this.scenarioResult.set(null);
    this.portfolioResult.set(null);
    this.comparisonResult.set(null);
  }

  private extractMessage(err: unknown): string {
    const e = err as { error?: { error?: { message?: string }; message?: string }; message?: string };
    return (
      e?.error?.error?.message ??
      e?.error?.message ??
      e?.message ??
      'Request failed. Please try again.'
    );
  }
}
