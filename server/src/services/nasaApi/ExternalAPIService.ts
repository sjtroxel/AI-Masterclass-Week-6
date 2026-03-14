import { ExternalAPIError, FatalAPIError } from '../../errors/AppError.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// Base class for all external API services.
// Provides retry with exponential backoff, Retry-After header awareness,
// and typed error surfacing. Each subclass builds its own URLs.
export abstract class ExternalAPIService {
  protected async get<T>(url: string): Promise<T> {
    return this.fetchWithRetry<T>(url, 0);
  }

  private async fetchWithRetry<T>(url: string, attempt: number): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url);
    } catch (err) {
      // Network-level failure (no response at all)
      if (attempt < MAX_RETRIES) {
        await this.sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        return this.fetchWithRetry<T>(url, attempt + 1);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new FatalAPIError(`Network error after ${MAX_RETRIES} retries: ${msg}`);
    }

    if (response.ok) {
      // Safe cast: callers supply T matching the actual API response shape
      return response.json() as Promise<T>;
    }

    // 429 or 5xx — retryable
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const delay = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1_000
        : BASE_DELAY_MS * Math.pow(2, attempt);
      await this.sleep(delay);
      return this.fetchWithRetry<T>(url, attempt + 1);
    }

    throw new ExternalAPIError(
      `HTTP ${response.status} ${response.statusText} — ${url}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
