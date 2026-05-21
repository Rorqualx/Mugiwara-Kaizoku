/**
 * Provider Type Guards
 *
 * Type guards for provider domain types
 */

import { isString, isNumber, isBoolean, isObject } from '../index';

/**
 * Check if value is a valid provider object
 */
export function isProvider(value: unknown): value is {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  config?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'name' in value &&
    isString(value['name']) &&
    'type' in value &&
    isString(value['type']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    'priority' in value &&
    isNumber(value['priority']) &&
    (!('config' in value) || isObject(value['config']))
  );
}

/**
 * Check if value is a valid provider status
 */
export function isProviderStatus(value: unknown): value is {
  providerId: string;
  status: 'online' | 'offline' | 'error';
  lastChecked: string;
  responseTime?: number;
  error?: string;
} {
  return (
    isObject(value) &&
    'providerId' in value &&
    isString(value['providerId']) &&
    'status' in value &&
    isString(value['status']) &&
    ['online', 'offline', 'error'].includes(value['status']) &&
    'lastChecked' in value &&
    isString(value['lastChecked']) &&
    (!('responseTime' in value) || isNumber(value['responseTime'])) &&
    (!('error' in value) || isString(value['error']))
  );
}

/**
 * Check if value is a valid provider configuration
 */
export function isProviderConfig(value: unknown): value is {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  rateLimit?: number;
} {
  return (
    isObject(value) &&
    (!('apiKey' in value) || isString(value['apiKey'])) &&
    (!('baseUrl' in value) || isString(value['baseUrl'])) &&
    (!('timeout' in value) || isNumber(value['timeout'])) &&
    (!('retries' in value) || isNumber(value['retries'])) &&
    (!('rateLimit' in value) || isNumber(value['rateLimit']))
  );
}

/**
 * Check if value is a valid provider capability
 */
export function isProviderCapability(value: unknown): value is {
  search: boolean;
  metadata: boolean;
  chapters: boolean;
  covers: boolean;
  recommendations?: boolean;
} {
  return (
    isObject(value) &&
    'search' in value &&
    isBoolean(value['search']) &&
    'metadata' in value &&
    isBoolean(value['metadata']) &&
    'chapters' in value &&
    isBoolean(value['chapters']) &&
    'covers' in value &&
    isBoolean(value['covers']) &&
    (!('recommendations' in value) || isBoolean(value['recommendations']))
  );
}

/**
 * Check if value is a valid provider type
 */
export function isProviderType(value: unknown): value is 'metadata' | 'scraper' | 'download' | 'search' {
  return (
    isString(value) &&
    ['metadata', 'scraper', 'download', 'search'].includes(value)
  );
}