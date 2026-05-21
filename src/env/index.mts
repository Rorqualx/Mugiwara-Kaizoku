/**
 * Environment variable module entry point
 *
 * This module serves as the main entry point for accessing environment variables
 * throughout the Kaizoku application. It re-exports variables and schemas from
 * the client and server modules, providing a unified interface for environment
 * variable access.
 *
 * @module env/index
 */

// Re-export all exports from client module
export { clientEnv } from './client';
export type { ClientEnv } from './client';

// Re-export all exports from server module
export {
  env,
  env as serverEnv,
  getEnvVar,
  isProduction,
  isDevelopment,
  isDocker
} from './server';
export type { ServerEnv } from './server';

/**
 * Default export for server environment variables
 *
 * This export provides a simple way to import server environment variables
 * without having to specify which environment is being accessed. This is
 * the recommended way to access environment variables in server-side code.
 *
 * @example
 * // Import server environment variables
 * import { env } from '@/env';
 *
 * // Use environment variables
 * const port = env.KAIZOKU_PORT;
 * const isDev = env.NODE_ENV === 'development';
 */
export { env as default } from './server';
