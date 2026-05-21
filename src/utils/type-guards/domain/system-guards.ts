/**
 * System Type Guards
 *
 * Type guards for system and infrastructure domain types
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Validate required top-level system config fields
 */
function validateSystemConfigBasicFields(value: Record<string, unknown>): boolean {
  return (
    'name' in value &&
    isString(value['name']) &&
    'version' in value &&
    isString(value['version']) &&
    'environment' in value &&
    isString(value['environment']) &&
    'debug' in value &&
    isBoolean(value['debug']) &&
    'logLevel' in value &&
    isString(value['logLevel'])
  );
}

/**
 * Validate database configuration
 */
function validateSystemConfigDatabase(value: Record<string, unknown>): boolean {
  return (
    'database' in value &&
    isObject(value['database']) &&
    'url' in value['database'] &&
    isString(value['database']['url']) &&
    (!('poolSize' in value['database']) || isNumber(value['database']['poolSize'])) &&
    (!('timeout' in value['database']) || isNumber(value['database']['timeout']))
  );
}

/**
 * Validate server configuration
 */
function validateSystemConfigServer(value: Record<string, unknown>): boolean {
  return (
    'server' in value &&
    isObject(value['server']) &&
    'port' in value['server'] &&
    isNumber(value['server']['port']) &&
    'host' in value['server'] &&
    isString(value['server']['host'])
  );
}

/**
 * Check if value is a valid system configuration
 */
export function isSystemConfig(value: unknown): value is {
  name: string;
  version: string;
  environment: string;
  debug: boolean;
  logLevel: string;
  database: {
    url: string;
    poolSize?: number;
    timeout?: number;
  };
  server: {
    port: number;
    host: string;
  };
} {
  if (!isObject(value)) return false;

  return (
    validateSystemConfigBasicFields(value) &&
    validateSystemConfigDatabase(value) &&
    validateSystemConfigServer(value)
  );
}

/**
 * Validate memory status fields
 */
function validateSystemStatusMemory(value: Record<string, unknown>): boolean {
  return (
    'memory' in value &&
    isObject(value['memory']) &&
    'total' in value['memory'] &&
    isNumber(value['memory']['total']) &&
    'used' in value['memory'] &&
    isNumber(value['memory']['used']) &&
    'free' in value['memory'] &&
    isNumber(value['memory']['free'])
  );
}

/**
 * Validate CPU status fields
 */
function validateSystemStatusCpu(value: Record<string, unknown>): boolean {
  return (
    'cpu' in value &&
    isObject(value['cpu']) &&
    'usage' in value['cpu'] &&
    isNumber(value['cpu']['usage']) &&
    'cores' in value['cpu'] &&
    isNumber(value['cpu']['cores'])
  );
}

/**
 * Validate database status fields
 */
function validateSystemStatusDatabase(value: Record<string, unknown>): boolean {
  return (
    'database' in value &&
    isObject(value['database']) &&
    'connected' in value['database'] &&
    isBoolean(value['database']['connected']) &&
    (!('latency' in value['database']) || isNumber(value['database']['latency']))
  );
}

/**
 * Check if value is a valid system status
 */
