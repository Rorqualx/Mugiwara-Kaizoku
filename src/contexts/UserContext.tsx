/**
 * User Context
 *
 * Provides a user state management layer for the application.
 * Uses Auth.js for session management.
 *
 * Features:
 * - Global user state accessible throughout the application
 * - User role and permissions management
 * - Authentication status tracking
 * - Backward compatibility with legacy components
 *
 * @module contexts/UserContext
 * @requires react - Context API
 * @requires next-auth/react - Session management (Auth.js)
 */


import React, { createContext, useContext, useMemo } from 'react';

import { useSession } from 'next-auth/react';

import type { UserRole } from '@prisma/client';

/**
 * Legacy User interface for backward compatibility
 */
export interface LegacyUser {
  id: string;
  userName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

/**
 * User Context Props interface
 */
interface UserContextProps {
  user: LegacyUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

/**
 * Create User Context
 */
const UserContext = createContext<UserContextProps>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false
});

/**
 * User Context Provider Component
 * 
 * Wraps the application with user context data from Auth.js.
 * Maps the Auth.js session user to the legacy user format.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Context provider wrapper
 */
export function UserProvider({ children }: {children: React.ReactNode;}): React.ReactElement {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && !!session.user;
  const isAdmin = (session?.user as unknown as { role?: string } | undefined)?.role === 'ADMIN';

  // Derive user from session - no useState needed
  const user = useMemo<LegacyUser | null>(() => {
    if (!session?.user) return null;

    const userData = session.user as unknown as {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
      avatar?: unknown;
    };

    return {
      id: String(userData.id ?? ''),
      userName: String(userData.name ?? ''),
      email: String(userData.email ?? ''),
      role: userData.role as UserRole,
      ...(userData.avatar ? { avatar: String(userData.avatar) } : {})
    };
  }, [session]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<UserContextProps>(() => ({
    user,
    isLoading,
    isAuthenticated,
    isAdmin
  }), [user, isLoading, isAuthenticated, isAdmin]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Use User Context Hook
 * 
 * Custom hook to access the user context from any component.
 * 
 * @returns {UserContextProps} User context values
 */
export function useUserContext(): UserContextProps {
  // Context always has a value since UserContext has a default value
  return useContext(UserContext);
}