/**
 * tRPC Client Configuration
 * 
 * This module sets up the tRPC client for making type-safe API calls from the frontend.
 * It configures the client with SuperJSON transformer for enhanced serialization and
 * HTTP batch link for optimized request handling.
 * 
 * @module trpc-client
 */

import { httpLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import superjson from 'superjson';

import type { AppRouter } from '@/server/trpc/root';

/**
 * Determines the base URL for API requests
 *
 * Uses different base URLs depending on the environment:
 * - Browser: Empty string (relative URLs)
 * - Vercel: Vercel deployment URL
 * - Local: localhost with configured port
 *
 * @returns {string} The base URL for API requests
 */
function getBaseUrl(): string {
   
  if (typeof window !== 'undefined') return '';
  // ESLint disable: process.env is available in Node.js/server environment
   
  if (process.env['VERCEL_URL']) return `https://${process.env['VERCEL_URL']}`;
   
  return `http://localhost:${process.env["KAIZOKU_PORT"] || 3000}`;
}

/**
 * tRPC client instance
 *
 * Configured with:
 * - SuperJSON transformer for handling dates, BigInts, and other complex types
 * - HTTP link for request handling
 * - Client-side rendering (SSR disabled for simplicity)
 *
 * @example
 * // Making a type-safe API call
 * const data = await trpc.someEndpoint.useQuery();
 *
 * // Mutation with type checking
 * await trpc.updateSomething.useMutation({ id: 1, value: 'new' });
 */
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        // TEMPORARY: Using httpLink instead of httpBatchLink to debug rapid query issues
        // httpBatchLink was causing manga detail queries to return wrong data when clicked rapidly
        httpLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // REMOVED: staleTime: 5 * 60 * 1000
            // This was preventing component-level staleTime from working
            // Causing manga detail modal to show wrong cached data
          },
        },
      },
    };
  },
  transformer: superjson,
  ssr: false, // Disabled - tRPC v11 SSR requires ssrPrepass function
});