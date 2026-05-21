/**
 * ConfirmationContent Component
 *
 * Main content sections for the confirmation step
 */
import React from 'react';

import { Stack, Paper, Text, Divider, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import type { VolumeData as RouterVolumeData } from '@/types/api/manga-router-types';
import { isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import { MediaGalleries } from './MediaGalleries';
import { MetadataDisplay } from './MetadataDisplay';
import { BulkFieldSelector } from './MetadataFieldSelector';
import { ProviderTabs } from './ProviderTabs';
import { VolumeChapterDisplay } from './VolumeChapterDisplay';

/**
 * Convert RouterVolumeData to VolumeChapterDisplay's VolumeData format
 */
function convertVolumeData(routerVolumes?: RouterVolumeData[] | undefined): Parameters<typeof VolumeChapterDisplay>[0]['volumes'] {
  if (!routerVolumes) return undefined;

  return routerVolumes.map(volume => ({
    ...volume,
    number: volume.number,
    volumeNumber: volume.volumeNumber ?? volume.number,
    title: volume.title,
    name: volume.title,
    volumeName: volume.title,
    volumeTitle: volume.title,
    coverUrl: volume.coverImageUrl ?? volume.coverImage ?? '',
    summary: volume.summary ?? '',
    description: volume.summary ?? '',
    chapterCount: volume.chapters?.length ?? 0,
    releaseDate: volume.releaseDate ?? '',
    isbn: '',
    issueName: '',
    issue_name: '',
    chapters: volume.chapters,
    coverImage: volume.coverImage,
    coverImageUrl: volume.coverImageUrl,
    pages: volume.pages,
  }));
}

import type { ProviderResults } from '../hooks/useConfirmationState';
import type { FieldSelections, FieldSelection } from '../hooks/useFieldSelections';

interface ConfirmationContentProps {
  source: string;
  availableProviders: string[];
  manga: unknown;
  _selectedResult: unknown;
  fieldSelections: FieldSelections;
  alternativeMetadata: Record<string, unknown>;
  selectedFromProvider: Record<string, string>;
  metadataConfidence: Record<string, number>;
  providerResults: Record<string, ProviderResults>;
  activeTab: string;
  selectedProvider: string;
  selectedSources: Record<string, unknown>;
  metadataEditorOpened: boolean;
  confirmState: AsyncResult<unknown, Error>;
  volumeChapterData: {
    provider: string;
    volumes?: RouterVolumeData[] | undefined;
    chapters?: unknown[] | undefined;
    totalVolumes?: number | undefined;
    totalChapters?: number | undefined;
  };
  volumes: RouterVolumeData[];
  galleryImages: string[];
  onFieldSelect: (field: string, selection: FieldSelection) => void;
  onEditMetadata: () => void;
  onBannerClick: () => void;
  onTabChange: (tab: string | null) => void;
  onProviderSelect: (provider: string) => void;
  onResultSelect: (provider: string, result: unknown) => void;
  updateFieldSelection: (field: string, selection: FieldSelection) => void;
}

export function ConfirmationContent({
  source,
  availableProviders,
  manga,
  _selectedResult,
  fieldSelections,
  alternativeMetadata,
  selectedFromProvider,
  metadataConfidence,
  providerResults,
  activeTab,
  selectedProvider,
  selectedSources,
  metadataEditorOpened,
  confirmState,
  volumeChapterData,
  volumes,
  galleryImages,
  onFieldSelect,
  onEditMetadata,
  onBannerClick,
  onTabChange,
  onProviderSelect,
  onResultSelect,
  updateFieldSelection
}: ConfirmationContentProps): React.ReactElement {
  return (
    <Stack gap="lg">
      {/* Original Selection */}
      <Paper p="md" radius="md" withBorder>
        <Text fw={600} mb="md">
          Original Selection from {source}
        </Text>
        <MetadataDisplay
          selectedResult={
            manga as unknown as Parameters<typeof MetadataDisplay>[0]['selectedResult']
          }
          fieldSelections={fieldSelections}
          alternativeMetadata={alternativeMetadata}
          selectedFromProvider={selectedFromProvider}
          metadataConfidence={metadataConfidence}
          onFieldSelect={onFieldSelect}
          onEditMetadata={onEditMetadata}
          onBannerClick={onBannerClick}
        />
      </Paper>

      <Divider />

      {/* Provider Results */}
      <Paper p="md" radius="md" withBorder>
        <Text fw={600} mb="md">
          Alternative Matches
        </Text>
        <ProviderTabs
          providers={[source, ...availableProviders]}
          providerResults={{
            [source]: {
              results: [manga],
              isLoading: false
            },
            ...providerResults
          }}
          activeTab={activeTab}
          selectedProvider={selectedProvider}
          selectedSources={selectedSources}
          onTabChange={onTabChange}
          onProviderSelect={onProviderSelect}
          onResultSelect={onResultSelect}
        />
      </Paper>

      {/* Volume/Chapter Display */}
      <Paper p="md" radius="md" withBorder>
        <VolumeChapterDisplay
          provider={volumeChapterData.provider}
          volumes={convertVolumeData(volumeChapterData.volumes)}
          chapters={volumeChapterData.chapters}
          totalVolumes={volumeChapterData.totalVolumes}
          totalChapters={volumeChapterData.totalChapters}
        />
      </Paper>

      {/* Media Galleries */}
      <MediaGalleries volumes={volumes} galleryImages={galleryImages} />

      {/* Field Selector for detailed editing */}
      {metadataEditorOpened && (
        <Paper p="md" radius="md" withBorder>
          <BulkFieldSelector
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'description', label: 'Description' },
              { name: 'genres', label: 'Genres' },
              { name: 'tags', label: 'Tags' },
              { name: 'status', label: 'Status' }
            ]}
            sources={alternativeMetadata}
            currentSelections={fieldSelections}
            onFieldChange={(field, source, value) => {
              updateFieldSelection(field, { source, value });
            }}
          />
        </Paper>
      )}

      {/* Error display */}
      {isError(confirmState) && (
        <Alert icon={<IconAlertCircle />} color="red" variant="light">
          <Text fw={600}>Error confirming manga</Text>
          <Text size="sm">{(confirmState as { error: Error }).error.message}</Text>
        </Alert>
      )}
    </Stack>
  );
}
