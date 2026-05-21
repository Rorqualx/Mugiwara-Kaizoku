/**
 * BasicInfoStep Component
 *
 * Handles basic information input and provider selection for manga import.
 * This is step 1 of the UniversalImportWizard.
 *
 * Refactored into smaller components for maintainability:
 * - PrimarySourceSection: Title and URL input
 * - ProviderSearchSection: Multi-provider search
 * - ProviderAccordion: Results accordion
 * - AccordionControl: Individual accordion headers
 * - CompactResultCard: Result cards
 * - ProviderResultsGrid: Results grid with pagination
 *
 * @module components/addManga/steps/wizard
 */

import React, { useState, useEffect, useRef } from 'react';

import {
  Stack,
  Title,
  Paper
} from '@mantine/core';

import { useWizardContext } from '@/components/addManga/context/WizardContext';
import { getFieldConfidence } from '@/lib/confidence';
import { isRecord } from '@/lib/type-guards';

import {
  PrimarySourceSection,
  ProviderSearchSection,
  ProviderAccordion
} from './basic-info-step/components';
import { useProviderSearch, useResultSelection, useQuickAdd } from './basic-info-step/hooks';
import { getStringProp } from './basic-info-step/utils';
import { BasicInfoStepMetadataPreview } from './BasicInfoStepMetadataPreview';

import type { BasicInfoStepProps } from './basic-info-step/types';

/**
 * BasicInfoStep Component
 *
 * Main wizard step for basic manga information input and provider selection.
 * Uses custom hooks for state management and extracted components for UI.
 */
