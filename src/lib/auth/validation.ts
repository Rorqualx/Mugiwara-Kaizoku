/**
 * User Data and Authentication Validation Module
 *
 * This module provides utilities for:
 * 1. Validating user data during creation and update operations
 * 2. Validating authentication state for API routes
 * 3. Verifying permissions for protected resources
 *
 * It implements comprehensive validation for user inputs to ensure
 * data integrity and security, as well as authorization checks.
 *
 * @module lib/auth/validation
 */


import { UserRole } from '@prisma/client';

import { prisma } from '@/server/db';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';



import { auth } from './auth-options';

import type { User } from '@prisma/client';
import type { NextApiRequest } from 'next';

// Type alias for validation results using centralized AsyncResult pattern
type ValidationResult = AsyncResult<User | null, Error>;

/**
 * Validates user creation data
 * 
 * Performs comprehensive validation of user data during account creation:
 * - Username format validation
 * - Email format and uniqueness validation
 * - Password complexity validation
 * - Role validation
 * 
 * @param userData - User data to validate
 * @returns Promise resolving to validation result
 */
export async function validateUserData(userData: {
  userName: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<ValidationResult> {
  try {
    const { userName, email, password, role } = userData;

    // Validate username
    if (!userName || typeof userName !== 'string' || userName.trim().length < 3) {
      return createErrorResult(
        createContextualError(
          'Username must be at least 3 characters',
          'VALIDATION_ERROR',
          { field: 'userName', value: userName }
        )
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return createErrorResult(
        createContextualError(
          'Invalid email format',
          'VALIDATION_ERROR',
          { field: 'email', value: email }
        )
      );
    }
    
    // Check if email already exists
    const existingUserWithEmail = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() }
    });
    
    if (existingUserWithEmail) {
      return createErrorResult(
        createContextualError(
          'Email already in use',
          'DUPLICATE_EMAIL',
          { email: email.toLowerCase().trim() }
        )
      );
    }
    
    // Check if username already exists
    const existingUserWithUsername = await prisma.user.findFirst({
      where: { userName: userName.trim() }
    });
    
    if (existingUserWithUsername) {
      return createErrorResult(
        createContextualError(
          'Username already in use',
          'DUPLICATE_USERNAME',
          { userName: userName.trim() }
        )
      );
    }
    
    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return createErrorResult(
        createContextualError(
          'Password must be at least 6 characters',
          'VALIDATION_ERROR',
          { field: 'password', length: password.length || 0 }
        )
      );
    }

    // Validate role if provided
    if (role !== undefined) {
      // Only ADMIN and USER roles are allowed for new users
      const validRoles = [UserRole.ADMIN, UserRole.USER];
      if (!validRoles.includes(role)) {
        return createErrorResult(
          createContextualError(
            'Invalid role provided',
            'VALIDATION_ERROR',
            { field: 'role', value: role }
          )
        );
      }
    }

    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('User validation error:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Validation failed')
    );
  }
}

/**
 * Validates user update data
 * 
 * Performs validation of user data during account updates:
 * - Username format and uniqueness validation (if changing)
 * - Email format and uniqueness validation (if changing)
 * - Password complexity validation (if changing)
 * - Role validation (if changing)
 * 
 * @param userId - ID of user being updated
 * @param updateData - User data to validate
 * @returns Promise resolving to validation result
 */
// eslint-disable-next-line complexity -- Complex validation with multiple user field checks
export async function validateUserUpdate(
  userId: string, 
  updateData: {
    userName?: string;
    email?: string;
    password?: string;
    role?: UserRole;
  }
): Promise<ValidationResult> {
  try {
    const { userName, email, password, role } = updateData;
    
    // Get current user data for comparison
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!currentUser) {
      return createErrorResult(
        createContextualError(
          'User not found',
          'NOT_FOUND',
          { userId }
        )
      );
    }
    
    // Validate username if provided
    if (userName !== undefined) {
      if (!userName || typeof userName !== 'string' || userName.trim().length < 3) {
        return createErrorResult(
          createContextualError(
            'Username must be at least 3 characters',
            'VALIDATION_ERROR',
            { field: 'userName', value: userName }
          )
        );
      }
      
      // Check if username already exists for another user
      if (userName.trim() !== currentUser.userName) {
        const existingUserWithUsername = await prisma.user.findFirst({
          where: { 
            userName: userName.trim(),
            id: { not: userId }
          }
        });
        
        if (existingUserWithUsername) {
          return createErrorResult(
            createContextualError(
              'Username already in use',
              'DUPLICATE_USERNAME',
              { userName: userName.trim() }
            )
          );
        }
      }
    }
    
    // Validate email if provided
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
        return createErrorResult(
          createContextualError(
            'Invalid email format',
            'VALIDATION_ERROR',
            { field: 'email', value: email }
          )
        );
      }
      
      // Check if email already exists for another user
      if (email.toLowerCase().trim() !== currentUser.email) {
        const existingUserWithEmail = await prisma.user.findFirst({
          where: { 
            email: email.toLowerCase().trim(),
            id: { not: userId }
          }
        });
        
        if (existingUserWithEmail) {
          return createErrorResult(
            createContextualError(
              'Email already in use',
              'DUPLICATE_EMAIL',
              { email: email.toLowerCase().trim() }
            )
          );
        }
      }
    }
    
    // Validate password if provided
    if (password !== undefined) {
      if (!password || typeof password !== 'string' || password.length < 6) {
        return createErrorResult(
          createContextualError(
            'Password must be at least 6 characters',
            'VALIDATION_ERROR',
            { field: 'password', length: password.length || 0 }
          )
        );
      }
    }

    // Validate role if provided
    if (role !== undefined) {
      // Only ADMIN and USER roles are allowed
      const validRoles = [UserRole.ADMIN, UserRole.USER];
      if (!validRoles.includes(role)) {
        return createErrorResult(
          createContextualError(
            'Invalid role provided',
            'VALIDATION_ERROR',
            { field: 'role', value: role }
          )
        );
      }
      
      // Check if this is the last admin and they're trying to downgrade
      if (currentUser.role === 'ADMIN' && role === UserRole.USER) {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' }
        });
        
        if (adminCount <= 1) {
          return createErrorResult(
            createContextualError(
              'Cannot downgrade the only admin user',
              'LAST_ADMIN',
              { userId, currentRole: currentUser.role }
            )
          );
        }
      }
    }
    
    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('User update validation error:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Validation failed')
    );
  }
}

