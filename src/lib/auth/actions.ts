"use server";

/**
 * Server-side authentication actions for user management
 * 
 * This module provides server actions for handling authentication operations
 * using Auth.js, including sign-in, sign-up, and user management.
 */

// This is a server action file - we need to use server-side auth functions
// Import auth directly from config where we've set up Auth
// Import other utilities and types
import { UserRole } from '@prisma/client';
import { hash } from "bcryptjs";
import { nanoid } from "nanoid";


import { prisma } from "@/server/db";
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
  isError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { signInSchema, signupSchema } from "../validators/auth";

import { auth } from "./config";

import type { SignInInput, SignupInput } from "../validators/auth";

/**
 * Response type for authentication actions
 */
export interface ActionResponse<T> {
  fieldError?: Partial<Record<keyof T, string | undefined>>;
  formError?: string;
}

/**
 * Type guard for Error objects
 */
function isErrorObject(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely gets form data with type checking
 */
function getFormDataValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value === null || typeof value !== 'string') {
    throw new Error(`Invalid form data: ${key} is required`);
  }
  return value;
}

/**
 * Handles user sign-in
 * Validates credentials and initiates NextAuth session
 */
export async function signIn(
  _: unknown,
  formData: FormData,
): Promise<ActionResponse<SignInInput>> {
  try {
    const rawData = {
      email: getFormDataValue(formData, "email"),
      password: getFormDataValue(formData, "password"),
    };

    const result = signInSchema.safeParse(rawData);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const formattedErrors: Partial<Record<keyof SignInInput, string>> = {};
      
      // Convert array errors to string
      for (const key in errors) {
        if (errors[key as keyof typeof errors]?.length) {
          formattedErrors[key as keyof SignInInput] = errors[key as keyof typeof errors]?.[0] ?? '';
        }
      }
      
      return {
        fieldError: formattedErrors,
      };
    }

    try {
      // In NextAuth v4, we can't directly call signIn from server actions
      // Instead, we validate credentials and return success
      // The actual sign-in should be handled via the NextAuth API route
      const { validateCredentials } = await import('./credentials');
      const validationResult = await validateCredentials(result.data.email, result.data.password);

      if (isError(validationResult)) {
        return {
          formError: validationResult.error.message || "Invalid email or password",
        };
      }
      
      // Return success - the client should then redirect to the NextAuth sign in
      return {};
    } catch (_signInError: unknown) {
      return {
        formError: "Invalid email or password",
      };
    }
  } catch (error: unknown) {
    const errorMessage = isErrorObject(error) 
      ? (error instanceof Error ? error.message : String(error)) 
      : "An error occurred during sign in";
    logger.error("Sign in error:", errorMessage);
    return {
      formError: errorMessage.includes("Invalid form data") 
        ? errorMessage 
        : "An error occurred during sign in",
    };
  }
}

/**
 * Handles user registration
 * Creates new user account and initiates session
 */
export async function signUp(
  _: unknown,
  formData: FormData,
): Promise<ActionResponse<SignupInput>> {
  try {
    const rawData = {
      email: getFormDataValue(formData, "email"),
      userName: getFormDataValue(formData, "userName"),
      password: getFormDataValue(formData, "password"),
    };

    const result = signupSchema.safeParse(rawData);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const formattedErrors: Partial<Record<keyof SignupInput, string>> = {};
      
      // Convert array errors to string
      for (const key in errors) {
        if (errors[key as keyof typeof errors]?.length) {
          formattedErrors[key as keyof SignupInput] = errors[key as keyof typeof errors]?.[0] ?? '';
        }
      }
      
      return {
        fieldError: formattedErrors,
      };
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: result.data.email },
          { userName: result.data.userName },
        ],
      },
    });

    if (existingUser) {
      return {
        formError: "Email or username already exists",
      };
    }

    const hashedPassword = await hash(result.data.password, 12);
    const newUser = await prisma.user.create({
      data: {
        id: nanoid(),
        email: result.data.email,
        userName: result.data.userName,
        hashedPassword,
        role: UserRole.USER,
        updatedAt: new Date(),
      },
    });

    // Emit WebSocket event for user signed up
    void realtimeEmitter.emitSystemEvent({
      eventType: 'user:signedUp',
      source: 'auth-actions',
      message: `New user signed up: ${result.data.userName}`,
      data: { userId: newUser.id, userName: result.data.userName },
    });

    return {};
  } catch (error: unknown) {
    const errorMessage = isErrorObject(error) 
      ? (error instanceof Error ? error.message : String(error)) 
      : "An error occurred during sign up";
    logger.error("Sign up error:", errorMessage);
    return {
      formError: errorMessage.includes("Invalid form data") 
        ? errorMessage 
        : "An error occurred during sign up",
    };
  }
}

/**
 * Handles user sign out
 * Terminates the current session
 */
export function signOut(): Promise<{ error: string } | void> {
  // In NextAuth v4, sign out is handled via the API route
  // This function is just a placeholder for compatibility
  // The actual sign out should be done via /api/auth/signout
  return Promise.resolve();
}

/**
 * Creates a new user account
 * Admin-only functionality for user management
 */
export async function createUser(
  _: unknown,
  formData: FormData,
): Promise<ActionResponse<SignupInput>> {
  try {
    // In server actions, we don't have access to req/res objects, 
    // but we can use the cookie-based session
    const session = await auth();
    if (!session?.user || (String(session.user.role).toLowerCase() !== "admin")) {
      return {
        formError: "Unauthorized access",
      };
    }

    return await signUp(_, formData);
  } catch (error: unknown) {
    const errorMessage = isErrorObject(error) 
      ? (error instanceof Error ? error.message : String(error)) 
      : "An error occurred while creating user";
    logger.error("Create user error:", errorMessage);
    return {
      formError: errorMessage.includes("Invalid form data") 
        ? errorMessage 
        : "An error occurred while creating user",
    };
  }
}

/**
 * Updates a user's role
 * Admin-only functionality for role management
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<AsyncResult<null, Error>> {
  try {
    // In server actions, we don't have access to req/res objects,
    // but we can use the cookie-based session
    const session = await auth();
    if (!session?.user || (String(session.user.role).toLowerCase() !== "admin")) {
      return createErrorResult(
        createContextualError(
          "Unauthorized access",
          "UNAUTHORIZED",
          { requiredRole: "ADMIN", currentRole: session?.user.role }
        )
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        role: role === UserRole.ADMIN ? "ADMIN" : "USER"
      },
    });

    // Emit WebSocket event for user role updated
    void realtimeEmitter.emitSystemEvent({
      eventType: 'user:role:updated',
      source: 'auth-actions',
      message: `User role updated to ${role}`,
      data: { userId, newRole: role },
    });

    return createSuccessResult(null);
  } catch (error: unknown) {
    const errorMessage = isErrorObject(error)
      ? (error instanceof Error ? error.message : String(error))
      : "An error occurred while updating user role";
    logger.error("Update user role error:", errorMessage);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error("An error occurred while updating user role")
    );
  }
}