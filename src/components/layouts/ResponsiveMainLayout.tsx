"use client";
/**
 * Responsive Main Layout Component
 *
 * Enhanced version of MainLayout with mobile responsiveness:
 * - Adaptive layout based on device type
 * - Mobile bottom navigation
 * - Tablet collapsible sidebar
 * - Desktop full sidebar
 * - Touch-optimized interactions
 */
import type { CSSProperties} from 'react';
import React, { useMemo, useEffect } from 'react';

import { AppShell, Box } from '@mantine/core';
import { useRouter } from 'next/router';

import { useBreakpoint, useMobileState } from '@/hooks/mobile';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { AlphabetJumpBar } from '../alphabetJumpBar';
import { AudioPlayerUI } from '../audioPlayer';
import ErrorBoundary from "../common/UnifiedErrorBoundary";
import { KaizokuHeaderContent } from '../headerContent';
import { LibraryActionBar } from '../libraryActionBar';
import { ResponsiveNavigation } from '../mobile';
import { KaizokuNavbar } from '../navbar';

import { AttributionFooter } from './AttributionFooter';
/**
 * Props for the ResponsiveMainLayout component
 */
export interface ResponsiveMainLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional CSS class name to apply to the layout */
  className?: string;
  /** Optional title for the page */
  pageTitle?: string;
  /** Optional callback for navbar toggle */
  onNavbarToggle?: () => void;
  /** Whether the navbar is collapsed */
  navbarCollapsed?: boolean;
  /** Additional styles for the main content area */
  contentStyle?: CSSProperties;
}
/**
 * Responsive main application layout component
 *
 * @param props - Component props
 * @returns Responsive application layout structure
 */
