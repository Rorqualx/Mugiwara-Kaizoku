/**
 * Security Event Logging Utility
 *
 * Comprehensive security event logging for OWASP A09:2021 compliance.
 * Logs all security-relevant events with context for audit trails and anomaly detection.
 *
 * @module server/utils/security-logger
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/server/utils/logger';

/**
 * Security event types categorized by domain
 */
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGIN_BLOCKED = 'auth.login.blocked',
  LOGOUT = 'auth.logout',

  // Authorization events
  ACCESS_DENIED = 'authz.access_denied',
  PRIVILEGE_ESCALATION_ATTEMPT = 'authz.privilege_escalation',

  // Session events
  SESSION_CREATED = 'session.created',
  SESSION_EXPIRED = 'session.expired',
  SESSION_INVALIDATED = 'session.invalidated',

  // Account events
  PASSWORD_CHANGED = 'account.password_changed',
  PASSWORD_RESET = 'account.password_reset',
  ACCOUNT_LOCKED = 'account.locked',
  ACCOUNT_UNLOCKED = 'account.unlocked',

  // Suspicious activity
  MULTIPLE_FAILED_LOGINS = 'suspicious.multiple_failed_logins',
  UNUSUAL_ACCESS_PATTERN = 'suspicious.unusual_access',
  RATE_LIMIT_EXCEEDED = 'suspicious.rate_limit_exceeded',
  INVALID_TOKEN = 'suspicious.invalid_token',
  SQL_INJECTION_ATTEMPT = 'suspicious.sql_injection',
  XSS_ATTEMPT = 'suspicious.xss_attempt',
}

/**
 * Metadata for security events
 * Includes contextual information for investigation
 */
