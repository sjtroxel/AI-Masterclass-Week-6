import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, type AnalysisResponse, type AgentEvent } from '../../core/api.service.js';
import { MarkdownPipe } from '../../shared/pipes/markdown.pipe.js';
import {
  ApproachTimelineComponent,
  type TimelineApproach,
} from '../../shared/components/approach-timeline/approach-timeline.component.js';

type AnalysisState = 'idle' | 'running' | 'complete' | 'handoff' | 'error';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [RouterLink, MarkdownPipe, ApproachTimelineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950 pb-24 md:pb-8">

      <!-- Header -->
      <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
        <div class="flex items-center gap-3 mb-1">
          <a [routerLink]="['/dossier', asteroidId()]"
             class="text-space-400 hover:text-space-200 text-xs transition-colors min-h-[44px]
                    flex items-center">
            ← Dossier
          </a>
        </div>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-lg font-bold text-white md:text-xl">Agent Swarm Analysis</h1>
            @if (asteroidId()) {
              <p class="text-xs text-space-400 font-mono mt-0.5">{{ asteroidId() }}</p>
            }
          </div>
          <!-- Status badge -->
          @if (state() !== 'idle') {
            <span class="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                  [class]="statusBadgeClass()">
              {{ statusLabel() }}
            </span>
          }
        </div>
      </header>

      <!-- Body -->
      <div class="px-4 py-4 md:px-8 md:py-5 space-y-4">

        <!-- Idle / trigger -->
        @if (state() === 'idle') {
          <div class="bg-space-900 rounded-xl p-6 text-center space-y-4">
            <!-- Swarm icon -->
            <div class="flex justify-center">
              <div class="w-16 h-16 rounded-full bg-nebula-600/20 border border-nebula-500/30
                          flex items-center justify-center">
                <svg class="w-8 h-8 text-nebula-400" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  <path d="M19.5 3.75l-.75 2.25M19.5 3.75l2.25-.75M19.5 3.75 18 6l2.25-1.5M19.5 3.75 21 1.5l-1.5 2.25" />
                </svg>
              </div>
            </div>
            <div>
              <h2 class="text-base font-semibold text-white mb-1">Run Agent Swarm</h2>
              <p class="text-sm text-space-400 max-w-xs mx-auto">
                Four specialized AI agents will analyze this asteroid across orbital mechanics,
                mineral composition, resource economics, and planetary defense risk.
              </p>
            </div>
            <div class="text-xs text-space-500">
              Analysis takes 30–90 seconds. Results are persisted.
            </div>
            <button (click)="runAnalysis()"
                    class="mx-auto flex items-center gap-2 px-6 py-3
                           bg-nebula-600 hover:bg-nebula-500 active:bg-nebula-700
                           text-white text-sm font-semibold rounded-lg
                           transition-colors min-h-[44px]">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Agent Swarm Analysis
            </button>
          </div>
        }

        <!-- Running -->
        @if (state() === 'running') {
          <div class="bg-space-900 rounded-xl p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-5 h-5 rounded-full border-2 border-nebula-500 border-t-transparent
                          animate-spin shrink-0"></div>
              <p class="text-sm font-medium text-white">Agent swarm running…</p>
            </div>
            <!-- Per-agent live status -->
            <div class="grid grid-cols-2 gap-2">
              @for (agent of agentPhases(); track agent.key) {
                <div class="flex items-center gap-2 bg-space-800 rounded-lg px-3 py-2">
                  @if (agent.status === 'done') {
                    <div class="w-2 h-2 rounded-full shrink-0 bg-safe-500"></div>
                  } @else if (agent.status === 'failed') {
                    <div class="w-2 h-2 rounded-full shrink-0 bg-hazard-500"></div>
                  } @else if (agent.status === 'running') {
                    <div class="w-2 h-2 rounded-full shrink-0 animate-pulse bg-nebula-500"></div>
                  } @else {
                    <div class="w-2 h-2 rounded-full shrink-0 bg-space-600"></div>
                  }
                  <span class="text-xs"
                        [class]="agent.status === 'done' ? 'text-safe-400' :
                                 agent.status === 'failed' ? 'text-hazard-400' :
                                 agent.status === 'running' ? 'text-white' :
                                 'text-space-400'">
                    {{ agent.name }}
                  </span>
                  @if (agent.status === 'done') {
                    <span class="ml-auto text-[10px] text-safe-500">✓</span>
                  }
                </div>
              }
            </div>

            <!-- Live agent event feeds -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              @for (agent of agentPhases(); track agent.key) {
                @if (liveAgentEvents()[agent.key]?.length) {
                  <details class="bg-space-800 rounded-lg overflow-hidden">
                    <summary class="px-3 py-2 cursor-pointer list-none flex items-center
                                    justify-between hover:bg-space-700 transition-colors min-h-[44px]">
                      <span class="text-xs font-medium text-space-300">{{ agent.name }}</span>
                      <span class="text-[10px] text-space-500">
                        {{ liveAgentEvents()[agent.key]?.length }} events
                      </span>
                    </summary>
                    <div class="px-3 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                      @for (event of liveAgentEvents()[agent.key]; track $index) {
                        <div class="flex items-start gap-2">
                          <span class="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded"
                                [class]="eventBadgeClass(event['type'])">
                            {{ event['type'] }}
                          </span>
                          <span class="text-[10px] text-space-300 leading-relaxed">
                            {{ eventSummary(event) }}
                          </span>
                        </div>
                      }
                    </div>
                  </details>
                }
              }
            </div>

            <!-- Synthesis streaming -->
            @if (synthesisStream()) {
              <div class="bg-nebula-600/10 border border-nebula-500/20 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-nebula-400 animate-pulse shrink-0"></div>
                  <span class="text-xs font-semibold text-nebula-300">Synthesizing…</span>
                </div>
                <p class="text-sm text-space-200 leading-relaxed whitespace-pre-wrap">{{ synthesisStream() }}</p>
              </div>
            }
          </div>
        }

        <!-- Error -->
        @if (state() === 'error' && errorMessage()) {
          <div class="bg-hazard-500/10 border border-hazard-500/30 rounded-xl p-5">
            <p class="text-sm font-medium text-hazard-400 mb-2">Analysis failed</p>
            <p class="text-xs text-space-300">{{ errorMessage() }}</p>
            <button (click)="runAnalysis()"
                    class="mt-4 text-xs text-nebula-400 hover:text-nebula-300 transition-colors
                           min-h-[44px] flex items-center">
              Try again
            </button>
          </div>
        }

        <!-- Results -->
        @if (state() === 'complete' || state() === 'handoff') {

          <!-- Confidence scores -->
          @if (analysis()?.confidenceScores) {
            <section class="bg-space-900 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-white mb-4">Confidence Scores</h2>
              <div class="space-y-3">
                @for (dim of confidenceDimensions(); track dim.label) {
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-space-300">{{ dim.label }}</span>
                      <span class="text-xs font-mono" [class]="dim.colorClass">
                        {{ (dim.value * 100).toFixed(0) }}%
                      </span>
                    </div>
                    <div class="h-1.5 bg-space-800 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-700"
                           [class]="dim.barClass"
                           [style.width.%]="dim.value * 100"></div>
                    </div>
                  </div>
                }
              </div>
              <!-- Overall confidence -->
              <div class="mt-4 pt-3 border-t border-space-800 flex items-center justify-between">
                <span class="text-sm font-semibold text-white">Overall</span>
                <span class="text-sm font-mono font-bold" [class]="overallConfidenceColor()">
                  {{ overallConfidenceLabel() }}
                </span>
              </div>
            </section>
          }

          <!-- Handoff notice -->
          @if (state() === 'handoff' && analysis()?.handoffPacket) {
            <section class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 md:p-5">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-amber-300 mb-2">Human Handoff Required</p>
                  <p class="text-xs text-space-300 mb-3">
                    Confidence too low for automated synthesis ({{ ((analysis()!.handoffPacket!.aggregateConfidence) * 100).toFixed(0) }}% overall).
                  </p>
                  <div class="space-y-2">
                    <div>
                      <p class="text-[10px] text-space-400 uppercase tracking-wide mb-0.5">What was found</p>
                      <p class="text-xs text-space-200">{{ analysis()!.handoffPacket!.whatWasFound }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] text-space-400 uppercase tracking-wide mb-0.5">Confidence gap</p>
                      <p class="text-xs text-space-200">{{ analysis()!.handoffPacket!.whereConfidenceBrokDown }}</p>
                    </div>
                    <div>
                      <p class="text-[10px] text-space-400 uppercase tracking-wide mb-0.5">Expert needs</p>
                      <p class="text-xs text-space-200">{{ analysis()!.handoffPacket!.whatHumanExpertNeeds }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          }

          <!-- Synthesis -->
          @if (state() === 'complete' && analysis()?.synthesis) {
            <section class="bg-nebula-600/10 border border-nebula-500/20 rounded-xl p-4 md:p-5">
              <h2 class="text-sm font-semibold text-nebula-300 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                Synthesis
              </h2>
              <div class="prose-markdown text-sm text-space-200 leading-relaxed"
                   [innerHTML]="analysis()!.synthesis | markdown"></div>
            </section>
          }

          <!-- Agent cards — 2-col on desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

            <!-- Navigator -->
            @if (analysis()?.outputs?.navigator) {
              <section class="bg-space-900 rounded-xl p-4 md:p-5">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-nebula-400 shrink-0"></span>
                    Navigator
                  </h2>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [class]="accessibilityBadgeClass()">
                    {{ analysis()!.outputs.navigator!.accessibilityRating }}
                  </span>
                </div>
                <dl class="space-y-2">
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Min delta-V</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ analysis()!.outputs.navigator!.minDeltaV_kms !== null
                          ? analysis()!.outputs.navigator!.minDeltaV_kms!.toFixed(3) + ' km/s'
                          : '—' }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Mission duration</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ analysis()!.outputs.navigator!.missionDurationDays !== null
                          ? analysis()!.outputs.navigator!.missionDurationDays + ' days'
                          : '—' }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Orbital class</dt>
                    <dd class="text-xs font-mono text-white">{{ analysis()!.outputs.navigator!.orbitalClass }}</dd>
                  </div>
                </dl>
                <p class="mt-3 text-xs text-space-300 leading-relaxed border-t border-space-800 pt-3">
                  {{ analysis()!.outputs.navigator!.reasoning }}
                </p>
                @if (analysis()!.outputs.navigator!.assumptionsRequired.length > 0) {
                  <details class="mt-2">
                    <summary class="text-[10px] text-space-500 cursor-pointer hover:text-space-400
                                    min-h-[44px] flex items-center">
                      {{ analysis()!.outputs.navigator!.assumptionsRequired.length }} assumptions
                    </summary>
                    <ul class="mt-1 space-y-0.5">
                      @for (a of analysis()!.outputs.navigator!.assumptionsRequired; track $index) {
                        <li class="text-[10px] text-space-400">• {{ a }}</li>
                      }
                    </ul>
                  </details>
                }
              </section>
            }

            <!-- Geologist -->
            @if (analysis()?.outputs?.geologist) {
              <section class="bg-space-900 rounded-xl p-4 md:p-5">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-plasma-400 shrink-0"></span>
                    Geologist
                  </h2>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-space-800 text-space-300 font-medium">
                    {{ analysis()!.outputs.geologist!.spectralClass }}-type
                  </span>
                </div>
                <div class="text-[10px] text-space-400 uppercase tracking-wide mb-2">Composition</div>
                <div class="space-y-1 mb-3">
                  @for (r of compositionRows(); track r.label) {
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-space-400 w-24 shrink-0">{{ r.label }}</span>
                      <div class="flex-1 h-1.5 bg-space-800 rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-plasma-500/60"
                             [style.width.%]="r.midPct"></div>
                      </div>
                      <span class="text-[10px] font-mono text-space-300 w-14 text-right">
                        {{ r.range }}
                      </span>
                    </div>
                  }
                </div>
                @if (analysis()!.outputs.geologist!.keyResources.length > 0) {
                  <div class="text-[10px] text-space-400 uppercase tracking-wide mb-1.5">Key Resources</div>
                  <ul class="space-y-1 mb-3">
                    @for (res of analysis()!.outputs.geologist!.keyResources; track res.resource) {
                      <li class="text-xs text-space-200">
                        <span class="text-plasma-400 font-medium">{{ res.resource }}</span>
                        — {{ res.significance }}
                      </li>
                    }
                  </ul>
                }
                <p class="text-xs text-space-300 leading-relaxed border-t border-space-800 pt-3">
                  {{ analysis()!.outputs.geologist!.reasoning }}
                </p>
              </section>
            }

            <!-- Economist -->
            @if (analysis()?.outputs?.economist) {
              <section class="bg-space-900 rounded-xl p-4 md:p-5">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-stellar-400 shrink-0"></span>
                    Economist
                  </h2>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [class]="roiBadgeClass()">
                    {{ analysis()!.outputs.economist!.missionROI }}
                  </span>
                </div>
                <dl class="space-y-2 mb-3">
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Total value</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ formatValueRange(analysis()!.outputs.economist!.totalResourceValueUSD) }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Terrestrial export</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ formatValueRange(analysis()!.outputs.economist!.terrestrialExportValue) }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">In-space utilization</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ formatValueRange(analysis()!.outputs.economist!.inSpaceUtilizationValue) }}
                    </dd>
                  </div>
                </dl>
                <p class="text-xs text-space-300 leading-relaxed border-t border-space-800 pt-3">
                  {{ analysis()!.outputs.economist!.reasoning }}
                </p>
                <p class="mt-2 text-[10px] text-space-500 italic">
                  {{ analysis()!.outputs.economist!.disclaimer }}
                </p>
              </section>
            }

            <!-- Risk Assessor -->
            @if (analysis()?.outputs?.risk) {
              <section class="bg-space-900 rounded-xl p-4 md:p-5">
                <div class="flex items-center justify-between mb-3">
                  <h2 class="text-sm font-semibold text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-hazard-400 shrink-0"></span>
                    Risk Assessor
                  </h2>
                  <div class="flex gap-1.5">
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                          [class]="hazardBadgeClass()">
                      {{ analysis()!.outputs.risk!.planetaryDefense.hazardRating }}
                    </span>
                  </div>
                </div>
                <dl class="space-y-2 mb-3">
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">PHA status</dt>
                    <dd class="text-xs font-mono"
                        [class]="analysis()!.outputs.risk!.planetaryDefense.isPHA ? 'text-hazard-400' : 'text-safe-400'">
                      {{ analysis()!.outputs.risk!.planetaryDefense.isPHA ? 'Hazardous' : 'Non-hazardous' }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Mission risk</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ analysis()!.outputs.risk!.missionRisk.overallRating }}
                    </dd>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <dt class="text-xs text-space-400">Comm. delay</dt>
                    <dd class="text-xs font-mono text-white">
                      {{ formatDelayRange(analysis()!.outputs.risk!.missionRisk.communicationDelayMinutes) }}
                    </dd>
                  </div>
                </dl>
                <p class="text-xs text-space-300 leading-relaxed border-t border-space-800 pt-3">
                  {{ analysis()!.outputs.risk!.reasoning }}
                </p>
                @if (analysis()!.outputs.risk!.planetaryDefense.mitigationContext) {
                  <p class="mt-2 text-xs text-space-400 leading-relaxed">
                    {{ analysis()!.outputs.risk!.planetaryDefense.mitigationContext }}
                  </p>
                }
                @if (riskTimelineApproaches().length > 0) {
                  <div class="mt-3 pt-3 border-t border-space-800">
                    <p class="text-[10px] text-space-400 uppercase tracking-wide mb-2">Notable Approaches</p>
                    <app-approach-timeline [approaches]="riskTimelineApproaches()" />
                  </div>
                }
              </section>
            }

          </div>

          <!-- Agent errors -->
          @if (analysis()?.errors && analysis()!.errors.length > 0) {
            <section class="bg-space-900 rounded-xl p-4">
              <h2 class="text-xs font-semibold text-space-400 mb-2 uppercase tracking-wide">Agent Errors</h2>
              @for (e of analysis()!.errors; track e.agent) {
                <div class="text-xs text-hazard-400">
                  <span class="font-medium">{{ e.agent }}:</span> {{ e.message }}
                </div>
              }
            </section>
          }

          <!-- Observability trace (collapsible) -->
          @if (analysis()?.trace) {
            <section class="bg-space-900 rounded-xl overflow-hidden">
              <details>
                <summary class="px-4 py-3 cursor-pointer list-none flex items-center justify-between
                                hover:bg-space-800 transition-colors min-h-[44px]">
                  <span class="text-xs font-semibold text-space-400 uppercase tracking-wide">
                    Observability Trace
                  </span>
                  <span class="text-[10px] text-space-500">
                    {{ (analysis()!.trace.totalLatencyMs / 1000).toFixed(1) }}s total
                  </span>
                </summary>
                <div class="px-4 pb-4 space-y-4">
                  <!-- Per-agent latency -->
                  <div class="pt-3 border-t border-space-800">
                    <p class="text-[10px] text-space-400 uppercase tracking-wide mb-2">Agent Latencies</p>
                    <div class="grid grid-cols-2 gap-2">
                      @for (entry of agentLatencyEntries(); track entry.agent) {
                        <div class="flex justify-between">
                          <span class="text-[10px] text-space-400">{{ entry.agent }}</span>
                          <span class="text-[10px] font-mono text-space-300">
                            {{ entry.latency !== null ? (entry.latency / 1000).toFixed(1) + 's' : '—' }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                  <!-- Per-agent events -->
                  @for (agentEntry of agentEventEntries(); track agentEntry.agent) {
                    <div class="pt-3 border-t border-space-800">
                      <p class="text-[10px] text-space-400 uppercase tracking-wide mb-2">
                        {{ agentEntry.agent }} — {{ agentEntry.events.length }} events
                      </p>
                      <div class="space-y-1.5 max-h-64 overflow-y-auto">
                        @for (event of agentEntry.events; track $index) {
                          <div class="flex items-start gap-2">
                            <span class="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded"
                                  [class]="eventBadgeClass(event.type)">
                              {{ event.type }}
                            </span>
                            <span class="text-[10px] text-space-300 leading-relaxed">
                              {{ eventSummary(event) }}
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </details>
            </section>
          }

        }

      </div>
    </div>
  `,
})
export class AnalysisComponent implements OnInit {
  readonly asteroidId = input<string | undefined>(undefined);

  private readonly api = inject(ApiService);

  readonly state = signal<AnalysisState>('idle');
  readonly analysis = signal<AnalysisResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly agentStatuses = signal<Record<string, 'idle' | 'running' | 'done' | 'failed'>>({});
  readonly liveAgentEvents = signal<Record<string, AgentEvent[]>>({});
  readonly synthesisStream = signal<string>('');

  private eventSource: EventSource | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.eventSource?.close();
    });
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly statusLabel = computed(() => {
    const s = this.state();
    if (s === 'running') return 'Running';
    if (s === 'complete') return 'Complete';
    if (s === 'handoff') return 'Handoff';
    if (s === 'error') return 'Error';
    return '';
  });

  readonly statusBadgeClass = computed(() => {
    const s = this.state();
    if (s === 'running') return 'bg-nebula-600/30 text-nebula-300 border border-nebula-500/30';
    if (s === 'complete') return 'bg-safe-500/20 text-safe-400 border border-safe-500/30';
    if (s === 'handoff') return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    if (s === 'error') return 'bg-hazard-500/20 text-hazard-400 border border-hazard-500/30';
    return '';
  });

  readonly agentPhases = computed(() => {
    const s = this.agentStatuses();
    return [
      { name: 'Navigator',     key: 'navigator',     status: s['navigator']     ?? 'idle' },
      { name: 'Geologist',     key: 'geologist',     status: s['geologist']     ?? 'idle' },
      { name: 'Risk Assessor', key: 'riskAssessor',  status: s['riskAssessor']  ?? 'idle' },
      { name: 'Economist',     key: 'economist',     status: s['economist']     ?? 'idle' },
    ] as const;
  });

  readonly confidenceDimensions = computed(() => {
    const scores = this.analysis()?.confidenceScores;
    if (!scores) return [];
    return [
      { label: 'Orbital', value: scores.orbital, colorClass: this.confColor(scores.orbital), barClass: this.confBarClass(scores.orbital) },
      { label: 'Compositional', value: scores.compositional, colorClass: this.confColor(scores.compositional), barClass: this.confBarClass(scores.compositional) },
      { label: 'Economic', value: scores.economic, colorClass: this.confColor(scores.economic), barClass: this.confBarClass(scores.economic) },
      { label: 'Risk', value: scores.risk, colorClass: this.confColor(scores.risk), barClass: this.confBarClass(scores.risk) },
    ];
  });

  readonly overallConfidenceLabel = computed(() => {
    const s = this.analysis()?.confidenceScores;
    if (!s) return '';
    return `${(s.overall * 100).toFixed(0)}%`;
  });

  readonly overallConfidenceColor = computed(() => {
    const s = this.analysis()?.confidenceScores;
    if (!s) return '';
    return this.confColor(s.overall);
  });

  readonly accessibilityBadgeClass = computed(() => {
    const r = this.analysis()?.outputs?.navigator?.accessibilityRating;
    const map: Record<string, string> = {
      exceptional: 'bg-safe-500/20 text-safe-400',
      good: 'bg-nebula-500/20 text-nebula-300',
      marginal: 'bg-amber-500/20 text-amber-300',
      inaccessible: 'bg-hazard-500/20 text-hazard-400',
    };
    return r ? (map[r] ?? 'bg-space-800 text-space-300') : '';
  });

  readonly roiBadgeClass = computed(() => {
    const r = this.analysis()?.outputs?.economist?.missionROI;
    const map: Record<string, string> = {
      exceptional: 'bg-safe-500/20 text-safe-400',
      positive: 'bg-nebula-500/20 text-nebula-300',
      marginal: 'bg-amber-500/20 text-amber-300',
      negative: 'bg-hazard-500/20 text-hazard-400',
      unmodelable: 'bg-space-800 text-space-400',
    };
    return r ? (map[r] ?? 'bg-space-800 text-space-300') : '';
  });

  readonly hazardBadgeClass = computed(() => {
    const r = this.analysis()?.outputs?.risk?.planetaryDefense.hazardRating;
    const map: Record<string, string> = {
      none: 'bg-safe-500/20 text-safe-400',
      negligible: 'bg-safe-500/20 text-safe-400',
      low: 'bg-nebula-500/20 text-nebula-300',
      moderate: 'bg-amber-500/20 text-amber-300',
      elevated: 'bg-orange-500/20 text-orange-300',
      high: 'bg-hazard-500/20 text-hazard-400',
    };
    return r ? (map[r] ?? 'bg-space-800 text-space-300') : '';
  });

  readonly compositionRows = computed(() => {
    const geo = this.analysis()?.outputs?.geologist;
    if (!geo) return [];
    const comp = geo.compositionEstimate;
    const toRow = (label: string, r: { min: number; max: number }) => ({
      label,
      range: `${r.min}–${r.max}%`,
      midPct: (r.min + r.max) / 2,
    });
    return [
      toRow('Water ice', comp.water_ice_pct),
      toRow('Carbonaceous', comp.carbonaceous_pct),
      toRow('Silicate', comp.silicate_pct),
      toRow('Iron/nickel', comp.iron_nickel_pct),
      toRow('PGMs', comp.platinum_group_pct),
      toRow('Other', comp.other_pct),
    ];
  });

  readonly riskTimelineApproaches = computed<TimelineApproach[]>(() =>
    this.analysis()?.outputs?.risk?.planetaryDefense.notableApproaches ?? []
  );

  readonly agentLatencyEntries = computed(() => {
    const t = this.analysis()?.trace;
    if (!t) return [];
    return Object.entries(t.agentLatencies).map(([agent, latency]) => ({ agent, latency }));
  });

  readonly agentEventEntries = computed(() => {
    const t = this.analysis()?.trace;
    if (!t) return [];
    return Object.entries(t.agentEvents)
      .filter(([, events]) => events.length > 0)
      .map(([agent, events]) => ({ agent, events }));
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.asteroidId();
    if (id) this.checkExistingAnalysis(id);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  runAnalysis(): void {
    const id = this.asteroidId();
    if (!id) return;

    this.state.set('running');
    this.errorMessage.set(null);
    this.agentStatuses.set({});
    this.liveAgentEvents.set({});
    this.synthesisStream.set('');

    // Close any existing stream
    this.eventSource?.close();
    const es = this.api.streamAnalysis(id);
    this.eventSource = es;

    es.addEventListener('agent_start', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { phase: string };
      const statuses = { ...this.agentStatuses() };
      if (data.phase === 'navigating') statuses['navigator'] = 'running';
      if (data.phase === 'geologizing') {
        statuses['geologist'] = 'running';
        statuses['riskAssessor'] = 'running';
      }
      if (data.phase === 'economizing') statuses['economist'] = 'running';
      this.agentStatuses.set(statuses);
    });

    es.addEventListener('agent_complete', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { agent: string; status: string };
      this.agentStatuses.update((s) => ({
        ...s,
        [data.agent]: data.status === 'success' ? 'done' : 'failed',
      }));
    });

    es.addEventListener('agent_event', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { agent: string; event: AgentEvent };
      this.liveAgentEvents.update((all) => ({
        ...all,
        [data.agent]: [...(all[data.agent] ?? []), data.event],
      }));
    });

    es.addEventListener('synthesis_token', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { text: string };
      this.synthesisStream.update((t) => t + data.text);
    });

    es.addEventListener('analysis_complete', (ev) => {
      const result = JSON.parse((ev as MessageEvent).data) as AnalysisResponse;
      this.analysis.set(result);
      this.state.set(result.handoffTriggered ? 'handoff' : 'complete');
      es.close();
      this.eventSource = null;
    });

    es.addEventListener('error', (ev) => {
      const raw = (ev as MessageEvent).data as string | undefined;
      const msg = raw
        ? (JSON.parse(raw) as { message?: string }).message ?? 'Analysis failed. Please try again.'
        : null;
      if (msg) {
        this.errorMessage.set(msg);
        this.state.set('error');
        es.close();
        this.eventSource = null;
      }
    });

    es.onerror = () => {
      if (this.state() === 'running') {
        this.errorMessage.set('Connection to server lost. Please try again.');
        this.state.set('error');
      }
      es.close();
      this.eventSource = null;
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private checkExistingAnalysis(id: string): void {
    this.api.getLatestAnalysis(id).subscribe({
      next: (result) => {
        this.analysis.set(result);
        this.state.set(result.handoffTriggered ? 'handoff' : 'complete');
      },
      error: () => {
        // 404 is normal — no prior analysis; stay in idle
        this.state.set('idle');
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private confColor(v: number): string {
    if (v >= 0.7) return 'text-safe-400';
    if (v >= 0.5) return 'text-amber-400';
    return 'text-hazard-400';
  }

  private confBarClass(v: number): string {
    if (v >= 0.7) return 'bg-safe-500';
    if (v >= 0.5) return 'bg-amber-500';
    return 'bg-hazard-500';
  }

  formatBillions(n: number): string {
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    return `${n.toLocaleString()}`;
  }

  formatValueRange(r: { min: number; max: number }): string {
    return `$${this.formatBillions(r.min)}\u2013$${this.formatBillions(r.max)}B`;
  }

  formatDelayRange(r: { min: number; max: number }): string {
    return `${r.min.toFixed(1)}\u2013${r.max.toFixed(1)} min`;
  }

  eventBadgeClass(type: string): string {
    const map: Record<string, string> = {
      input: 'bg-nebula-500/20 text-nebula-300',
      tool_call: 'bg-stellar-500/20 text-stellar-300',
      tool_result: 'bg-space-700 text-space-300',
      rag_lookup: 'bg-plasma-500/20 text-plasma-300',
      output: 'bg-safe-500/20 text-safe-300',
      error: 'bg-hazard-500/20 text-hazard-300',
    };
    return map[type] ?? 'bg-space-700 text-space-300';
  }

  eventSummary(event: AgentEvent): string {
    const type = event['type'] as string;
    if (type === 'input') return `Asteroid: ${event['asteroidId'] as string}`;
    if (type === 'tool_call') return `${event['toolName'] as string}(${JSON.stringify(event['toolInput']).slice(0, 60)})`;
    if (type === 'tool_result') return `${event['toolName'] as string}: ${event['resultSummary'] as string}`;
    if (type === 'rag_lookup') return `"${event['query'] as string}" → ${event['retrievedCount'] as number} chunks`;
    if (type === 'output') return `completeness=${event['dataCompleteness'] as number}, assumptions=${event['assumptionsCount'] as number}`;
    if (type === 'error') return `${event['message'] as string}`;
    return JSON.stringify(event).slice(0, 80);
  }
}
