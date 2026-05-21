/**
 * Configuration Type Guards
 *
 * Type guards for configuration and settings domain types
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Helper: Check app config basic fields
 */
function checkAppConfigBasicFields(obj: Record<string, unknown>): boolean {
  return (
    'name' in obj &&
    isString(obj['name']) &&
    'version' in obj &&
    isString(obj['version']) &&
    'environment' in obj &&
    isString(obj['environment']) &&
    'debug' in obj &&
    isBoolean(obj['debug']) &&
    'logLevel' in obj &&
    isString(obj['logLevel'])
  );
}

/**
 * Helper: Check app config database field
 */
function checkAppConfigDatabase(obj: Record<string, unknown>): boolean {
  if (!('database' in obj) || !isObject(obj['database'])) return false;
  const db = obj['database'] as Record<string, unknown>;
  return (
    'url' in db &&
    isString(db['url']) &&
    (!('poolSize' in db) || isNumber(db['poolSize'])) &&
    (!('timeout' in db) || isNumber(db['timeout']))
  );
}

/**
 * Helper: Check app config server field
 */
function checkAppConfigServer(obj: Record<string, unknown>): boolean {
  if (!('server' in obj) || !isObject(obj['server'])) return false;
  const server = obj['server'] as Record<string, unknown>;
  return (
    'port' in server &&
    isNumber(server['port']) &&
    'host' in server &&
    isString(server['host'])
  );
}

/**
 * Check if value is a valid application configuration
 */
export function isAppConfig(value: unknown): value is {
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
  const obj = value as Record<string, unknown>;
  return (
    checkAppConfigBasicFields(obj) &&
    checkAppConfigDatabase(obj) &&
    checkAppConfigServer(obj)
  );
}

/**
 * Check if value is a valid feature configuration
 */
export function isFeatureConfig(value: unknown): value is {
  name: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
  dependencies?: string[];
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    (!('settings' in value) || isObject(value['settings'])) &&
    (!('dependencies' in value) || isArray(value['dependencies']))
  );
}

/**
 * Check if value is a valid module configuration
 */
export function isModuleConfig(value: unknown): value is {
  name: string;
  enabled: boolean;
  version: string;
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    'version' in value &&
    isString(value['version']) &&
    (!('settings' in value) || isObject(value['settings'])) &&
    (!('features' in value) || isObject(value['features']))
  );
}

/**
 * Check if value is a valid security configuration
 */
export function isSecurityConfig(value: unknown): value is {
  jwtSecret: string;
  bcryptRounds: number;
  sessionTimeout: number;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
} {
  return (
    isObject(value) &&
    'jwtSecret' in value &&
    isString(value['jwtSecret']) &&
    'bcryptRounds' in value &&
    isNumber(value['bcryptRounds']) &&
    'sessionTimeout' in value &&
    isNumber(value['sessionTimeout']) &&
    'corsOrigins' in value &&
    isArray(value['corsOrigins']) &&
    'rateLimit' in value &&
    isObject(value['rateLimit']) &&
    'windowMs' in value['rateLimit'] &&
    isNumber(value['rateLimit']['windowMs']) &&
    'max' in value['rateLimit'] &&
    isNumber(value['rateLimit']['max'])
  );
}

/**
 * Check if value is a valid cache configuration
 */
export function isCacheConfig(value: unknown): value is {
  enabled: boolean;
  type: 'memory' | 'redis' | 'database';
  ttl: number;
  maxSize?: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
} {
  return (
    isObject(value) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    'type' in value &&
    isString(value['type']) &&
    ['memory', 'redis', 'database'].includes(value['type']) &&
    'ttl' in value &&
    isNumber(value['ttl']) &&
    (!('maxSize' in value) || isNumber(value['maxSize'])) &&
    (!('redis' in value) || (
      isObject(value['redis']) &&
      'host' in value['redis'] &&
      isString(value['redis']['host']) &&
      'port' in value['redis'] &&
      isNumber(value['redis']['port']) &&
      (!('password' in value['redis']) || isString(value['redis']['password']))
    ))
  );
}

/**
 * Helper: Check notification config email field
 */
