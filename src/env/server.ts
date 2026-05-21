/**
 * Server Environment Configuration Module
 * 
 * Provides type-safe access to server-side environment variables.
 * This module ensures all required environment variables are present
 * and properly typed for use throughout the server application.
 * 
 * @module env/server
 */

import { z } from 'zod';

/**
 * Environment Variable Schema
 * 
 * Defines the expected structure and types for all server-side
 * environment variables used by the application.
 */
const envSchema = z.object({
  // Database Configuration
  DATABASE_URL: z.string().url().optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  KAIZOKU_PORT: z.string().default('3000'),
  KAIZOKU_LOG_PATH: z.string().default('logs'),
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),
  
  // Docker Configuration
  DOCKER: z.string().optional(),
  TZ: z.string().default('UTC'),
  
  // Authentication
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  
  // API Keys: Provider keys are stored in the DB Config table, not .env
  // Use the Settings UI or DB directly to configure provider API keys.

  // Feature Flags
  USE_AI_AGENT: z.enum(['true', 'false']).default('false'),
});

/**
 * Server Environment Type
 * 
 * Inferred type from the environment schema for type safety.
 */
export type ServerEnv = z.infer<typeof envSchema>;

/**
 * Parse and Validate Environment Variables
 * 
 * Parses the process.env object and validates it against the schema.
 * Provides defaults where appropriate and ensures type safety.
 * 
 * @returns {ServerEnv} Validated environment configuration
 * @throws {Error} If required environment variables are missing or invalid
 */
function parseEnv(): ServerEnv {
  try {
    return envSchema.parse(process.env);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      throw new Error(
        `Environment validation failed:\n${issues}\n\n` +
        `Please check your environment variables and ensure they match the expected format.`
      );
    }
    
    throw error;
  }
}

/**
 * Lazy-initialized environment object
 */
let _env: ServerEnv | null = null;

/**
 * Validated Server Environment Configuration
 * 
 * This export provides type-safe access to all server-side environment
 * variables. Uses lazy initialization to prevent build-time errors.
 */
export const env = new Proxy({} as ServerEnv, {
  get(_, prop: string) {
    if (!_env) {
      try {
        _env = parseEnv();
      } catch (error: unknown) {
        // During build time, provide defaults
        if (typeof window === 'undefined' &&
            process.env["NEXT_PHASE"] === 'phase-production-build') {
           
          const nodeEnv = process.env['NODE_ENV'];
          const isValidEnv = (env: string | undefined): env is 'development' | 'production' | 'test' =>
            env === 'development' || env === 'production' || env === 'test';
          const validNodeEnv: 'development' | 'production' | 'test' =
            isValidEnv(nodeEnv) ? nodeEnv : 'production';

          _env = {
            DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://build:build@localhost:5432/build',
            NODE_ENV: validNodeEnv,
            KAIZOKU_PORT: process.env['KAIZOKU_PORT'] ?? '3000',
            KAIZOKU_LOG_PATH: process.env['KAIZOKU_LOG_PATH'] ?? 'logs',
            NEXT_PUBLIC_APP_VERSION: process.env['NEXT_PUBLIC_APP_VERSION'],
            DOCKER: process.env['DOCKER'],
            TZ: process.env['TZ'] ?? 'UTC',
            AUTH_SECRET: process.env['AUTH_SECRET'],
            NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'],
            NEXTAUTH_URL: process.env['NEXTAUTH_URL'],
            // Provider API keys are in DB Config table, not .env
            USE_AI_AGENT: (process.env['USE_AI_AGENT'] === 'true' || process.env['USE_AI_AGENT'] === 'false') ? process.env['USE_AI_AGENT'] : 'false',
          };
        } else {
          throw error;
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- _env is guaranteed to be set by the try block above
    return _env![prop as keyof ServerEnv];
  }
});

/**
 * Helper function to get environment variable with fallback
 * 
 * @param {keyof ServerEnv} key - Environment variable key
 * @param {string} fallback - Fallback value if not set
 * @returns {string} Environment value or fallback
 */
export function getEnvVar(key: keyof ServerEnv, fallback: string): string {
  const value = env[key];
  return value ?? fallback;
}

/**
 * Check if running in production
 * 
 * @returns {boolean} True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 * 
 * @returns {boolean} True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Check if running in Docker
 * 
 * @returns {boolean} True if DOCKER environment variable is 'true'
 */
export function isDocker(): boolean {
  return env.DOCKER === 'true';
}