/**
 * Validates user deletion
 * 
 * Checks if a user can be safely deleted:
 * - Prevents deletion of the last admin user
 * - Validates user existence
 * 
 * @param userId - ID of user to delete
 * @returns Promise resolving to validation result
 */
export async function validateUserDeletion(userId: string): Promise<ValidationResult> {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return createErrorResult(
        createContextualError(
          'User not found',
          'NOT_FOUND',
          { userId }
        )
      );
    }
    
    // Check if this is the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      });
      
      if (adminCount <= 1) {
        return createErrorResult(
          createContextualError(
            'Cannot delete the only admin user',
            'LAST_ADMIN',
            { userId, userRole: user.role }
          )
        );
      }
    }
    
    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('User deletion validation error:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Validation failed')
    );
  }
}

/**
 * Error response type for API routes - now using AsyncResult
 */
type ErrorResponse = AsyncResult<null, Error>;

/**
 * Validates if a request is authenticated
 *
 * @returns Boolean indicating if the request is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await auth();
    return !!session?.user;
  } catch (error: unknown) {
    logger.error('Error validating authentication:', error);
    return false;
  }
};

/**
 * Validates if a user has admin role
 *
 * @returns Boolean indicating if the user has admin role
 */
export const isAdmin = async (): Promise<boolean> => {
  try {
    const session = await auth();
    return session?.user.role === UserRole.ADMIN;
  } catch (error: unknown) {
    logger.error('Error validating admin role:', error);
    return false;
  }
};

/**
 * Handler for checking authentication
 *
 * @param req - Next.js API request
 * @returns Error response or null if authenticated
 */
export const validateAuth = async (
  req: NextApiRequest
): Promise<ErrorResponse> => {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return createErrorResult(
        createContextualError(
          'Unauthorized',
          'UNAUTHORIZED',
          { path: req.url }
        )
      );
    }

    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('Error validating authentication:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Authentication error')
    );
  }
};

/**
 * Handler for checking admin authorization
 *
 * @param req - Next.js API request
 * @returns Error response or null if authorized
 */
export const validateAdmin = async (
  req: NextApiRequest
): Promise<ErrorResponse> => {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return createErrorResult(
        createContextualError(
          'Unauthorized',
          'UNAUTHORIZED',
          { path: req.url }
        )
      );
    }

    const admin = await isAdmin();

    if (!admin) {
      return createErrorResult(
        createContextualError(
          'Forbidden',
          'FORBIDDEN',
          { path: req.url, requiredRole: 'ADMIN' }
        )
      );
    }

    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('Error validating admin authorization:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Authorization error')
    );
  }
};

/**
 * Handler for checking user authorization for a specific resource
 * 
 * @param req - Next.js API request
 * @param resourceUserId - User ID of the resource owner
 * @returns Error response or null if authorized
 */
export const validateResourceAccess = async (
  req: NextApiRequest,
  resourceUserId: string
): Promise<ErrorResponse> => {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return createErrorResult(
        createContextualError(
          'Unauthorized',
          'UNAUTHORIZED',
          { path: req.url }
        )
      );
    }

    const session = await auth();
    const userId = session?.user.id;
    const isUserAdmin = session?.user.role === UserRole.ADMIN;

    // Admin can access any resource
    if (isUserAdmin) {
      return createSuccessResult(null);
    }

    // Users can only access their own resources
    if (userId !== resourceUserId) {
      return createErrorResult(
        createContextualError(
          'Forbidden',
          'FORBIDDEN',
          { path: req.url, resourceUserId, currentUserId: userId }
        )
      );
    }

    return createSuccessResult(null);
  } catch (error: unknown) {
    logger.error('Error validating resource access:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Authorization error')
    );
  }
};