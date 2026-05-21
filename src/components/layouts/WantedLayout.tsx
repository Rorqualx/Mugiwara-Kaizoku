/**
 * WantedLayout component for wanted/missing pages
 * 
 * This component provides a consistent layout for wanted-related pages,
 * including navigation, title, and content area. Features include:
 * - Centered container layout
 * - Custom scrolling behavior
 * - Navigation integration
 * - Customizable title
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
 * // Basic usage in wanted page
 * <WantedLayout title="Missing Items">
 *   <WantedContent />
 * </WantedLayout>
 * ```
 */

import React from "react";

import { Container, Title } from "@mantine/core";

import { WantedNavigation } from "../wanted/WantedNavigation";

/**
 * Props for the WantedLayout component
 */
interface WantedLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional title to display at the top of the page (defaults to "Wanted") */
  title?: string;
}

export default function WantedLayout({ children, title = "Wanted" }: WantedLayoutProps): React.ReactElement {
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
      className="hide-scrollbar"
    >
      <Title order={1} mb="lg" mt="xl">{title}</Title>
      <WantedNavigation />
      {children}
    </Container>
  );
}
