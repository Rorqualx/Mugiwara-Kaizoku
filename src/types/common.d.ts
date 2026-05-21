/**
 * Common Type Definitions
 * 
 * This module provides shared type definitions used throughout the application.
 * It includes utility types, generic handlers, and common interfaces for:
 * - Record types
 * - Task handling
 * - Database operations
 * - Queue management
 * - Environment configuration
 * 
 * @module types/common
 */

/**
 * Empty record type
 * Represents an object with no properties
 * 
 * @type {Record<string, never>}
 * 
 * @example
 * ```ts
 * const emptyObj: EmptyRecord = {};
 * ```
 */
export type EmptyRecord = Record<string, never>;
/**
 * Generic record type
 * Represents an object with any string keys and unknown values
 * 
 * @type {Record<string, unknown>}
 * 
 * @example
 * ```ts
 * const data: AnyRecord = {
 *   key1: "value",
 *   key2: 123
 * };
 * ```
 */
export type AnyRecord = Record<string, unknown>;

/**
 * Generic task handler type
 * Type-safe handler for processing queue tasks
 * 
 * @template T - Task payload type
 * @template R - Task result type
 * 
 * @example
 * ```ts
 * const handler: TaskHandler<string, number> = async (payload) => {
 *   return payload.length;
 * };
 * ```
 */
export type TaskHandler<T = unknown, R = void> = (payload: T) => Promise<R>;

/**
 * Generic callback function type
 * Type-safe callback with variable arguments
 * 
 * @template T - Return type of the callback
 * 
 * @example
 * ```ts
 * const callback: CallbackFn<string> = (...args) => {
 *   return args.join(',');
 * };
 * ```
 */
export type CallbackFn<T = void> = (...args: unknown[]) => T;

/**
 * Database operation result
 * Wraps database operation results with success/error information
 * 
 * @interface DbResult
 * @template T - Type of successful operation data
 * @property {boolean} success - Operation success status
 * @property {T} [data] - Operation result data
 * @property {string} [error] - Error message if operation failed
 * 
 * @example
 * ```ts
 * const result: DbResult<User> = {
 *   success: true,
 *   data: { id: 1, name: "User" }
 * };
 * ```
 */
export interface DbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Queue task information
 * Represents a task in the processing queue
 * 
 * @interface QueueTask
 * @template T - Task payload type
 * @property {string} id - Unique task identifier
 * @property {string} type - Task type identifier
 * @property {T} payload - Task data
 * @property {string} status - Current task status
 * @property {Date} createdAt - Task creation time
 * @property {Date} updatedAt - Last status update time
 * 
 * @example
 * ```ts
 * const task: QueueTask<DownloadPayload> = {
 *   id: "task-1",
 *   type: "download",
 *   payload: { url: "..." },
 *   status: 'PENDING',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * };
 * ```
 */
export interface QueueTask<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Environment configuration type
 * Type-safe environment variable definitions
 * 
 * @interface EnvConfig
 * @property {string} NODE_ENV - Runtime environment
 * @property {string} DATABASE_URL - Database connection string
 * @property {string} KAIZOKU_PORT - Application port
 * @property {string} KAIZOKU_LOG_PATH - Log file location
 * @property {string | undefined} [key: string] - Additional env vars
 * 
 * @example
 * ```ts
 * const config: EnvConfig = {
 *   NODE_ENV: "development",
 *   DATABASE_URL: "postgresql://...",
 *   KAIZOKU_PORT: "3000",
 *   KAIZOKU_LOG_PATH: "/logs"
 * };
 * ```
 */
export type EnvConfig = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  KAIZOKU_PORT?: string;
  KAIZOKU_LOG_PATH?: string;
  [key: string]: string | undefined;
};
