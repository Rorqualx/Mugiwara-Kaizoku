/**
 * ProviderSelectionForm Component
 *
 * Form component for selecting metadata providers for a manga.
 * Allows users to view and select which provider's data to use
 * for each metadata field.
 *
 * Architecture:
 * - hooks/useFetchProviderData.tsx - Data fetching logic
 * - hooks/useProviderMutations.ts - Mutation handling
 * - components/FieldListView.tsx - Accordion list view
 * - components/ComparisonView.tsx - Table comparison view
 * - components/ProviderBadge.tsx - Provider badge rendering
 * - components/ImagePreview.tsx - Cover image preview
 *
 * Refactored from 1553 lines to ~290 lines (81% reduction)
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

import {
  Box,
  Button,
  Group,
  Text,
  Title,
  LoadingOverlay,
  Tabs,
  Tooltip,
} from '@mantine/core';
import { MangaPublicationStatus } from '@prisma/client';
import { IconRefresh, } from '@tabler/icons-react';

import { ValidationError } from '@/utils/errors';
import { toStringId, toNumberId, isValidId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';


import {
  isManga,
  extractMangaId,
  createProviderPreferences,
} from '../providerFormUtils';

// Components
import { ComparisonView } from './components/ComparisonView';
import { FieldListView } from './components/FieldListView';
import { renderImagePreview } from './components/ImagePreview';
import { renderProviderBadge } from './components/ProviderBadge';
// Hooks
import { useFetchProviderData } from './hooks/useFetchProviderData';
import { useProviderMutations } from './hooks/useProviderMutations';
import {
  processProviderMetadataArray,
  extractProviderMetadataInfo,
} from './utils';

import type {
  ProviderSelectionFormProps,
  TRPCMangaResult,
  FieldData,
  ProviderMetadataInfo,
  ProviderMetadataItem,
  Manga,
} from './types';

/**
 * Converts manga prop to internal Manga type for the hook
 */
function convertMangaForProvider(
  manga: ProviderSelectionFormProps['manga']
): Manga {
  return {
    id: manga['id'],
    title: typeof manga['title'] === 'string' ? manga['title'] : String(manga['title']),
    metadata: (() => {
      if ('metadata' in manga && typeof manga.metadata === 'object' && manga.metadata !== null) {
        return manga.metadata as Record<string, unknown>;
      }
      const metadataObj: Record<string, unknown> = {};
      if ('description' in manga && manga['description']) metadataObj['description'] = manga['description'];
      if ('cover' in manga && manga.cover) metadataObj['cover'] = manga.cover;
      if ('coverUrl' in manga && manga.coverUrl) metadataObj['cover'] = manga.coverUrl;
      if ('genres' in manga && manga['genres']) metadataObj['genres'] = manga['genres'];
      return metadataObj;
    })(),
    providerMetadata: buildProviderMetadata(manga),
    ...(typeof manga['source'] === 'string' && { source: manga['source'] }),
    ...(typeof manga.publicationStatus === 'string' && {
      status: Object.values(MangaPublicationStatus).includes(manga.publicationStatus as MangaPublicationStatus)
        ? (manga.publicationStatus as MangaPublicationStatus)
        : MangaPublicationStatus.ONGOING,
    }),
  };
}

/**
 * Builds provider metadata from manga entity
 */
function buildProviderMetadata(
  manga: ProviderSelectionFormProps['manga']
): ProviderMetadataInfo | ProviderMetadataItem[] {
  const emptyProviderMetadataInfo: ProviderMetadataInfo = {
    metadataProvenance: {},
    preferences: {},
  };

  if (!manga.providerMetadata) return emptyProviderMetadataInfo;

  // Handle array format
  if (Array.isArray(manga.providerMetadata)) {
    return processProviderMetadataArray(manga.providerMetadata);
  }

  // Handle object format with metadataProvenance
  if (typeof manga.providerMetadata === 'object' && 'metadataProvenance' in manga.providerMetadata) {
    return extractProviderMetadataInfo(manga.providerMetadata as Record<string, unknown>);
  }

  return emptyProviderMetadataInfo;
}