function checkNotificationConfigEmail(obj: Record<string, unknown>): boolean {
  if (!('email' in obj) || !isObject(obj['email'])) return false;
  const email = obj['email'] as Record<string, unknown>;

  if (!('enabled' in email) || !isBoolean(email['enabled'])) return false;
  if (!('smtp' in email) || !isObject(email['smtp'])) return false;

  const smtp = email['smtp'] as Record<string, unknown>;
  return (
    'host' in smtp &&
    isString(smtp['host']) &&
    'port' in smtp &&
    isNumber(smtp['port']) &&
    'secure' in smtp &&
    isBoolean(smtp['secure']) &&
    checkNotificationConfigEmailAuth(smtp)
  );
}

/**
 * Helper: Check notification config email auth field
 */
function checkNotificationConfigEmailAuth(smtp: Record<string, unknown>): boolean {
  if (!('auth' in smtp)) return true;
  if (!isObject(smtp['auth'])) return false;
  const auth = smtp['auth'] as Record<string, unknown>;
  return (
    'user' in auth &&
    isString(auth['user']) &&
    'pass' in auth &&
    isString(auth['pass'])
  );
}

/**
 * Helper: Check notification config push field
 */
function checkNotificationConfigPush(obj: Record<string, unknown>): boolean {
  if (!('push' in obj) || !isObject(obj['push'])) return false;
  const push = obj['push'] as Record<string, unknown>;
  return (
    'enabled' in push &&
    isBoolean(push['enabled']) &&
    (!('service' in push) || isString(push['service'])) &&
    (!('apiKey' in push) || isString(push['apiKey']))
  );
}

/**
 * Helper: Check notification config webhook field
 */
function checkNotificationConfigWebhook(obj: Record<string, unknown>): boolean {
  if (!('webhook' in obj) || !isObject(obj['webhook'])) return false;
  const webhook = obj['webhook'] as Record<string, unknown>;
  return (
    'enabled' in webhook &&
    isBoolean(webhook['enabled']) &&
    (!('url' in webhook) || isString(webhook['url'])) &&
    (!('secret' in webhook) || isString(webhook['secret']))
  );
}

/**
 * Check if value is a valid notification configuration
 */
export function isNotificationConfig(value: unknown): value is {
  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth?: {
        user: string;
        pass: string;
      };
    };
  };
  push: {
    enabled: boolean;
    service?: string;
    apiKey?: string;
  };
  webhook: {
    enabled: boolean;
    url?: string;
    secret?: string;
  };
} {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    checkNotificationConfigEmail(obj) &&
    checkNotificationConfigPush(obj) &&
    checkNotificationConfigWebhook(obj)
  );
}

/**
 * Check if value is a valid storage configuration
 */
export function isStorageConfig(value: unknown): value is {
  type: 'local' | 's3' | 'gcs' | 'azure';
  path?: string;
  bucket?: string;
  region?: string;
  credentials?: Record<string, string>;
} {
  return (
    isObject(value) &&
    'type' in value &&
    isString(value['type']) &&
    ['local', 's3', 'gcs', 'azure'].includes(value['type']) &&
    (!('path' in value) || isString(value['path'])) &&
    (!('bucket' in value) || isString(value['bucket'])) &&
    (!('region' in value) || isString(value['region'])) &&
    (!('credentials' in value) || isObject(value['credentials']))
  );
}

/**
 * Check if value is a valid integration configuration
 */
export function isIntegrationConfig(value: unknown): value is {
  name: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  webhooks?: Array<{
    url: string;
    events: string[];
    secret?: string;
  }>;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    'type' in value &&
    isString(value['type']) &&
    'enabled' in value &&
    isBoolean(value['enabled']) &&
    'settings' in value &&
    isObject(value['settings']) &&
    (!('webhooks' in value) || (
      isArray(value['webhooks']) &&
      value['webhooks'].every((webhook: unknown) =>
        isObject(webhook) &&
        'url' in webhook &&
        isString((webhook as Record<string, unknown>)['url']) &&
        'events' in webhook &&
        isArray((webhook as Record<string, unknown>)['events']) &&
        (!('secret' in webhook) || isString((webhook as Record<string, unknown>)['secret']))
      )
    ))
  );
}