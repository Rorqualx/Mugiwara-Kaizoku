/**
 * Authentication Hook
 * 
 * Custom React hook for managing authentication state and operations.
 * Handles login, logout, and authentication status checking throughout the application.
 * Uses NextAuth for authentication.
 * 
 * Features:
 * - Authentication state management
 * - Login/logout functionality
 * - User data access
 * - Loading and error states
 * - Role-based authorization
 * - Protected route redirection
 * 
 * @module hooks/useAuth
 * @requires next-auth/react - NextAuth React hooks
 * @requires next/router - Next.js router
 * @requires react - React hooks
 */



import { useState, useEffect, useCallback } from 'react';

import { useRouter } from 'next/router';
import {
  useSession,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut} from
'next-auth/react';

import { logger } from '../utils/logger';

import type { Session } from 'next-auth';

// Define UserRole enum to avoid direct import from Prisma client
// This matches the values in the database and ensures consistency
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
}

/**
 * Login result interface
 */
interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * Auth hook options interface
 */
export interface AuthOptions {
  /** Whether authentication is required */
  requireAuth?: boolean;
  /** Required roles for authorization */
  requiredRoles?: UserRole[];
  /** Redirect path for unauthenticated users */
  redirectTo?: string;
}

/**
 * Extended Session user interface with our custom properties
 */
export interface ExtendedUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  role?: UserRole;
  [key: string]: unknown;
}

/**
 * Extended Session interface with our custom properties
 */
export interface ExtendedSession extends Omit<Session, 'user'> {
  user?: ExtendedUser;
  expires: string;
}

/**
 * Auth hook return type interface
 */
export interface UseAuthResult {
  /** Current user information */
  user: ExtendedUser | null;
  /** Full session information */
  session: ExtendedSession | null;
  /** Authentication status: 'loading', 'authenticated', or 'unauthenticated' */
  status: 'loading' | 'authenticated' | 'unauthenticated';
  /** Whether authentication is in loading state */
  isLoading: boolean;
  /** Error message if authentication failed */
  error: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has admin role */
  isAdmin: boolean;
  /** Function to log in with credentials object */
  login: (credentials: {identifier: string;password: string;callbackUrl?: string;}) => Promise<LoginResult>;
  /** Function to log out */
  logout: (options?: {redirectUrl?: string;}) => Promise<boolean>;
  /** Original NextAuth signIn function */
  signIn: typeof nextAuthSignIn;
  /** Original NextAuth signOut function */
  signOut: typeof nextAuthSignOut;
  /** Function to check if user has required roles */
  hasRequiredRoles: (roles: UserRole[]) => boolean;
}

// Define the SignInResult type to match what nextAuthSignIn actually returns
interface SignInResult {
  error?: string | null;
  status?: number;
  ok?: boolean;
  url?: string | null;
}

/**
 * Authentication hook that provides authentication state and functions
 * 
 * @param {AuthOptions} options - Hook options
 * @param {boolean} [options.requireAuth=false] - Whether authentication is required
 * @param {UserRole[]} [options.requiredRoles=[]] - Required roles for authorization
 * @param {string} [options.redirectTo="/login"] - Redirect path for unauthenticated users
 * @returns {UseAuthResult} Authentication state and functions
 */
