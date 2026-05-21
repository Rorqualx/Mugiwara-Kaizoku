/**
 * Database Testing and Health Check Utilities
 *
 * This module provides utilities for testing database connectivity, schema validation,
 * and overall database health monitoring. It includes retry logic for connection attempts
 * and detailed error logging for troubleshooting.
 *
 * @module databaseTest
 */
import type { PrismaClient } from '@prisma/client';

import { logger } from '@/utils/logger';
import { prisma } from '@/server/db';
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
    this["name"] = 'PrismaClientError';
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
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting database connection (Attempt ${attempt}/${maxRetries})...`);
      // Test connection
      // eslint-disable-next-line no-await-in-loop -- Sequential retry logic required for database connection attempts
      await prisma.$connect();
      // eslint-disable-next-line no-await-in-loop -- Sequential retry logic required for database connection attempts
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection successful');
      return true;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
const errorMsg62 = errorMessage;
      logger.error(`Connection attempt ${attempt} failed: ${errorMessage}`);
      // On last attempt, log detailed error and throw
      if (attempt === maxRetries) {
        logDetailedError(error);
        throw new PrismaClientError(`Failed to connect to database after ${maxRetries} attempts`);
      }

      // Wait before retry
      // eslint-disable-next-line no-await-in-loop -- Sequential retry logic required with delay between attempts
      await delay(retryDelay);
    }
  }

  return false;
}

/**
 * Extracts error message from unknown error type
 * 
 * Safely handles different error types and formats them into readable messages.
 * 
 * @param {unknown} error - The error to process
 * @returns {string} Formatted error message
 * @example
 * const message = getErrorMessage(new Error('Test error'));
 * // Returns: "Test error"
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return (error instanceof Error ? error.message : String(error));
  }
  return String(error);
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
  const errorObj = error as Record<string, unknown>;
  if (errorObj && errorObj['name'] === 'PrismaClientInitializationError') {
    logger.error(`Prisma initialization error: ${errorObj['message']}`, {
      errorCode: errorObj['errorCode'],
      clientVersion: errorObj['clientVersion']
    });
  } else if (errorObj && errorObj['name'] === 'PrismaClientKnownRequestError') {
    logger.error(`Prisma known request error: ${errorObj['message']}`, {
      code: errorObj['code'],
      meta: errorObj['meta']
    });
  } else if (error instanceof Error) {
    logger.error(`Unknown database error: ${error.message}`, {
      name: error["name"],
      stack: error.stack
    });
  } else {
    logger.error(`Unknown error type: ${String(error)}`);
  }

  // Log database connection details (with masked credentials)
  const dbUrl = process.env["DATABASE_URL"] ?? '';
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  logger.info('Database connection details', {
    url: maskedUrl, nodeEnv: process.env.NODE_ENV
  });
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
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
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
      isConnected, schemaValid,
      responseTime
    };
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Database health check failed: ${errorMessage}`);
    throw error;
  }
}

// Export PrismaClient type
export type { PrismaClient };