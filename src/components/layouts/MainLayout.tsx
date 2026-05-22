"use client";

/**
 * MainLayout component for the application's primary layout structure
 * 
 * This component provides the main application shell, including header,
 * navigation, and content areas. Features include:
 * - Responsive layout with AppShell
 * - Fixed header and navbar
 * - Dynamic theme support
 * - Loading and error states
 * - Download queue overlay
 * - Conditional action bar based on route
 * 
 * @remarks
 * Layout Structure:
 * - Header (56px height, fixed)
 * - Navbar (250px width, collapsible)
 * - Main content area
 * - Action bar (fixed below header) - HomeActionBar for home page, ActionBar for other pages
 * - Download queue (fixed bottom-right)
 * 
 * Styling:
 * - Dark/light theme support
 * - Consistent spacing and shadows
 * - Z-index layering for overlays
 * - Responsive breakpoints
 * 
 * States:
 * - Loading: Centered loader
 * - Error: Error message display
 * - Normal: Full layout render
 * 
 * @example
 * ```jsx
 * // Basic usage in app layout
 * <MainLayout>
 *   <PageContent />
 * </MainLayout>
 * ```
 */
import type { CSSProperties } from 'react';
import React, { useMemo } from 'react';

import { AppShell, Box } from '@mantine/core';
import { useRouter } from 'next/router';

import { useTheme } from '@/hooks/useTheme';
import { toNumberId } from '@/utils/id-converters';

import { ActionBar } from '../actionBar';
import { AlphabetJumpBar } from '../alphabetJumpBar';
import { CalendarActionBar } from '../calendarActionBar';
import ErrorBoundary from "../common/UnifiedErrorBoundary";
import { KaizokuHeaderContent } from '../headerContent';
import { LibraryActionBar } from '../libraryActionBar';
import { KaizokuNavbar } from '../navbar';
import { TaskActionBar } from '../taskActionBar';

import { AttributionFooter } from './AttributionFooter';


/**
 * Props for the MainLayout component
 */
export interface MainLayoutProps {
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
 * Main application layout component with header, navbar, and content areas
 * 
 * @param props - Component props
 * @returns Main application layout structure
 */
export function MainLayout({
  children,
  className,
  navbarCollapsed = false,
  contentStyle
}: MainLayoutProps): React.ReactElement {
  // Simplified theme handling
  const {
    isDark
  } = useTheme();
  const theme = useMemo(() => isDark, [isDark]);

  // Get current route to determine which action bar to show
  const router = useRouter();
  const isHomePage = router.pathname === '/' || router.pathname === '/index';
  const isLibraryPage = router.pathname.startsWith('/library/') && router.pathname !== '/library/add';
  const isSettingsPage = router.pathname.startsWith('/settings');
  const isCalendarPage = router.pathname === '/calendar';
  const isTaskPage = router.pathname.startsWith('/tasks');

  // Memoized shell styles using type-safe CSS properties
  const shellStyles = useMemo(() => ({
    root: {
      position: 'relative' as const,
      padding: 0,
      margin: 0,
      overflowX: 'hidden' as const
    },
    main: {
      backgroundColor: theme ? '#333333' : '#f8f9fa',
      paddingTop: '56px',
      padding: isHomePage || isLibraryPage || isCalendarPage || isTaskPage ? '56px 0 0 0' : 'var(--mantine-spacing-md)',
      ...(contentStyle ?? {})
    },
    navbar: {
      backgroundColor: '#424242',
      zIndex: 200,
      borderRight: '1px solid rgba(0, 0, 0, 0.1)',
      boxShadow: 'var(--mantine-shadow-md)',
      top: '56px',
      height: 'calc(100vh - 56px)',
      padding: 0
    },
    header: {
      backgroundColor: '#4a4a4a',
      zIndex: 201,
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      boxShadow: 'var(--mantine-shadow-md)',
      padding: 0,
      '& > div': {
        padding: 0
      }
    }
  }), [theme, contentStyle, isHomePage, isLibraryPage, isCalendarPage, isTaskPage]);

  // Memoized action bar styles
  const actionBarStyles = useMemo(() => ({
    position: 'fixed',
    top: '56px',
    left: navbarCollapsed ? '0' : '210px',
    right: '0',
    zIndex: 100,
    transition: 'left 0.3s ease-in-out'
  }) as const, [navbarCollapsed]);

  // Memoized content area styles based on presence of action bar
  const contentAreaStyles = useMemo(() => {
    // Determine if the page has an action bar
    const hasActionBar = isHomePage || isLibraryPage || isCalendarPage || isTaskPage;
    // Determine if the page has an alphabet jump bar
    const hasAlphabetJumpBar = isHomePage || isLibraryPage;
    return {
      marginTop: hasActionBar ? '30px' : '-10px',
      paddingLeft: navbarCollapsed ? '0px' : '210px',
      paddingRight: hasAlphabetJumpBar ? '30px' : '0px',
      // Add padding for alphabet jump bar
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      minHeight: !hasActionBar ? 'calc(100vh - 56px)' : 'calc(100vh - 112px)',
      transition: 'padding-left 0.3s ease-in-out, padding-right 0.3s ease-in-out'
    } as const;
  }, [isHomePage, isLibraryPage, isCalendarPage, isTaskPage, navbarCollapsed]);
  return <ErrorBoundary>
      <AppShell header={{
      height: 56
    }} navbar={{
      width: navbarCollapsed ? 0 : 210,
      breakpoint: 'sm',
      collapsed: {
        desktop: navbarCollapsed,
        mobile: navbarCollapsed
      }
    }} padding={0} withBorder styles={shellStyles} {...(className ? { className } : {})}>
        <AppShell.Header>
          <KaizokuHeaderContent searchSource="main" />
        </AppShell.Header>
        
        <AppShell.Navbar>
          <KaizokuNavbar />
        </AppShell.Navbar>
        
        <AppShell.Main>
          {/* Action bars render on library pages, calendar page, and task pages.
              Home page no longer has one — the Search Downloads button it used
              to host now lives on the library detail page where selection +
              monitored-manga context actually applies. */}
          {!isSettingsPage && (isLibraryPage || isCalendarPage || isTaskPage) && <Box style={actionBarStyles}>
              {isLibraryPage ? <LibraryActionBar libraryId={toNumberId(router.query["id"])} libraryName={String(router.query["name"] ?? '')} /> : isCalendarPage ? <CalendarActionBar /> : isTaskPage ? <TaskActionBar /> : <ActionBar children={null} />}
            </Box>}
          
          {/* Render AlphabetJumpBar on homepage and library pages */}
          {!isSettingsPage && (isHomePage || isLibraryPage) && <AlphabetJumpBar topOffset={112} includeNumeric={true} />}
          
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
    </ErrorBoundary>;
}