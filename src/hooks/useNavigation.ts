/**
 * Navigation Hook
 * Provides consistent navigation with error handling and prefetching
 *
 * @module hooks/useNavigation
 */
import { useCallback, useState } from 'react';

import { useRouter } from 'next/router';

import { logger } from '@/utils/logger';

/**
 * Result of a navigation attempt
 */
export interface NavigationResult {
  success: boolean;
  error?: string;
}

/**
 * Options for navigation
 */
export interface NavigationOptions {
  /** Skip navigation if already on target path (default: true) */
  skipIfSame?: boolean;
  /** Use replace instead of push (default: false) */
  replace?: boolean;
  /** Callback on successful navigation */
  onSuccess?: () => void;
  /** Callback on navigation error */
  onError?: (error: string) => void;
  /** Use shallow routing (default: false) */
  shallow?: boolean;
}

/**
 * Return type of useNavigation hook
 */
export interface UseNavigationResult {
  /** Navigate to a path with error handling */
  navigateTo: (path: string, options?: NavigationOptions) => Promise<NavigationResult>;
  /** Whether a navigation is currently in progress */
  isNavigating: boolean;
  /** Prefetch a route for faster navigation */
  prefetch: (path: string) => void;
  /** Current pathname */
  pathname: string;
}

/**
 * Hook providing consistent navigation with error handling and prefetching
 *
 * Features:
 * - Proper async/await with try/catch
 * - Three-tier fallback: push → replace → window.location.href
 * - Built-in prefetch support
 * - Navigation state tracking
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { navigateTo, prefetch, isNavigating } = useNavigation();
 *
 *   return (
 *     <button
 *       onClick={() => navigateTo('/dashboard')}
 *       onMouseEnter={() => prefetch('/dashboard')}
 *       disabled={isNavigating}
 *     >
 *       {isNavigating ? 'Loading...' : 'Go to Dashboard'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useNavigation(): UseNavigationResult {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateTo = useCallback(
    async (path: string, options: NavigationOptions = {}): Promise<NavigationResult> => {
      const {
        skipIfSame = true,
        replace = false,
        onSuccess,
        onError,
        shallow = false,
      } = options;

      // Skip if already on target path
      // Use asPath for actual URL comparison (pathname is the route pattern like /manga/[id])
      if (skipIfSame && router.asPath === path) {
        logger.debug('[Navigation] Skipping navigation - already on target path:', { path });
        return { success: true };
      }

      setIsNavigating(true);
      logger.debug('[Navigation] Starting navigation:', { path, replace, shallow, from: router.asPath });

      try {
        // First attempt: standard navigation
        if (replace) {
          await router.replace(path, undefined, { shallow });
        } else {
          await router.push(path, undefined, { shallow });
        }
        logger.debug('[Navigation] Navigation successful:', { path });
        onSuccess?.();
        return { success: true };
      } catch (pushError: unknown) {
        const pushErrorMessage =
          pushError instanceof Error ? pushError.message : String(pushError);
        logger.warn('[Navigation] Primary navigation failed:', {
          path,
          error: pushErrorMessage,
        });

        try {
          // Second attempt: replace instead of push
          await router.replace(path, undefined, { shallow });
          onSuccess?.();
          return { success: true };
        } catch (replaceError: unknown) {
          const replaceErrorMessage =
            replaceError instanceof Error ? replaceError.message : String(replaceError);
          logger.error('[Navigation] Replace navigation failed:', {
            path,
            error: replaceErrorMessage,
          });

          // Final fallback: hard navigation
          if (typeof window !== 'undefined') {
            window.location.href = path;
            return { success: true };
          }

          const finalError = `Navigation failed: ${replaceErrorMessage}`;
          onError?.(finalError);
          return { success: false, error: finalError };
        }
      } finally {
        setIsNavigating(false);
      }
    },
    [router]
  );

  const prefetch = useCallback(
    (path: string): void => {
      // Use asPath for actual URL comparison
      if (router.asPath === path) return;
      router.prefetch(path).catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.debug('[Navigation] Prefetch failed:', { path, error: errorMessage });
      });
    },
    [router]
  );

  return {
    navigateTo,
    isNavigating,
    prefetch,
    pathname: router.pathname,
  };
}