export function useAuth(options: AuthOptions = {}): UseAuthResult {
  const {
    requireAuth = false,
    requiredRoles = [],
    redirectTo = '/login'
  } = options;

  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  /**
   * Check if user has required roles
   * 
   * @param {UserRole[]} roles - Required roles
   * @param {Session|null} userSession - Optional user session (defaults to current session)
   * @returns {boolean} True if user has required role
   */
  const hasRequiredRoles = useCallback((
  roles: UserRole[],
  userSession: ExtendedSession | null = null)
  : boolean => {
    // Use provided session or fall back to current session
    const sessionToCheck = userSession ?? session as ExtendedSession | null;

    if (!sessionToCheck?.user) return false;
    if (roles.length === 0) return true;

    // Get user role with type safety
    const userRole = sessionToCheck.user.role;

    // Make sure it's a valid UserRole
    if (!userRole || typeof userRole !== 'string') return false;

    // Check if user has one of the required roles
    try {
      // Safely convert string to UserRole enum
      const roleEnum = userRole as UserRole;
      return roles.includes(roleEnum);
    } catch (err: unknown) {
      logger.error('Invalid user role', { userRole, error: err });
      return false;
    }
  }, [session]);

  /**
   * Handle authentication and authorization redirect
   */
  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !isAuthenticated) {
      // Redirect to login if authentication is required but user is not authenticated
      const callbackUrl = router.asPath;
      void router.push(`${redirectTo}?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } else if (isAuthenticated && requiredRoles.length > 0) {
      // Check role-based authorization
      const hasRole = hasRequiredRoles(requiredRoles);

      if (!hasRole) {
        // Redirect to home if user doesn't have required role
        setError('Insufficient permissions');
        void router.push('/');
      }
    }
  }, [
  isLoading,
  requireAuth,
  isAuthenticated,
  requiredRoles,
  hasRequiredRoles,
  session,
  router,
  redirectTo]
  );

  /**
   * Log in with credentials
   * 
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.identifier - Username or email
   * @param {string} credentials.password - User password
   * @param {string} [credentials.callbackUrl] - URL to redirect to after login
   * @returns {Promise<LoginResult>} Login result
   */
  const login = async (
  credentials: {
    identifier: string;
    password: string;
    callbackUrl?: string;
  })
  : Promise<LoginResult> => {
    try {
      setError(null);

      // Extract credentials
      const { identifier, password, callbackUrl } = credentials;

      // Use NextAuth signIn with credentials
      const signInOptions: Record<string, unknown> = {
        identifier,
        password,
        redirect: false,
      };
      if (callbackUrl !== undefined) {
        signInOptions['callbackUrl'] = callbackUrl;
      }
      const result = (await nextAuthSignIn('credentials', signInOptions)) as SignInResult | undefined;

      // Handle result
      if (!result) {
        const errorMsg = 'No result from sign in operation';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Handle error in result
      if (result.error) {
        setError(result.error);
        return { success: false, error: result.error };
      }

      // Handle successful result with URL
      if (result.url) {
        // If we have a URL from the result and a callbackUrl was provided,
        // redirect to that URL
        if (callbackUrl) {
          void router.push(callbackUrl);
        }

        return { success: true };
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'An error occurred during login';

      logger.error('Login error', { error: errorMessage });
      setError(errorMessage);

      return { success: false, error: errorMessage };
    }
  };

  /**
   * Log out the current user
   * 
   * @param {Object} options - Logout options
   * @param {string} [options.redirectUrl='/login'] - URL to redirect to after logout
   * @returns {Promise<boolean>} Logout success
   */
  const logout = async (options?: {redirectUrl?: string;}): Promise<boolean> => {
    try {
      const redirectUrl = options?.redirectUrl ?? '/login';

      // NextAuth signOut doesn't have the same options type as SignInOptions
      // We'll use it without any options, since we'll handle redirect manually
      await nextAuthSignOut({ redirect: false });

      // Clear error state
      setError(null);

      // Manual redirect to login page
      void router.push(redirectUrl);

      return true;
    } catch (err: unknown) {
      logger.error('Logout error', { error: err });

      const errorMessage = err instanceof Error ?
      err.message :
      'Failed to logout';

      setError(errorMessage);
      return false;
    }
  };

  /**
   * Check if the user is an admin
   *
   * @returns {boolean} True if the user has admin role
   */
  const isAdmin = (session?.user as ExtendedUser | undefined)?.role === UserRole.ADMIN;

  /**
   * Get the current user with our extended type
   *
   * @returns {ExtendedUser|null} User object or null if not authenticated
   */
  const user = (session?.user ?? null) as ExtendedUser | null;

  return {
    // Session state
    user,
    session: session as ExtendedSession | null,
    status,
    isLoading,
    error,

    // Authentication state
    isAuthenticated,
    isAdmin,

    // Authentication methods
    login,
    logout,
    signIn: nextAuthSignIn, // Expose original NextAuth signIn for advanced use cases
    signOut: nextAuthSignOut, // Expose original NextAuth signOut for advanced use cases

    // Authorization helpers
    hasRequiredRoles
  };
}