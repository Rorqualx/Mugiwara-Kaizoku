/**
 * TypeScript declaration file for environment variable schemas
 * 
 * This file defines the TypeScript types for environment variables used in the Kaizoku application.
 * It provides type definitions for both server-side and client-side environment variables.
 * 
 * @module env/schema
 */
import { z } from 'zod';

/**
 * Server-side environment variable schema
 * 
 * Defines the required and optional server environment variables and their expected formats.
 * This schema is used to validate process.env in server.mjs.
 */
export const serverSchema = z.object({
  /** Application environment: development, test, or production */
  NODE_ENV: z.enum(['development', 'test', 'production']),
  
  /** PostgreSQL database connection URL */
  DATABASE_URL: z.string().url(),
  
  /** Port number for the Kaizoku server to listen on */
  KAIZOKU_PORT: z.coerce.number().int().positive(),
  
  /** Path to store application logs */
  KAIZOKU_LOG_PATH: z.string().default('./logs'),
  
  /** Telegram bot token for notifications (optional) */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  
  /** Telegram chat ID for notifications (optional) */
  TELEGRAM_CHAT_ID: z.string().optional(),
  
  /** Kavita integration host URL (optional) */
  KAVITA_HOST: z.string().optional(),
  
  /** Kavita integration username (optional) */
  KAVITA_USER: z.string().optional(),
  
  /** Kavita integration password (optional) */
  KAVITA_PASSWORD: z.string().optional(),
  
  /** Kavita libraries to integrate with (optional) */
  KAVITA_LIBRARIES: z.array(z.string()).default([]),
  
  /** Komga integration host URL (optional) */
  KOMGA_HOST: z.string().optional(),
  
  /** Komga integration username (optional) */
  KOMGA_USER: z.string().optional(),
  
  /** Komga integration password (optional) */
  KOMGA_PASSWORD: z.string().optional(),
});

/**
 * Client-side environment variable schema
 * 
 * Defines the required client environment variables and their expected formats.
 * This schema is used to validate clientEnv in client.mjs.
 */
export const clientSchema = z.object({
  /** Application version, exposed to the client */
  NEXT_PUBLIC_APP_VERSION: z.string(),
});

/**
 * Client environment variable values
 * 
 * Contains the actual values for client-side environment variables.
 * These values are validated against clientSchema in client.mjs.
 */
export const clientEnv = {
  /** Application version from package.json or fallback */
  NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? '0.0.0',
};
