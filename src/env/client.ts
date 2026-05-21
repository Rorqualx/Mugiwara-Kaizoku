/**
 * Client Environment Configuration Module
 * 
 * Provides type-safe access to client-side environment variables.
 * Only variables prefixed with NEXT_PUBLIC_ are accessible in the browser.
 * 
 * @module env/client
 */

import { z } from 'zod';
/**
 * Client Environment Variable Schema
 * 
 * Defines the expected structure for client-side environment variables.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),
});
/**
 * Client Environment Type
 * 
 * Inferred type from the client environment schema.
 */
export type ClientEnv = z.infer<typeof clientSchema>;
/**
 * Parse and Validate Client Environment Variables
 * 
 * @returns {ClientEnv} Validated client environment configuration
 */
function parseClientEnv(): ClientEnv {
  // In the browser, we access NEXT_PUBLIC_ variables directly
  const clientEnvVars = {
    NEXT_PUBLIC_APP_VERSION: process.env["NEXT_PUBLIC_APP_VERSION"] ??
                            process.env["npm_package_version"] ??
                            '0.0.0',
  };
  try {
    return clientSchema.parse(clientEnvVars);
  } catch (_error: unknown) {
    // Client env vars are optional, so we return defaults on error
    return {
      NEXT_PUBLIC_APP_VERSION: '0.0.0',
    };
  }
}

/**
 * Validated Client Environment Configuration
 * 
 * This export provides type-safe access to client-side environment variables.
 */
export const clientEnv = parseClientEnv();
