/**
 * IntegrationsStatus Component
 *
 * Displays status of all system integrations including metadata
 * and source providers with their connection status.
 */
import React from 'react';

import { Paper, Title, Text, Stack, Divider } from '@mantine/core';
import { IconSearch, IconBook, IconDatabase } from '@tabler/icons-react';

import { useIntegrationStatus } from '@/contexts/IntegrationStatusContext';
import type { IntegrationStatusData } from '@/types/system-status';

import { AvailableSourcesList } from './AvailableSourcesList';
import { MetadataProviderRow } from './MetadataProviderRow';
import { SourceProviderRow } from './SourceProviderRow';

import type { IntegrationsStatusProps, MetadataProviderInfo, SourceProviderInfo } from './types';

const DEFAULT_METADATA: { anilist: MetadataProviderInfo; comicvine: MetadataProviderInfo } = {
  anilist: {
    enabled: false,
    useForMetadata: false,
    status: 'inactive' as const
  },
  comicvine: {
    enabled: false,
    status: 'inactive' as const,
    apiConfigured: false
  }
};

const DEFAULT_SOURCES: { mangal: SourceProviderInfo; suwayomi: SourceProviderInfo } = {
  mangal: {
    enabled: false,
    status: 'inactive' as const,
    sourceCount: 0,
    availableSources: []
  },
  suwayomi: {
    enabled: false,
    status: 'inactive' as const,
    sourceCount: 0,
    availableSources: []
  }
};

/**
 * Displays the status of all system integrations
 */
export default function IntegrationsStatus({
  detailed: _detailed = false,
  useProvidedData = false,
  data: providedData
}: IntegrationsStatusProps): JSX.Element {
  const { data: contextData, isLoading } = useIntegrationStatus();
  const data = useProvidedData ? providedData : contextData;

  if (!data || isLoading) {
    return (
      <Paper p="md" withBorder>
        <Title order={3} mb="md">Integrations</Title>
        <Text c="dimmed">Loading integrations information...</Text>
      </Paper>
    );
  }

  const integrationData = data as IntegrationStatusData;
  const metadata = integrationData.metadata ?? DEFAULT_METADATA;
  const sources = integrationData.sources ?? DEFAULT_SOURCES;

  return (
    <Paper p="md" withBorder>
      <Title order={3} mb="md">Integrations</Title>

      {/* Metadata Providers Section */}
      <Stack gap="xs">
        <Title order={4}>Metadata Providers</Title>

        <MetadataProviderRow
          icon={<IconSearch size={18} />}
          name="Anilist"
          provider={metadata.anilist}
        />

        <MetadataProviderRow
          icon={<IconBook size={18} />}
          name="ComicVine"
          provider={metadata.comicvine}
          showApiMissing
        />
      </Stack>

      <Divider my="md" />

      {/* Source Providers Section */}
      <Stack gap="xs">
        <Title order={4}>Source Providers</Title>

        <SourceProviderRow
          icon={<IconDatabase size={18} />}
          name="Suwayomi"
          provider={sources.suwayomi}
        />

        <Divider my="sm" label="Available Sources" labelPosition="center" />

        <AvailableSourcesList
          providerName="Suwayomi"
          sources={sources.suwayomi.availableSources}
          enabled={sources.suwayomi.enabled}
        />
      </Stack>
    </Paper>
  );
}
