/**
 * env.ts
 *
 * Build-time environment variable access.
 * Angular's @angular/build (esbuild) replaces import.meta.env.NG_APP_* with the
 * literal string value at build time — the expression never reaches the browser.
 *
 * In development (ng serve / Vite), import.meta.env is polyfilled by Vite and
 * NG_APP_API_BASE_URL is undefined → API_BASE_URL is '', so all calls stay
 * relative (/api/...) and the dev-server proxy forwards them to localhost:3001.
 *
 * In production (Vercel build), NG_APP_API_BASE_URL=https://<railway>.railway.app
 * is set before ng build runs. esbuild replaces import.meta.env.NG_APP_API_BASE_URL
 * with that string, so no runtime access to import.meta.env ever occurs.
 */

// Augment ImportMeta so TypeScript accepts the NG_APP_ property.
// The actual value is substituted by esbuild at build time.
declare global {
  interface ImportMeta {
    env: { readonly NG_APP_API_BASE_URL?: string };
  }
}

export const API_BASE_URL: string = import.meta.env.NG_APP_API_BASE_URL ?? '';
