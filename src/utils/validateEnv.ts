/**
 * Environment Variable Validation Module
 *
 * Provides type-safe validation and parsing of environment variables using Zod.
 * Enforces strict typing and validation rules for all environment configurations
 * used throughout the application.
 *
 * @module utils/validateEnv
 */
// import { logger } from '../utils/logger';
import { z } from 'zod';

import { ValidationError } from '../utils/errors';
/**
 * Environment variable schema definition
 * Validates and enforces types for all application environment variables
 *
 * @typedef {Object} EnvSchema
 * @property {('development'|'production'|'test')} NODE_ENV - Application environment
 * @property {string} DATABASE_URL - PostgreSQL connection string
 * @property {string} KAIZOKU_PORT - Application port number
 * @property {string} KAIZOKU_LOG_PATH - Path for application logs
 * @property {string} [TELEGRAM_BOT_TOKEN] - Optional Telegram bot integration token
 * @property {string} [TELEGRAM_CHAT_ID] - Required if TELEGRAM_BOT_TOKEN is provided
 * @property {string} [KAVITA_HOST] - Optional Kavita integration host URL
 * @property {string} [KAVITA_USER] - Optional Kavita username
 * @property {string} [KAVITA_PASSWORD] - Optional Kavita password
 * @property {string[]} [KAVITA_LIBRARIES] - Optional list of Kavita library IDs
 * @property {string} [KOMGA_HOST] - Optional Komga integration host URL
 * @property {string} [KOMGA_USER] - Optional Komga username
 * @property {string} [KOMGA_PASSWORD] - Optional Komga password
 */
export const envSchema = z.object({
  // Core environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Database
  DATABASE_URL: z.string().
  url().
  refine((url) => url.startsWith('postgresql://'), {
    message: 'DATABASE_URL must be a PostgreSQL connection string'
  }),
  // Application settings
  KAIZOKU_PORT: z.string().default('3000'),
  // File system paths
  KAIZOKU_LOG_PATH: z.string().default('./logs'),

  // Log rotation settings
  KAIZOKU_LOG_MAX_SIZE: z.string().default('10m'),
  KAIZOKU_LOG_MAX_FILES: z.coerce.number().int().positive().default(7),
  KAIZOKU_LOG_COMPRESS: z.coerce.boolean().default(true),
  KAIZOKU_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  // Optional integrations
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  // Optional Kavita integration
  KAVITA_HOST: z.string().optional(),
  KAVITA_USER: z.string().optional(),
  KAVITA_PASSWORD: z.string().optional(),
  KAVITA_LIBRARIES: z.array(z.string()).default([]),
  // Optional Komga integration
  KOMGA_HOST: z.string().optional(),
  KOMGA_USER: z.string().optional(),
  KOMGA_PASSWORD: z.string().optional()
}).refine((env) => {
  if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_CHAT_ID) {
    throw new ValidationError('TELEGRAM_CHAT_ID is required when TELEGRAM_BOT_TOKEN is provided');
  }
  return true;
});
/**
 * Inferred TypeScript type from the environment schema
 * Used for type checking throughout the application
 */
export type EnvSchema = z.infer<typeof envSchema>;
/**
 * Lazy-initialized environment object to prevent build-time errors
 */
let _env: EnvSchema | null = null;
/**
 * Get validated environment variables
 * Uses lazy initialization to prevent errors during build time
 *
 * @returns {EnvSchema} Validated environment object
 */
function getEnv(): EnvSchema {
  if (!_env) {
    try {
      _env = envSchema.parse(process.env);
    }
    catch (error: unknown) {
      // During build time, provide defaults for required fields
      if (process.env["NEXT_PHASE"] === 'phase-production-build') {
        _env = {
          NODE_ENV: 'production',
          DATABASE_URL: process.env["DATABASE_URL"] || 'postgresql://build:build@localhost:5432/build',
          KAIZOKU_PORT: process.env["KAIZOKU_PORT"] || '3000',
          KAIZOKU_LOG_PATH: process.env["KAIZOKU_LOG_PATH"] || './logs',
          KAIZOKU_LOG_MAX_SIZE: process.env["KAIZOKU_LOG_MAX_SIZE"] || '10m',
          KAIZOKU_LOG_MAX_FILES: parseInt(process.env["KAIZOKU_LOG_MAX_FILES"] || '7', 10),
          KAIZOKU_LOG_COMPRESS: process.env["KAIZOKU_LOG_COMPRESS"] !== 'false',
          KAIZOKU_LOG_RETENTION_DAYS: parseInt(process.env["KAIZOKU_LOG_RETENTION_DAYS"] || '30', 10),
          TELEGRAM_BOT_TOKEN: undefined,
          TELEGRAM_CHAT_ID: undefined,
          KAVITA_HOST: undefined,
          KAVITA_USER: undefined,
          KAVITA_PASSWORD: undefined,
          KAVITA_LIBRARIES: [],
          KOMGA_HOST: undefined,
          KOMGA_USER: undefined,
          KOMGA_PASSWORD: undefined
        } as EnvSchema;
      } else
      {
        throw error;
      }
    }
  }
  return _env;
}
/**
 * Validated and typed environment object
 * Contains all environment variables with proper type conversion
 *
 * @type {Readonly<{
 *   NODE_ENV: 'development' | 'production' | 'test',
 *   KAIZOKU_PORT: number,
 *   DATABASE_URL: string,
 *   KAIZOKU_LOG_PATH: string
 * }>}
 */
export const env = new Proxy({} as const, {
  get(_, prop: string) {
    const envData = getEnv();
    if (prop === 'KAIZOKU_PORT') {
      return parseInt(envData.KAIZOKU_PORT, 10);
    }
    return envData[prop as keyof EnvSchema];
  }
}) as Readonly<{
  NODE_ENV: 'development' | 'production' | 'test';
  KAIZOKU_PORT: number;
  DATABASE_URL: string;
  KAIZOKU_LOG_PATH: string;
  KAIZOKU_LOG_MAX_SIZE: string;
  KAIZOKU_LOG_MAX_FILES: number;
  KAIZOKU_LOG_COMPRESS: boolean;
  KAIZOKU_LOG_RETENTION_DAYS: number;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  KAVITA_HOST?: string;
  KAVITA_USER?: string;
  KAVITA_PASSWORD?: string;
  KAVITA_LIBRARIES: string[];
  KOMGA_HOST?: string;
  KOMGA_USER?: string;
  KOMGA_PASSWORD?: string;
}>;
/**
 * Type definition for the validated environment object
 * Used for type checking when accessing environment variables
 */
export type Env = typeof env;
/**
 * Type augmentation for process.env
 * Ensures TypeScript properly types process.env access
 */
type ProcessEnvAugmentation = EnvSchema;
/**
 * Export ProcessEnvAugmentation type for use in environment.d.ts
 * This allows proper typing of process.env throughout the application
 */
export type { ProcessEnvAugmentation };