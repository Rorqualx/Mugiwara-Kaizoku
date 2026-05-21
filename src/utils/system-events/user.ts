/**
 * User Event Logging Functions
 *
 * Logging functions for user operations including creation, updates,
 * authentication events, and security monitoring.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs user creation
 *
 * @param {string} username - Username
 * @param {string} role - User role
 */
export function logUserCreated(username: string, role: string): void {
  emitEvent(
    'info',
    `User created: ${username} (${role})`,
    'System',
    {
      details: {
        type: 'user_created',
        username,
        role
      }
    }
  );
}

/**
 * Logs user update
 *
 * @param {string} username - Username
 * @param {string} changes - Description of changes
 */
export function logUserUpdated(username: string, changes: string): void {
  emitEvent(
    'info',
    `User updated: ${username} - ${changes}`,
    'System',
    {
      details: {
        type: 'user_updated',
        username,
        changes
      }
    }
  );
}

/**
 * Logs user deletion
 *
 * @param {string} username - Username
 */
export function logUserDeleted(username: string): void {
  emitEvent(
    'info',
    `User deleted: ${username}`,
    'System',
    {
      details: {
        type: 'user_deleted',
        username
      }
    }
  );
}

/**
 * Logs password change
 *
 * @param {string} username - Username
 */
export function logPasswordChanged(username: string): void {
  emitEvent(
    'info',
    `Password changed: ${username}`,
    'System',
    {
      details: {
        type: 'password_changed',
        username
      }
    }
  );
}

/**
 * Logs role change
 *
 * @param {string} username - Username
 * @param {string} oldRole - Previous role
 * @param {string} newRole - New role
 */
export function logRoleChanged(username: string, oldRole: string, newRole: string): void {
  emitEvent(
    'info',
    `Role changed: ${username} from ${oldRole} to ${newRole}`,
    'System',
    {
      details: {
        type: 'role_changed',
        username,
        oldRole,
        newRole
      }
    }
  );
}

/**
 * Logs failed login attempt
 *
 * @param {string} username - Username
 * @param {string} reason - Failure reason
 */
export function logLoginFailed(username: string, reason: string): void {
  emitEvent(
    'warning',
    `Login failed: ${username} - ${reason}`,
    'System',
    {
      details: {
        type: 'login_failed',
        username,
        reason
      }
    }
  );
}

/**
 * Logs suspicious activity detection
 *
 * @param {string} username - Username
 * @param {string} activity - Description of suspicious activity
 */
export function logSuspiciousActivity(username: string, activity: string): void {
  emitEvent(
    'warning',
    `Suspicious activity: ${username} - ${activity}`,
    'System',
    {
      details: {
        type: 'suspicious_activity',
        username,
        activity
      }
    }
  );
}

/**
 * Logs session expiration
 *
 * @param {string} username - Username
 */
export function logSessionExpired(username: string): void {
  emitEvent(
    'info',
    `Session expired: ${username}`,
    'System',
    {
      details: {
        type: 'session_expired',
        username
      }
    }
  );
}
