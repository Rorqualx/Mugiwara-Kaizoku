import { createTRPCProxyClient, httpLink, type TRPCClient } from '@trpc/client';
import superjson from 'superjson';

import type { AppRouter } from '@/server/trpc/root';

/**
 * Get the base URL for tRPC calls (matches existing React client logic exactly)
 * From src/utils/trpc-client/index.ts and src/utils/trpc-client/direct-export.ts
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  // ESLint disable: process.env is available in Node.js/server environment
  if (process.env['VERCEL_URL']) return `https://${process.env['VERCEL_URL']}`;
  return `http://localhost:${process.env['KAIZOKU_PORT'] || 3000}`;
}

/**
 * Fetch wrapper that includes credentials for authenticated procedures
 * Ensures session cookies are sent with all tRPC requests
 */
function fetchWithCredentials(url: URL | RequestInfo, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
}

/**
 * Create httpLink configuration with credentials support
 * Using httpLink instead of httpBatchLink to avoid body size issues with large payloads
 * (e.g., manga with 100+ chapters from Fandom)
 */
function createLinkConfig(baseUrl: string): ReturnType<typeof httpLink> {
  return httpLink({
    url: `${baseUrl}/api/trpc`,
    // @ts-ignore - tRPC v11 transformer compatibility (may be needed)
    transformer: superjson,
    // @ts-ignore - tRPC v11 fetch type compatibility with exactOptionalPropertyTypes
    fetch: fetchWithCredentials,
  });
}

/**
 * Vanilla tRPC client for use in non-React contexts (services, scripts, etc.)
 * Based on existing pattern from test-comicvine-volume.ts script
 * Uses httpLink (same as React client) to avoid body size issues with large payloads
 *
 * IMPORTANT: Uses credentials: 'include' to send session cookies for authenticated procedures
 */
// @ts-ignore - tRPC v11 compatibility (may be needed)
export const vanillaTrpcClient = createTRPCProxyClient<AppRouter>({
  links: [createLinkConfig(getBaseUrl())],
});

/**
 * Optional: Factory function for creating vanilla tRPC clients with custom URLs
 * Useful for testing or different environments
 */
export function createVanillaTRPCClient(options?: { url?: string }): TRPCClient<AppRouter> {
  const baseUrl = options?.url ?? getBaseUrl();
  // @ts-ignore - tRPC v11 compatibility
  return createTRPCProxyClient<AppRouter>({
    links: [createLinkConfig(baseUrl)],
  });
}
