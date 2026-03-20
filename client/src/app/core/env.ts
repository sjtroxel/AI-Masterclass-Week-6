/**
 * env.ts
 *
 * Build-time environment variable access.
 * Angular's @angular/build (esbuild) injects NG_APP_* variables from the
 * environment into the bundle via import.meta.env at build time.
 *
 * In development (no NG_APP_API_BASE_URL set), API_BASE_URL is '' and
 * all calls remain relative (/api/...), resolved by the Angular dev-server
 * proxy to http://localhost:3001.
 *
 * In production on Vercel, NG_APP_API_BASE_URL=https://<railway-domain>.railway.app
 * is set as a Vercel environment variable before the build runs.
 */

const metaEnv = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export const API_BASE_URL: string = metaEnv['NG_APP_API_BASE_URL'] ?? '';
