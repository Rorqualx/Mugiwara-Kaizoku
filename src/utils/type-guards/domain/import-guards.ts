/**
 * Import Type Guards
 *
 * Type guards for import and data migration domain types
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Check if value is a valid import configuration
 */
export function isImportConfig(value: unknown): value is {
  source: string;
  format: string;
  options?: Record<string, unknown>;
  mappings?: Record<string, string>;
} {
  return (
    isObject(value) &&
    'source' in value &&
    isString(value['source']) &&
    'format' in value &&
    isString(value['format']) &&
    (!('options' in value) || isObject(value['options'])) &&
    (!('mappings' in value) || isObject(value['mappings']))
  );
}

/**
 * Check if value is a valid import job
 */
export function isImportJob(value: unknown): value is {
  id: string;
  source: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalItems?: number;
  processedItems?: number;
  errors?: string[];
  createdAt: string;
  updatedAt: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'source' in value &&
    isString(value['source']) &&
    'status' in value &&
    isString(value['status']) &&
    ['pending', 'running', 'completed', 'failed'].includes(value['status']) &&
    'progress' in value &&
    isNumber(value['progress']) &&
    (!('totalItems' in value) || isNumber(value['totalItems'])) &&
    (!('processedItems' in value) || isNumber(value['processedItems'])) &&
    (!('errors' in value) || isArray(value['errors'])) &&
    'createdAt' in value &&
    isString(value['createdAt']) &&
    'updatedAt' in value &&
    isString(value['updatedAt'])
  );
}

/**
 * Check if value is a valid import source
 */
export function isImportSource(value: unknown): value is {
  type: string;
  name: string;
  url?: string;
  credentials?: Record<string, unknown>;
  capabilities?: string[];
} {
  return (
    isObject(value) &&
    'type' in value &&
    isString(value['type']) &&
    'name' in value &&
    isString(value['name']) &&
    (!('url' in value) || isString(value['url'])) &&
    (!('credentials' in value) || isObject(value['credentials'])) &&
    (!('capabilities' in value) || isArray(value['capabilities']))
  );
}

/**
 * Check if value is a valid import mapping
 */
export function isImportMapping(value: unknown): value is {
  sourceField: string;
  targetField: string;
  transform?: string;
  required?: boolean;
} {
  return (
    isObject(value) &&
    'sourceField' in value &&
    isString(value['sourceField']) &&
    'targetField' in value &&
    isString(value['targetField']) &&
    (!('transform' in value) || isString(value['transform'])) &&
    (!('required' in value) || isBoolean(value['required']))
  );
}

/**
 * Check if value is a valid import result
 */
export function isImportResult(value: unknown): value is {
  jobId: string;
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: Array<{
    item: unknown;
    error: string;
  }>;
  warnings?: string[];
} {
  return (
    isObject(value) &&
    'jobId' in value &&
    isString(value['jobId']) &&
    'success' in value &&
    isBoolean(value['success']) &&
    'importedCount' in value &&
    isNumber(value['importedCount']) &&
    'skippedCount' in value &&
    isNumber(value['skippedCount']) &&
    'errorCount' in value &&
    isNumber(value['errorCount']) &&
    (!('errors' in value) || isArray(value['errors'])) &&
    (!('warnings' in value) || isArray(value['warnings']))
  );
}

/**
 * Check if value is a valid migration configuration
 */
export function isMigrationConfig(value: unknown): value is {
  fromVersion: string;
  toVersion: string;
  steps: Array<{
    name: string;
    type: string;
    script?: string;
  }>;
  rollback?: boolean;
} {
  return (
    isObject(value) &&
    'fromVersion' in value &&
    isString(value['fromVersion']) &&
    'toVersion' in value &&
    isString(value['toVersion']) &&
    'steps' in value &&
    isArray(value['steps']) &&
    value['steps'].every((step: unknown) =>
      isObject(step) &&
      'name' in step &&
      isString((step as Record<string, unknown>)['name']) &&
      'type' in step &&
      isString((step as Record<string, unknown>)['type']) &&
      (!('script' in step) || isString((step as Record<string, unknown>)['script']))
    ) &&
    (!('rollback' in value) || isBoolean(value['rollback']))
  );
}

/**
 * Check if value is a valid data transformation
 */
export function isDataTransformation(value: unknown): value is {
  name: string;
  type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  rules: Array<{
    field: string;
    transform: string;
  }>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'type' in value &&
    isString(value['type']) &&
    'input' in value &&
    isObject(value['input']) &&
    'output' in value &&
    isObject(value['output']) &&
    'rules' in value &&
    isArray(value['rules']) &&
    value['rules'].every((rule: unknown) =>
      isObject(rule) &&
      'field' in rule &&
      isString((rule as Record<string, unknown>)['field']) &&
      'transform' in rule &&
      isString((rule as Record<string, unknown>)['transform'])
    )
  );
}