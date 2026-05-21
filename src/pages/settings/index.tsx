/**
 * Settings Index Page
 * 
 * Serves as the root settings page that automatically redirects users
 * to the events settings section. Displays a loading indicator during
 * the redirect process to provide visual feedback.
 * 
 * Navigation Flow:
 * 1. User accesses /settings
 * 2. Loading state displayed
 * 3. Automatic redirect to /settings/events
 * 
 * @module pages/settings
 * @requires next/router - Next.js routing
 * @requires @mantine/core - UI components
 * @requires @/components/layouts/SettingsLayout - Settings page wrapper
 */

import type { ReactElement } from 'react';
import React from "react";
import { useEffect } from 'react';

import { Group, Loader, Text } from '@mantine/core';
import { useRouter } from 'next/router';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';

/**
 * Settings Root Page Component
 * 
 * Implements a redirect page with loading state for the settings section.
 * Wraps content in the SettingsLayout for consistent navigation and styling.
 * 
 * @component
 * @example
 * ```tsx
 * // In Next.js pages
 * // URL: /settings
 * export default Settings
 * ```
 */
export default function Settings(): React.ReactElement {
  /**
   * Initialize Next.js router for programmatic navigation
   * Used for automatic redirection to general settings
   */
  const router = useRouter();

  /**
   * Redirect Effect
   * Automatically redirects to the events settings page on component mount
   * Uses router.replace to prevent back-button navigation to this page
   */
  useEffect(() => {
    void router.replace('/settings/events');
  }, [router]);

  /**
   * Loading State Display
   * Shows a centered loading indicator with text while redirect processes
   */
  return (
    <SettingsLayout>
      <Group justify="center" style={{ minHeight: '50vh' }}>
        <Loader size="xl" />
        <Text size="xl">Redirecting to Event Settings...</Text>
      </Group>
    </SettingsLayout>);

}

// Use MainLayout for this page to get the full navigation
Settings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};