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

// ── SVG layout constants ──────────────────────────────────────────────────────
const SVG_W   = 600;
const SVG_H   = 160;
const ML      = 8;    // margin left
const MR      = 8;    // margin right
const MT      = 10;   // margin top
const MB      = 46;   // margin bottom (room for date labels)
const CHART_W = SVG_W - ML - MR;   // 584
const CHART_H = SVG_H - MT - MB;   // 104
const BASELINE_Y = MT + CHART_H;   // 114

interface SvgBar {
  barX: number;
  barY: number;
  barH: number;
  barW: number;
  color: string;
  labelX: number;
  dateLabelY: number;
  distLabelY: number;
  dateLabel: string;
  distLabel: string;
  approach: TimelineApproach;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function barColor(km: number): string {
  if (km < 50_000)     return '#f59e0b'; // amber-400 — very close
  if (km < 500_000)    return '#fb923c'; // orange-400
  if (km < 2_000_000)  return '#60a5fa'; // blue-400
  return '#94a3b8';                       // slate-400 — distant
}

function fmtDateShort(iso: string, spanYears: number): string {
  const d = new Date(iso);
  if (spanYears > 2) return String(d.getUTCFullYear());
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

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

      <!-- ── Mobile: horizontal scrollable pill list ───────────────── -->
      <div class="block md:hidden overflow-x-auto pb-1 -mx-1 px-1">
        <div class="flex gap-2 min-w-max">
          @for (a of sorted(); track a.close_approach_date) {
            <div class="flex-shrink-0 rounded-full border px-3 py-2 min-h-[44px] flex flex-col justify-center"
                 [class]="pillClass(a.miss_distance_km)">
              <p class="text-xs font-semibold whitespace-nowrap leading-tight">
                {{ formatDateLong(a.close_approach_date) }}
              </p>
              <p class="text-[10px] whitespace-nowrap opacity-75 mt-0.5 leading-tight">
                {{ formatDist(a.miss_distance_km) }}
                @if (a.relative_velocity_km_s) {
                  · {{ a.relative_velocity_km_s.toFixed(2) }} km/s
                }
              </p>
            </div>
          }
        </div>
      </div>

      <!-- ── Desktop: SVG bar timeline ────────────────────────────── -->
      <div class="hidden md:block">
        <svg viewBox="0 0 600 160" width="100%" aria-label="Close approach timeline" role="img">

          <!-- Baseline -->
          <line x1="8" y1="114" x2="592" y2="114"
                stroke="#374151" stroke-width="1"/>

          @for (bar of svgBars(); track bar.approach.close_approach_date) {
            <!-- Bar -->
            <rect
              [attr.x]="bar.barX"
              [attr.y]="bar.barY"
              [attr.width]="bar.barW"
              [attr.height]="bar.barH"
              [attr.fill]="bar.color"
              rx="3"
              opacity="0.85"
            />
            <!-- Distance label above bar -->
            <text
              [attr.x]="bar.labelX"
              [attr.y]="bar.distLabelY"
              text-anchor="middle"
              style="font-size:9px;font-family:system-ui,sans-serif"
              [attr.fill]="bar.color"
            >{{ bar.distLabel }}</text>
            <!-- Date label below baseline -->
            <text
              [attr.x]="bar.labelX"
              [attr.y]="bar.dateLabelY"
              text-anchor="middle"
              style="font-size:10px;font-family:system-ui,sans-serif"
              fill="#94a3b8"
            >{{ bar.dateLabel }}</text>
          }
        </svg>
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

  // Compute SVG bar geometry from sorted approaches
  readonly svgBars = computed<SvgBar[]>(() => {
    const items = this.sorted();
    if (items.length === 0) return [];

    const dateMs = items.map(a => new Date(a.close_approach_date).getTime());
    const minDate = Math.min(...dateMs);
    const maxDate = Math.max(...dateMs);
    const dateRange = maxDate - minDate || 1;
    const spanYears = dateRange / (365.25 * 24 * 60 * 60 * 1000);

    const distances = items.map(a => a.miss_distance_km);
    const maxDist = Math.max(...distances);

    // Bar width: fill ~60% of per-bar slot, clamped to [10, 48]
    const barW = Math.min(48, Math.max(10, (CHART_W / items.length) * 0.6));

    return items.map(a => {
      const t = new Date(a.close_approach_date).getTime();

      // centerX: for a single item, center in chart; otherwise proportional
      const centerX =
        items.length === 1
          ? ML + CHART_W / 2
          : ML + CHART_W * ((t - minDate) / dateRange);

      const barX = centerX - barW / 2;
      const barH = Math.max(4, CHART_H * (a.miss_distance_km / maxDist));
      const barY = BASELINE_Y - barH;

      return {
        barX,
        barY,
        barH,
        barW,
        color: barColor(a.miss_distance_km),
        labelX: centerX,
        dateLabelY: BASELINE_Y + 16,
        distLabelY: barY - 3,
        dateLabel: fmtDateShort(a.close_approach_date, spanYears),
        distLabel: fmtDist(a.miss_distance_km),
        approach: a,
      };
    });
  });

  // Template helpers (called from template — must be methods not private)
  formatDateLong(iso: string): string { return fmtDateLong(iso); }
  formatDist(km: number):   string { return fmtDist(km); }

  pillClass(km: number): string {
    if (km < 50_000)
      return 'border-amber-600/60 bg-amber-950/40 text-amber-300';
    if (km < 500_000)
      return 'border-orange-600/60 bg-orange-950/40 text-orange-300';
    if (km < 2_000_000)
      return 'border-blue-700/60 bg-blue-950/40 text-blue-300';
    return 'border-space-600 bg-space-900 text-space-300';
  }
}
