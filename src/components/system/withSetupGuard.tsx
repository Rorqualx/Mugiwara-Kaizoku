import { isSetupComplete } from '@/lib/auth/setup-utils';

import type { GetServerSidePropsContext } from 'next';

// Define GetServerSideProps type locally since Next.js export is problematic
type GetServerSideProps<
  P extends { [key: string]: unknown } = { [key: string]: unknown }
> = (
  context: GetServerSidePropsContext
) => Promise<{ props: P } | { redirect: { destination: string; permanent: boolean } } | { notFound: true }>;

type GetServerSidePropsResult<P> = 
  | { props: P }
  | { redirect: { destination: string; permanent: boolean } }
  | { notFound: true };

/**
 * Higher-order function for protecting routes with setup completion check
 * 
 * This function wraps Next.js getServerSideProps to enforce setup completion
 * before allowing access to protected pages. It automatically redirects
 * users to the setup page if the initial system setup is not complete.
 * 
 * Features:
 * - Setup completion verification
 * - Automatic redirection to setup page
 * - Preserves original getServerSideProps functionality
 * - Type-safe props handling
 * 
 * @remarks
 * Setup Flow:
 * 1. Checks setup completion status
 * 2. If incomplete, redirects to /setup
 * 3. If complete, proceeds with original getServerSideProps
 * 4. Falls back to empty props if no original handler
 * 
 * @typeParam P - Type of page props, extends object with string keys
 * 
 * @param getServerSideProps - Optional original getServerSideProps function
 * @returns Enhanced getServerSideProps function with setup guard
 * 
 * @example
 * ```tsx
 * // Basic usage - redirect to setup if not complete
 * export const getServerSideProps = withSetupGuard();
 * 
 * // With existing getServerSideProps
 * export const getServerSideProps = withSetupGuard(async (context) => {
 *   return {
 *     props: {
 *       data: await fetchData()
 *     }
 *   };
 * });
 * ```
 */
export function withSetupGuard<P extends { [key: string]: unknown }>(
  getServerSideProps?: GetServerSideProps<P>
): GetServerSideProps<P> {
  return async (context: GetServerSidePropsContext): Promise<GetServerSidePropsResult<P>> => {
    // Check if setup is complete
    const setupComplete = await isSetupComplete();
    
    // If setup is not complete, redirect to setup page
    if (!setupComplete) {
      return {
        redirect: {
          destination: '/setup',
          permanent: false,
        },
      };
    }
    
    // If setup is complete and there's an original getServerSideProps, call it
    if (getServerSideProps) {
      return getServerSideProps(context);
    }
    
    // Otherwise, just return empty props
    return { props: {} as P };
  };
}
