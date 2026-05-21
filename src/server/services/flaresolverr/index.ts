/**
 * FlareSolverr Module
 *
 * Provides Cloudflare bypass capability for any scraping service.
 *
 * @module flaresolverr
 *
 * @example
 * ```typescript
 * import { flareSolverr } from '@/server/services/flaresolverr';
 *
 * // Check if available
 * const healthy = await flareSolverr.isHealthy();
 *
 * // Fetch a URL through FlareSolverr
 * const result = await flareSolverr.fetch('https://comicvine.gamespot.com/...');
 * if (result.html) {
 *   // Parse HTML
 * }
 *
 * // Use sessions for cookie persistence
 * await flareSolverr.createSession('comicvine');
 * const result = await flareSolverr.fetch(url, { session: 'comicvine' });
 * ```
 */

export { FlareSolverrClient } from './flareSolverrClient';
export {
  flareSolverr,
  registerShutdownHandler,
  bootstrapFlareSolverr,
  cleanupOrphanedProcesses,
  reloadConfigFromDatabase,
} from './singleton';
export * from './types';
