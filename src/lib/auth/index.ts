/**
 * Authentication Library
 * 
 * This module exports authentication utilities and provides compatibility 
 * for the application's auth system.
 * 
 * @module lib/auth
 */

// Export the main auth utilities
export * from './actions';
export * from './client-actions';
export * from './password';
export * from './credentials';
export * from './validation';
export * from './validate-request';

// Export auth objects from the consolidated config file
export { authConfig, authOptions, auth } from './config';

// Development auth has been removed for security reasons
export const DEVELOPMENT_AUTH_ENABLED = false;

// Export session validation helper
export const validateSession = async (): Promise<boolean> => {
  const { auth: authFunction } = await import('./config');
  const session = await authFunction();
  return Boolean(session?.user);
};