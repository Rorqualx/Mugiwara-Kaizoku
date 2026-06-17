/**
 * Application Providers
 * 
 * Sets up global application providers and context configuration.
 * Handles:
 * - Query client state
 * - Theme management
 * - Color scheme
 * - Navigation context
 * - Modal management
 * - Notifications
 * - Store initialization and data loading
 * - Integration status management
 * - Authentication via NextAuth
 * - User context for backward compatibility
 * 
 * Provider Hierarchy:
 * 1. SessionProvider (Authentication)
 * 2. UserProvider (Legacy user compatibility)
 * 3. QueryClientProvider (Data fetching)
 * 4. ColorSchemeProvider (Dark/Light mode)
 * 5. ThemeProvider (Custom theme)
 * 6. ModalsProvider (Modal dialogs)
 * 7. Notifications (Toast messages)
 * 8. RealTimeProvider (WebSocket connection and real-time subscriptions)
 * 9. StoreProvider (Store initialization)
 * 10. RootStoreProvider (Data loading)
 * 11. AudioPlayerProvider (Audio playback management)
 * 
 * @module providers/AppProviders
 * @requires next-auth/react - Authentication session provider
 * @requires @mantine/modals - Modal management
 * @requires @mantine/notifications - Toast notifications
 * @requires @tanstack/react-query - Data fetching
 * @requires @/styles - Theme configuration
 * @requires @/contexts - Application contexts
 * @requires @/hooks - Custom hooks
 * @requires @/store/StoreProvider - Store initialization
 * @requires @/store/RootStoreProvider - Data loading and real-time updates
 */

"use client";

import * as React from "react";
import { useState, useEffect } from 'react';

import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { SessionProvider } from 'next-auth/react';

import { logger } from '@/utils/logger';

// Lazy load PWAManager - only needed on client side
const PWAManager = dynamic(
  () => import('../components/mobile/PWAManager').then(mod => mod.PWAManager),
  { ssr: false }
);

import { AudioPlayerProvider } from '../components/audioPlayer/AudioPlayerProvider';
import { IntegrationStatusProvider } from '../contexts/IntegrationStatusContext';
// MainSearchProvider backs the header "Search your library..." box via useSearch ->
// useMainSearch. Both come from the same UnifiedSearchContext (via the barrel), so the
// provider and consumer can no longer drift onto mismatched context objects.
import { MainSearchProvider } from '../contexts/search';
import { UserProvider } from '../contexts/UserContext';
import { useCustomTheme } from '../hooks/useCustomTheme';
import { RootStoreProvider } from '../store/RootStoreProvider';
import { StoreProvider } from '../store/StoreProvider';
import { ColorSchemeProvider } from '../styles/ColorSchemeProvider';

import { RealTimeProvider } from './RealTimeProvider';

import type { Session } from 'next-auth';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

/**
 * Theme Provider Component
 * 
 * Applies custom theme configuration to the application.
 * Uses the useCustomTheme hook to set up theme colors
 * and other styling preferences.
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Themed component wrapper
 */
function ThemeProvider({ children }: {children: React.ReactNode;}): React.ReactElement {
  const [mounted, setMounted] = useState(false);

  // Set mounted state after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply custom theme colors
  const { isCustomTheme, customColors } = useCustomTheme();

  // Log theme application for debugging
  useEffect(() => {
    if (mounted) {
      logger.info('Theme applied', { isCustomTheme, customColors });
    }
  }, [mounted, isCustomTheme, customColors]);

  return <>{children}</>;
}

/**
 * Application Providers Component
 * 
 * Root provider component that wraps the entire application.
 * Configures global state management, theming, and UI utilities.
 * 
 * Features:
 * - Authentication session management
 * - Legacy user context for backward compatibility
 * - React Query configuration
 * - Theme management
 * - Navigation state
 * - Modal system
 * - Toast notifications
 * - Store initialization and state management
 * - Progressive data loading
 * - Integration status management
 * 
 * Query Client Configuration:
 * - Disabled window focus refetching
 * - 3 retry attempts
 * - 1 second retry delay
 * - 5 second stale time
 * 
 * Store Provider Hierarchy:
 * - StoreProvider initializes store instances
 * - RootStoreProvider handles data loading and real-time updates
 * 
 * @component
 * @example
 * ```tsx
 * // In _app.tsx
 * <AppProviders>
 *   <App />
 * </AppProviders>
 * ```
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Application components
 * @param {Object} props.session - NextAuth session data
 * @returns {JSX.Element} Provider-wrapped application
 */
export function AppProviders({
  children,
  session

}: {children: React.ReactNode;session?: Session | null;}): React.ReactElement {
  // Initialize React Query client with custom configuration
  // PERFORMANCE FIX: Reduced retries from 3 to 1 to prevent request storms
  // When backend is slow/unavailable, retry:3 × multiple queries × polling = exponential request growth
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false, // Prevent unnecessary refetches
        retry: 1, // FIXED: Reduced from 3 to prevent request storms
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000), // Exponential backoff with 30s cap
        staleTime: 5 * 60 * 1000, // 5 minutes - prevents refetches on navigation
        // For compatibility with React Query v5
        gcTime: 30 * 60 * 1000 // Garbage collection time (30 minutes)
      }
    },
    // Logger removed - TanStack Query v5 uses a different logging approach
  }));

  return (
    <SessionProvider {...(session !== null && { session })}>
      <UserProvider>
        <QueryClientProvider client={queryClient}>
          <ColorSchemeProvider>
            <ThemeProvider>
              <ModalsProvider>
                <Notifications position="top-right" limit={8} />
                <RealTimeProvider>
                  <StoreProvider>
                    <RootStoreProvider>
                      <IntegrationStatusProvider>
                        <MainSearchProvider>
                          <AudioPlayerProvider>
                            <PWAManager />
                            {children}
                          </AudioPlayerProvider>
                        </MainSearchProvider>
                      </IntegrationStatusProvider>
                    </RootStoreProvider>
                  </StoreProvider>
                </RealTimeProvider>
              </ModalsProvider>
            </ThemeProvider>
          </ColorSchemeProvider>
        </QueryClientProvider>
      </UserProvider>
    </SessionProvider>);

}