export function ProviderSelectionForm({
  manga,
  onClose,
  onUpdate,
}: ProviderSelectionFormProps): React.ReactElement {
  // State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [fieldData, setFieldData] = useState<Record<string, FieldData>>({});
  const [providers, setProviders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'comparison'>('list');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Extract manga ID
  const mangaForExtraction: Manga = {
    id: manga['id'],
    title: typeof manga['title'] === 'string' ? manga['title'] : String(manga['title']),
    metadata:
      'metadata' in manga && typeof manga.metadata === 'object' && manga.metadata !== null
        ? (manga.metadata as Record<string, unknown>)
        : {},
  };
  const mangaId = extractMangaId(mangaForExtraction);

  if (mangaId <= 0) {
    logger.error('Invalid manga ID:', manga.id);
  }

  // Setup mutations hook
  const mutationProps = onClose
    ? { onUpdate, onClose, setSaving }
    : { onUpdate, setSaving };
  const { getProviderMetadata, updateProviderPreferences, handleMutationSuccess, handleMutationError } =
    useProviderMutations(mutationProps);

  // Setup fetch hook
  const { fetchAllProviderData } = useFetchProviderData({
    setIsLoading,
    setRefreshing,
    setProviders,
    setFieldData,
    getProviderMetadata,
    mangaId,
  });

  // Query manga data for refetching
  const queryResult = mangaId
    ? trpc.manga.get.useQuery({ id: mangaId })
    : { data: undefined, isLoading: false, refetch: () => Promise.resolve({ data: undefined }) };

  const mangaData = queryResult.data as TRPCMangaResult | undefined;
  const isMangaLoading = queryResult.isLoading;
  const refetch = queryResult.refetch;

  // Initialize data loading when component mounts
  useEffect(() => {
    const mangaForFetch = convertMangaForProvider(manga);
    void fetchAllProviderData(mangaForFetch);
  }, [manga, fetchAllProviderData]);

  // Handle data loading when mangaData changes (for refreshes)
  useEffect(() => {
    if (mangaData) {
      const refreshedManga = convertMangaForProvider(mangaData as ProviderSelectionFormProps['manga']);
      void fetchAllProviderData(refreshedManga);
    }
  }, [mangaData, fetchAllProviderData]);

  // Handler for provider change
  const handleProviderChange = useCallback((field: string, provider: string): void => {
    setFieldData((prev) => {
      const updatedData = { ...prev };
      const currentField = updatedData[field];
      if (!currentField || !Array.isArray(currentField.selectOptions)) return updatedData;

      const option = currentField.selectOptions.find(
        (opt) => typeof opt === 'object' && 'provider' in opt && opt.provider === provider
      );
      updatedData[field] = {
        ...currentField,
        selectedProvider: provider,
        selectedValue: option?.value ?? currentField.selectedValue,
      };
      return updatedData;
    });
  }, []);

  // Handler for value change
  const handleValueChange = useCallback((field: string, value: string | null): void => {
    if (!value) return;
    setFieldData((prev) => {
      const updatedData = { ...prev };
      const currentField = updatedData[field];
      if (!currentField || !Array.isArray(currentField.selectOptions)) return updatedData;

      const option = currentField.selectOptions.find(
        (opt) => typeof opt === 'object' && 'value' in opt && opt.value === value
      );
      updatedData[field] = {
        ...currentField,
        selectedProvider:
          option && typeof option === 'object' && 'provider' in option && typeof option.provider === 'string'
            ? option.provider
            : currentField.selectedProvider,
        selectedValue: option ? value : currentField.selectedValue,
      };
      return updatedData;
    });
  }, []);

  // Handler for refresh
  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      if (typeof refetch !== 'function') {
        throw new ValidationError('Refetch function is not available');
      }
      const result = await Promise.resolve(refetch());
      if (typeof result !== 'object' || !('data' in result) || typeof result.data !== 'object') {
        throw new ValidationError('Invalid result from refetch operation');
      }

      const data = result.data as Record<string, unknown>;
      const mangaForProviders: Manga = {
        id: isValidId(data['id']) ? data['id'] : 0,
        title: typeof data['title'] === 'string' ? data['title'] : '',
        metadata:
          data['metadata'] && typeof data['metadata'] === 'object'
            ? (data['metadata'] as Record<string, unknown>)
            : {},
        providerMetadata: (() => {
          if (!data['providerMetadata'] || typeof data['providerMetadata'] !== 'object') {
            return { metadataProvenance: {}, preferences: {} };
          }
          if (Array.isArray(data['providerMetadata'])) {
            return { metadataProvenance: {}, preferences: {} };
          }
          const providerMeta = data['providerMetadata'] as Record<string, unknown>;
          return {
            metadataProvenance:
              'metadataProvenance' in providerMeta &&
              providerMeta['metadataProvenance'] !== null &&
              typeof providerMeta['metadataProvenance'] === 'object'
                ? (providerMeta['metadataProvenance'] as Record<string, string>)
                : {},
            preferences:
              'preferences' in providerMeta &&
              providerMeta['preferences'] !== null &&
              typeof providerMeta['preferences'] === 'object'
                ? (providerMeta['preferences'] as Record<string, { provider: string; value: unknown }>)
                : {},
          };
        })(),
      };

      if (!isManga(mangaForProviders)) {
        throw new ValidationError('Invalid manga data structure after refetch');
      }
      await fetchAllProviderData(mangaForProviders);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error refreshing manga data:', errorMessage);
      notify({ severity: 'ERROR', title: 'Refresh Failed', message: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setRefreshing(false);
    }
  }, [refetch, fetchAllProviderData]);

  // Handler for save
  const handleSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      const numericId = toNumberId(mangaId);
      let finalId = numericId;
      if (numericId <= 0) {
        const fallbackId = toNumberId(manga['id']);
        if (fallbackId <= 0) {
          throw new ValidationError(`Invalid manga ID: ${toStringId(manga.id)}`);
        }
        logger.info(`Using fallback manga ID: ${fallbackId} instead of invalid mangaId: ${toStringId(mangaId)}`);
        finalId = fallbackId;
      }
      if (finalId <= 0) {
        throw new ValidationError(`Invalid manga ID: ${toStringId(manga.id)}`);
      }
      if (typeof fieldData !== 'object') {
        throw new ValidationError('Invalid field data for provider preferences');
      }

      const preferences = createProviderPreferences(fieldData);
      if (Object.keys(preferences).length === 0) {
        logger.warn('No provider preferences were created - creating empty submission');
      }

      await updateProviderPreferences({ id: finalId, preferences });
      handleMutationSuccess();
    } catch (error: unknown) {
      logger.error('Error processing provider preferences:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      handleMutationError(errorObj);
    }
  }, [manga, mangaId, fieldData, updateProviderPreferences, handleMutationSuccess, handleMutationError]);

  // Loading state
  if (isLoading || isMangaLoading) {
    return (
      <Box style={{ position: 'relative', minHeight: 200 }}>
        <LoadingOverlay visible />
      </Box>
    );
  }

  // Main render
  return (
    <Box style={{ position: 'relative', minHeight: 400 }}>
      <LoadingOverlay visible={saving || refreshing} />

      <Group justify="space-between" mb="md">
        <Title order={3}>Provider Selection</Title>
        <Tooltip label="Refresh provider data" withArrow>
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            Refresh Data
          </Button>
        </Tooltip>
      </Group>

      <Text size="sm" mb="md" c="dimmed">
        Select which provider to use for each metadata field. Preview values from all available providers.
      </Text>

      <Tabs
        defaultValue="list"
        mb="md"
        onChange={(value) => setViewMode(value as 'list' | 'comparison')}
      >
        <Tabs.List>
          <Tabs.Tab value="list">Field List</Tabs.Tab>
          <Tabs.Tab value="comparison">Provider Comparison</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {viewMode === 'list' ? (
        <FieldListView
          fieldData={fieldData}
          manga={manga}
          onValueChange={handleValueChange}
          onProviderChange={handleProviderChange}
          renderProviderBadge={renderProviderBadge}
          renderImagePreview={renderImagePreview}
        />
      ) : (
        <ComparisonView
          providers={providers}
          fieldData={fieldData}
          onProviderChange={handleProviderChange}
          renderProviderBadge={renderProviderBadge}
          renderImagePreview={renderImagePreview}
        />
      )}

      <Group justify="flex-end" mt="xl">
        {onClose && (
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button onClick={() => void handleSave()}>Save Preferences</Button>
      </Group>
    </Box>
  );
}

export default ProviderSelectionForm;
