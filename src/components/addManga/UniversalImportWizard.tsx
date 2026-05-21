// @file-size-justified: Complex wizard component orchestrating multiple steps, hooks, and state management - already modularly split
/* eslint-disable max-lines */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';

import {
  Modal,
  Stepper,
  Stack,
  Group,
  Button,
  LoadingOverlay
} from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';

import type {
  WizardFormData,
  ProviderMetadata
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { WizardProvider, useWizardContext } from './context/WizardContext';
import { useChapterHandlers } from './handlers/chapter-handlers';
import { useDisplayDataHandlers } from './handlers/display-data-handlers';
import { useFieldOptionsHandler } from './handlers/field-options-handler';
import { useImportHandler } from './handlers/import-handler';
import { useSourceSelectionHandler } from './handlers/source-selection-handler';
import { useUrlHandlers } from './handlers/url-handlers';
import { useWizardValidation } from './hooks/useWizardValidation';
import { ChapterFetchingService } from './services/chapterFetchingService';
import { ImportService } from './services/importService';
import { extractPrimaryProviderGallery } from './services/modules/mediaExtractor';
import { SourceManagementService } from './services/sourceManagementService';
import { UrlParsingService } from './services/urlParsingService';
import { toVolumesData } from './utils/typeGuards';
import { extractUrl } from './wizard-utils/metadata-extractors';
import { WizardStepRenderer } from './WizardStepRenderer';

import type { MutationResults, StaticAnalysisResponse, WikipediaAnalysisResponse } from './wizard-utils/mutation-types';

interface UniversalImportWizardProps {
  opened: boolean;
  onClose: () => void;
  onComplete: (mangaId: number) => void;
  provider: string;
  initialData?: WizardFormData | Record<string, unknown>;
  libraryId?: number; // Required for search mode
}

interface WizardStepContentProps {
  services: {
    urlParsingService: UrlParsingService;
    sourceManagementService: SourceManagementService;
    importService: ImportService;
    chapterFetchingService: ChapterFetchingService;
  };
  mutations: MutationResults;
  onComplete: (mangaId: number) => void;
  onCancel: () => void;
  isSearchMode?: boolean;
  libraryId?: number;
  // Quick add props
  onQuickAdd?: (() => Promise<void>) | undefined;
  isQuickAdding?: boolean | undefined;
  setIsQuickAdding?: ((loading: boolean) => void) | undefined;
  canQuickAdd?: boolean | undefined;
  setCanQuickAdd?: ((can: boolean) => void) | undefined;
  registerQuickAddHandler?: ((handler: () => Promise<void>) => void) | undefined;
}

// eslint-disable-next-line max-lines-per-function -- Wizard step content requires many hooks and state
const WizardStepContent: React.FC<WizardStepContentProps> = ({
  services,
  mutations,
  onComplete: _onComplete,
  onCancel,
  isSearchMode = false,
  libraryId,
  // Quick add props (from parent - optional)
  onQuickAdd: _onQuickAdd,
  isQuickAdding: _isQuickAdding = false,
  setIsQuickAdding: _setIsQuickAdding,
  canQuickAdd: _canQuickAdd = false,
  setCanQuickAdd: _setCanQuickAdd,
  registerQuickAddHandler: _registerQuickAddHandler
}) => {
  const wizardContext = useWizardContext();
  const {
    currentStep,
    setCurrentStep,
    formData,
    updateFormData,
    provider,
    selectedSources,
    setSelectedSources,
    selectedSourcesMetadata,
    setSelectedSourcesMetadata,
    mediaGallery,
    setMediaGallery,
    volumesData,
    setVolumesData,
    selectedCover,
    setSelectedCover,
    selectedBanner,
    setSelectedBanner,
    selectedVolumes,
    setSelectedVolumes,
    selectedChapters,
    setSelectedChapters,
    selectedGalleryImages,
    setSelectedGalleryImages,
    descriptionEditMode,
    setDescriptionEditMode,
    isLoading,
    setIsLoading: _setIsLoading,
    chapterMetadataCache,
    setChapterMetadataCache: _setChapterMetadataCache,
    externalIds,
    setExternalIds,
    externalLinks,
    setExternalLinks,
    canProceedToNextStep,
    goToNextStep,
    goToPreviousStep,
    libraryId: contextLibraryId,
    registerPendingFetch,
    hasPendingFetches
  } = wizardContext;

  // Wizard validation and confidence scoring
  const {
    calculateFieldConfidence,
    getConfidenceColor
  } = useWizardValidation();

  // Use libraryId from context if available, otherwise from props
  const activeLibraryId = contextLibraryId ?? libraryId;

  // Local state for step-specific functionality
  const [url, setUrl] = useState('');
  const [metadataUrl, setMetadataUrl] = useState('');
  const [manualVolumeUrl, setManualVolumeUrl] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [isValidatingMetadataUrl, setIsValidatingMetadataUrl] = useState(false);
  const [isParsingVolumeUrl, setIsParsingVolumeUrl] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StaticAnalysisResponse | null>(null);
  const [wikipediaAnalysisResult, setWikipediaAnalysisResult] = useState<WikipediaAnalysisResponse | null>(null);
  const [additionalProviders, setAdditionalProviders] = useState<Record<string, { results?: unknown[]; error?: unknown }>>({});
  const [isSearchingProviders, setIsSearchingProviders] = useState(false);
  const [parseChapterDetails, setParseChapterDetails] = useState(false);
  const [volumeDisplaySource, setVolumeDisplaySource] = useState('primary');
  const [chapterDisplaySource, setChapterDisplaySource] = useState('primary');
  const [loadingChapterMetadata, setLoadingChapterMetadata] = useState(false);
  const [isBatchFetching, _setIsBatchFetching] = useState(false);
  const [batchFetchProgress, _setBatchFetchProgress] = useState({ current: 0, total: 0 });
  const [_fieldConfidence, _setFieldConfidence] = useState<Record<string, number>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  // Quick add state
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [canQuickAdd, setCanQuickAdd] = useState(false);
  const [quickAddHandler, setQuickAddHandler] = useState<(() => Promise<void>) | undefined>(undefined);
  // Quick add callbacks
  const registerQuickAddHandler = useCallback((handler: () => Promise<void>) => {
    setQuickAddHandler(() => handler);
  }, []);

  const onQuickAdd = useCallback(async () => {
    if (quickAddHandler) {
      await quickAddHandler();
    }
  }, [quickAddHandler]);

  // Bulk fetching state - all fetching now happens on the server
  const isProgressiveFetching = false;
  const progressiveFetchProgress = { completed: 0, total: 0 };
  const failedUrls = new Map<string, number>();
  const retryFailedChapters = async (): Promise<void> => {};

  // Track if we've already triggered enhanced fetch for Fandom primary source
  const fandomEnhancedFetchTriggeredRef = useRef(false);
  // Track if we've already triggered enhanced fetch for Wikipedia metadata
  const wikipediaEnhancedFetchTriggeredRef = useRef(false);

  // Extract gallery from primary provider on initial load
  useEffect(() => {
    if (!isLoading) {
      const rawData = formData as WizardFormData & { gallery?: string[] | undefined; images?: string[] | undefined };
      if (mediaGallery.gallery.length === 0 && (rawData.gallery ?? rawData.images)) {
        extractPrimaryProviderGallery(provider, rawData as unknown as ProviderMetadata, setMediaGallery);
      }
    }
  }, [provider, formData, mediaGallery.gallery.length, isLoading, services.sourceManagementService, setMediaGallery]);

  // Handler hooks
  // debouncedAnalyzeUrl and isAnalyzing are available for triggering analysis on URL change
  const { handleUrlParse, handleMetadataUrlParse, handleVolumeUrlParse, debouncedAnalyzeUrl: _debouncedAnalyzeUrl, isAnalyzing: _isAnalyzing } = useUrlHandlers({
    services, mutations, url, metadataUrl, manualVolumeUrl, formDataTitle: formData.title ?? '',
    updateFormData, setMediaGallery, setVolumesData, setSelectedSources, setSelectedSourcesMetadata,
    setIsValidatingUrl, setIsValidatingMetadataUrl, setIsParsingVolumeUrl, provider, volumesData, selectedSources,
    setVolumeDisplaySource, setChapterDisplaySource, analysisResult, setAnalysisResult,
    wikipediaAnalysisResult, setWikipediaAnalysisResult
  });
  const { handleAdditionalSourceSelection } = useSourceSelectionHandler({
    services: { sourceManagementService: services.sourceManagementService },
    setSelectedSources, setSelectedSourcesMetadata, setMediaGallery, setVolumesData,
    selectedSources, selectedSourcesMetadata, registerPendingFetch
  });
  const { handleBatchFetchChapterCovers, fetchChapterMetadataOnHover, handleComicVineChapterScraping } = useChapterHandlers({
    volumesData, chapterFetchingService: services.chapterFetchingService,
    scrapeComicVineVolumeMutation: mutations.scrapeComicVineVolumeMutation,
    setMediaGallery, setVolumesData, setSelectedSourcesMetadata, setLoadingChapterMetadata, logger
  });
  const { handleImport } = useImportHandler({
    ...(activeLibraryId !== undefined && { libraryId: activeLibraryId }), provider, selectedSourcesMetadata, formData,
    mediaGallery: mediaGallery as unknown, volumesData: volumesData as unknown,
    externalIds: externalIds as unknown, externalLinks, chapterMetadataCache,
    selectedCover, selectedBanner, selectedGalleryImages, volumeDisplaySource, chapterDisplaySource,
    selectedVolumes, selectedChapters, importService: services.importService,
    sourceManagementService: services.sourceManagementService, setIsImporting, setImportProgress, logger, isSearchMode
  });
  const { getFieldOptions, statusOptions, formatOptions, demographicOptions, getExternalIdOptions } = useFieldOptionsHandler({
    selectedSourcesMetadata, selectedSources, logger
  });
  const { displayVolumes, displayChapters: _displayChapters, allChapterUrls } = useDisplayDataHandlers({
    volumeDisplaySource, chapterDisplaySource, volumesData: volumesData as unknown as Record<string, unknown>,
    selectedSourcesMetadata, provider, sourceManagementService: services.sourceManagementService, logger
  });

  // Auto-fetch enhanced metadata for Fandom PRIMARY sources
  // This ensures Fandom metadata (genres, authors, descriptions) gets properly enriched
  // when Fandom is the initial/primary provider (not just an additional source)
  useEffect(() => {
    // Only for Fandom primary sources
    if (provider.toLowerCase() !== 'fandom') return;

    // Only trigger once per wizard session
    if (fandomEnhancedFetchTriggeredRef.current) return;

    // Wait for initial data to load
    if (isLoading) return;

    // Check if we have Fandom metadata already
    const fandomMeta = selectedSourcesMetadata['fandom'];
    if (!fandomMeta) {
      // No fandom metadata yet - check if we have form data with a URL
      const fandomUrl = extractUrl(formData as Record<string, unknown>);
      if (!fandomUrl) return;

      logger.info('[Wizard] Fandom primary source - triggering enhanced fetch', {
        url: fandomUrl,
        provider,
        hasFormData: !!formData
      });

      // Trigger enhanced fetch for Fandom
      fandomEnhancedFetchTriggeredRef.current = true;

      // Create a minimal search result to pass to handleAdditionalSourceSelection
      const fandomResult = {
        provider: 'fandom',
        title: formData.title ?? '',
        url: fandomUrl,
        metadata: formData
      };

      void handleAdditionalSourceSelection('fandom', fandomResult, true);
      return;
    }

    // Check if Fandom metadata needs enrichment (no genres = needs enhanced fetch)
    const hasGenres = Array.isArray(fandomMeta.genres) && fandomMeta.genres.length > 0;
    if (hasGenres) {
      logger.debug('[Wizard] Fandom metadata already has genres, skipping enhanced fetch');
      return;
    }

    // Extract URL from formData for enhanced fetch
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- These fields may be empty strings at runtime
    const fandomUrl = extractUrl(formData as Record<string, unknown>) ?? fandomMeta.url ?? fandomMeta.wikiUrl;
    if (!fandomUrl) {
      logger.warn('[Wizard] Cannot trigger enhanced Fandom fetch: no URL available');
      return;
    }

    logger.info('[Wizard] Fandom primary source needs enrichment - triggering enhanced fetch', {
      url: fandomUrl,
      hasGenres,
      currentGenreCount: fandomMeta.genres?.length ?? 0
    });

    // Mark as triggered to prevent re-fetching
    fandomEnhancedFetchTriggeredRef.current = true;

    // Build volumes data from existing metadata if available
    const existingVolumes = toVolumesData(fandomMeta as unknown as Record<string, unknown>);

    // Create a result object that includes volumes for the enhanced fetch
    const fandomResult = {
      provider: 'fandom',
      title: formData.title ?? fandomMeta.title ?? '',
      url: fandomUrl,
      metadata: {
        ...fandomMeta,
        volumes: existingVolumes.volumes.length > 0 ? existingVolumes.volumes : undefined
      }
    };

    // Trigger enhanced fetch through source selection handler
    void handleAdditionalSourceSelection('fandom', fandomResult, true);
  }, [
    provider,
    isLoading,
    formData,
    selectedSourcesMetadata,
    handleAdditionalSourceSelection
  ]);

  // Auto-fetch enhanced metadata for Wikipedia sources
  // Wikipedia search results only contain basic data (title, description, url)
  // but NOT author, publisher, dates, etc. This effect triggers enhanced fetch
  // to get that metadata after Wikipedia is detected in selectedSourcesMetadata
  useEffect(() => {
    // Wait for initial data to load
    if (isLoading) return;

    // Only trigger once per wizard session
    if (wikipediaEnhancedFetchTriggeredRef.current) return;

    // Check if Wikipedia is in the metadata
    const wikipediaMeta = selectedSourcesMetadata['wikipedia'];
    if (!wikipediaMeta) return;

    // Check if Wikipedia metadata needs enrichment (no authors AND no publisher)
    const hasAuthors = Array.isArray(wikipediaMeta.authors) && wikipediaMeta.authors.length > 0;
    const hasPublisher = typeof wikipediaMeta.publisher === 'string' && wikipediaMeta.publisher.length > 0;

    if (hasAuthors || hasPublisher) {
      logger.debug('[Wizard] Wikipedia metadata already has authors/publisher, skipping enhanced fetch', {
        authorsCount: Array.isArray(wikipediaMeta.authors) ? wikipediaMeta.authors.length : 0,
        publisher: wikipediaMeta.publisher
      });
      return;
    }

    // Need a title to fetch enhanced metadata
    const title = wikipediaMeta.title ?? formData.title;
    if (!title) {
      logger.warn('[Wizard] Cannot trigger enhanced Wikipedia fetch: no title available');
      return;
    }

    logger.info('[Wizard] Wikipedia metadata needs enrichment - triggering enhanced fetch', {
      title,
      currentAuthors: wikipediaMeta.authors,
      currentPublisher: wikipediaMeta.publisher
    });

    // Mark as triggered to prevent re-fetching
    wikipediaEnhancedFetchTriggeredRef.current = true;

    // Create a result object for the enhanced fetch
    const wikipediaResult = {
      provider: 'wikipedia',
      title,
      url: wikipediaMeta.url ?? wikipediaMeta.wikiUrl ?? '',
      id: wikipediaMeta.id,
      sourceId: wikipediaMeta.sourceId,
      metadata: wikipediaMeta
    };

    // Trigger enhanced fetch through source selection handler with forceUpdate=true
    void handleAdditionalSourceSelection('wikipedia', wikipediaResult, true);
  }, [
    isLoading,
    formData.title,
    selectedSourcesMetadata,
    handleAdditionalSourceSelection
  ]);

  const steps = ['Basic Information', 'Metadata Selection', 'Volumes & Chapters', 'Media Selection', 'Review & Import'];

  return (
    <Stack>
      <Stepper active={currentStep} onStepClick={setCurrentStep}>
        {steps.map((label, index) => (
          <Stepper.Step key={index} label={label} />
        ))}
      </Stepper>

      <LoadingOverlay visible={isLoading} />

      <WizardStepRenderer
        currentStep={currentStep}
        provider={provider}
        formData={formData}
        updateFormData={updateFormData}
        selectedSourcesMetadata={selectedSourcesMetadata}
        volumesData={volumesData}
        volumeDisplaySource={volumeDisplaySource}
        chapterDisplaySource={chapterDisplaySource}
        mediaGallery={mediaGallery}
        setMediaGallery={setMediaGallery}
        selectedVolumes={selectedVolumes}
        setSelectedVolumes={setSelectedVolumes}
        selectedChapters={selectedChapters}
        setSelectedChapters={setSelectedChapters}
        selectedCover={selectedCover}
        setSelectedCover={setSelectedCover}
        selectedBanner={selectedBanner}
        setSelectedBanner={setSelectedBanner}
        selectedGalleryImages={selectedGalleryImages}
        setSelectedGalleryImages={setSelectedGalleryImages}
        descriptionEditMode={descriptionEditMode}
        setDescriptionEditMode={setDescriptionEditMode}
        externalIds={externalIds}
        setExternalIds={setExternalIds}
        externalLinks={externalLinks}
        setExternalLinks={setExternalLinks}
        chapterMetadataCache={chapterMetadataCache}
        allChapterUrls={allChapterUrls}
        displayVolumes={displayVolumes}
        url={url}
        setUrl={setUrl}
        additionalProviders={additionalProviders}
        setAdditionalProviders={setAdditionalProviders}
        selectedSources={selectedSources}
        setSelectedSources={setSelectedSources}
        isSearchingProviders={isSearchingProviders}
        setIsSearchingProviders={setIsSearchingProviders}
        isValidatingUrl={isValidatingUrl}
        handleUrlParse={() => { void handleUrlParse(); }}
        handleAdditionalSourceSelection={handleAdditionalSourceSelection}
        metadataUrl={metadataUrl}
        setMetadataUrl={setMetadataUrl}
        handleMetadataUrlParse={() => { void handleMetadataUrlParse(); }}
        isValidatingMetadataUrl={isValidatingMetadataUrl}
        statusOptions={statusOptions}
        formatOptions={formatOptions}
        getFieldOptions={getFieldOptions}
        getExternalIdOptions={getExternalIdOptions}
        demographicOptions={demographicOptions}
        manualVolumeUrl={manualVolumeUrl}
        setManualVolumeUrl={setManualVolumeUrl}
        handleVolumeUrlParse={(url?: string) => { void handleVolumeUrlParse(url); }}
        isParsingVolumeUrl={isParsingVolumeUrl}
        parseChapterDetails={parseChapterDetails}
        setParseChapterDetails={setParseChapterDetails}
        setVolumeDisplaySource={setVolumeDisplaySource}
        setChapterDisplaySource={setChapterDisplaySource}
        isBatchFetching={isBatchFetching}
        batchFetchProgress={batchFetchProgress}
        handleBatchFetchChapterCovers={() => { void handleBatchFetchChapterCovers(); }}
        fetchChapterMetadataOnHover={fetchChapterMetadataOnHover}
        loadingChapterMetadata={loadingChapterMetadata}
        handleComicVineChapterScraping={(volumeNumber: number) => { void handleComicVineChapterScraping(volumeNumber); }}
        isProgressiveFetching={isProgressiveFetching}
        progressiveFetchProgress={progressiveFetchProgress}
        failedChapterUrls={failedUrls}
        retryFailedChapters={retryFailedChapters}
        isImporting={isImporting}
        importProgress={importProgress}
        handleImport={handleImport}
        calculateFieldConfidence={calculateFieldConfidence}
        getConfidenceColor={getConfidenceColor}
        services={{ sourceManagementService: services.sourceManagementService }}
        logger={logger}
        // Quick add props
        onQuickAdd={onQuickAdd}
        isQuickAdding={isQuickAdding}
        setIsQuickAdding={setIsQuickAdding}
        canQuickAdd={canQuickAdd}
        setCanQuickAdd={setCanQuickAdd}
        registerQuickAddHandler={registerQuickAddHandler}
        onComplete={_onComplete}
      />

      <Group justify="space-between" mt="xl">
        <Button variant="subtle" onClick={() => { void onCancel(); }}>
          Cancel
        </Button>
        <Group>
          <Button
            variant="default"
            onClick={() => { void goToPreviousStep(); }}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          {/* Quick Add button - only shown on step 0 (Basic Information) */}
          {currentStep === 0 && quickAddHandler && (
            <Button
              variant="filled"
              color="orange"
              leftSection={<IconRocket size={14} />}
              onClick={() => { void onQuickAdd(); }}
              loading={isQuickAdding || hasPendingFetches()}
              disabled={!canQuickAdd || isQuickAdding}
            >
              {isQuickAdding ? 'Quick Adding...' : hasPendingFetches() ? 'Loading Sources...' : 'Quick Add'}
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              onClick={() => { void goToNextStep(); }}
              disabled={!canProceedToNextStep()}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={() => { void handleImport(); }}
              loading={isImporting}
              color="green"
            >
              Import Manga
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
};

/**
 * UniversalImportWizard Component (Refactored)
 *
 * A comprehensive wizard for importing manga metadata from multiple sources.
 * This refactored version uses extracted services, components, and context for better maintainability.
 *
 * Reduced from 11,203 lines to ~700 lines through modular architecture.
 */
const UniversalImportWizard: React.FC<UniversalImportWizardProps> = ({
  opened,
  onClose,
  onComplete,
  provider,
  initialData,
  libraryId
}) => {
  // Detect search mode - when provider is "search" or libraryId is provided
  const isSearchMode = provider === 'search' || !!libraryId;
  // Use the provided provider - don't override it
  const actualProvider = provider === 'search' ? 'anilist' : provider;

  // Get tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  // Initialize mutations
  // NOTE: Cache invalidation moved to ImportService to ensure it happens BEFORE navigation
  const addMangaMutation = trpc.manga.add.useMutation(); // NEW: manga.add mutation
  const fetchAnilistMutation = trpc["metadata"].fetchAnilistMetadata.useMutation();
  const fetchFandomMutation = trpc["metadata"].fetchFandomMetadata.useMutation();
  const parseFandomUrlMutation = trpc["metadata"].parseFandomUrl.useMutation();
  const fetchComicvineMutation = trpc["metadata"].fetchComicvineMetadata.useMutation();
  const fetchComicvineVolumeDetailsMutation = trpc["metadata"].fetchComicvineVolumeDetails.useMutation();
  const parseUrlMutation = trpc["metadata"].parseMetadataUrl.useMutation();
  const fetchFandomChapterMetadata = trpc["metadata"].fetchFandomChapterMetadata.useMutation();
  const scrapeComicVineVolumeMutation = trpc["metadata"].scrapeComicVineVolume.useMutation();
  const scrapeComicVineChaptersMutation = trpc["metadata"].scrapeComicVineChapters.useMutation();
  const scrapeComicVineVolumeUrlsMutation = trpc["metadata"].scrapeComicVineVolumeUrls.useMutation();
  const fetchWikipediaMutation = trpc["metadata"].fetchWikipediaMetadata.useMutation();
  const analyzeUrlMutation = trpc["metadata"].analyzeUrl.useMutation();
  const analyzeWikipediaUrlMutation = trpc["metadata"].analyzeWikipediaUrl.useMutation();
  const fetchMangaDexVolumesMutation = trpc["metadata"].fetchMangaDexVolumes.useMutation();

  // Initialize services
  const urlParsingService = useMemo(
    () => new UrlParsingService({
      parseUrlMutation,
      fetchAnilistMutation,
      fetchFandomMutation,
      parseFandomUrlMutation,
      fetchComicvineMutation
    }),
    [parseUrlMutation, fetchAnilistMutation, fetchFandomMutation, parseFandomUrlMutation, fetchComicvineMutation]
  );

  const sourceManagementService = useMemo(
    () => new SourceManagementService({
      fetchAnilistMutation,
      fetchFandomMutation,
      parseFandomUrlMutation,
      fetchComicvineMutation,
      fetchComicvineVolumeDetailsMutation,
      scrapeComicVineVolumeMutation,
      scrapeComicVineChaptersMutation,
      scrapeComicVineVolumeUrlsMutation,
      fetchWikipediaMutation
    }),
    [fetchAnilistMutation, fetchFandomMutation, parseFandomUrlMutation, fetchComicvineMutation, fetchComicvineVolumeDetailsMutation, scrapeComicVineVolumeMutation, scrapeComicVineChaptersMutation, scrapeComicVineVolumeUrlsMutation, fetchWikipediaMutation]
  );

  const importService = useMemo(
    () => new ImportService({
      onComplete,
      onCancel: onClose,
      addMangaMutation, // Pass the mutation to ImportService
      utils // Pass utils for cache invalidation
    }),
    [onComplete, onClose, addMangaMutation, utils]
  );

  const chapterFetchingService = useMemo(
    () => new ChapterFetchingService({
      fetchFandomChapterMetadata
    }),
    [fetchFandomChapterMetadata]
  );

  const services = {
    urlParsingService,
    sourceManagementService,
    importService,
    chapterFetchingService
  };

  const mutations = {
    fetchAnilistMutation,
    fetchFandomMutation,
    parseFandomUrlMutation,
    fetchComicvineMutation,
    fetchComicvineVolumeDetailsMutation,
    parseUrlMutation,
    fetchFandomChapterMetadata,
    scrapeComicVineVolumeMutation,
    scrapeComicVineChaptersMutation,
    scrapeComicVineVolumeUrlsMutation,
    analyzeUrlMutation,
    analyzeWikipediaUrlMutation,
    fetchMangaDexVolumesMutation,
  };

  if (!opened) return null;

  const modalTitle = isSearchMode
    ? 'Add Manga'
    : `Import from ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

  return (
    <Modal
      opened={opened}
      onClose={() => { void onClose(); }}
      title={modalTitle}
      size="xl"
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <WizardProvider
        provider={actualProvider}
        {...(initialData !== undefined ? { initialData: initialData as unknown as import('@/types/search.types').ExtendedMangaSearchResult } : {})}
        {...(libraryId !== undefined ? { libraryId } : {})}
      >
        <WizardStepContent
          services={services}
          mutations={mutations}
          onComplete={onComplete}
          onCancel={() => { void onClose(); }}
          isSearchMode={isSearchMode}
          {...(libraryId !== undefined && { libraryId })}
        />
      </WizardProvider>
    </Modal>
  );
};

export default UniversalImportWizard;