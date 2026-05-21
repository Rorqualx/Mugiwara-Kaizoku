/**
 * Database Testing and Health Check Utilities
 *
 * This module provides utilities for testing database connectivity, schema validation,
 * and overall database health monitoring. It includes retry logic for connection attempts
 * and detailed error logging for troubleshooting.
 *
 * @module databaseTest
 */
import { prisma } from "../server/db";

import { logger } from './logging';

import type { PrismaClient } from '@prisma/client';
// import { 
//   PrismaClientInitializationError, 
//   PrismaClientKnownRequestError 
// } from '@prisma/client/runtime/library'; // Import removed - using any type casting
/**
 * Custom error class for Prisma client-related errors
 *
 * @class PrismaClientError
 * @extends Error
 * @example
 * throw new PrismaClientError('Failed to connect to database');
 */
export class PrismaClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientError';
  }
}
/**
 * Tests database connection with retry logic
 *
 * Attempts to establish a connection to the database with configurable retry attempts.
 * On failure, waits between attempts and provides detailed error logging.
 *
 * @returns {Promise<boolean>} True if connection successful, never returns false (throws instead)
 * @throws {PrismaClientError} If connection fails after max retries
 * @example
 * try {
 *   const connected = await testDatabaseConnection();
 *   logger.info('Database connected:', connected);
 * } catch (error) {
 *   console.error('Connection failed:', error);
 * }
 */
export async function testDatabaseConnection(): Promise<boolean> {
  const maxRetries = 5;
  const retryDelay = 2000; // milliseconds
  logger.info('Testing database connection...');

  /* eslint-disable no-await-in-loop */
  // Sequential execution is required for retry logic - each attempt must complete before the next
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting database connection (Attempt ${attempt}/${maxRetries})...`);
      // Test connection
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection successful');
      return true;
    }
    catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
// const errorMsg60 = errorMessage;
      logger.error(`Connection attempt ${attempt} failed: ${errorMessage}`);
      // On last attempt, log detailed error and throw
      if (attempt === maxRetries) {
        logDetailedError(error);
        throw new PrismaClientError(`Failed to connect to database after ${maxRetries} attempts`);
      }
      // Wait before retry
      await delay(retryDelay);
    }
  }
  /* eslint-enable no-await-in-loop */

  return false;
}
/**
 * Logs detailed database error information
 *
 * Handles different Prisma error types and logs appropriate details for debugging.
 * Includes connection details with masked sensitive information.
 *
 * @param {unknown} error - The error to log
 * @example
 * logDetailedError(new PrismaClientInitializationError(...));
 */
function logDetailedError(error: unknown): void {
  // Type guard for Prisma-like errors
  interface PrismaError {
    name: string;
    message: string;
    errorCode?: string;
    clientVersion?: string;
    code?: string;
    meta?: unknown;
  }

  function isPrismaError(err: unknown): err is PrismaError {
    return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
  }

  if (isPrismaError(error) && error.name === 'PrismaClientInitializationError') {
    logger.error(`Prisma initialization error: ${error.message}`, JSON.stringify({
      errorCode: error.errorCode ?? 'unknown',
      clientVersion: error.clientVersion ?? 'unknown'
    }));
  } else
  if (isPrismaError(error) && error.name === 'PrismaClientKnownRequestError') {
    logger.error(`Prisma known request error: ${error.message}`, JSON.stringify({
      code: error.code ?? 'unknown',
      meta: error.meta ?? {}
    }));
  } else
  if (error instanceof Error) {
    logger.error(`Unknown database error: ${(error instanceof Error ? error.message : String(error))}`, JSON.stringify({
      name: (error instanceof Error ? error.name : String(error)),
      stack: (error instanceof Error ? error.stack : String(error))
    }));
  } else
  {
    logger.error(`Unknown error type: ${String(error)}`);
  }
  // Log database connection details (with masked credentials)
  const dbUrl = (process.env["DATABASE_URL"] as string | undefined) ?? '';
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  logger.info('Database connection details', JSON.stringify({
    url: maskedUrl,
    nodeEnv: process.env.NODE_ENV
  }));
}
/**
 * Creates a promise that resolves after specified milliseconds
 *
 * Used for implementing delay between connection retry attempts.
 *
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after the delay
 * @example
 * await delay(2000); // Waits for 2 seconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
/**
 * Verifies that the database schema and required tables exist
 *
 * Tests access to critical tables to ensure database schema is properly set up.
 *
 * @returns {Promise<boolean>} True if schema verification successful
 * @throws {PrismaClientError} If schema verification fails
 * @example
 * try {
 *   const valid = await verifyDatabaseSchema();
 *   logger.info('Schema valid:', valid);
 * } catch (error) {
 *   console.error('Schema verification failed:', error);
 * }
 */
export async function verifyDatabaseSchema(): Promise<boolean> {
  try {
    // Test critical tables
    await prisma.library.findFirst();
    await prisma.manga.findFirst();
    await prisma.chapter.findFirst();
    logger.info('Database schema verification successful');
    return true;
  }
  catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Database schema verification failed: ${errorMessage}`);
    throw new PrismaClientError('Database schema verification failed');
  }
}
/**
 * Performs a comprehensive database health check
 *
 * Tests database connectivity, schema validity, and measures response time.
 * Provides detailed health status information for monitoring.
 *
 * @returns {Promise<{isConnected: boolean, schemaValid: boolean, responseTime: number}>} Health check results
 * @throws {PrismaClientError} If health check fails
 * @example
 * try {
 *   const health = await checkDatabaseHealth();
 *   logger.info('Database health:', health);
 * } catch (error) {
 *   console.error('Health check failed:', error);
 * }
 */
export async function checkDatabaseHealth(): Promise<{
  isConnected: boolean;
  schemaValid: boolean;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const isConnected = await testDatabaseConnection();
    const schemaValid = await verifyDatabaseSchema();
    const responseTime = Date.now() - startTime;
    return {
      isConnected,
      schemaValid,
      responseTime
    };
  }
  catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Database health check failed: ${errorMessage}`);
    throw error;
  }
}
// Export PrismaClient type
export type { PrismaClient };