export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  title,
  setTitle,
  url,
  setUrl,
  provider,
  initialData: _initialData,
  cachedSearchResults,
  additionalProviders,
  setAdditionalProviders,
  selectedSources,
  selectedSourcesMetadata,
  isSearchingProviders,
  setIsSearchingProviders,
  isValidatingUrl,
  handleUrlParse,
  handleAdditionalSourceSelection,
  logger,
  onQuickAdd: _onQuickAdd,
  isQuickAdding: _isQuickAdding = false,
  setIsQuickAdding,
  canQuickAdd: _canQuickAdd = false,
  setCanQuickAdd,
  registerQuickAddHandler,
  onComplete
}): React.ReactElement => {
  // Get library ID, pending fetch functions, and field selection from wizard context
  const {
    libraryId,
    hasPendingFetches,
    waitForAllPendingFetches,
    updateFieldSelection,
    fieldSelections
  } = useWizardContext();

  // Accordion state - all providers open by default
  const [openAccordions, setOpenAccordions] = useState<string[]>(['anilist', 'mangadex', 'comicvine', 'wikipedia', 'fandom']);
  const hasSearched = useRef(false);

  // Use custom hooks for search functionality
  const {
    searchInput,
    setSearchInput,
    showAllResults,
    setShowAllResults,
    handleSearchAllProviders
  } = useProviderSearch({
    title,
    cachedSearchResults,
    additionalProviders,
    setAdditionalProviders,
    setIsSearchingProviders,
    logger
  });

  // Use custom hook for result selection
  const { loadingResults, handleSelectResult } = useResultSelection({
    selectedSources,
    handleAdditionalSourceSelection
  });

  // Use custom hook for quick add functionality
  useQuickAdd({
    provider,
    title,
    url,
    additionalProviders,
    selectedSourcesMetadata,
    libraryId: libraryId ?? 1, // Default to library 1 if not set
    setIsQuickAdding,
    setCanQuickAdd,
    registerQuickAddHandler,
    logger,
    onComplete,
    hasPendingFetches,
    waitForAllPendingFetches
  });

  // Initialize search input from title when component mounts or title changes
  useEffect(() => {
    if (title && !searchInput) {
      setSearchInput(title);
    }
  }, [title, searchInput, setSearchInput]);

  // Process cached search results on mount
  useEffect(() => {
    if (cachedSearchResults && cachedSearchResults.length > 0 && Object.keys(additionalProviders).length === 0) {
      logger.info('[BasicInfoStep] Processing cached search results:', cachedSearchResults.length);

      // Debug: Log all providers found in cached results
      const allProviders = cachedSearchResults.map(r => {
        const providerValue = getStringProp(r, "provider");
        const sourceValue = getStringProp(r, "source");
        return providerValue ?? sourceValue ?? 'unknown';
      });
      logger.info('[BasicInfoStep] All providers in cached results:', [...new Set(allProviders)]);

      // Process cached results with deduplication
      const groupedResults: Record<string, { results: unknown[]; error: null }> = {};
      const seenIds: Record<string, Set<string>> = {};

      cachedSearchResults.forEach(result => {
        const providerValue = getStringProp(result, "provider");
        const sourceValue = getStringProp(result, "source");
        const providerKey = providerValue ?? sourceValue;
        const resultProvider = providerKey ? providerKey.toLowerCase() : '';

        // Include all providers with deduplication
        if (resultProvider) {
          // Create unique identifier for deduplication
          const resultId = getStringProp(result, "id") ?? '';
          const sourceId = getStringProp(result, "sourceId") ?? '';
          const titleValue = getStringProp(result, "title") ?? '';
          const uniqueKey = `${resultId}-${sourceId}-${titleValue}`;

          // Initialize provider group and seen set if they don't exist
          const providerGroup = (groupedResults[resultProvider] ??= { results: [], error: null });
          const providerSeenIds = (seenIds[resultProvider] ??= new Set<string>());

          // Only add if not already seen for this provider
          if (!providerSeenIds.has(uniqueKey)) {
            providerSeenIds.add(uniqueKey);
            providerGroup.results.push(result);
          }
        }
      });

      if (Object.keys(groupedResults).length > 0) {
        logger.info('[BasicInfoStep] Setting additional providers from cached results:', groupedResults);

        // Log each provider's result count for debugging
        Object.entries(groupedResults).forEach(([providerName, data]) => {
          logger.info(`[BasicInfoStep] Provider ${providerName}: ${data.results.length} results`);
          // Log first result details for debugging
          if (data.results.length > 0) {
            const firstResult = data.results[0];
            logger.info(`[BasicInfoStep] ${providerName} first result:`, {
              title: getStringProp(firstResult, "title"),
              hasVolumes: isRecord(firstResult) && 'volumes' in firstResult,
              volumes: isRecord(firstResult) ? firstResult["volumes"] : undefined,
              hasChapters: isRecord(firstResult) && 'chapters' in firstResult,
              chapters: isRecord(firstResult) ? firstResult["chapters"] : undefined,
              hasMetadata: isRecord(firstResult) && 'metadata' in firstResult
            });
          }
        });
        setAdditionalProviders(groupedResults);
      }
    }
  }, [cachedSearchResults, provider, additionalProviders, setAdditionalProviders, logger]);

  // Auto-select Fandom metadata when it's the primary provider
  useEffect(() => {
    const fandomData = additionalProviders["fandom"];
    if (provider === 'fandom' && fandomData?.results && fandomData.results.length > 0 && !selectedSourcesMetadata["fandom"]) {
      const fandomResult = fandomData.results[0];

      // Automatically select the first Fandom result as it's the primary provider
      void handleAdditionalSourceSelection('fandom', fandomResult);
    }
  }, [provider, additionalProviders, selectedSourcesMetadata, handleAdditionalSourceSelection]);

  // Track search state
  useEffect(() => {
    if (Object.keys(additionalProviders).length > 0) {
      hasSearched.current = true;
    }
  }, [additionalProviders]);

  // Handle show all toggle for a specific provider
  const handleShowAllToggle = (providerName: string): void => {
    setShowAllResults(prev => ({ ...prev, [providerName]: true }));
  };

  // Wrapper to handle search
  const handleSearch = (): void => {
    void handleSearchAllProviders(searchInput);
  };

  // Wrapper to handle result selection
  const handleResultSelection = (providerName: string, result: unknown): void => {
    void handleSelectResult(providerName, result);
  };

  return (
    <Stack>
      <Title order={4}>Basic Information</Title>

      {/* Primary Source Section */}
      <PrimarySourceSection
        title={title}
        setTitle={setTitle}
        url={url}
        setUrl={setUrl}
        provider={provider}
        isValidatingUrl={isValidatingUrl}
        onUrlParse={handleUrlParse}
      />

      {/* Additional Metadata Sources */}
      <Paper p="md">
        <Stack>
          {/* Search Section */}
          <ProviderSearchSection
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            onSearch={handleSearch}
            isSearching={isSearchingProviders}
            resultCount={Object.keys(additionalProviders).length}
            originalTitle={title}
            hasSearched={hasSearched.current}
          />

          {/* Results Accordion */}
          <ProviderAccordion
            primaryProvider={provider}
            openAccordions={openAccordions}
            onAccordionChange={setOpenAccordions}
            additionalProviders={additionalProviders}
            selectedSourcesMetadata={selectedSourcesMetadata}
            showAllResults={showAllResults}
            onShowAllToggle={handleShowAllToggle}
            loadingResults={loadingResults}
            onSelectResult={handleResultSelection}
            currentLibraryId={libraryId}
          />
        </Stack>
      </Paper>

      {/* Metadata Preview */}
      <BasicInfoStepMetadataPreview
        selectedSourcesMetadata={selectedSourcesMetadata}
        additionalProviders={additionalProviders}
        selectedSources={selectedSources}
        fieldProvenance={Object.entries(fieldSelections).reduce<Record<string, { provider: string; confidence: number }>>((result, [field, selection]) => {
          if (selection.isExplicit) {
            return {
              ...result,
              [field]: {
                provider: selection.selectedProvider,
                confidence: selection.confidence
              }
            };
          }
          return result;
        }, {})}
        onSelectFieldAlternative={(field, providerName) => {
          // Handle field-level provider selection
          logger.info(`Field ${field} alternative selected: ${providerName}`);

          // Get field value from provider metadata
          const providerMetadata = selectedSourcesMetadata[providerName];
          if (providerMetadata && field in providerMetadata) {
            const value = providerMetadata[field as keyof typeof providerMetadata];

            // Calculate dynamic confidence based on field, value, and provider
            const dynamicConfidence = getFieldConfidence(field, value, providerName);

            // Update field selection in wizard context
            updateFieldSelection(field, providerName, value, dynamicConfidence);
            logger.info(`Field ${field} updated to use ${providerName} value:`, value);
          }
        }}
      />
    </Stack>
  );
};

export default BasicInfoStep;
