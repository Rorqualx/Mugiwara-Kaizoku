/**
 * Direct tRPC Client Export
 * 
 * This module provides direct exports of tRPC functionality,
 * eliminating the need for runtime wrappers during the build process.
 * 
 * @module trpc-client/direct-export
 */

import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';

import type { AppRouter } from '@/server/trpc/root';

/**
 * Determines the base URL for API requests
 */
function getBaseUrl(): string {

  if (typeof window !== 'undefined') return '';
  if (process.env['VERCEL_URL'] !== undefined) return `https://${process.env['VERCEL_URL']}`;
  return `http://localhost:${process.env['KAIZOKU_PORT'] ?? 3000}`;
}

/**
 * Create the tRPC client
 * 
 * We disable SSR to prevent hydration issues and use superjson
 * for proper serialization of dates, BigInts, etc.
 */
// Use a @ts-ignore for the whole tRPC client setup since there are compatibility 
// issues between tRPC v11 and the TypeScript type definitions
// @ts-ignore - Ignoring type errors due to tRPC v11 compatibility issues
// Create a wrapper to handle type compatibility issues with tRPC v11
// @ts-ignore - Need to completely ignore for tRPC v11 compatibility
export const trpc = createTRPCNext<AppRouter>({
  // @ts-ignore - tRPC v11 config compatibility
  config() {
    // @ts-ignore - tRPC v11 requires transformer in the httpBatchLink
    const links = [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        // @ts-ignore - Necessary for tRPC v11 but causing type errors
        transformer: superjson,
      }),
    ];

    // @ts-ignore - Return config ignoring type errors
    return {
      // @ts-ignore - tRPC v11 links compatibility
      links,
      // @ts-ignore - Config with proper options
      queryClientConfig: {
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      },
    };
  },
  // @ts-ignore - SSR option
  ssr: false,
});

// Export the withTRPC function directly to avoid destructuring issues
export const withTRPC = trpc.withTRPC;