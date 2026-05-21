/**
 * User Type Guards
 *
 * Type guards for user domain types and authentication
 */

import { isString, isBoolean, isObject } from '../index';

/**
 * Check if value is a valid user object
 */
export function isUser(value: unknown): value is {
  id: string;
  email: string;
  username?: string;
  name?: string;
  avatar?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'email' in value &&
    isString(value['email']) &&
    (!('username' in value) || isString(value['username'])) &&
    (!('name' in value) || isString(value['name'])) &&
    (!('avatar' in value) || isString(value['avatar'])) &&
    'role' in value &&
    isString(value['role']) &&
    'createdAt' in value &&
    isString(value['createdAt']) &&
    'updatedAt' in value &&
    isString(value['updatedAt'])
  );
}

/**
 * Check if value is a valid user profile
 */
export function isUserProfile(value: unknown): value is {
  userId: string;
  bio?: string;
  preferences?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  lastLogin?: string;
} {
  return (
    isObject(value) &&
    'userId' in value &&
    isString(value['userId']) &&
    (!('bio' in value) || isString(value['bio'])) &&
    (!('preferences' in value) || isObject(value['preferences'])) &&
    (!('settings' in value) || isObject(value['settings'])) &&
    (!('lastLogin' in value) || isString(value['lastLogin']))
  );
}

/**
 * Check if value is a valid user session
 */
export function isUserSession(value: unknown): value is {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  userAgent?: string;
  ipAddress?: string;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'userId' in value &&
    isString(value['userId']) &&
    'expiresAt' in value &&
    isString(value['expiresAt']) &&
    'createdAt' in value &&
    isString(value['createdAt']) &&
    (!('userAgent' in value) || isString(value['userAgent'])) &&
    (!('ipAddress' in value) || isString(value['ipAddress']))
  );
}

/**
 * Check if value is a valid authentication token
 */
export function isAuthToken(value: unknown): value is {
  token: string;
  type: 'access' | 'refresh';
  expiresAt: string;
  userId: string;
} {
  return (
    isObject(value) &&
    'token' in value &&
    isString(value['token']) &&
    'type' in value &&
    isString(value['type']) &&
    ['access', 'refresh'].includes(value['type']) &&
    'expiresAt' in value &&
    isString(value['expiresAt']) &&
    'userId' in value &&
    isString(value['userId'])
  );
}

/**
 * Check if value is a valid login request
 */
export function isLoginRequest(value: unknown): value is {
  email: string;
  password: string;
  rememberMe?: boolean;
} {
  return (
    isObject(value) &&
    'email' in value &&
    isString(value['email']) &&
    'password' in value &&
    isString(value['password']) &&
    (!('rememberMe' in value) || isBoolean(value['rememberMe']))
  );
}

/**
 * Check if value is a valid registration request
 */
export function isRegistrationRequest(value: unknown): value is {
  email: string;
  password: string;
  username?: string;
  name?: string;
} {
  return (
    isObject(value) &&
    'email' in value &&
    isString(value['email']) &&
    'password' in value &&
    isString(value['password']) &&
    (!('username' in value) || isString(value['username'])) &&
    (!('name' in value) || isString(value['name']))
  );
}

/**
 * Check if value is a valid password reset request
 */
export function isPasswordResetRequest(value: unknown): value is {
  email: string;
  token?: string;
  newPassword?: string;
} {
  return (
    isObject(value) &&
    'email' in value &&
    isString(value['email']) &&
    (!('token' in value) || isString(value['token'])) &&
    (!('newPassword' in value) || isString(value['newPassword']))
  );
}

/**
 * Check if value is a valid user role
 * Matches Prisma's UserRole enum: 'ADMIN' | 'USER'
 */
export function isUserRole(value: unknown): value is 'ADMIN' | 'USER' {
  return (
    isString(value) &&
    ['ADMIN', 'USER'].includes(value)
  );
}

/**
 * Check if value is a valid user permission
 */
export function isUserPermission(value: unknown): value is {
  resource: string;
  action: string;
  allowed: boolean;
} {
  return (
    isObject(value) &&
    'resource' in value &&
    isString(value['resource']) &&
    'action' in value &&
    isString(value['action']) &&
    'allowed' in value &&
    isBoolean(value['allowed'])
  );
}

/**
 * Check if value is a valid user activity
 */
export function isUserActivity(value: unknown): value is {
  id: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'userId' in value &&
    isString(value['userId']) &&
    'action' in value &&
    isString(value['action']) &&
    (!('resource' in value) || isString(value['resource'])) &&
    (!('resourceId' in value) || isString(value['resourceId'])) &&
    'timestamp' in value &&
    isString(value['timestamp']) &&
    (!('details' in value) || isObject(value['details']))
  );
}

/**
 * Check if value is a valid user notification
 */
export function isUserNotification(value: unknown): value is {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'id' in value &&
    isString(value['id']) &&
    'userId' in value &&
    isString(value['userId']) &&
    'type' in value &&
    isString(value['type']) &&
    'title' in value &&
    isString(value['title']) &&
    'message' in value &&
    isString(value['message']) &&
    'read' in value &&
    isBoolean(value['read']) &&
    'createdAt' in value &&
    isString(value['createdAt']) &&
    (!('data' in value) || isObject(value['data']))
  );
}