/**
 * Indexers Settings Page
 *
 * Provides a comprehensive interface for managing manga indexers through Prowlarr integration.
 * Allows users to configure Prowlarr connection settings and manage indexers for manga downloads.
 *
 * Features:
 * - Prowlarr connection configuration and testing
 * - Enable/disable Prowlarr integration
 * - Indexer management (enable, disable, test, delete)
 * - Real-time indexer status monitoring
 * - Secure API key handling
 *
 * State Management:
 * - Uses integration store for Prowlarr settings
 * - Local state for form handling and UI feedback
 * - Persistent storage through tRPC mutations
 *
 * @module pages/settings/indexers
 * @requires @mantine/core - UI components
 * @requires @tabler/icons-react - Icons
 * @requires @/store/integrationSlice - Prowlarr settings state
 * @requires @/api/prowlarrClient - Unified Prowlarr API client
 */
import type { ReactElement } from 'react';
import React from "react";

import { Title, Text, Container } from "@mantine/core";

import ErrorBoundary from '@/components/common/UnifiedErrorBoundary';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { ProwlarrConfigSection, IndexersTable, MangaDexSourceSection, GetComicsSection } from '@/components/settings/indexers';
import { useProwlarrConfig, useProwlarrIndexers } from '@/components/settings/indexers/hooks';
import { SuwayomiSourceSection } from '@/components/settings/indexers/SuwayomiSourceSection';
import { useIntegrationStore } from '@/store/integrationSlice';


/**
 * Indexers Settings Page Component
 *
 * Manages Prowlarr integration settings and indexer configuration.
 * Provides a user interface for connecting to Prowlarr and managing
 * manga indexers for automated downloads.
 *
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/settings/indexers" component={IndexersSettings} />
 * ```
 */
function IndexersSettings(): React.ReactElement {
  const prowlarrSettings = useIntegrationStore((state) => state.prowlarr);

  // Use extracted hooks
  const {
    formState,
    onToggleProwlarr,
    onSubmit,
    onTest,
    onBaseURLChange,
    onApiKeyChange
  } = useProwlarrConfig();

  const {
    indexersState: { indexers, isLoading, error, showIndexers },
    fetchIndexers
  } = useProwlarrIndexers();
  return (
    <SettingsLayout title="Indexers">
      <Container size="xl" px={0}>
        <Title order={3} mb="lg">Prowlarr Integration</Title>
        <Text size="md" c="dimmed" mb="lg">
          Prowlarr is an indexer manager/proxy that integrates with various PVR apps.
          It supports management of both Torrent Trackers and Usenet Indexers.
        </Text>

        {/* Prowlarr Configuration Section */}
        <ProwlarrConfigSection
          prowlarrSettings={prowlarrSettings}
          formState={formState}
          onToggleProwlarr={onToggleProwlarr}
          onSubmit={onSubmit}
          onTest={onTest}
          onBaseURLChange={onBaseURLChange}
          onApiKeyChange={onApiKeyChange}
        />

        {/* Prowlarr Indexers Section */}
        {showIndexers && (
          <IndexersTable
            indexers={indexers}
            isLoading={isLoading}
            error={error}
            prowlarrSettings={prowlarrSettings}
            onRefresh={() => { void fetchIndexers(); }}
          />
        )}

        {/* MangaDex Direct Download Source */}
        <MangaDexSourceSection />

        {/* GetComics Integration */}
        <GetComicsSection />

        {/* Suwayomi Source Extensions */}
        <SuwayomiSourceSection />
      </Container>
    </SettingsLayout>
  );
}
/**
 * Exported component wrapped with ErrorBoundary to catch and handle rendering errors
 */
export default function IndexersSettingsWithErrorBoundary(): React.ReactElement {
  return <ErrorBoundary>
      <IndexersSettings />
    </ErrorBoundary>;
}
// Use MainLayout for this page to get the full navigation
IndexersSettingsWithErrorBoundary.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
