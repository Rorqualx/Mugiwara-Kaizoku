/**
 * tRPC Client Configuration
 * 
 * This module sets up the tRPC client for making type-safe API calls from the frontend.
 * It configures the client with SuperJSON transformer for enhanced serialization and
 * an HTTP batch link (see the links comment below).
 * 
 * @module trpc-client
 */

import { httpBatchLink } from '@trpc/client';
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
 * - Batch link: calls made together share one HTTP request
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
        // Calls made in the same tick share one HTTP request.
        //
        // Not httpBatchStreamLink: on a streamed response tRPC sets
        // `transfer-encoding: chunked` itself and Bun's node:http adds its own,
        // so the header is sent twice. Browsers accept that, but the HTTPS
        // proxy (Caddy, Go's HTTP client) rejects it and answers 502 — which
        // took prod down on 2026-10-13. A plain batch response carries the
        // header once and passes through the proxy.
        //
        // Batching was off from 2025-10 to 2026-10 after "manga detail returns
        // wrong data on rapid clicks". The cause was the server's response
        // cache, which keyed on the whole request's input, so two calls to one
        // procedure in a batch shared an entry; it now keys on each call's own
        // input (and caller) — see cachingMiddleware.
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          // Batched inputs go in the GET query string; split before proxies
          // or the server would reject an overlong URL.
          maxURLLength: 4000,
          maxItems: 25,
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