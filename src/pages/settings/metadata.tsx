/**
 * Metadata Settings Page
 *
 * Provides configuration interface for manga metadata providers and settings.
 * Allows users to manage how manga information is fetched and enriched from
 * various sources like AniList, ComicVine, Fandom, etc.
 *
 * Features:
 * - Default metadata provider selection
 * - Provider-specific configuration
 * - Provider enable/disable controls
 * - Metadata enrichment settings
 *
 * Component Structure:
 * - MetadataProvidersGrid: Grid of available metadata providers
 * - FieldProviderPreferences: Field-level provider preferences for import wizard
 * - DefaultMetadataProvider: Active providers display (in header)
 *
 * @module pages/settings/metadata
 * @requires @mantine/core - UI components
 * @requires @/components/settings/MetadataProvidersGrid - Provider configuration grid
 * @requires @/components/settings/DefaultMetadataProvider - Default provider selector
 */

import React from "react";
import type { ReactElement } from 'react';

import { Container, Space, Title, Text, Paper } from "@mantine/core";

import { ErrorBoundary } from '@/components/common/UnifiedErrorBoundary';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { DefaultMetadataProvider } from '@/components/settings/DefaultMetadataProvider';
import { MetadataProvidersGrid } from '@/components/settings/MetadataProvidersGrid';

/**
 * Metadata Settings Page Component
 *
 * Renders a settings page for configuring metadata providers and their behavior.
 * Organizes settings into sections for default provider selection and individual
 * provider configuration.
 *
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/settings/metadata" component={MetadataSettings} />
 * ```
 */
export default function MetadataSettings(): React.ReactElement {
  return (
    <SettingsLayout title="Metadata">
      {/* Main content container */}
      <Container size="xl" px={0} style={{ position: 'relative' }}>
        {/* Description section with active providers */}
        <Paper p="md" withBorder mb="xl">
          <Title order={3} mb="md">Metadata Configuration</Title>
          <Text size="sm" mb="sm">
            Configure metadata providers to enhance your manga library with detailed information.
            Enable or disable providers, set field-level provider preferences for the import wizard,
            and view your active metadata configuration.
          </Text>
          <ErrorBoundary>
            <DefaultMetadataProvider />
          </ErrorBoundary>
        </Paper>

        {/* Provider configuration grid with error boundary */}
        <ErrorBoundary>
          <MetadataProvidersGrid />
        </ErrorBoundary>
        <Space h="xl" />
      </Container>
    </SettingsLayout>
  );
}

// Use MainLayout for this page to get the full navigation
MetadataSettings.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
