/**
 * Application Root Component
 *
 * Main application wrapper that handles:
 * - Global providers and store setup
 * - Layout management
 * - Client-side rendering
 * - Hydration handling
 * - tRPC integration
 * - Authentication session
 *
 * Features:
 * - Custom layout support per page
 * - Client-side only rendering to prevent hydration issues
 * - Loading fallback during hydration
 * - Global state management
 * - Theme and style integration
 * - NextAuth integration
 *
 * @module pages/_app
 * @requires next/app - Next.js app utilities
 * @requires next/head - Document head management
 * @requires next/dynamic - Dynamic imports
 * @requires react - React core
 * @requires @/providers - Application providers
 * @requires @/store - State management
 * @requires @/styles - Global styles
 * @requires @/utils - Utility functions
 */
// Import Brave browser ethereum fix before any other imports
import '../scripts/brave-ethereum-fix';
import type { ReactElement, ReactNode} from 'react';
import React from "react";
import { useEffect, useRef } from 'react';

import Head from 'next/head';
import { useSession } from 'next-auth/react';

import '../styles/globals.css';
import '../styles/prowlarr.css';
import '../styles/hideScrollbar.css';
import '../styles/themeOverrides.css';
import '../styles/nprogress.css';
import '../styles/calendar.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
// Swagger CSS moved to api-docs.tsx
import '../scripts/theme-initializer'; // Import the theme initializer script
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import RootLayout from '../components/layouts/RootLayout';
import { useRouterProgress } from '../hooks/useRouterProgress';
import { AppProviders } from '../providers/AppProviders';
import { logger } from '../utils/logger';
import { trpc } from '../utils/trpc-client/index';

import type { AppProps } from 'next/dist/pages/_app';
import type { Session } from 'next-auth';
/**
 * Extended Next.js page type with layout support
 *
 * @typedef {Object} NextPageWithLayout
 * @extends NextPage
 * @property {Function} [getLayout] Optional function to wrap page with custom layout
 */
type NextPageWithLayout = React.FC & {
    getLayout?: (page: ReactElement) => ReactNode;
};
/**
 * Extended app props type with layout support and session
 *
 * @typedef {Object} AppPropsWithLayout
 * @extends AppProps
 * @property {NextPageWithLayout} Component Page component with optional layout
 * @property {Object} pageProps Page properties
 * @property {Session} [pageProps.session] NextAuth session data
 */
type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
    pageProps: {
        session?: Session;
        [key: string]: unknown;
    };
};
/**
 * Logs the application-startup event once per mount, after authentication
 * resolves. events.logStartup is a protectedProcedure — firing it from the
 * login page just produced a 401. Lives inside AppProviders so useSession
 * has a SessionProvider above it.
 */
function StartupEventLogger(): null {
    const { status } = useSession();
    const logged = useRef(false);
    const logStartupMutation = trpc.events.logStartup.useMutation({
        onError: (error) => {
            logger.warn('Failed to log application startup event', { error: error.message });
        }
    });
    useEffect(() => {
        if (status !== 'authenticated' || logged.current) return;
        logged.current = true;
        logger.info('Application mounted');
        logStartupMutation.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation hook reference changes every render
    }, [status]);
    return null;
}
/**
 * Main Application Component
 *
 * Handles the core application setup and rendering:
 * - Applies global providers and store
 * - Manages page layouts
 * - Controls hydration visibility
 * - Sets up meta tags
 * - Provides authentication session
 *
 * @component
 * @param {AppPropsWithLayout} props Application props
 * @param {NextPageWithLayout} props.Component Page component to render
 * @param {Object} props.pageProps Props for the page component
 * @param {Session} [props.pageProps.session] Authentication session
 * @returns {React.ReactElement} Wrapped application component
 */
function App({ Component, pageProps }: AppPropsWithLayout): React.ReactElement {
    const { session, ...restPageProps } = pageProps as { session?: Session; [key: string]: unknown };
    const getLayout = Component.getLayout ?? ((page: ReactElement) => <RootLayout>{page}</RootLayout>);
    // NProgress integration for route transition feedback
    useRouterProgress();
    // Auto-reload on stale webpack chunks (e.g. after server restart)
    useEffect(() => {
        const handleChunkError = (event: ErrorEvent): void => {
            if ((event.error as Record<string, unknown>)?.['name'] === 'ChunkLoadError') {
                const reloaded = sessionStorage.getItem('chunk-reload');
                if (!reloaded) {
                    sessionStorage.setItem('chunk-reload', '1');
                    window.location.reload();
                }
            }
        };
        const clearReloadFlag = (): void => { sessionStorage.removeItem('chunk-reload'); };
        window.addEventListener('error', handleChunkError);
        window.addEventListener('focus', clearReloadFlag);
        return () => {
            window.removeEventListener('error', handleChunkError);
            window.removeEventListener('focus', clearReloadFlag);
        };
    }, []);

    // Add a class to help prevent flash of unstyled content
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement?.classList.add('theme-transition-ready');
            return () => {
                document.documentElement?.classList.remove('theme-transition-ready');
            };
        }
        return undefined;
    }, []);
    return (<>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <title>Mugiwara-Kaizoku</title>
      </Head>
      <AppProviders session={session ?? null}>
        <StartupEventLogger />
        <ErrorBoundary>
          {getLayout(<Component {...restPageProps}/>)}
        </ErrorBoundary>
      </AppProviders>
    </>);
}
/**
 * Export the App component with tRPC wrapper
 *
 * Note: The useLayoutEffect warning from ColorSchemeProvider is harmless
 * and doesn't affect functionality. It's a React warning, not an error.
 *
 * Performance optimizations applied:
 * - Non-blocking mutations (mutate() instead of mutateAsync())
 * - React Query caching (5min stale, 30min gc)
 * - Removed forced reflow code
 */
export default trpc.withTRPC(App);
