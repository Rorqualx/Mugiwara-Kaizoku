/**
 * SettingsLayout component for settings pages
 *
 * This component provides a consistent layout for settings-related pages,
 * including navigation, title, and content area. Features include:
 * - Centered container layout
 * - Navigation integration
 * - Customizable title
 * - Specialized settings action bar
 *
 * @remarks
 * Layout Structure:
 * - Full width container (xl size)
 * - Top margin for header space
 * - Page scrolls naturally (no internal scroll container)
 *
 * Styling:
 * - Centered content
 * - Consistent spacing
 * - Responsive container
 *
 * @example
 * ```jsx
 * // Basic usage in settings page
 * <SettingsLayout title="User Settings">
 *   <SettingsContent />
 * </SettingsLayout>
 * ```
 */

import React from "react";

import { Container, Title } from "@mantine/core";

import { SettingsNavigation } from "../settings/SettingsNavigation";
import { SettingsActionBar } from "../settingsActionBar";

/**
 * Props for the SettingsLayout component
 */
interface SettingsLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional title to display at the top of the page (defaults to "Settings") */
  title?: string;
}

export default function SettingsLayout({ children, title = "Settings" }: SettingsLayoutProps): React.ReactElement {
  return (
    <>
      <SettingsActionBar />
      <Container size="xl" pb="xl" style={{
        marginTop: '112px', /* Account for header (56px) + settings action bar (56px) */
        minHeight: 'calc(100vh - 112px)', /* Minimum height but allow natural growth */
      }}>
        <Title order={1} mb="lg">{title}</Title>
        <SettingsNavigation />
        {children}
      </Container>
    </>
  );
}
