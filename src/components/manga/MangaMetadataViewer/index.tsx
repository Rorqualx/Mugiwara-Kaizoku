/**
 * Manga Metadata Viewer Component
 *
 * This component displays enhanced metadata for a manga using the search.getMetadata
 * endpoint. It provides detailed information about a manga from multiple providers.
 *
 * @module components/manga/MangaMetadataViewer
 */

'use client';

import React, { useState, useEffect } from 'react';

import { Card, Stack, Group, Text, Badge, ActionIcon, Tabs } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import {
  CompactView,
  OverviewTab,
  DetailsTab,
  RawMetadataTab,
  LoadingState,
  ErrorState,
  EmptyState
} from './components';
import { extractMetadata, getStatusColor } from './utils';

/**
 * Props for the MangaMetadataViewer component
 */
interface MangaMetadataViewerProps {
  /** Provider ID */
  provider: string;
  /** Manga ID from the provider */
  mangaId: string;
  /** Optional title to display */
  title?: string;
  /** Whether to show the component in a compact mode */
  compact?: boolean;
  /** Callback when metadata is fetched */
  onMetadataFetched?: (metadata: unknown) => void;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
}

/**
 * Component to display enhanced manga metadata
 */
export function MangaMetadataViewer({
  provider,
  mangaId,
  title,
  compact = false,
  onMetadataFetched,
  isLoading
}: MangaMetadataViewerProps): React.ReactElement {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    description: !compact,
    details: !compact,
    links: false
  });

  // Fetch metadata using tRPC
  const {
    data: metadata,
    error,
    refetch
  } = trpc.search.getMetadata.useQuery(
    { provider, id: mangaId },
    {
      retry: 1,
      staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    }
  );

  // Handle onMetadataFetched callback
  useEffect(() => {
    if (metadata && onMetadataFetched) {
      onMetadataFetched(metadata);
    }
  }, [metadata, onMetadataFetched]);

  const handleToggleSection = (section: string): void => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleRefetch = (): void => {
    void refetch();
  };

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={handleRefetch} />;
  }

  // Empty state
  if (!metadata) {
    return <EmptyState />;
  }

  // Extract metadata properties
  const extractedMetadata = extractMetadata(metadata, title);

  return (
    <Card withBorder>
      <Stack>
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Text size="lg" fw={600}>
              {extractedMetadata.title}
            </Text>
            {extractedMetadata.status && (
              <Badge color={getStatusColor(extractedMetadata.status)}>
                {extractedMetadata.status}
              </Badge>
            )}
          </Group>
          <ActionIcon variant="light" onClick={handleRefetch} title="Refresh metadata">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {compact ? (
          <CompactView metadata={extractedMetadata} />
        ) : (
          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="metadata">Raw Metadata</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <OverviewTab
                metadata={extractedMetadata}
                expandedSections={expandedSections}
                onToggleSection={handleToggleSection}
              />
            </Tabs.Panel>

            <Tabs.Panel value="details" pt="md">
              <DetailsTab metadata={extractedMetadata} />
            </Tabs.Panel>

            <Tabs.Panel value="metadata" pt="md">
              <RawMetadataTab provider={provider} metadata={metadata} />
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Card>
  );
}

// Re-export types and utilities
export type { ExtractedMetadata } from './utils';
export { extractMetadata, getStatusColor, formatDate, getProperty } from './utils';
