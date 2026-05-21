/**
 * Consolidated ConfirmationStep Component
 *
 * This is the refactored version that uses extracted components and hooks
 * to maintain the same functionality with better organization.
 */
import React, { useEffect, useState, useCallback } from 'react';

import { Box } from '@mantine/core';

import type {
  RawProviderData,
  VolumeData,
  ChapterData,
  ProviderMetadataRecord
} from '@/types/api/manga-router-types';
import {
  isError,
  isLoading,
  createLoadingResult,
  createSuccessResult,
  createErrorResult
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

// Import extracted components
import { ConfirmationContent } from './components/ConfirmationContent';
import { ConfirmationHeader } from './components/ConfirmationHeader';
import { ConfirmationModals } from './components/ConfirmationModals';
import { LoadingState, ErrorState } from './components/LoadingErrorStates';
// Import extracted hooks
import { useConfirmationDebugLog } from './hooks/useConfirmationDebugLog';
import { useConfirmationState, type ProviderResults } from './hooks/useConfirmationState';
import {
  useFieldSelections,
  type FieldSelections,
  type FieldSelection
} from './hooks/useFieldSelections';
import { useProviderSearch } from './hooks/useProviderSearch';
// Import utilities
import { extractVolumeChapterData, extractGalleryImages } from './utils/volumeChapterExtractor';

// Types
interface MangaData {
  title?: string;
  provider?: string;
  source?: string;
  id?: string | number;
  coverImage?: string;
  cover?: string;
  bannerImage?: string;
  description?: string;
  volumes?: VolumeData[];
  chapters?: ChapterData[];
  totalVolumes?: number;
  totalChapters?: number;
  formData?: Record<string, unknown>;
  selectedSourcesMetadata?: Record<string, unknown>;
  providerMetadata?: ProviderMetadataRecord;
  metadata?: Record<string, unknown>;
  rawData?: RawProviderData & {
    selectedVolumesData?: VolumeData[];
    volumeCovers?: VolumeData[];
    chapterCovers?: ChapterData[];
    gallery?: string[];
    images?: string[];
  };
  [key: string]: unknown;
}

interface ConfirmationData {
  rawData?: RawProviderData;
  libraryId?: number;
  folderId?: number;
  downloadConfig?: unknown;
  monitoringConfig?: unknown;
  selectedProvider?: string;
  fieldSelections?: FieldSelections;
  confidence?: unknown;
  [key: string]: unknown;
}

interface ConfirmationStepProps {
  manga: MangaData;
  source: string;
  onConfirm: (data: ConfirmationData) => void | Promise<void>;
  onCancel: () => void;
  libraryId?: number;
  folderId?: number;
}

/**
 * ConfirmationStep Component
 *
 * Allows users to review and confirm manga selection with metadata from multiple providers
 */
export function ConfirmationStep({
  manga,
  source,
  onConfirm,
  onCancel,
  libraryId,
  folderId
}: ConfirmationStepProps): React.ReactElement {
  // Debug logging hook
  useConfirmationDebugLog({
    manga,
    source,
    ...(libraryId !== undefined && { libraryId }),
    ...(folderId !== undefined && { folderId })
  });

  // Use extracted hooks for state management
  const {
    searchState,
    setSearchState,
    confirmState,
    setConfirmState,
    activeTab,
    setActiveTab,
    bannerModalOpened,
    setBannerModalOpened,
    metadataEditorOpened,
    setMetadataEditorOpened,
    providerResults,
    setProviderResults,
    selectedProvider,
    setSelectedProvider,
    selectedResult,
    setSelectedResult,
    selectedSources,
    setSelectedSources,
    alternativeMetadata,
    selectedFromProvider,
    setSelectedFromProvider,
    metadataConfidence,
    downloadConfig,
    monitoringConfig
  } = useConfirmationState(manga, source);

  const { fieldSelections, updateFieldSelection, updateMultipleFields, aggregatedMetadata, getMetadataField } =
    useFieldSelections(manga);

  const getSelectedMetadata = (): Record<string, unknown> => aggregatedMetadata;
  const { searchAllProviders: searchProviders, getProviderResults } = useProviderSearch();

  // Banner/Chapter modal state
  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [selectedChapter] = useState<{
    number: number;
    title: string;
    coverImage?: string;
    releaseDate?: string;
    pageCount?: number;
    scanlator?: string;
    url?: string;
  }>();

  // Available providers
  const availableProviders = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'].filter(
    (p) => p !== source
  );

  // Extract manga title for dependency
  const mangaTitle = manga.title ?? '';

  // Search for matches - wrapped in useCallback to avoid hook dependency issues
  const searchForMatches = useCallback(async (): Promise<void> => {
    setSearchState(createLoadingResult());
    try {
      // Create search functions for each provider
      const searchFunctions: Record<string, (query: string) => Promise<unknown[]>> = {};
      for (const provider of availableProviders) {
        searchFunctions[provider] = (query: string) => {
          logger.debug('Searching provider', { provider, query });
          return Promise.resolve([]);
        };
      }

      await searchProviders(mangaTitle, availableProviders, searchFunctions);

      // Get results from the hook
      const results: Record<string, ProviderResults> = {};
      for (const provider of availableProviders) {
        const providerResult = getProviderResults(provider);
        if (providerResult) {
          results[provider] = providerResult;
        } else {
          results[provider] = {
            results: [],
            isLoading: false
          };
        }
      }

      setProviderResults(results);
      setSearchState(createSuccessResult<Record<string, ProviderResults>>(results));
    } catch (error: unknown) {
      logger.error('Error searching providers:', error);
      setSearchState(
        createErrorResult(error instanceof Error ? error : new Error('Search failed'))
      );
    }
  }, [mangaTitle, availableProviders, searchProviders, getProviderResults, setSearchState, setProviderResults]);

  // Search for matches on mount
  useEffect(() => {
    void searchForMatches();
  }, [searchForMatches]);

  const handleProviderSelect = (provider: string): void => {
    setSelectedProvider(provider);
    const providerResult = selectedSources[provider] ?? manga;
    setSelectedResult(providerResult);

    const updates: Record<string, FieldSelection> = {};
    Object.keys(fieldSelections).forEach((field) => {
      const value = getMetadataField(providerResult, field, null);
      if (value !== null) {
        updates[field] = { source: provider, value };
      }
    });
    updateMultipleFields(updates);
  };

  const handleResultSelect = (provider: string, result: unknown): void => {
    setSelectedSources((prev) => ({
      ...prev,
      [provider]: result
    }));

    if (provider === selectedProvider) {
      setSelectedResult(result);

      const updates: Record<string, FieldSelection> = {};
      if (result) {
        Object.keys(fieldSelections).forEach((field) => {
          const value = getMetadataField(result, field, null);
          if (value !== null) {
            updates[field] = { source: provider, value };
          }
        });
      }
      updateMultipleFields(updates);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    setConfirmState(createLoadingResult());
    try {
      const metadata = getSelectedMetadata();
      const confirmData = {
        ...metadata,
        rawData: manga.rawData,
        libraryId,
        folderId,
        downloadConfig,
        monitoringConfig,
        selectedProvider,
        fieldSelections,
        confidence: metadataConfidence
      } as ConfirmationData;

      await onConfirm(confirmData);
      setConfirmState(createSuccessResult(confirmData));
    } catch (error: unknown) {
      logger.error('Error confirming manga:', error);
      setConfirmState(
        createErrorResult(error instanceof Error ? error : new Error('Confirmation failed'))
      );
    }
  };

  const handleFieldSelect = (field: string, selection: FieldSelection): void => {
    updateFieldSelection(field, selection);
    setSelectedFromProvider((prev) => ({
      ...prev,
      [field]: selection.source
    }));
  };

  const handleEditMetadata = (): void => {
    setMetadataEditorOpened(true);
  };

  const handleBannerClick = (): void => {
    setBannerModalOpened(true);
  };

  // Loading state
  if (isLoading(searchState)) {
    return <LoadingState />;
  }

  // Error state
  if (isError(searchState)) {
    return <ErrorState error={searchState.error} onRetry={() => { void searchForMatches(); }} />;
  }

  // Extract data for child components
  const volumeChapterData = extractVolumeChapterData(selectedResult, manga, source);
  const galleryImages = extractGalleryImages(manga);
  const volumes = (manga.rawData?.volumes ?? manga.volumes ?? []) as VolumeData[];

  return (
    <Box>
      <ConfirmationHeader
        isLoading={isLoading(confirmState)}
        onCancel={() => { void onCancel(); }}
        onConfirm={() => { void handleConfirm(); }}
      />

      <ConfirmationContent
        source={source}
        availableProviders={availableProviders}
        manga={manga}
        _selectedResult={selectedResult}
        fieldSelections={fieldSelections}
        alternativeMetadata={alternativeMetadata}
        selectedFromProvider={selectedFromProvider}
        metadataConfidence={metadataConfidence}
        providerResults={providerResults}
        activeTab={activeTab ?? "source-selection"}
        selectedProvider={selectedProvider}
        selectedSources={selectedSources}
        metadataEditorOpened={metadataEditorOpened}
        confirmState={confirmState}
        volumeChapterData={volumeChapterData}
        volumes={volumes}
        galleryImages={galleryImages}
        onFieldSelect={handleFieldSelect}
        onEditMetadata={handleEditMetadata}
        onBannerClick={handleBannerClick}
        onTabChange={setActiveTab}
        onProviderSelect={handleProviderSelect}
        onResultSelect={handleResultSelect}
        updateFieldSelection={updateFieldSelection}
      />

      <ConfirmationModals
        bannerModalOpened={bannerModalOpened}
        chapterModalOpen={chapterModalOpen}
        fieldSelections={fieldSelections}
        {...(selectedChapter && { selectedChapter })}
        onBannerModalClose={() => setBannerModalOpened(false)}
        onChapterModalClose={() => setChapterModalOpen(false)}
      />
    </Box>
  );
}

// Export for backward compatibility
export const ConfirmationStepStandardized = ConfirmationStep;
export default ConfirmationStep;
