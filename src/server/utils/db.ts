/**
 * Database utility module providing type-safe database operations and query execution
 * 
 * This module exports a configured PrismaClient instance and utility functions for
 * executing raw SQL queries with proper type safety and error handling.
 * 
 * @module database
 */

import { Prisma } from '@prisma/client';

import { logger } from '@/utils/logger';



import { prisma } from "../db";

/**
 * Generic interface for query results providing both the data and metadata
 * 
 * @template T - The type of data contained in the rows
 * @property {T[]} rows - Array of query result rows
 * @property {number} rowCount - Total number of rows returned
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Interface representing a row in the jobs table
 *
 * @property {number} id - Unique identifier for the job
 * @property {string} status - Current status of the job (e.g., 'PENDING', 'COMPLETED', 'FAILED')
 * @property {string} type - Type of job (e.g., 'DOWNLOAD_CHAPTER', 'UPDATE_METADATA')
 * @property {Date} createdAt - Timestamp when the job was created
 * @property {Date} updatedAt - Timestamp when the job was last updated
 * @property {Date} [scheduledFor] - Optional timestamp when the job is scheduled to run
 * @property {string} [interval] - Optional interval for recurring jobs (e.g., '1h', '1d')
 * @property {number} retryCount - Number of retry attempts for failed jobs
 * @property {string} [errorMessage] - Optional error message if the job failed
 */
interface JobRow {
  id: number;
  status: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  interval?: string;
  retryCount: number;
  errorMessage?: string;
}

/**
 * Executes a raw SQL query with parameters in a type-safe manner
 * 
 * This function provides a safe way to execute raw SQL queries while maintaining
 * type safety through Prisma's query builder. It handles parameter injection
 * and error logging.
 *
 * @template T - The expected type of the query results
 * @param {string} query - The SQL query string with placeholders for parameters
 * @param {unknown[]} [params=[]] - Array of parameters to be safely injected into the query
 * @returns {Promise<QueryResult<T>>} Object containing the query results and row count
 * @throws {Error} If the query execution fails, logs the error and re-throws
 * 
 * @example
 * // Simple query without parameters
 * const users = await executeQuery<User>("SELECT * FROM users");
 * 
 * // Query with parameters
 * const posts = await executeQuery<Post>(
 *   "SELECT * FROM posts WHERE author_id = $1 AND published = $2",
 *   [userId, true]
 * );
 */
export async function executeQuery<T>(
query: string,
params: unknown[] = [])
: Promise<QueryResult<T>> {
  try {
    // Safely construct the query using Prisma.sql and Prisma.raw
    const result = await prisma.$queryRaw<T[]>(
      Prisma.sql`${Prisma.raw(query)}`,
      ...params
    );

    return {
      rows: result,
      rowCount: result.length
    };
  } catch (error: unknown) {
    logger.error(
      `Error executing query: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error; // Re-throw the error after logging
  }
}

/**
 * Retrieves all jobs from the 'jobs' table
 *
 * This function fetches all job records from the database, including their
 * status, type, scheduling information, and error details if any.
 *
 * @returns {Promise<QueryResult<JobRow>>} Object containing the jobs and total count
 * @throws {Error} If the database query fails
 *
 * @example
 * try {
 *   const { rows: jobs, rowCount } = await getJobsQuery();
 *   logger.info(`Retrieved ${rowCount} jobs`);
 * } catch (error) {
 *   console.error('Failed to fetch jobs:', error);
 * }
 */
export async function getJobsQuery(): Promise<QueryResult<JobRow>> {
  return executeQuery<JobRow>("SELECT * FROM jobs");
}


// Export prisma instance for reuse
export { prisma };