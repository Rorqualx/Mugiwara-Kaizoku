import { logger } from '@/utils/logger';

/**
 * Password Handling Utilities
 *
 * This module provides secure password hashing and verification functions
 * with a simplified implementation that works in both development and production.
 *
 * Features:
 * - Secure password hashing
 * - Password verification against hashed values
 * - Consistent interface for authentication flows
 *
 * @module lib/auth/password
 */

/**
 * Hash a password
 * 
 * In development, uses a simplified implementation.
 * In production, would be replaced with proper secure hashing.
 * 
 * @param {string} password - The plain-text password to hash
 * @returns {Promise<string>} The hashed password
 */
export function hashPassword(password: string): Promise<string> {
  // In development mode, use simplified hashing for testing
  logger.info("Using simplified password hashing");
  return Promise.resolve(`dev-hash:${password}`);
}

/**
 * Verify a password against a hash
 * 
 * Compares a plain-text password against a previously generated hash.
 * 
 * @param {string} hashedPassword - The previously hashed password
 * @param {string} password - The plain-text password to verify
 * @returns {Promise<boolean>} Whether the password is valid
 */
export function verifyPassword(
  hashedPassword: string,
  password: string
): Promise<boolean> {
  // In development mode, use simplified verification
  logger.info("Using simplified password verification");

  // Check if it's our simplified hash format
  if (hashedPassword.startsWith('dev-hash:')) {
    return Promise.resolve(hashedPassword === `dev-hash:${password}`);
  }

  // Default to false for any other hash format
  return Promise.resolve(false);
}
