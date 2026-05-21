/**
 * Credentials Validation Utilities
 *
 * This module provides functions to validate user credentials
 * for authentication purposes.
 *
 * @module lib/auth/credentials
 */

import { compare } from 'bcrypt';

import { prisma } from '@/server/db';
import type {
  AsyncResult
} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';


import type { UserRole } from '@prisma/client';

/**
 * User data for successful validation
 */
interface UserData {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation result type using centralized AsyncResult
 */
export type ValidationResult = AsyncResult<UserData, Error>;

/**
 * Validates user credentials
 * 
 * Checks if provided credentials match a user in the database.
 * 
 * @param {string} identifier - Username or email
 * @param {string} password - User password
 * @returns {Promise<ValidationResult>} Validation result with user data or error
 */
export async function validateCredentials(
  identifier: string,
  password: string
): Promise<ValidationResult> {
  try {
    if (!identifier || !password) {
      return createErrorResult(
        createContextualError(
          'Username/email and password are required',
          'MISSING_CREDENTIALS',
          { identifier: !!identifier, password: !!password }
        )
      );
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { userName: identifier },
          { email: identifier }
        ]
      }
    });

    if (!user) {
      return createErrorResult(
        createContextualError(
          'Invalid credentials',
          'INVALID_CREDENTIALS',
          { identifier }
        )
      );
    }

    // Verify password
    let validPassword = false;
    
    try {
      // Always verify the password, regardless of environment
      validPassword = await compare(password, user.hashedPassword || '');
    } catch (error: unknown) {
      logger.error('Password verification error');
      // Only log details in non-production
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Password verification details:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
      }
      validPassword = false;
    }

    if (!validPassword) {
      return createErrorResult(
        createContextualError(
          'Invalid credentials',
          'INVALID_CREDENTIALS',
          { identifier }
        )
      );
    }

    // Map the Prisma user to our domain UserEntity
    return createSuccessResult({
      id: user["id"],
      username: user.userName || '',
      email: user.email || '',
      role: user.role as UserRole,
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error: unknown) {
    logger.error('Credential validation error');
    // Only log details in non-production
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Validation error details:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    }
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Authentication error')
    );
  }
}