/**
 * Transaction Type Guards
 *
 * Type guards for database transactions and operations
 */

import { isString, isNumber, isBoolean, isObject, isArray, isFunction } from '../index';

/**
 * Check if value is a valid database transaction
 */
export function isDatabaseTransaction(value: unknown): value is {
  id: string;
  type: 'create' | 'update' | 'delete' | 'query';
  table: string;
  data?: unknown;
  where?: Record<string, unknown>;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'type' in value &&
    isString(value['type']) &&
    ['create', 'update', 'delete', 'query'].includes(value['type']) &&
    'table' in value &&
    isString(value['table']) &&
    // data is optional and can be any type - no validation needed
    (!('where' in value) || isObject(value['where'])) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}

/**
 * Check if value is a valid transaction result
 */
export function isTransactionResult(value: unknown): value is {
  success: boolean;
  data?: unknown;
  error?: string;
  affectedRows?: number;
} {
  return (
    isObject(value) &&
    'success' in value &&
    isBoolean(value['success']) &&
    // data is optional and can be any type - no validation needed
    (!('error' in value) || isString(value['error'])) &&
    (!('affectedRows' in value) || isNumber(value['affectedRows']))
  );
}

/**
 * Check if value is a valid batch operation
 */
export function isBatchOperation(value: unknown): value is {
  operations: unknown[];
  transaction?: boolean;
  rollbackOnError?: boolean;
} {
  return (
    isObject(value) &&
    'operations' in value &&
    isArray(value['operations']) &&
    (!('transaction' in value) || isBoolean(value['transaction'])) &&
    (!('rollbackOnError' in value) || isBoolean(value['rollbackOnError']))
  );
}

/**
 * Check if value is a valid query operation
 */
export function isQueryOperation(value: unknown): value is {
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
} {
  return (
    isObject(value) &&
    (!('select' in value) || isArray(value['select'])) &&
    (!('where' in value) || isObject(value['where'])) &&
    (!('orderBy' in value) || isObject(value['orderBy'])) &&
    (!('limit' in value) || isNumber(value['limit'])) &&
    (!('offset' in value) || isNumber(value['offset']))
  );
}

/**
 * Check if value is a valid mutation operation
 */
export function isMutationOperation(value: unknown): value is {
  data: Record<string, unknown>;
  where?: Record<string, unknown>;
  returning?: string[];
} {
  return (
    isObject(value) &&
    'data' in value &&
    isObject(value['data']) &&
    (!('where' in value) || isObject(value['where'])) &&
    (!('returning' in value) || isArray(value['returning']))
  );
}

/**
 * Check if value is a valid transaction log entry
 */
export function isTransactionLogEntry(value: unknown): value is {
  id: string;
  transactionId: string;
  operation: string;
  table: string;
  data: Record<string, unknown>;
  timestamp: string;
  userId?: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'transactionId' in value &&
    isString(value['transactionId']) &&
    'operation' in value &&
    isString(value['operation']) &&
    'table' in value &&
    isString(value['table']) &&
    'data' in value &&
    isObject(value['data']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    (!('userId' in value) || isString(value['userId']))
  );
}

/**
 * Check if value is a valid database connection
 */
export function isDatabaseConnection(value: unknown): value is {
  connected: boolean;
  url?: string;
  database?: string;
  poolSize?: number;
  timeout?: number;
} {
  return (
    isObject(value) &&
    'connected' in value &&
    isBoolean(value['connected']) &&
    (!('url' in value) || isString(value['url'])) &&
    (!('database' in value) || isString(value['database'])) &&
    (!('poolSize' in value) || isNumber(value['poolSize'])) &&
    (!('timeout' in value) || isNumber(value['timeout']))
  );
}

/**
 * Check if value is a valid migration operation
 */
export function isMigrationOperation(value: unknown): value is {
  name: string;
  version: string;
  up: () => Promise<void>;
  down?: () => Promise<void>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'version' in value &&
    isString(value['version']) &&
    'up' in value &&
    isFunction(value['up']) &&
    (!('down' in value) || isFunction(value['down']))
  );
}

/**
 * Check if value is a valid backup operation
 */
export function isBackupOperation(value: unknown): value is {
  id: string;
  type: 'full' | 'incremental';
  path: string;
  size?: number;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'type' in value &&
    isString(value['type']) &&
    ['full', 'incremental'].includes(value['type']) &&
    'path' in value &&
    isString(value['path']) &&
    (!('size' in value) || isNumber(value['size'])) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}