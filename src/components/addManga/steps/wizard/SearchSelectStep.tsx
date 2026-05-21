/**
 * SearchSelectStep Component
 *
 * Wizard step that wraps the SearchStep component and integrates it with WizardContext.
 * Handles manga search and automatically populates wizard state with selected result.
 *
 * This is Step 0 of the UniversalImportWizard when in "search mode".
 *
 * @module components/addManga/steps/wizard/SearchSelectStep
 */

import React, { useCallback } from 'react';

import { Paper, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';

import { useWizardContext } from '@/components/addManga/context/WizardContext';
import type { FormType } from '@/components/addManga/form';
import { mapSearchResultToWizardData, mapToProviderMetadata } from '@/components/addManga/utils/searchToWizardMapper';
import { isRecord } from '@/lib/type-guards';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { SearchStep } from '../searchStep';

import { enrichAniListResult, enrichFandomResult, extractFandomUrl } from './search-enrichment';

// Helper functions for safe property access
function getArrayProp(obj: unknown, key: string): unknown[] | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return Array.isArray(value) ? value : undefined;
}

// Type guard to ensure array of strings
function toStringArray(arr: unknown[]): string[] {
  return arr.filter((item): item is string => typeof item === 'string');
}

// Type guard to ensure array conforms to Volume interface
function toVolumeArray(arr: unknown[]): import('@/types/universalImportWizard.types').Volume[] {
  return arr.filter((item): item is import('@/types/universalImportWizard.types').Volume => {
    if (!isRecord(item)) return false;
    // Volume must have at least a title property
    return typeof item['title'] === 'string' ||
           typeof item['name'] === 'string' ||
           typeof item['volumeName'] === 'string';
  });
}

interface SearchSelectStepProps {
  libraryId: number;
  onSearchResultSelected?: () => void;
}

/**
 * SearchSelectStep Component
 *
 * Integrates search functionality into the wizard flow. When a manga is selected,
 * automatically populates the wizard context with all available metadata.
 */
