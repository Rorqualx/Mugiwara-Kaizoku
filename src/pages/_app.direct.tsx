/**
 * Direct Application Root Component
 *
 * Alternative implementation of _app.tsx that uses direct imports
 * to avoid build-time dependency issues with tRPC.
 */




import type { ReactElement, ReactNode} from 'react';
import React from "react";
import { useState, useEffect } from 'react';

import dynamic from 'next/dynamic';
import Head from 'next/head';

import '../styles/prowlarr';
import '../styles/hideScrollbar';
import '../scripts/theme-initializer';
import RootLayout from '../components/layouts/RootLayout';
import { AppProviders } from '../providers/AppProviders';
import styles from '../styles/LoadingFallback.module.css';
import { logger } from '../utils/logger';
import { withTRPC } from '../utils/trpc-client/direct-export';

import type { AppProps } from 'next/dist/pages/_app';
import type { Session } from 'next-auth';
// Type definitions
type NextPageWithLayout = React.FC & {
    getLayout?: (page: ReactElement) => ReactNode;
};
type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
    pageProps: {
        session?: Session;
        [key: string]: unknown;
    };
};
// Loading fallback component
function LoadingFallback(): React.ReactElement {
    return (<div className={styles.container}>
      <div>Loading...</div>
    </div>);
}
// Helper to safely extract session from pageProps
function extractSession(props: unknown): Session | undefined {
    if (typeof props === 'object' && props !== null && 'session' in props) {
        return (props as { session?: Session }).session;
    }
    return undefined;
}

// Main application component
function App({ Component, pageProps }: AppPropsWithLayout): JSX.Element {
    // Cast through unknown to break the 'any' chain from Next.js AppProps
    const safePageProps = pageProps as unknown as Record<string, unknown>;
    const session = extractSession(safePageProps);
    const { session: _session, ...restPageProps } = safePageProps;
    const getLayout = Component.getLayout ?? ((page: ReactElement) => <RootLayout>{page}</RootLayout>);
    const [mounted, setMounted] = useState(false);
    // Set mounted state after hydration
    useEffect(() => {
        setMounted(true);
        logger.info('Application mounted');
        // Force a redraw of the page to ensure theme is applied
        if (document.body)
            document.body.style.display = 'none';
        // Trigger a reflow - assign to unused var to satisfy ESLint
        const _forceReflow = document.body.offsetHeight;
        void _forceReflow;
        if (document.body)
            document.body.style.display = '';
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
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Kaizoku</title>
      </Head>
      <AppProviders session={session ?? null}>
        <div style={{
            visibility: mounted ? 'visible' : 'hidden',
            transition: 'opacity 0.3s ease-in-out',
            opacity: mounted ? 1 : 0
        }}>

          {getLayout(<Component {...restPageProps}/>)}
        </div>
      </AppProviders>
    </>);
}
// Dynamic loading component
const DynamicLoadingFallback = dynamic(() => Promise.resolve(LoadingFallback), {
    ssr: false
});
// Client-side only app component
const AppWithNoSSR = dynamic(() => Promise.resolve(App), {
    ssr: false,
    loading: () => <DynamicLoadingFallback />
});
// Export the app with tRPC integration
export default withTRPC(AppWithNoSSR);
