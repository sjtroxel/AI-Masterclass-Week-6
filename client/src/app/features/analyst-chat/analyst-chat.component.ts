/**
 * analyst-chat.component.ts
 *
 * The AI Analyst chat interface — accessible at /analyst.
 *
 * Layouts:
 *   Mobile  — full-screen chat, input pinned above bottom nav
 *   Desktop — max-width centered panel, messages scroll in a bounded area
 *
 * Observability:
 *   Each assistant response includes a collapsible RAG trace panel showing
 *   every chunk retrieved, its source type, similarity score, and content
 *   preview. First-class UI so portfolio viewers can see exactly how the
 *   Analyst grounds its answers in real data.
 */

import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnalystService } from './analyst.service';

@Component({
  selector: 'app-analyst-chat',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col h-screen md:h-[calc(100vh)] bg-space-950">

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <header class="shrink-0 px-4 py-3 md:px-8 md:py-4
                     bg-space-900 border-b border-space-700
                     flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-nebula-600/20 border border-nebula-500/30
                      flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-nebula-400" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                 aria-hidden="true">
              <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-semibold text-white">AI Analyst</h1>
            @if (svc.contextAsteroidId()) {
              <p class="text-xs text-space-300 truncate">
                Context: {{ svc.contextAsteroidId() }}
              </p>
            } @else {
              <p class="text-xs text-space-400">Grounded in NASA &amp; JPL science</p>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          @if (svc.hasSession()) {
            <span class="flex items-center gap-1.5 text-[10px] text-safe-400 font-medium uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-safe-400 animate-pulse"></span>
              Active
            </span>
          }
          @if (svc.hasSession() && !svc.isEmpty()) {
            <button (click)="newSession()"
                    class="px-2.5 py-1.5 text-xs text-space-300 hover:text-white
                           border border-space-700 hover:border-space-500
                           rounded-lg transition-colors min-h-8">
              New chat
            </button>
          }
        </div>
      </header>

      <!-- ── Context banner ─────────────────────────────────────────────── -->
      @if (svc.contextAsteroidId()) {
        <div class="shrink-0 px-4 py-2 md:px-8
                    bg-nebula-600/10 border-b border-nebula-500/20
                    flex items-center justify-between gap-3">
          <p class="text-xs text-nebula-300">
            <span class="font-medium">Asteroid context active</span>
            — answers grounded in data for {{ svc.contextAsteroidId() }}
          </p>
          <a [routerLink]="['/dossier', svc.contextAsteroidId()]"
             class="text-xs text-nebula-400 hover:text-nebula-300 transition-colors shrink-0">
            View dossier →
          </a>
        </div>
      }

      <!-- ── Session expired ────────────────────────────────────────────── -->
      @if (svc.sessionExpired()) {
        <div class="shrink-0 mx-4 mt-3 md:mx-8
                    rounded-lg bg-hazard-500/10 border border-hazard-500/30
                    px-4 py-3 flex items-center justify-between gap-3">
          <p class="text-sm text-hazard-400">Session expired (24h limit).</p>
          <button (click)="newSession()"
                  class="text-xs text-hazard-300 hover:text-white font-medium
                         underline underline-offset-2 transition-colors shrink-0 min-h-[44px]">
            Start new
          </button>
        </div>
      }

      <!-- ── Error banner ────────────────────────────────────────────────── -->
      @if (svc.error() && !svc.sessionExpired()) {
        <div class="shrink-0 mx-4 mt-3 md:mx-8
                    rounded-lg bg-hazard-500/10 border border-hazard-500/30
                    px-4 py-2.5 flex items-center justify-between gap-3">
          <p class="text-xs text-hazard-400">{{ svc.error() }}</p>
          <button (click)="svc.error.set(null)"
                  class="text-xs text-space-400 hover:text-white transition-colors min-h-[44px] px-2">
            ✕
          </button>
        </div>
      }

      <!-- ── Messages ────────────────────────────────────────────────────── -->
      <div #msgContainer
           class="flex-1 overflow-y-auto overscroll-contain
                  px-4 py-5 md:px-8 md:py-6 space-y-6">

        <!-- Welcome / empty state -->
        @if (svc.isEmpty() && !svc.isStartingSession()) {
          <div class="flex flex-col items-center justify-center
                      min-h-[55vh] text-center px-2">
            <div class="w-16 h-16 rounded-2xl
                        bg-nebula-600/15 border border-nebula-500/25
                        flex items-center justify-center mb-5">
              <svg class="w-8 h-8 text-nebula-400" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-white mb-2">Ask the Analyst</h2>
            <p class="text-sm text-space-300 mb-7 max-w-sm leading-relaxed">
              Grounded answers from NASA &amp; JPL mission data, peer-reviewed
              science, and 2050 resource economics — with full source attribution.
            </p>
            <div class="grid grid-cols-1 gap-2 w-full max-w-md">
              @for (prompt of suggestedPrompts; track prompt) {
                <button (click)="sendPrompt(prompt)"
                        [disabled]="!svc.hasSession()"
                        class="text-left px-4 py-3 rounded-xl
                               bg-space-900 border border-space-700
                               hover:border-nebula-500/50 hover:bg-space-800
                               transition-colors text-sm text-space-200
                               disabled:opacity-40 disabled:cursor-not-allowed
                               min-h-[44px]">
                  {{ prompt }}
                </button>
              }
            </div>
          </div>
        }

        <!-- Session starting -->
        @if (svc.isStartingSession()) {
          <div class="flex items-center justify-center min-h-[55vh]">
            <div class="flex items-center gap-3 text-space-300">
              <div class="w-5 h-5 border-2 border-nebula-500/30 border-t-nebula-400
                          rounded-full animate-spin"></div>
              <span class="text-sm">Starting session…</span>
            </div>
          </div>
        }

        <!-- Messages -->
        @for (msg of svc.messages(); track msg.id) {

          <!-- User bubble -->
          @if (msg.role === 'user') {
            <div class="flex justify-end">
              <div class="max-w-[85%] md:max-w-[68%]
                          px-4 py-3 rounded-2xl rounded-tr-sm
                          bg-nebula-600 text-white text-sm leading-relaxed
                          shadow-lg shadow-nebula-900/30">
                {{ msg.text }}
              </div>
            </div>
          }

          <!-- Assistant bubble -->
          @if (msg.role === 'assistant') {
            <div class="flex flex-col gap-2 max-w-[92%] md:max-w-[80%]">

              <!-- ── RAG Trace (observability) ─────────────────────────── -->
              @if (msg.trace) {
                <div class="rounded-xl border border-space-700 overflow-hidden">

                  <!-- Trace header — always visible, click to expand -->
                  <button (click)="toggleTrace(msg.id)"
                          class="w-full flex items-center justify-between gap-3
                                 px-3 py-2.5 bg-space-900/80
                                 hover:bg-space-800/80 transition-colors
                                 text-left min-h-[44px]"
                          [attr.aria-expanded]="isTraceOpen(msg.id)">
                    <div class="flex items-center gap-2 min-w-0">
                      <svg class="w-3.5 h-3.5 text-plasma-400 shrink-0" viewBox="0 0 24 24"
                           fill="none" stroke="currentColor" stroke-width="1.5"
                           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                      </svg>
                      <span class="text-[11px] font-mono text-space-300">
                        RAG retrieved
                        <span class="text-ion-400 font-medium">{{ msg.trace.ragCounts.science }}</span> science
                        + <span class="text-stellar-400 font-medium">{{ msg.trace.ragCounts.scenario }}</span> scenario
                        in <span class="text-white font-medium">{{ msg.trace.retrievalLatencyMs }}ms</span>
                        <span class="text-space-500"> · ~{{ msg.trace.promptTokenEstimate }} tokens</span>
                      </span>
                    </div>
                    <svg class="w-3.5 h-3.5 text-space-400 shrink-0 transition-transform duration-200"
                         [class.rotate-180]="isTraceOpen(msg.id)"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         aria-hidden="true">
                      <path d="m19 9-7 7-7-7" />
                    </svg>
                  </button>

                  <!-- Trace body -->
                  @if (isTraceOpen(msg.id)) {
                    <div class="bg-space-950/70 border-t border-space-800
                                px-3 py-3 space-y-3 max-h-72 overflow-y-auto">
                      @for (chunk of msg.trace.retrievedChunks; track chunk.sourceId + chunk.chunkIndex) {
                        <div class="flex gap-2.5 text-[11px]">

                          <!-- Badge -->
                          <div class="shrink-0 pt-0.5">
                            @if (chunk.sourceType === 'science') {
                              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono
                                           uppercase tracking-wider
                                           bg-ion-500/15 text-ion-400 border border-ion-500/20">
                                SCI
                              </span>
                            } @else {
                              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono
                                           uppercase tracking-wider
                                           bg-stellar-500/15 text-stellar-400 border border-stellar-500/20">
                                2050
                              </span>
                            }
                          </div>

                          <!-- Content -->
                          <div class="min-w-0 flex-1">
                            <div class="flex items-baseline justify-between gap-2 mb-0.5">
                              <p class="text-space-200 font-medium leading-tight truncate">
                                {{ chunk.sourceTitle }}
                                @if (chunk.sourceYear) {
                                  <span class="text-space-500 font-normal">({{ chunk.sourceYear }})</span>
                                }
                              </p>
                              <span class="font-mono text-safe-400 shrink-0">
                                {{ (chunk.similarity * 100).toFixed(1) }}%
                              </span>
                            </div>
                            <p class="text-space-400 font-mono leading-relaxed line-clamp-2">
                              {{ chunk.preview }}
                            </p>
                          </div>
                        </div>
                      }
                      @if (msg.trace.retrievedChunks.length === 0) {
                        <p class="text-xs text-space-500 italic text-center py-2">
                          No chunks retrieved above similarity threshold.
                        </p>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Message bubble -->
              <div class="flex items-start gap-2.5">

                <!-- Avatar -->
                <div class="w-6 h-6 rounded-full bg-nebula-600/20 border border-nebula-500/30
                            flex items-center justify-center shrink-0 mt-0.5">
                  <svg class="w-3 h-3 text-nebula-400" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round"
                       stroke-linejoin="round" aria-hidden="true">
                    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="px-4 py-3 rounded-2xl rounded-tl-sm
                              bg-space-900 border border-space-700
                              text-sm text-space-100 leading-relaxed
                              whitespace-pre-wrap wrap-break-word">
                    @if (msg.text) {
                      {{ msg.text }}
                    }
                    @if (msg.isStreaming) {
                      <span class="inline-block w-1.75 h-3.75 ml-0.5
                                   bg-nebula-400 align-middle animate-pulse
                                   rounded-xs"></span>
                    }
                  </div>

                  <!-- Source-type footnote -->
                  @if (!msg.isStreaming && msg.trace && msg.trace.retrievedChunks.length > 0) {
                    <div class="flex items-center gap-3 mt-2 pl-1">
                      @if (msg.trace.ragCounts.science > 0) {
                        <span class="flex items-center gap-1 text-[10px] text-ion-400
                                     font-medium uppercase tracking-wider">
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
                          </svg>
                          Science fact
                        </span>
                      }
                      @if (msg.trace.ragCounts.scenario > 0) {
                        <span class="flex items-center gap-1 text-[10px] text-stellar-400
                                     font-medium uppercase tracking-wider">
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5Z" clip-rule="evenodd" />
                          </svg>
                          2050 Projection
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        }
      </div>

      <!-- ── Input area ──────────────────────────────────────────────────── -->
      <div class="shrink-0 px-4 pb-4 pt-3 md:px-8 md:pb-6
                  bg-space-950 border-t border-space-800">

        <!-- No session -->
        @if (!svc.hasSession() && !svc.isStartingSession()) {
          <div class="flex justify-center py-1">
            <button (click)="initSession()"
                    class="px-6 py-3 bg-nebula-600 hover:bg-nebula-500
                           text-white text-sm font-medium rounded-xl
                           transition-colors min-h-[44px] flex items-center gap-2">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                   aria-hidden="true">
                <path d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Start conversation
            </button>
          </div>
        }

        <!-- Active input -->
        @if (svc.hasSession()) {
          <div class="flex items-end gap-2">
            <textarea #inputEl
                      [value]="inputText()"
                      (input)="onInput($event)"
                      (keydown)="onKeydown($event)"
                      [disabled]="svc.isStreaming() || svc.sessionExpired()"
                      placeholder="Ask about asteroid science, composition, or 2050 economics…"
                      rows="1"
                      class="flex-1 px-4 py-3 bg-space-900 border border-space-700
                             hover:border-space-600 focus:border-nebula-500
                             rounded-xl text-sm text-white placeholder-space-400
                             resize-none overflow-hidden leading-5
                             focus:outline-none focus:ring-1 focus:ring-nebula-500/40
                             transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                             min-h-[44px] max-h-32"
            ></textarea>

            <button (click)="send()"
                    [disabled]="!canSend()"
                    class="w-11 h-11 flex items-center justify-center shrink-0
                           bg-nebula-600 hover:bg-nebula-500
                           disabled:bg-space-800 disabled:text-space-600
                           text-white rounded-xl transition-colors
                           disabled:cursor-not-allowed"
                    aria-label="Send message">
              @if (svc.isStreaming()) {
                <div class="w-4 h-4 border-2 border-white/20 border-t-white
                            rounded-full animate-spin"></div>
              } @else {
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                     aria-hidden="true">
                  <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              }
            </button>
          </div>
          <p class="text-[10px] text-space-500 mt-2 text-center">
            Grounded answers only · Enter to send · Shift+Enter for new line
          </p>
        }
      </div>

    </div>
  `,
})
export class AnalystChatComponent implements OnInit {
  protected readonly svc = inject(AnalystService);
  private readonly route = inject(ActivatedRoute);

  readonly inputText = signal('');
  private readonly expandedTraces = signal<Set<string>>(new Set());

  readonly msgContainer = viewChild<ElementRef<HTMLDivElement>>('msgContainer');
  readonly inputEl = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

  readonly canSend = computed(
    () =>
      this.svc.hasSession() &&
      !this.svc.isStreaming() &&
      !this.svc.sessionExpired() &&
      this.inputText().trim().length > 0,
  );

  readonly suggestedPrompts = [
    'What minerals were found in the OSIRIS-REx Bennu samples?',
    'How did DART change the orbital period of Dimorphos?',
    'What is the projected value of asteroid platinum mining by 2050?',
    'Which near-Earth asteroids are most accessible for human missions?',
  ];

  constructor() {
    // Auto-scroll to bottom whenever messages change or tokens stream in
    effect(() => {
      void this.svc.messages();
      void this.svc.isStreaming();
      requestAnimationFrame(() => this.scrollToBottom());
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const asteroidId = params.get('asteroid') ?? undefined;

      if (!this.svc.hasSession()) {
        void this.svc.startSession(asteroidId);
      } else if (asteroidId && asteroidId !== this.svc.contextAsteroidId()) {
        // Asteroid context changed — start a fresh session
        void this.svc.resetSession(asteroidId);
      }
    });
  }

  initSession(): void {
    void this.svc.startSession();
  }

  newSession(): void {
    this.inputText.set('');
    this.expandedTraces.set(new Set());
    void this.svc.resetSession(this.svc.contextAsteroidId() ?? undefined);
  }

  sendPrompt(prompt: string): void {
    this.inputText.set(prompt);
    void this.submitMessage(prompt);
  }

  onInput(event: Event): void {
    this.inputText.set((event.target as HTMLTextAreaElement).value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  send(): void {
    void this.submitMessage(this.inputText().trim());
  }

  toggleTrace(messageId: string): void {
    this.expandedTraces.update((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  isTraceOpen(messageId: string): boolean {
    return this.expandedTraces().has(messageId);
  }

  private async submitMessage(text: string): Promise<void> {
    if (!text || !this.canSend()) return;
    this.inputText.set('');
    const ta = this.inputEl()?.nativeElement;
    if (ta) ta.value = '';
    await this.svc.sendMessage(text);
  }

  private scrollToBottom(): void {
    const el = this.msgContainer()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
