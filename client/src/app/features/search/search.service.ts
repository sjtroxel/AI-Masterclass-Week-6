import { Injectable, inject, signal, computed } from '@angular/core';
import {
  ApiService,
  type AsteroidListItem,
  type AsteroidSearchResult,
  type AsteroidFilters,
} from '../../core/api.service';

export type SearchMode = 'browse' | 'semantic';

export interface SearchState {
  mode: SearchMode;
  query: string;
  filters: AsteroidFilters;
  page: number;
  isLoading: boolean;
  error: string | null;
  browseResults: AsteroidListItem[];
  searchResults: AsteroidSearchResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiService);

  // ── State signals ─────────────────────────────────────────────────────────

  readonly query = signal('');
  readonly filters = signal<AsteroidFilters>({});
  readonly page = signal(1);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly browseResults = signal<AsteroidListItem[]>([]);
  readonly searchResults = signal<AsteroidSearchResult[]>([]);
  readonly total = signal(0);
  /** Full catalog count — fetched once with no filters; unaffected by sort/filter state. */
  readonly catalogSize = signal<number | null>(null);

  readonly mode = computed<SearchMode>(() =>
    this.query().trim().length > 0 ? 'semantic' : 'browse',
  );

  // ── Catalog size (fetched once, never changes with filters) ──────────────

  loadCatalogSize(): void {
    if (this.catalogSize() !== null) return; // already loaded
    this.api.listAsteroids(1, 1, {}).subscribe({
      next: (res) => this.catalogSize.set(res.total),
      error: () => { /* non-critical — headline falls back to filtered total */ },
    });
  }

  // ── Browse (filter-based) ─────────────────────────────────────────────────

  loadBrowsePage(page: number, filters: AsteroidFilters = {}): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.page.set(page);
    this.filters.set(filters);

    this.api.listAsteroids(page, 20, filters).subscribe({
      next: (res) => {
        this.browseResults.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Failed to load asteroids');
        this.isLoading.set(false);
      },
    });
  }

  // ── Semantic search ───────────────────────────────────────────────────────

  runSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    this.query.set(trimmed);
    this.isLoading.set(true);
    this.error.set(null);

    this.api.searchAsteroids(trimmed, 40).subscribe({
      next: (res) => {
        this.searchResults.set(res.data);
        this.total.set(res.total);
        this.isLoading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err instanceof Error ? err.message : 'Search failed');
        this.isLoading.set(false);
      },
    });
  }

  clearSearch(): void {
    this.query.set('');
    this.searchResults.set([]);
    this.total.set(0);
    this.error.set(null);
  }
}
