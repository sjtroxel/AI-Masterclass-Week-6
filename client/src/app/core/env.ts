/**
 * env.ts
 *
 * Build-time environment configuration.
 * In development, environment.ts is used → apiBaseUrl is '' → all /api/* calls
 * are relative and the dev-server proxy forwards them to localhost:3001.
 *
 * In production (Vercel), Angular's fileReplacements swaps environment.ts for
 * environment.prod.ts at build time → apiBaseUrl is the Railway URL, baked in
 * as a plain string literal in the bundle.
 */

import { environment } from '../../environments/environment';

export const API_BASE_URL: string = environment.apiBaseUrl;
