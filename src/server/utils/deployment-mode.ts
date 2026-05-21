/**
 * Deployment-mode detection — used by the path-mapping system to seed sensible
 * defaults and to surface the running mode in the settings UI.
 *
 * This is a pure detection helper. It MUST NOT branch behaviour by itself —
 * callers use the returned value as a hint (e.g. which default mappings to
 * seed, or what to display in settings). Any code path that actually needs
 * different behaviour in Docker should be reviewed for whether the difference
 * is necessary in the first place.
 */

import { existsSync } from 'fs';

import { logger } from '@/utils/logger';

export type DeploymentMode = 'docker' | 'host';

let cached: DeploymentMode | null = null;

/**
 * Returns 'docker' when running inside a container, 'host' otherwise.
 *
 * Detection order (first hit wins):
 *  1. `MUGIWARA_DEPLOYMENT_MODE` env explicitly set to 'docker' or 'host'.
 *  2. `/.dockerenv` exists (Docker writes this marker into every container).
 *  3. Default 'host'.
 *
 * Result is cached for the process lifetime. Restart the server to re-detect.
 */
export function detectDeploymentMode(): DeploymentMode {
  if (cached !== null) return cached;

  const envOverride = process.env['MUGIWARA_DEPLOYMENT_MODE'];
  if (envOverride === 'docker' || envOverride === 'host') {
    cached = envOverride;
    logger.info(`[deployment-mode] Resolved to '${cached}' via MUGIWARA_DEPLOYMENT_MODE env override`);
    return cached;
  }

  if (existsSync('/.dockerenv')) {
    cached = 'docker';
    logger.info('[deployment-mode] Resolved to docker via /.dockerenv marker');
    return cached;
  }

  cached = 'host';
  logger.info('[deployment-mode] Resolved to host (no docker markers found)');
  return cached;
}

/** Reset the cached mode. Test-only. */
export function resetDeploymentModeCache(): void {
  cached = null;
}
