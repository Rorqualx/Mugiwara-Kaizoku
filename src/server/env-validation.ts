/**
 * Environment Secret Validation
 *
 * Validates that all critical environment secrets meet security requirements
 * for production use. This includes checking for sufficient entropy, minimum length,
 * and detecting common weak patterns.
 *
 * This validation should be called at application startup to prevent deployment
 * with insecure secrets.
 *
 * @module server/env-validation
 */

import crypto from 'crypto';

import { logger } from '@/utils/logger';

/**
 * Validate that a secret has sufficient entropy for production use
 *
 * @param secret - The secret value to validate
 * @param name - Name of the secret for error messages
 * @param minLength - Minimum required length (default: 32)
 * @returns The validated secret
 * @throws {Error} If secret is invalid or too weak
 */
function validateSecret(
  secret: string | undefined,
  name: string,
  minLength: number = 32
): string {
  if (!secret) {
    throw new Error(
      `${name} is required. Generate one with: openssl rand -base64 32`
    );
  }

  if (secret.length < minLength) {
    throw new Error(
      `${name} must be at least ${minLength} characters. Current length: ${secret.length}`
    );
  }

  // Check for common weak patterns
  const weakPatterns = [
    'your-secret-here',
    'your-auth-secret-here',
    'your-nextauth-secret-here',
    'change-me',
    'changeme',
    'example',
    'test',
    '123456',
    'password',
    'secret',
    'placeholder',
    'replace-me',
  ];

  const lowerSecret = secret.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerSecret.includes(pattern)) {
      throw new Error(
        `${name} contains weak pattern "${pattern}". Use a cryptographically random value.`
      );
    }
  }

  return secret;
}

/**
 * Validate development environment secrets with lenient requirements
 *
 * This helper function extracts the development validation logic to reduce
 * nesting depth in the main validateEnvironmentSecrets function.
 */
function validateDevelopmentSecrets(): void {
  logger.info('Running development environment secret validation...');

  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    logger.warn(
      'WARNING: No AUTH_SECRET or NEXTAUTH_SECRET set. Generate one with: openssl rand -base64 32'
    );
    return;
  }

  // Check for weak patterns even in development
  try {
    if (process.env.AUTH_SECRET) {
      validateSecret(process.env.AUTH_SECRET, 'AUTH_SECRET', 20);
    }
    if (process.env.NEXTAUTH_SECRET) {
      validateSecret(process.env.NEXTAUTH_SECRET, 'NEXTAUTH_SECRET', 20);
    }
  } catch (error: unknown) {
    logger.warn(
      `Development secret validation warning: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  logger.info('Development environment validation complete');
}

/**
 * Validate production environment secrets with strict requirements
 *
 * This helper function extracts the production validation logic to reduce
 * nesting depth in the main validateEnvironmentSecrets function.
 */
function validateProductionSecrets(): void {
  logger.info('Running production environment secret validation...');

  // Validate AUTH_SECRET
  validateSecret(process.env.AUTH_SECRET, 'AUTH_SECRET', 32);

  // Validate NEXTAUTH_SECRET
  validateSecret(process.env.NEXTAUTH_SECRET, 'NEXTAUTH_SECRET', 32);

  // Validate SYSTEM_API_TOKEN if it exists
  if (process.env['SYSTEM_API_TOKEN']) {
    validateSecret(process.env['SYSTEM_API_TOKEN'], 'SYSTEM_API_TOKEN', 32);
  }

  logger.info('Environment secrets validated successfully');
}

/**
 * Validate all critical environment secrets on startup
 *
 * This function checks that all security-critical environment variables
 * are set and meet minimum security requirements. In production mode,
 * validation is strict and will throw errors. In development, it only
 * logs warnings to allow easier local development.
 *
 * @throws {Error} In production mode if any required secret is invalid
 */
export function validateEnvironmentSecrets(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    if (isProduction) {
      validateProductionSecrets();
    } else {
      validateDevelopmentSecrets();
    }
  } catch (error: unknown) {
    if (isProduction) {
      // In production, fail fast with clear error message
      logger.error(
        `CRITICAL: Environment secret validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } else {
      // In development, just warn
      logger.warn(
        `Development secret validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Generate a secure random secret suitable for environment variables
 *
 * This is a utility function that can be used to generate new secrets.
 * It uses crypto.randomBytes() to ensure cryptographic strength.
 *
 * @param length - Length of the secret in bytes (default: 32)
 * @returns Base64-encoded random secret
 */
export function generateSecureSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64');
}