export function isSystemStatus(value: unknown): value is {
  uptime: number;
  memory: {
    total: number;
    used: number;
    free: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  database: {
    connected: boolean;
    latency?: number;
  };
  services: Record<string, boolean>;
} {
  if (!isObject(value)) return false;

  return (
    'uptime' in value &&
    isNumber(value['uptime']) &&
    validateSystemStatusMemory(value) &&
    validateSystemStatusCpu(value) &&
    validateSystemStatusDatabase(value) &&
    'services' in value &&
    isObject(value['services'])
  );
}

/**
 * Check if value is a valid system log entry
 */
export function isSystemLogEntry(value: unknown): value is {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  service?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'level' in value &&
    isString(value['level']) &&
    ['error', 'warn', 'info', 'debug'].includes(value['level']) &&
    'message' in value &&
    isString(value['message']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    (!('service' in value) || isString(value['service'])) &&
    (!('userId' in value) || isString(value['userId'])) &&
    (!('metadata' in value) || isObject(value['metadata']))
  );
}

/**
 * Check if value is a valid system metric
 */
export function isSystemMetric(value: unknown): value is {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'value' in value &&
    isNumber(value['value']) &&
    'unit' in value &&
    isString(value['unit']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    (!('tags' in value) || isObject(value['tags']))
  );
}

/**
 * Check if value is a valid system alert
 */
export function isSystemAlert(value: unknown): value is {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  service?: string;
  metadata?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'level' in value &&
    isString(value['level']) &&
    ['critical', 'warning', 'info'].includes(value['level']) &&
    'title' in value &&
    isString(value['title']) &&
    'message' in value &&
    isString(value['message']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    'acknowledged' in value &&
    isBoolean(value['acknowledged']) &&
    (!('service' in value) || isString(value['service'])) &&
    (!('metadata' in value) || isObject(value['metadata']))
  );
}

/**
 * Check if value is a valid system health check
 */
export function isSystemHealthCheck(value: unknown): value is {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastChecked: string;
  details?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'status' in value &&
    isString(value['status']) &&
    ['healthy', 'unhealthy', 'degraded'].includes(value['status']) &&
    (!('responseTime' in value) || isNumber(value['responseTime'])) &&
    'lastChecked' in value &&
    isString(value['lastChecked']) &&
    (!('details' in value) || isObject(value['details']))
  );
}

/**
 * Check if value is a valid system backup
 */
export function isSystemBackup(value: unknown): value is {
  id: string;
  type: 'full' | 'incremental';
  path: string;
  size: number;
  timestamp: string;
  status: 'completed' | 'failed' | 'in-progress';
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
    'size' in value &&
    isNumber(value['size']) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    'status' in value &&
    isString(value['status']) &&
    ['completed', 'failed', 'in-progress'].includes(value['status'])
  );
}

/**
 * Check if value is a valid system maintenance window
 */
export function isSystemMaintenanceWindow(value: unknown): value is {
  id: string;
  startTime: string;
  endTime: string;
  description: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  services: string[];
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'startTime' in value &&
    isString(value['startTime']) &&
    'endTime' in value &&
    isString(value['endTime']) &&
    'description' in value &&
    isString(value['description']) &&
    'status' in value &&
    isString(value['status']) &&
    ['scheduled', 'in-progress', 'completed', 'cancelled'].includes(value['status']) &&
    'services' in value &&
    isArray(value['services'])
  );
}

/**
 * Check if value is a valid system feature flag
 */
export function isSystemFeatureFlag(value: unknown): value is {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  targetUsers?: string[];
  targetEnvironments?: string[];
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    (!('description' in value) || isString(value['description'])) &&
    (!('rolloutPercentage' in value) || isNumber(value['rolloutPercentage'])) &&
    (!('targetUsers' in value) || isArray(value['targetUsers'])) &&
    (!('targetEnvironments' in value) || isArray(value['targetEnvironments']))
  );
}

/**
 * Check if value is a valid system update
 */
export function isSystemUpdate(value: unknown): value is {
  version: string;
  type: 'patch' | 'minor' | 'major';
  description: string;
  releaseDate: string;
  breakingChanges?: string[];
  dependencies?: Record<string, string>;
} {
  return (
    isObject(value) &&
    'version' in value &&
    isString(value['version']) &&
    'type' in value &&
    isString(value['type']) &&
    ['patch', 'minor', 'major'].includes(value['type']) &&
    'description' in value &&
    isString(value['description']) &&
    'releaseDate' in value &&
    isString(value['releaseDate']) &&
    (!('breakingChanges' in value) || isArray(value['breakingChanges'])) &&
    (!('dependencies' in value) || isObject(value['dependencies']))
  );
}