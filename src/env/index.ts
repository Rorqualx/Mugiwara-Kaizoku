/**
 * Environment Variable Module
 * 
 * Unified entry point for all environment variable access in the Kaizoku application.
 * This module provides type-safe access to both server and client environment variables.
 * 
 * @module env
 */

// Server environment exports
export type { env, env as serverEnv, getEnvVar, isProduction, isDevelopment, isDocker } from './server';
export type { ServerEnv } from './server';
// Client environment exports
export type { clientEnv } from './client';
export type { ClientEnv } from './client';
/**
 * Default export for convenience
 * Exports server environment for server-side code
 */
export type { env as default } from './server';
