/**
 * Authentication Higher-Order Component
 * 
 * Provides a wrapper component for protecting routes based on authentication
 * and role requirements. Used to secure page components in the application.
 * Updated to use Auth.js.
 * 
 * Features:
 * - Route protection based on authentication
 * - Admin-only route protection
 * - Loading state handling
 * - Automatic redirect to login for unauthenticated users
 * - Callback URL preservation
 * 
 * @module components/auth/withAuth
 */

import React from "react";
import { useEffect, useState } from 'react';

import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

/**
 * Basic loading screen component
 * 
 * Displayed while authentication status is being checked
 */
// Import the UI loading screen component
import LoadingScreenComponent from '../ui/LoadingScreen';

function LoadingScreen(): React.ReactElement {
  return <LoadingScreenComponent message="Please wait while we verify your credentials" />;
}

/**
 * Authentication wrapper for page components
 *
 * @param {React.ComponentType} Component - The page component to protect
 * @param {boolean} requireAdmin - Whether admin role is required
 * @returns {React.ComponentType} Protected component
 */
export default function withAuth(
  Component: React.ComponentType<unknown>,
  requireAdmin = false
): React.ComponentType<unknown> {
  /**
   * Protected route component that checks authentication before rendering
   */
  function ProtectedRoute(props: Record<string, unknown>): React.ReactElement | null {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    const isLoading = status === 'loading';
    const isAuthenticated = status === 'authenticated';
    // Check for admin role in a type-safe way
    const user = session?.user as Record<string, unknown> | undefined;
    const isAdmin = user && 'role' in user
      ? String(user['role']).toLowerCase() === 'admin'
      : false;

    useEffect(() => {
      // Skip auth check if still loading
      if (isLoading) return;

      if (!isAuthenticated) {
        // Redirect to login page if not authenticated
        void router.push({
          pathname: '/login',
          query: { callbackUrl: router.asPath }
        });
      } else if (requireAdmin && !isAdmin) {
        // Redirect to home page if admin required but user is not admin
        void router.push('/');
      } else {
        // User is authenticated and meets role requirements
        setAuthorized(true);
      }
    }, [isLoading, isAuthenticated, isAdmin, router]);

    // Show loading screen while checking authentication
    if (isLoading || !authorized) {
      return <LoadingScreen />;
    }

    // Render the protected component with its props
    return <Component {...props} />;
  }

  // Set display name for debugging
  const componentName = Component.displayName ?? Component.name;
  ProtectedRoute.displayName = `withAuth(${componentName})`;

  return ProtectedRoute as React.ComponentType<unknown>;
}

/**
 * Authentication wrapper that specifically requires admin role
 *
 * @param {React.ComponentType} Component - The page component to protect
 * @returns {React.ComponentType} Admin-protected component
 */
export function withAdmin(Component: React.ComponentType<unknown>): React.ComponentType<unknown> {
  return withAuth(Component, true);
}