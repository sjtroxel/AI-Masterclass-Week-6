import type { Request, Response, NextFunction } from 'express';

/**
 * Route-level middleware that sets a public Cache-Control header.
 * Use on GET endpoints whose responses are stable for a known TTL.
 *
 * @param seconds How long downstream caches (CDN, browser) may cache the response.
 */
export function cacheFor(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds}`);
    next();
  };
}
