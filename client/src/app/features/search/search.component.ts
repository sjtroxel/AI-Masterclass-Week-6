import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchService } from './search.service';
import { AsteroidCardComponent } from './asteroid-card.component';
import type { AsteroidFilters, SortColumn } from '../../core/api.service';

const SPECTRAL_TYPES = ['C', 'S', 'X', 'B', 'D', 'F', 'G', 'K', 'L', 'P', 'Q', 'T', 'V'];

interface SortOption {
  label: string;
  sort_by: SortColumn;
  sort_dir: 'asc' | 'desc';
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Size (H mag)',          sort_by: 'absolute_magnitude_h',  sort_dir: 'asc'  },
  { label: 'Named first (A→Z)',     sort_by: 'has_real_name',          sort_dir: 'asc'  },
  { label: 'Named first (Z→A)',     sort_by: 'has_real_name',          sort_dir: 'desc' },
  { label: 'Diameter (largest)',    sort_by: 'diameter_min_km',        sort_dir: 'desc' },
  { label: 'Diameter (smallest)',   sort_by: 'diameter_min_km',        sort_dir: 'asc'  },
  { label: 'Next approach (soon)',  sort_by: 'next_approach_date',     sort_dir: 'asc'  },
  { label: 'Delta-V (accessible)',  sort_by: 'nhats_min_delta_v_kms',  sort_dir: 'asc'  },
  { label: 'Name (A→Z)',            sort_by: 'name',                   sort_dir: 'asc'  },
];

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, AsteroidCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-space-950">

      <!-- Page header -->
      <header class="px-4 pt-6 pb-4 md:px-8 md:pt-8 border-b border-space-800">
        <h1 class="text-xl font-bold text-white md:text-2xl">Asteroid Search</h1>
        <p class="text-space-300 text-sm mt-1">
          Browse {{ totalLabel() }} or search by description
        </p>
      </header>

      <!-- Search bar -->
      <div class="px-4 py-4 md:px-8 border-b border-space-800 bg-space-900/50">
        <form (ngSubmit)="submitSearch()" class="flex gap-2">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-space-400 pointer-events-none"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              [(ngModel)]="queryInput"
              name="query"
              placeholder='e.g. "metallic asteroid accessible before 2035"'
              class="w-full bg-space-800 border border-space-600 rounded-lg
                     pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-space-400
                     focus:outline-none focus:border-nebula-500 focus:ring-1 focus:ring-nebula-500/50
                     min-h-[44px]"
            />
          </div>
          <button
            type="submit"
            class="px-4 py-2.5 bg-nebula-600 hover:bg-nebula-500 text-white text-sm font-medium
                   rounded-lg transition-colors min-h-[44px] min-w-[44px]">
            Search
          </button>
          @if (svc.query()) {
            <button
              type="button"
              (click)="clearSearch()"
              class="px-3 py-2.5 bg-space-800 hover:bg-space-700 text-space-300 hover:text-white
                     text-sm rounded-lg transition-colors min-h-[44px] min-w-[44px]">
              Clear
            </button>
          }
        </form>
      </div>

      <div class="md:flex">

        <!-- Filter sidebar — desktop only, hidden in semantic mode -->
        @if (svc.mode() === 'browse') {
          <aside class="hidden md:block md:w-56 md:shrink-0 px-5 py-5
                        border-r border-space-800 space-y-5">
            <div>
              <h2 class="text-[10px] font-semibold uppercase tracking-widest text-space-300 mb-2">
                Hazard
              </h2>
              <label class="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input type="checkbox"
                       [(ngModel)]="filterPha"
                       (ngModelChange)="applyFilters()"
                       name="filterPha"
                       class="w-4 h-4 rounded border-space-600 bg-space-800
                              accent-nebula-500 cursor-pointer" />
                <span class="text-sm text-space-300">Potentially Hazardous</span>
              </label>
            </div>

            <div>
              <h2 class="text-[10px] font-semibold uppercase tracking-widest text-space-300 mb-2">
                Mission Access
              </h2>
              <label class="flex items-center gap-2 cursor-pointer min-h-[44px]">
                <input type="checkbox"
                       [(ngModel)]="filterNhats"
                       (ngModelChange)="applyFilters()"
                       name="filterNhats"
                       class="w-4 h-4 rounded border-space-600 bg-space-800
                              accent-nebula-500 cursor-pointer" />
                <span class="text-sm text-space-300">NHATS Accessible</span>
              </label>
            </div>

            <div>
              <h2 class="text-[10px] font-semibold uppercase tracking-widest text-space-300 mb-3">
                Spectral Class
              </h2>
              <div class="flex flex-wrap gap-1.5">
                @for (type of spectralTypes; track type) {
                  <button
                    (click)="toggleSpectral(type)"
                    [class]="spectralBtnClass(type)"
                    class="px-2.5 py-1 rounded text-xs font-mono font-medium
                           border transition-colors min-h-8 min-w-8">
                    {{ type }}
                  </button>
                }
              </div>
              @if (filterSpectral()) {
                <button (click)="clearSpectral()"
                        class="mt-2 text-[10px] text-space-400 hover:text-space-200 transition-colors">
                  Clear filter
                </button>
              }
            </div>

            <!-- Mobile-visible filter chips when collapsed -->
          </aside>
        }

        <!-- Results area -->
        <main class="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-5">

          <!-- Sort control — browse mode only -->
          @if (svc.mode() === 'browse') {
            <div class="mb-4 flex items-center gap-2">
              <label for="sort-select" class="text-xs text-space-400 shrink-0">Sort by</label>
              <select id="sort-select"
                      [(ngModel)]="activeSortIndex"
                      (ngModelChange)="applySort()"
                      name="sortSelect"
                      class="bg-space-800 border border-space-600 rounded-lg px-3 py-2
                             text-sm text-white focus:outline-none focus:border-nebula-500
                             min-h-[44px] cursor-pointer">
                @for (opt of sortOptions; track $index) {
                  <option [value]="$index">{{ opt.label }}</option>
                }
              </select>
            </div>
          }

          <!-- Semantic search badge -->
          @if (svc.mode() === 'semantic') {
            <div class="mb-4 flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full text-xs font-medium
                           bg-nebula-600/20 text-nebula-400 border border-nebula-600/30">
                Semantic search
              </span>
              <span class="text-space-300 text-xs">
                Results ranked by relevance
              </span>
            </div>
          }

          <!-- Error state -->
          @if (svc.error()) {
            <div class="rounded-lg bg-hazard-500/10 border border-hazard-500/30 p-4 mb-4">
              <p class="text-hazard-400 text-sm">{{ svc.error() }}</p>
            </div>
          }

          <!-- Loading skeleton -->
          @if (svc.isLoading()) {
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (_ of skeletons; track $index) {
                <div class="bg-space-900 border border-space-700 rounded-xl p-4 animate-pulse">
                  <div class="h-4 bg-space-700 rounded w-3/4 mb-3"></div>
                  <div class="h-3 bg-space-700 rounded w-1/2 mb-4"></div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="h-3 bg-space-800 rounded"></div>
                    <div class="h-3 bg-space-800 rounded"></div>
                    <div class="h-3 bg-space-800 rounded"></div>
                    <div class="h-3 bg-space-800 rounded"></div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Results grid -->
          @if (!svc.isLoading()) {
            @if (svc.mode() === 'browse') {
              @if (svc.browseResults().length > 0) {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (asteroid of svc.browseResults(); track asteroid.id) {
                    <app-asteroid-card [asteroid]="asteroid" />
                  }
                </div>
                <div class="mt-6 flex items-center justify-between">
                  <p class="text-space-400 text-sm">
                    Page {{ svc.page() }} of {{ totalPages() }}
                  </p>
                  <div class="flex gap-2">
                    <button
                      (click)="prevPage()"
                      [disabled]="svc.page() <= 1"
                      class="px-4 py-2 bg-space-800 hover:bg-space-700 text-white text-sm
                             rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                             min-h-[44px]">
                      Previous
                    </button>
                    <button
                      (click)="nextPage()"
                      [disabled]="svc.page() >= totalPages()"
                      class="px-4 py-2 bg-space-800 hover:bg-space-700 text-white text-sm
                             rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                             min-h-[44px]">
                      Next
                    </button>
                  </div>
                </div>
              } @else {
                <div class="text-center py-16 text-space-400">
                  <p class="text-lg font-medium text-white mb-2">No asteroids found</p>
                  <p class="text-sm">Try adjusting your filters</p>
                </div>
              }
            } @else {
              @if (svc.searchResults().length > 0) {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (asteroid of svc.searchResults(); track asteroid.id) {
                    <app-asteroid-card [asteroid]="asteroid" />
                  }
                </div>
              } @else if (!svc.error()) {
                <div class="text-center py-16 text-space-400">
                  <p class="text-lg font-medium text-white mb-2">No results</p>
                  <p class="text-sm">Try a different search query</p>
                </div>
              }
            }
          }
        </main>
      </div>
    </div>
  `,
})
export class SearchComponent implements OnInit {
  readonly svc = inject(SearchService);

  readonly queryInput = signal('');
  readonly filterPha = signal(false);
  readonly filterNhats = signal(false);
  readonly filterSpectral = signal<string | undefined>(undefined);
  readonly activeSortIndex = signal(0);

  readonly spectralTypes = SPECTRAL_TYPES;
  readonly sortOptions = SORT_OPTIONS;
  readonly skeletons = Array(6).fill(null);

  readonly totalPages = () =>
    Math.max(1, Math.ceil(this.svc.total() / 20));

  readonly totalLabel = () => {
    // Use catalog size (unfiltered) for the headline so it never varies with sort/filter state.
    const cat = this.svc.catalogSize();
    const t = cat ?? this.svc.total();
    return t > 0 ? `${t.toLocaleString()} asteroids` : 'asteroids';
  };

  ngOnInit(): void {
    this.svc.loadCatalogSize();
    this.svc.loadBrowsePage(1, {});
  }

  submitSearch(): void {
    const q = this.queryInput().trim();
    if (q) {
      this.svc.runSearch(q);
    }
  }

  clearSearch(): void {
    this.queryInput.set('');
    this.svc.clearSearch();
    this.svc.loadBrowsePage(1, this.buildFilters());
  }

  applyFilters(): void {
    this.svc.loadBrowsePage(1, this.buildFilters());
  }

  toggleSpectral(type: string): void {
    const current = this.filterSpectral();
    this.filterSpectral.set(current === type ? undefined : type);
    this.applyFilters();
  }

  clearSpectral(): void {
    this.filterSpectral.set(undefined);
    this.applyFilters();
  }

  applySort(): void {
    this.svc.loadBrowsePage(1, this.buildFilters());
  }

  spectralBtnClass(type: string): string {
    return this.filterSpectral() === type
      ? 'bg-nebula-600 border-nebula-500 text-white'
      : 'bg-space-800 border-space-600 text-space-300 hover:border-nebula-600 hover:text-white';
  }

  prevPage(): void {
    const p = this.svc.page();
    if (p > 1) this.svc.loadBrowsePage(p - 1, this.buildFilters());
  }

  nextPage(): void {
    const p = this.svc.page();
    if (p < this.totalPages()) this.svc.loadBrowsePage(p + 1, this.buildFilters());
  }

  private buildFilters(): AsteroidFilters {
    const filters: AsteroidFilters = {};
    if (this.filterPha()) filters.is_pha = true;
    if (this.filterNhats()) filters.nhats_accessible = true;
    const spectral = this.filterSpectral();
    if (spectral) filters.spectral_type = spectral;
    const sort = SORT_OPTIONS[this.activeSortIndex()];
    if (sort) {
      filters.sort_by = sort.sort_by;
      filters.sort_dir = sort.sort_dir;
    }
    return filters;
  }
}
