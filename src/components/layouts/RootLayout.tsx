/**
 * RootLayout component for the application's root content structure
 *
 * This component provides a minimal wrapper for pages that manage their own layouts.
 * Most pages in the application use ResponsiveMainLayout directly for the full app shell.
 *
 * Features:
 * - Minimal wrapper for pages with custom layouts
 * - Optional CSS class support
 * - Flexible children rendering
 *
 * @remarks
 * Layout Pattern:
 * - Pages that need the full app shell (navbar, header) use ResponsiveMainLayout directly
 * - This RootLayout is the fallback for _app.tsx default layout
 * - Does not render HTML/body tags (handled by Next.js)
 *
 * @example
 * ```tsx
 * // Basic usage in app
 * <RootLayout>
 *   <AppContent />
 * </RootLayout>
 * ```
 */
import React from 'react';

/**
 * Props for the RootLayout component
 */
export interface RootLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;

  /** Optional CSS class name for the root element */
  className?: string;

  /** Optional ID for the root element */
  id?: string;

  /** Optional inline styles */
  style?: React.CSSProperties;

  /** Optional ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Root layout component - minimal wrapper for pages with custom layouts
 *
 * @param props - Component props
 * @returns React element containing the children
 */
export default function RootLayout({
  children,
  className,
  id,
  style,
  ariaLabel = 'Main application content'
}: RootLayoutProps): React.ReactElement {
  return (
    <main
      id={id}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </main>
  );
}
