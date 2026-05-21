/**
 * Router Progress Hook
 * Integrates NProgress with Next.js router events
 *
 * @module hooks/useRouterProgress
 */
import { useEffect } from 'react';

import { useRouter } from 'next/router';
import NProgress from 'nprogress';

import { logger } from '@/utils/logger';

/**
 * NProgress configuration options
 */
const NPROGRESS_CONFIG = {
  minimum: 0.1,
  showSpinner: false,
  easing: 'ease',
  speed: 300,
  trickleSpeed: 200,
} as const;

/**
 * Hook to integrate NProgress with Next.js router events
 *
 * Automatically shows a progress bar during route transitions:
 * - routeChangeStart → NProgress.start()
 * - routeChangeComplete → NProgress.done()
 * - routeChangeError → NProgress.done()
 *
 * @example
 * ```tsx
 * function App({ Component, pageProps }: AppProps) {
 *   useRouterProgress();
 *   return <Component {...pageProps} />;
 * }
 * ```
 */
export function useRouterProgress(): void {
  const router = useRouter();

  useEffect(() => {
    NProgress.configure(NPROGRESS_CONFIG);

    const handleStart = (url: string): void => {
      logger.debug('[Router] Navigation started', { url });
      NProgress.start();
    };

    const handleComplete = (): void => {
      logger.debug('[Router] Navigation completed');
      NProgress.done();
    };

    const handleError = (): void => {
      logger.debug('[Router] Navigation error');
      NProgress.done();
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return (): void => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
      NProgress.done();
    };
  }, [router.events]);
}
