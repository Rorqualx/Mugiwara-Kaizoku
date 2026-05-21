"use client";

/**
 * ClientLayout component for client-side rendered pages
 * 
 * This component serves as a wrapper for client-side rendered content,
 * utilizing the MainLayout component while ensuring proper client-side
 * functionality. Features include:
 * - Client-side rendering directive
 * - MainLayout composition
 * - Content wrapping
 * 
 * @remarks
 * Layout Structure:
 * - Uses "use client" directive for client-side rendering
 * - Wraps content in MainLayout for consistent page structure
 * - Preserves component hierarchy
 * 
 * Usage Context:
 * - Used for pages requiring client-side interactivity
 * - Ensures proper hydration of client components
 * - Maintains layout consistency with server components
 * 
 * @example
 * ```tsx
 * // Basic usage in client page
 * <ClientLayout>
 *   <InteractiveComponent />
 * </ClientLayout>
 * ```
 */

import React from 'react';

import { ResponsiveMainLayout } from './ResponsiveMainLayout';

import type { ResponsiveMainLayoutProps } from './ResponsiveMainLayout';

/**
 * Props for the ClientLayout component
 */
export interface ClientLayoutProps extends Omit<ResponsiveMainLayoutProps, 'children'> {
  /** Child components to render within the layout */
  children: React.ReactNode;
  
  /** Optional CSS class name to apply to the layout */
  className?: string;
  
  /** Optional title to display in the document head */
  pageTitle?: string;
}

/**
 * Client-side layout component wrapping MainLayout
 * 
 * @param props - Component props containing children and optional className
 * @returns React element with properly typed children wrapped in MainLayout
 */
export function ClientLayout({ 
  children, 
  className,
  pageTitle,
  ...restProps
}: ClientLayoutProps): React.ReactElement {
  return (
    <ResponsiveMainLayout
      {...(className ? { className } : {})}
      {...(pageTitle ? { pageTitle } : {})}
      {...restProps}
    >
      {children}
    </ResponsiveMainLayout>
  );
}