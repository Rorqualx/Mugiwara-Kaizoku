/**
 * Process Environment Type Extensions
 *
 * This module extends the global NodeJS.ProcessEnv interface with
 * application-specific environment variables. Environment variables
 * are typed as optional because they may be undefined at runtime
 * before validation.
 *
 * @module types/process
 *
 * @remarks
 * IMPORTANT: This defines the RUNTIME types for process.env, where
 * variables can be undefined. For VALIDATED environment variables
 * (after validation), use the types from @/utils/validateEnv.
 */

/**
 * Global process environment augmentation
 * Extends NodeJS.ProcessEnv with application-specific variables
 *
 * @global
 * @interface NodeJS.ProcessEnv
 *
 * @remarks
 * All environment variables are marked as optional (string | undefined)
 * to reflect runtime reality. Use the validated env object from
 * validateEnv.ts for guaranteed non-null values.
 *
 * @example
 * ```ts
 * // Runtime access (may be undefined)
 * const port = process.env.KAIZOKU_PORT ?? '3000';
 *
 * // Validated access (guaranteed to exist)
 * import { env } from '@/utils/validateEnv';
 * const port = env.KAIZOKU_PORT; // always string
 * ```
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Core environment
      NODE_ENV?: 'development' | 'production' | 'test';

      // Database
      DATABASE_URL: string;

      // Application settings
      KAIZOKU_PORT?: string;

      // File system paths
      KAIZOKU_LOG_PATH?: string;

      // Optional integrations
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;

      // Optional Kavita integration
      KAVITA_HOST?: string;
      KAVITA_USER?: string;
      KAVITA_PASSWORD?: string;
      KAVITA_LIBRARIES?: string;

      // Optional Komga integration
      KOMGA_HOST?: string;
      KOMGA_USER?: string;
      KOMGA_PASSWORD?: string;
    }
  }
}