export function ResponsiveMainLayout({ children, className, onNavbarToggle, navbarCollapsed = false, contentStyle }: ResponsiveMainLayoutProps): React.ReactElement {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const { closeNav } = useMobileState();
  // Route detection
  const isHomePage = router.pathname === '/' || router.pathname === '/index';
  const isLibraryListPage = router.pathname === '/library'; // Library listing page (shows all libraries)
  const isLibraryDetailPage = router.pathname.startsWith('/library/') && router.pathname !== '/library/add'; // Individual library page
  const isLibraryPage = isLibraryListPage || isLibraryDetailPage; // Either listing or detail page
  const isMangaPage = router.pathname.startsWith('/manga/');
  const isSettingsPage = router.pathname.startsWith('/settings');
  // Debug logging
   
  if (typeof window !== 'undefined') {
    logger.info('[ResponsiveMainLayout] Current path:', router.pathname);
    logger.info('[ResponsiveMainLayout] isHomePage:', isHomePage);
    logger.info('[ResponsiveMainLayout] isLibraryPage:', isLibraryPage);
    logger.info('[ResponsiveMainLayout] isMangaPage:', isMangaPage);
    logger.info('[ResponsiveMainLayout] isSettingsPage:', isSettingsPage);
  }
  // Close mobile nav on route change
  useEffect(() => {
    const handleRouteChange = (): void => {
      if (isMobile || isTablet) {
        closeNav();
      }
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events, isMobile, isTablet, closeNav]);
  // Responsive navbar configuration
  const navbarConfig = useMemo(() => {
    if (isMobile) {
      // Hide navbar on mobile - use bottom nav instead
      return {
        width: 0,
        breakpoint: 'sm' as const,
        collapsed: {
          desktop: true,
          mobile: true
        }
      };
    } else
    if (isTablet) {
      // Collapsible sidebar for tablets
      return {
        width: navbarCollapsed ? 0 : 210,
        breakpoint: 'md' as const,
        collapsed: {
          desktop: navbarCollapsed,
          mobile: true
        }
      };
    } else
    {
      // Full sidebar for desktop
      return {
        width: navbarCollapsed ? 0 : 210,
        breakpoint: 'sm' as const,
        collapsed: {
          desktop: navbarCollapsed,
          mobile: navbarCollapsed
        }
      };
    }
  }, [isMobile, isTablet, navbarCollapsed]);
  // Responsive shell styles
  const shellStyles = useMemo(() => ({
    root: {
      position: 'relative' as const,
      padding: 0,
      margin: 0,
      overflowX: 'hidden' as const,
      paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0))' : '0' // Space for bottom nav + safe area
    },
    main: {
      backgroundColor: 'var(--app-background-color)',
      padding: 0,
      paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0))' : '0',
      // Space for bottom nav + safe area
      minHeight: isMobile ? 'calc(100vh - 56px - 56px - env(safe-area-inset-bottom, 0))' : 'calc(100vh - 56px)',
      ...(contentStyle ?? {})
    },
    navbar: {
      backgroundColor: 'var(--app-card-background)',
      zIndex: 200,
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      boxShadow: 'var(--mantine-shadow-md)',
      top: '56px',
      height: 'calc(100vh - 56px)',
      padding: 0,
      display: isMobile ? 'none' : 'block'
    },
    header: {
      backgroundColor: 'var(--app-card-background)',
      zIndex: 201,
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      boxShadow: 'var(--mantine-shadow-md)',
      padding: 0,
      '& > div': {
        padding: 0
      }
    }
  }), [contentStyle, isMobile]);
  // Responsive action bar styles
  const actionBarStyles = useMemo(() => ({
    position: 'fixed',
    top: '56px',
    left: isMobile ? '0' : navbarCollapsed ? '0' : '210px',
    right: '0',
    zIndex: 100,
    transition: 'left 0.3s ease-in-out'
  }) as const, [navbarCollapsed, isMobile]);
  // Responsive content area styles
  const contentAreaStyles = useMemo(() => {
    const hasActionBar = (isHomePage || isLibraryPage) && !isMangaPage;
    const hasAlphabetJumpBar = isLibraryPage && !isMobile; // Only on library page, hide on mobile
    return {
      marginTop: hasActionBar ? '56px' : '0',
      // Account for action bar height
      paddingTop: hasActionBar ? '56px' : '0',
      // Add 56px padding when action bar is present
      paddingLeft: isMobile ? '0px' : navbarCollapsed ? '0px' : '210px',
      paddingRight: hasAlphabetJumpBar ? '30px' : '0px',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      minHeight: 'calc(100vh - 56px)',
      transition: 'padding-left 0.3s ease-in-out, padding-right 0.3s ease-in-out'
    } as const;
  }, [isHomePage, isLibraryPage, isMangaPage, navbarCollapsed, isMobile]);
  return <ErrorBoundary>
      <AppShell header={{
      height: 56
    }} navbar={navbarConfig} padding={0} withBorder styles={shellStyles} {...(className !== undefined && { className })}>

        <AppShell.Header>
          <KaizokuHeaderContent searchSource="main" showMenuButton={isTablet} {...(onNavbarToggle !== undefined && { onMenuClick: onNavbarToggle })} />

        </AppShell.Header>
        
        {!isMobile && <AppShell.Navbar>
            <KaizokuNavbar />
          </AppShell.Navbar>}
        
        <AppShell.Main>
          {/* Action bars - responsive sizing. No bar on home / library-list —
              the only thing it used to host was Search Downloads, which moved
              to the library detail action bar. */}
          {!isSettingsPage && !isMangaPage && isLibraryDetailPage && <Box style={actionBarStyles} data-component="action-bar-container">
              <LibraryActionBar libraryId={toNumberId(router.query["id"])} libraryName={String(router.query["name"] ?? '')} />
            </Box>}
          
          {/* Alphabet jump bar - only on library page, hide on mobile */}
          {!isSettingsPage && !isMobile && isLibraryPage && !isMangaPage && <AlphabetJumpBar topOffset={112} includeNumeric={true} />}
          
          <Box style={contentAreaStyles}>
            <Box style={{
            width: '100%'
          }}>
              {children}
            </Box>
          </Box>
          <AttributionFooter />
        </AppShell.Main>
      </AppShell>

      {/* Mobile Navigation */}
      <ResponsiveNavigation />

      {/* Audio Player UI (MiniPlayer + Fullscreen + Modals) */}
      <AudioPlayerUI miniPlayerZIndex={150} />
    </ErrorBoundary>;
}