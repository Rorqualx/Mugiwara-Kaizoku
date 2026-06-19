/**
 * Authentication Library
 * 
 * This module exports authentication utilities and provides compatibility 
 * for the application's auth system.
 * 
 * @module lib/auth
 */

// Export the main auth utilities
export * from './client-actions';
export * from './validation';
export * from './validate-request';

// Export auth objects from the canonical config
export { authConfig, authOptions, auth } from './auth-options';

// Development auth has been removed for security reasons
export const DEVELOPMENT_AUTH_ENABLED = false;

// Export session validation helper
export const validateSession = async (): Promise<boolean> => {
  const { auth: authFunction } = await import('./auth-options');
  const session = await authFunction();
  return Boolean(session?.user);
};