export interface SecurityEventMetadata {
  userId?: number;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  reason?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Security event severity levels
 */
type SecuritySeverity = 'info' | 'warning' | 'critical';

/**
 * Get severity level based on event type
 */
function getSeverity(eventType: SecurityEventType): SecuritySeverity {
  // Critical events
  if (
    eventType.includes('escalation') ||
    eventType.includes('suspicious') ||
    eventType.includes('blocked') ||
    eventType.includes('injection') ||
    eventType.includes('xss')
  ) {
    return 'critical';
  }

  // Warning events
  if (
    eventType.includes('failed') ||
    eventType.includes('denied') ||
    eventType.includes('locked') ||
    eventType.includes('invalid')
  ) {
    return 'warning';
  }

  // Informational events
  return 'info';
}

/**
 * Log a security-related event
 *
 * Logs events with enriched metadata for audit trails and security monitoring.
 * Events are categorized by severity and include contextual information.
 *
 * @param eventType - Type of security event
 * @param metadata - Event metadata including user, IP, resource, etc.
 *
 * @example
 * ```typescript
 * logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
 *   userId: 123,
 *   username: 'john_doe',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  metadata: SecurityEventMetadata
): void {
  const enrichedMetadata = {
    ...metadata,
    timestamp: metadata.timestamp ?? new Date().toISOString(),
    severity: getSeverity(eventType),
    eventType,
  };

  // Log with appropriate level based on severity
  const severity = enrichedMetadata.severity;
  const message = `Security Event: ${eventType}`;

  if (severity === 'critical') {
    logger.error(message, enrichedMetadata);
  } else if (severity === 'warning') {
    // Use logger.info with warning metadata for warnings
    logger.info(message, { ...enrichedMetadata, level: 'warning' });
  } else {
    logger.info(message, enrichedMetadata);
  }

  // Check for suspicious patterns
  detectAnomalies(eventType, metadata);
}

/**
 * Cache keys for anomaly detection
 * Using PostgreSQL-based UnifiedCacheProvider for persistence
 */
const CACHE_NAMESPACE = 'security';
const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Get cache key for failed login tracking
 */
function getFailedLoginKey(ip: string): string {
  return `failed_logins:${ip}`;
}

/**
 * Get cache key for access denial tracking
 */
function getAccessDenialKey(userId: number, resource: string): string {
  return `access_denials:${userId}:${resource}`;
}

/**
 * Get cache key for rate limit tracking
 */
function getRateLimitKey(ip: string): string {
  return `rate_limits:${ip}`;
}

/**
 * Track failed login attempt using persistent cache
 */
async function trackFailedLogin(ip: string): Promise<void> {
  const key = getFailedLoginKey(ip);
  const count = await cacheProvider.incr(key);

  // Set TTL on first increment (sliding window)
  if (count === 1) {
    await cacheProvider.set(key, { count: 1 }, { ttl: CACHE_TTL_SECONDS, namespace: CACHE_NAMESPACE });
  }

  // Alert on 5+ failed attempts
  if (count >= 5) {
    logSecurityEvent(SecurityEventType.MULTIPLE_FAILED_LOGINS, {
      ipAddress: ip,
      failedAttempts: count,
      reason: 'Multiple failed login attempts detected from same IP',
      windowMinutes: 15,
      timestamp: new Date().toISOString(),
    });

    // Clear counter after alert
    await cacheProvider.del(key, CACHE_NAMESPACE);
  }
}

/**
 * Track access denial using persistent cache
 */
async function trackAccessDenial(
  metadata: SecurityEventMetadata
): Promise<void> {
  if (!metadata.userId || !metadata.resource) return;

  const key = getAccessDenialKey(metadata.userId, metadata.resource);
  const count = await cacheProvider.incr(key);

  // Set TTL on first increment
  if (count === 1) {
    await cacheProvider.set(key, { count: 1 }, { ttl: CACHE_TTL_SECONDS, namespace: CACHE_NAMESPACE });
  }

  // Alert on 3+ denials
  if (count >= 3) {
    const alertMetadata: SecurityEventMetadata = {
      userId: metadata.userId,
      resource: metadata.resource,
      attemptCount: count,
      reason: 'Multiple attempts to access restricted resource',
      timestamp: new Date().toISOString(),
    };

    if (metadata.username) {
      alertMetadata.username = metadata.username;
    }

    logSecurityEvent(SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT, alertMetadata);

    // Clear counter after alert
    await cacheProvider.del(key, CACHE_NAMESPACE);
  }
}

/**
 * Track rate limit violation using persistent cache
 */
async function trackRateLimitViolation(ip: string): Promise<void> {
  const key = getRateLimitKey(ip);
  const count = await cacheProvider.incr(key);

  // Set TTL on first increment
  if (count === 1) {
    await cacheProvider.set(key, { count: 1 }, { ttl: CACHE_TTL_SECONDS, namespace: CACHE_NAMESPACE });
  }

  // Alert on 3+ violations
  if (count >= 3) {
    logSecurityEvent(SecurityEventType.UNUSUAL_ACCESS_PATTERN, {
      ipAddress: ip,
      violationCount: count,
      reason: 'Repeated rate limit violations detected',
      timestamp: new Date().toISOString(),
    });

    // Clear counter after alert
    await cacheProvider.del(key, CACHE_NAMESPACE);
  }
}

/**
 * Detect anomalous patterns in security events
 *
 * Uses PostgreSQL-based cache for persistence across server restarts.
 * Implements sliding window detection for:
 * - Multiple failed logins from same IP
 * - Repeated access denials
 * - Rate limit violations
 *
 * @param eventType - Security event type
 * @param metadata - Event metadata
 */
function detectAnomalies(
  eventType: SecurityEventType,
  metadata: SecurityEventMetadata
): void {
  // Detect multiple failed logins from same IP
  if (eventType === SecurityEventType.LOGIN_FAILED && metadata.ipAddress) {
    trackFailedLogin(metadata.ipAddress).catch((err: unknown) => {
      logger.error('[SecurityLogger] Failed to track login attempt', { error: err });
    });
  }

  // Detect repeated access denials
  if (eventType === SecurityEventType.ACCESS_DENIED && metadata.userId && metadata.resource) {
    trackAccessDenial(metadata).catch((err: unknown) => {
      logger.error('[SecurityLogger] Failed to track access denial', { error: err });
    });
  }

  // Track rate limit violations
  if (eventType === SecurityEventType.RATE_LIMIT_EXCEEDED && metadata.ipAddress) {
    trackRateLimitViolation(metadata.ipAddress).catch((err: unknown) => {
      logger.error('[SecurityLogger] Failed to track rate limit violation', { error: err });
    });
  }
}

/**
 * Clear anomaly detection data (useful for testing)
 * Clears all security-related cache entries
 */
export async function clearAnomalyDetectionData(): Promise<void> {
  try {
    await cacheProvider.clear({ namespace: CACHE_NAMESPACE });
    logger.info('[SecurityLogger] Cleared anomaly detection data');
  } catch (error: unknown) {
    logger.error('[SecurityLogger] Failed to clear anomaly detection data', { error });
  }
}

/**
 * Get anomaly detection statistics (useful for monitoring)
 * Returns stats from PostgreSQL-based cache
 */
export async function getAnomalyStats(): Promise<{
  failedLogins: number;
  accessDenials: number;
  rateLimitViolations: number;
}> {
  try {
    const stats = await cacheProvider.getStats();
    const namespaceStats = stats.namespaces[CACHE_NAMESPACE];

    return {
      failedLogins: namespaceStats?.entries ?? 0,
      accessDenials: 0, // Would need more specific tracking
      rateLimitViolations: 0, // Would need more specific tracking
    };
  } catch (error: unknown) {
    logger.error('[SecurityLogger] Failed to get anomaly stats', { error });
    return {
      failedLogins: 0,
      accessDenials: 0,
      rateLimitViolations: 0,
    };
  }
}