export const SearchSelectStep: React.FC<SearchSelectStepProps> = ({
  libraryId,
  onSearchResultSelected
}) => {
  const wizardContext = useWizardContext();
  const {
    formData,
    updateFormData,
    setSelectedSources,
    setSelectedSourcesMetadata,
    setMediaGallery,
    setVolumesData,
    setLibraryId
  } = wizardContext;

  // Ensure libraryId is set in wizard context
  React.useEffect(() => {
    if (libraryId && setLibraryId) {
      logger.info('[SearchSelectStep] Setting libraryId in context:', libraryId);
      setLibraryId(libraryId);
    }
  }, [libraryId, setLibraryId]);

  // Create a local form for SearchStep (required by its interface)
  const searchForm = useForm<FormType>({
    initialValues: {
      query: formData["title"] ?? '',
      mangaTitle: '',
      mangaId: '',
      libraryId
    }
  });

  /**
   * Handle manga selection from search results
   * Maps the selected result to wizard form data and updates context
   */
  // eslint-disable-next-line complexity -- Unavoidable complexity: state updates, logging, and multiple provider handling
  const handleMangaSelect = useCallback((
    selectedResult: ExtendedMangaSearchResult,
    allResults?: Record<string, unknown[]>
  ) => {
    logger.debug('[SearchSelectStep] Manga selected', {
      title: selectedResult["title"],
      provider: selectedResult.provider || selectedResult["source"],
      hasAllResults: !!allResults,
      hasAuthors: !!selectedResult.authors,
      authorsValue: selectedResult.authors,
      authorsLength: selectedResult.authors?.length ?? 0,
      hasArtists: !!(selectedResult as Record<string, unknown>)['artists'],
      artistsValue: (selectedResult as Record<string, unknown>)['artists'],
      hasMetadata: !!selectedResult.metadata,
      metadataKeys: selectedResult.metadata ? Object.keys(selectedResult.metadata) : [],
      metadataAuthors: selectedResult.metadata ? (selectedResult.metadata as Record<string, unknown>)['authors'] : undefined,
    });

    // Map search result to wizard form data
    const wizardData = mapSearchResultToWizardData(selectedResult, allResults);

    // Update wizard context with mapped data
    updateFormData(wizardData);

    logger.info('[SearchSelectStep] Updated wizard formData:', {
      title: wizardData["title"],
      hasDescription: !!wizardData["description"],
      hasGenres: !!wizardData["genres"]?.length,
      hasAuthors: !!wizardData["authors"]?.length,
      provider: wizardData.searchProvider
    });

    // Only store metadata for the primary (selected) provider
    // Other providers' metadata will be fetched when explicitly selected as secondary
    const primaryProvider = selectedResult.provider || selectedResult["source"] || 'unknown';
    const primaryMetadata = mapToProviderMetadata(selectedResult);

    logger.debug('[SearchSelectStep] Primary metadata after mapping', {
      provider: primaryProvider,
      mappedAuthors: primaryMetadata.authors,
      mappedAuthorsLength: primaryMetadata.authors?.length ?? 0,
      mappedArtists: primaryMetadata.artists,
      mappedArtistsLength: primaryMetadata.artists?.length ?? 0,
      mappedIdMal: primaryMetadata.idMal,
    });

    setSelectedSourcesMetadata({ [primaryProvider]: primaryMetadata });
    setSelectedSources([primaryProvider]);

    logger.info('[SearchSelectStep] Set primary provider metadata:', primaryProvider);
    logger.info('[SearchSelectStep] Other providers available for manual selection:',
      allResults ? Object.keys(allResults).filter(p => p !== primaryProvider) : []);

    // Extract media gallery from search result
    const galleryFromResult = getArrayProp(selectedResult, 'gallery');
    const imagesFromResult = getArrayProp(selectedResult, 'images');
    const metadataObj = isRecord(selectedResult) ? selectedResult["metadata"] : undefined;
    const galleryFromMetadata = getArrayProp(metadataObj, 'gallery');

    const rawGallery = galleryFromResult ?? imagesFromResult ?? galleryFromMetadata ?? [];
    logger.debug('[SearchSelectStep] Initial gallery from search result', {
      galleryFromResultLength: galleryFromResult?.length ?? 0,
      imagesFromResultLength: imagesFromResult?.length ?? 0,
      galleryFromMetadataLength: galleryFromMetadata?.length ?? 0,
      rawGalleryLength: rawGallery.length
    });

    const gallery = {
      covers: [],
      banners: [],
      gallery: toStringArray(rawGallery),
      volumeCovers: [],
      chapterCovers: []
    };
    logger.debug('[SearchSelectStep] Initial setMediaGallery called', { gallery });
    setMediaGallery(gallery);

    // Provider-specific enrichment (fire and forget)
    const enrichmentContext = {
      primaryProvider,
      primaryMetadata,
      setSelectedSourcesMetadata,
      setMediaGallery,
      setVolumesData,
      updateFormData,
    };

    // Enrich Fandom results with gallery and volume data
    if (primaryProvider.toLowerCase() === 'fandom') {
      const fandomUrl = extractFandomUrl(selectedResult as Record<string, unknown>);
      enrichFandomResult(fandomUrl, enrichmentContext);
    }

    // Enrich AniList results with complete metadata (authors, artists, dates)
    if (primaryProvider.toLowerCase() === 'anilist' && selectedResult.id) {
      enrichAniListResult(selectedResult.id, enrichmentContext);
    }

    // Extract volume data if available
    const volumesFromResult = getArrayProp(selectedResult, 'volumes');
    const rawDataObj = isRecord(selectedResult) ? selectedResult["rawData"] : undefined;
    const volumesFromRawData = getArrayProp(rawDataObj, 'volumes');
    const volumeDataFromMetadata = getArrayProp(metadataObj, 'volumeData');

    const rawVolumeData = volumesFromResult ?? volumesFromRawData ?? volumeDataFromMetadata ?? [];
    const volumeData = toVolumeArray(rawVolumeData);

    if (volumeData.length > 0) {
      // Calculate total chapters safely
      const totalChapters = volumeData.reduce((sum: number, vol) => {
        const chapters = getArrayProp(vol, 'chapters');
        const chapterCount = typeof vol['chapterCount'] === 'number' ? vol['chapterCount'] : 0;
        return sum + (chapters?.length ?? chapterCount);
      }, 0);

      setVolumesData({
        volumes: volumeData,
        totalVolumes: volumeData.length,
        totalChapters
      });

      logger.info('[SearchSelectStep] Set volumes data:', {
        volumeCount: volumeData.length,
        firstVolume: volumeData[0]
      });
    }

    // Trigger callback
    if (onSearchResultSelected) {
      onSearchResultSelected();
    }
  }, [
    updateFormData,
    setSelectedSources,
    setSelectedSourcesMetadata,
    setMediaGallery,
    setVolumesData,
    onSearchResultSelected
  ]);

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Title order={3}>Search for Manga</Title>
          <Text size="sm" c="dimmed">
            Search across multiple providers to find and import manga. Select a result to continue with the import wizard.
          </Text>
        </Stack>
      </Paper>

      {/* Render the search step with wizard integration */}
      <SearchStep
        form={searchForm}
        onSelect={handleMangaSelect}
        selectedLibraryId={libraryId}
      />
    </Stack>
  );
};

export default SearchSelectStep;
