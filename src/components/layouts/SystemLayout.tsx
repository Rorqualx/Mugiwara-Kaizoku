/**
 * SystemLayout component for system administration pages
 * 
 * This component provides a consistent layout for system-related pages,
 * including navigation, title, and content area. Features include:
 * - Centered container layout
 * - Custom scrolling behavior
 * - System navigation integration
 * - Customizable title
 * - Error boundary for graceful error handling
 * 
 * @remarks
 * Layout Structure:
 * - Full width container (xl size)
 * - Top margin for header space
 * - Full viewport height minus header
 * - Smooth scrolling with WebKit support
 * 
 * Styling:
 * - Hidden scrollbar
 * - Centered content
 * - Consistent spacing
 * - Responsive container
 * 
 * @example
 * ```jsx
 * // Basic usage in system page
 * <SystemLayout title="System Status">
 *   <SystemContent />
 * </SystemLayout>
 * ```
 */

import React from "react";

import { Container, Title, Alert } from "@mantine/core";

import { ErrorBoundary } from "../common/UnifiedErrorBoundary";
import { SystemNavigation } from "../system/SystemNavigation";

/**
 * Props for the SystemLayout component
 */
interface SystemLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional title to display at the top of the page (defaults to "System") */
  title?: string;
}

// Fallback component for system page errors
function SystemErrorFallback(): React.ReactElement {
  return (
    <Alert color="red" title="System Page Error" mt="md">
      <p>An error occurred while loading this system page.</p>
      <p>This might be due to:</p>
      <ul>
        <li>Icon loading issues</li>
        <li>Theme configuration problems</li>
        <li>Component import failures</li>
      </ul>
      <p>Please try refreshing the page or navigating to a different section.</p>
    </Alert>);

}

export default function SystemLayout({ children, title = "System" }: SystemLayoutProps): React.ReactElement {
  return (
    <Container
      size="xl"
      pb="xl"
      style={{
        height: 'calc(100vh - 56px)',
        marginTop: '100px',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
      className="hide-scrollbar">

      <Title order={1} mb="lg" mt="xl">{title}</Title>
      <SystemNavigation />
      <ErrorBoundary fallback={(): React.ReactElement => <SystemErrorFallback />}>
        {children}
      </ErrorBoundary>
    </Container>);

}