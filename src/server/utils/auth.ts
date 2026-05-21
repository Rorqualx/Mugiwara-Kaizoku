/**
 * Authentication Utilities
 *
 * Provides password hashing and verification functions
 * using bcryptjs for secure password storage.
 */

import * as crypto from 'crypto';

import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt
 *
 * @param password - The plain text password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Increased from 10 to 12 for better security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 *
 * @param password - The plain text password to verify
 * @param hash - The stored password hash
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random token
 *
 * Uses crypto.randomBytes() instead of Math.random() for security-critical token generation.
 * This function is suitable for password reset tokens, API keys, session tokens, etc.
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token (output length will be length * 2 characters)
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate password strength
 *
 * SECURITY: Enforces strong password policy (OWASP A07:2021)
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - Optional: Special character for extra strength
 *
 * @param password - The password to validate
 * @returns Object with validation result, strength flag, and feedback messages
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  isStrong: boolean;
  message?: string;
  feedback: string[];
} {
  const feedback: string[] = [];
  let isValid = true;

  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
    isValid = false;
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
    isValid = false;
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
    isValid = false;
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    feedback.push('Password must contain at least one number');
    isValid = false;
  }

  // Optional: Check for special characters (improves strength but not required)
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasSpecialChar) {
    feedback.push('Consider adding a special character for stronger security');
  }

  // Check for common weak patterns
  if (password.toLowerCase().includes('password')) {
    feedback.push('Password should not contain the word "password"');
    isValid = false;
  }

  if (/^(.)\1+$/.test(password)) {
    feedback.push('Password should not be all the same character');
    isValid = false;
  }

  // Password is strong if it meets all requirements
  const isStrong = isValid;

  const result: {
    isValid: boolean;
    isStrong: boolean;
    message?: string;
    feedback: string[];
  } = {
    isValid,
    isStrong,
    feedback
  };

  if (feedback.length > 0 && feedback[0]) {
    result.message = feedback[0];
  }

  return result;
}
