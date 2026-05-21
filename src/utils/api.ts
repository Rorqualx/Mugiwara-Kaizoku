import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import superjson from 'superjson';

import { type AppRouter } from '../server/trpc/root';

// Define router types
type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env["VERCEL_URL"]) return `https://${process.env["VERCEL_URL"]}`; // SSR should use vercel url
  return `http://localhost:${process.env["PORT"] ?? 3000}`; // dev SSR should use localhost
};

/**
 * Configure tRPC client with superjson transformer
 *
 * NOTE: No global staleTime set - component-level settings control caching.
 * This matches the pattern in @/utils/trpc-client/index.ts
 */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // No global staleTime - let component-level settings work
          },
        },
      },
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    };
  },
  transformer: superjson,
  ssr: false,
});

// Export type definitions
export type { RouterInputs, RouterOutputs };
