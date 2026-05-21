/**
 * FlareSolverr Client Configuration
 *
 * Constants and default configuration for the FlareSolverr client.
 *
 * @module flaresolverr/flareSolverrClient/config
 */

import * as path from 'path';

import type { FlareSolverrConfig } from '@/server/services/flaresolverr/types';

/**
 * Default configuration — hardcoded defaults only (no process.env reads).
 * The DB is the single source of truth. These defaults are used only until
 * initialize() loads the actual config from the FlareSolverrConfig table.
 */
export const DEFAULT_CONFIG: FlareSolverrConfig = {
  url: 'http://localhost:8191/v1',
  enabled: true,
  timeout: 60000,
  sessionTTL: 1800000,
  disableMedia: true,
  defaultWaitSeconds: 0,
};

/** PID file path for tracking FlareSolverr process */
export const PID_FILE_PATH = path.join(process.cwd(), '.flaresolverr.pid');

/** Maximum consecutive failures before attempting restart */
export const MAX_CONSECUTIVE_FAILURES = 3;

/** Cooldown period between restart attempts (5 minutes) */
export const RESTART_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Minimum recommended version for flaresolverr-go
 * Note: 'dev' version is always considered valid (development builds)
 */
export const MINIMUM_VERSION = '0.1.0';

/** Health check cache interval (1 minute) */
export const HEALTH_CHECK_INTERVAL_MS = 60000;
