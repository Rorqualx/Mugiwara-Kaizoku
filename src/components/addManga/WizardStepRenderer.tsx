import React, { lazy, Suspense } from 'react';

import { Stack, Text, Progress } from '@mantine/core';

import type {
  WizardFormData,
  ProviderMetadata,
  MediaGallery,
  VolumesData,
  ExternalIds,
  DescriptionEditMode
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { getVolumeCoversByProvider, type VolumeDetails } from './wizard-utils';

import type { FieldOption, ExternalIdOption } from './handlers/field-options-handler';
import type { SourceManagementService } from './services/sourceManagementService';

// Step components (lazy loaded for performance)
const BasicInfoStep = lazy(() => import('./steps/wizard/BasicInfoStep').then(m => ({ default: m.BasicInfoStep })));
const MetadataSelectionStep = lazy(() => import('./steps/wizard/MetadataSelectionStep').then(m => ({ default: m.MetadataSelectionStep })));
const VolumesChaptersStep = lazy(() => import('./steps/wizard/VolumesChaptersStep').then(m => ({ default: m.VolumesChaptersStep })));
const MediaSelectionStep = lazy(() => import('./steps/wizard/MediaSelectionStep').then(m => ({ default: m.MediaSelectionStep })));
const ReviewConfidenceStep = lazy(() => import('./steps/wizard/ReviewConfidenceStep').then(m => ({ default: m.ReviewConfidenceStep })));

/**
 * Wizard Step Renderer Component
 *
 * Renders the appropriate wizard step based on currentStep index.
 * Each step receives its props and handlers from the parent WizardStepContent.
 *
 * @module WizardStepRenderer
 * @provenance Extracted from UniversalImportWizard.tsx lines 278-473
 */

interface WizardStepRendererProps {
  currentStep: number;
  provider: string;
  formData: Partial<WizardFormData>;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  volumesData: VolumesData;
  volumeDisplaySource: string;
  chapterDisplaySource: string;
  mediaGallery: MediaGallery;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  selectedChapters: unknown[];
  setSelectedChapters: React.Dispatch<React.SetStateAction<unknown[]>>;
  selectedCover: string;
  setSelectedCover: (cover: string) => void;
  selectedBanner: string;
  setSelectedBanner: (banner: string) => void;
  selectedGalleryImages: string[];
  setSelectedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;
  descriptionEditMode: DescriptionEditMode;
  setDescriptionEditMode: React.Dispatch<React.SetStateAction<DescriptionEditMode>>;
  externalIds: ExternalIds;
  setExternalIds: React.Dispatch<React.SetStateAction<ExternalIds>>;
  externalLinks: string[];
  setExternalLinks: React.Dispatch<React.SetStateAction<string[]>>;
  chapterMetadataCache: Map<string, unknown>;
  allChapterUrls: unknown[];
  displayVolumes: VolumeDetails[];

  // Step 0 - BasicInfoStep props
  url: string;
  setUrl: (url: string) => void;
  additionalProviders: Record<string, { results?: unknown[]; error?: unknown }>;
  setAdditionalProviders: (providers: Record<string, { results?: unknown[]; error?: unknown }>) => void;
  selectedSources: string[];
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  isSearchingProviders: boolean;
  setIsSearchingProviders: (searching: boolean) => void;
  isValidatingUrl: boolean;
  handleUrlParse: () => void;
  handleAdditionalSourceSelection: (provider: string, result: unknown, forceUpdate?: boolean) => Promise<void>;
  // Quick add props for footer button
  onQuickAdd?: (() => Promise<void>) | undefined;
  isQuickAdding?: boolean | undefined;
  setIsQuickAdding?: ((loading: boolean) => void) | undefined;
  canQuickAdd?: boolean | undefined;
  setCanQuickAdd?: ((can: boolean) => void) | undefined;
  registerQuickAddHandler?: ((handler: () => Promise<void>) => void) | undefined;
  onComplete?: ((mangaId: number) => void) | undefined;

  // Step 1 - MetadataSelectionStep props
  metadataUrl: string;
  setMetadataUrl: (url: string) => void;
  handleMetadataUrlParse: () => void;
  isValidatingMetadataUrl: boolean;
  statusOptions: FieldOption[];
  formatOptions: FieldOption[];
  getFieldOptions: (field: string) => FieldOption[];
  getExternalIdOptions: (idType: string) => ExternalIdOption[];
  demographicOptions: FieldOption[];

  // Step 2 - VolumesChaptersStep props
  manualVolumeUrl: string;
  setManualVolumeUrl: (url: string) => void;
  handleVolumeUrlParse: (url?: string) => void;
  isParsingVolumeUrl: boolean;
  parseChapterDetails: boolean;
  setParseChapterDetails: (parse: boolean) => void;
  setVolumeDisplaySource: (source: string) => void;
  setChapterDisplaySource: (source: string) => void;
  isBatchFetching: boolean;
  batchFetchProgress: { current: number; total: number };
  handleBatchFetchChapterCovers: () => void;
  fetchChapterMetadataOnHover: (url: string) => Promise<unknown>;
  loadingChapterMetadata: boolean;
  handleComicVineChapterScraping: (volumeNumber: number) => void;
  isProgressiveFetching: boolean;
  progressiveFetchProgress: { completed: number; total: number };
  failedChapterUrls: Map<string, number>;
  retryFailedChapters: () => Promise<void>;

  // Step 4 - ReviewConfidenceStep props
  isImporting: boolean;
  importProgress: number;
  handleImport: () => Promise<void>;
  calculateFieldConfidence: (
    fieldName: string,
    value: unknown,
    sourceProvider?: string,
    currentProvider?: string
  ) => number;
  getConfidenceColor: (confidence: number) => string;

  // Services
  services: {
    sourceManagementService: SourceManagementService;
  };

  logger: typeof logger;
}

/**
 * Renders the current wizard step based on the currentStep index
 */
export function WizardStepRenderer(props: WizardStepRendererProps): React.ReactNode {
  const {
    currentStep,
    provider,
    formData,
    updateFormData,
    selectedSourcesMetadata,
    volumesData,
    volumeDisplaySource,
    chapterDisplaySource,
    mediaGallery,
    setMediaGallery,
    selectedVolumes,
    setSelectedVolumes,
    selectedChapters,
    setSelectedChapters,
    selectedCover,
    setSelectedCover,
    selectedBanner,
    setSelectedBanner,
    selectedGalleryImages,
    setSelectedGalleryImages,
    descriptionEditMode,
    setDescriptionEditMode,
    externalIds,
    setExternalIds,
    externalLinks,
    setExternalLinks,
    chapterMetadataCache,
    allChapterUrls,
    displayVolumes,
    url,
    setUrl,
    additionalProviders,
    setAdditionalProviders,
    selectedSources,
    setSelectedSources,
    isSearchingProviders,
    setIsSearchingProviders,
    isValidatingUrl,
    handleUrlParse,
    handleAdditionalSourceSelection,
    metadataUrl,
    setMetadataUrl,
    handleMetadataUrlParse,
    isValidatingMetadataUrl,
    statusOptions,
    formatOptions,
    getFieldOptions,
    getExternalIdOptions,
    demographicOptions,
    manualVolumeUrl,
    setManualVolumeUrl,
    handleVolumeUrlParse,
    isParsingVolumeUrl,
    parseChapterDetails,
    setParseChapterDetails,
    setVolumeDisplaySource,
    setChapterDisplaySource,
    isBatchFetching,
    batchFetchProgress,
    handleBatchFetchChapterCovers,
    fetchChapterMetadataOnHover,
    loadingChapterMetadata,
    handleComicVineChapterScraping,
    isProgressiveFetching,
    progressiveFetchProgress,
    failedChapterUrls,
    retryFailedChapters,
    isImporting,
    importProgress,
    handleImport,
    calculateFieldConfidence,
    getConfidenceColor,
    services,
    logger,
    // Quick add props
    onQuickAdd,
    isQuickAdding,
    setIsQuickAdding,
    canQuickAdd,
    setCanQuickAdd,
    registerQuickAddHandler,
    onComplete
  } = props;

  const renderStep = (): React.ReactNode => {
    switch (currentStep) {
      case 0:
        return (
          <BasicInfoStep
            title={formData.title ?? ''}
            setTitle={(title) => updateFormData({ title })}
            url={url}
            setUrl={setUrl}
            provider={provider}
            initialData={formData}
            {...(formData.cachedSearchResults !== undefined && { cachedSearchResults: formData.cachedSearchResults })}
            additionalProviders={additionalProviders}
            setAdditionalProviders={setAdditionalProviders}
            selectedSources={selectedSources}
            setSelectedSources={setSelectedSources}
            selectedSourcesMetadata={selectedSourcesMetadata}
            isSearchingProviders={isSearchingProviders}
            setIsSearchingProviders={setIsSearchingProviders}
            isValidatingUrl={isValidatingUrl}
            handleUrlParse={() => { void handleUrlParse(); }}
            handleAdditionalSourceSelection={handleAdditionalSourceSelection}
            logger={logger}
            onQuickAdd={onQuickAdd}
            isQuickAdding={isQuickAdding}
            setIsQuickAdding={setIsQuickAdding}
            canQuickAdd={canQuickAdd}
            setCanQuickAdd={setCanQuickAdd}
            registerQuickAddHandler={registerQuickAddHandler}
            onComplete={onComplete}
          />
        );

      case 1:
        return (
          <MetadataSelectionStep
            metadataUrl={metadataUrl}
            setMetadataUrl={setMetadataUrl}
            handleMetadataUrlParse={() => { void handleMetadataUrlParse(); }}
            isValidatingMetadataUrl={isValidatingMetadataUrl}
            selectedMetadata={formData}
            setSelectedMetadata={(value) => {
              if (typeof value === 'function') {
                updateFormData(value(formData));
              } else {
                updateFormData(value);
              }
            }}
            statusOptions={statusOptions}
            formatOptions={formatOptions}
            getFieldOptions={getFieldOptions}
            getExternalIdOptions={getExternalIdOptions}
            demographicOptions={demographicOptions}
            logger={logger}
            descriptionEditMode={descriptionEditMode as Record<string, boolean>}
            setDescriptionEditMode={setDescriptionEditMode as React.Dispatch<React.SetStateAction<Record<string, boolean>>>}
            selectedSourcesMetadata={selectedSourcesMetadata}
            selectedSources={selectedSources}
            externalIds={externalIds as Record<string, string>}
            setExternalIds={setExternalIds as React.Dispatch<React.SetStateAction<Record<string, string>>>}
            externalLinks={externalLinks}
            setExternalLinks={setExternalLinks}
          />
        );

      case 2:
        return (
          <VolumesChaptersStep
            manualVolumeUrl={manualVolumeUrl}
            setManualVolumeUrl={setManualVolumeUrl}
            handleVolumeUrlParse={(url?: string) => { void handleVolumeUrlParse(url); }}
            isParsingVolumeUrl={isParsingVolumeUrl}
            isScrapingComicVineChapters={false}
            parseChapterDetails={parseChapterDetails}
            setParseChapterDetails={setParseChapterDetails}
            displayVolumes={displayVolumes}
            allChapterUrls={allChapterUrls}
            volumesData={volumesData}
            volumeDisplaySource={volumeDisplaySource}
            setVolumeDisplaySource={setVolumeDisplaySource}
            chapterDisplaySource={chapterDisplaySource}
            setChapterDisplaySource={setChapterDisplaySource}
            provider={provider}
            mediaGallery={mediaGallery}
            setMediaGallery={setMediaGallery as React.Dispatch<React.SetStateAction<unknown>>}
            selectedSourcesMetadata={selectedSourcesMetadata}
            selectedSources={selectedSources}
            selectedVolumes={selectedVolumes}
            setSelectedVolumes={setSelectedVolumes}
            selectedChapters={selectedChapters}
            setSelectedChapters={setSelectedChapters}
            isBatchFetching={isBatchFetching}
            batchFetchProgress={batchFetchProgress}
            handleBatchFetchChapterCovers={() => { void handleBatchFetchChapterCovers(); }}
            chapterMetadataCache={chapterMetadataCache}
            fetchChapterMetadataOnHover={fetchChapterMetadataOnHover}
            loadingChapterMetadata={loadingChapterMetadata}
            handleComicVineChapterScraping={(volumeNumber: number) => { void handleComicVineChapterScraping(volumeNumber); }}
            logger={logger as unknown as { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; debug: (...args: unknown[]) => void }}
            isProgressiveFetching={isProgressiveFetching}
            progressiveFetchProgress={progressiveFetchProgress}
            failedChapterUrls={failedChapterUrls}
            retryFailedChapters={retryFailedChapters}
          />
        );

      case 3: {
        const volumeCoversByProvider = getVolumeCoversByProvider(selectedSourcesMetadata, logger);
        logger.info('[MediaSelection] Volume covers by provider:', Object.keys(volumeCoversByProvider));

        return (
          <MediaSelectionStep
            mediaGallery={mediaGallery}
            setMediaGallery={setMediaGallery}
            selectedCover={selectedCover}
            setSelectedCover={setSelectedCover}
            selectedBanner={selectedBanner}
            setSelectedBanner={setSelectedBanner}
            selectedVolumes={selectedVolumes}
            setSelectedVolumes={setSelectedVolumes}
            selectedChapters={selectedChapters}
            setSelectedChapters={setSelectedChapters}
            selectedGalleryImages={selectedGalleryImages}
            setSelectedGalleryImages={setSelectedGalleryImages}
            volumesData={volumesData}
            displayVolumes={volumesData.volumes}
            allChapterUrls={allChapterUrls}
            chapterMetadataCache={chapterMetadataCache}
            provider={provider}
            volumeDisplaySource={volumeDisplaySource}
            chapterDisplaySource={chapterDisplaySource}
            volumeCoversByProvider={volumeCoversByProvider}
            selectedMetadata={selectedSourcesMetadata[provider] ?? {}}
            validatedInitialData={{}}
            logger={logger}
          />
        );
      }

      case 4: {
        // Debug: Log formData to see what's being passed to Review step
        logger.info('[UniversalImportWizard] Case 4 - Review Step formData:', {
          formDataKeys: Object.keys(formData),
          title: formData.title,
          description: formData.description,
          status: formData.status,
          format: formData.format,
          genres: formData.genres,
          genresLength: formData.genres?.length,
          authors: formData.authors,
          authorsLength: formData.authors?.length,
          fullFormData: formData
        });

        logger.info('[UniversalImportWizard] Available selectedSourcesMetadata:', {
          providers: Object.keys(selectedSourcesMetadata),
          fandomKeys: selectedSourcesMetadata['fandom'] ? Object.keys(selectedSourcesMetadata['fandom']) : [],
          anilistKeys: selectedSourcesMetadata['anilist'] ? Object.keys(selectedSourcesMetadata['anilist']) : []
        });

        const reviewVolumeCoversByProvider = getVolumeCoversByProvider(selectedSourcesMetadata, logger);

        // Get volumes from the selected source for display (same logic as Media step)
        const reviewDisplayVolumes = services.sourceManagementService.getVolumesForSource(
          volumeDisplaySource,
          volumesData as unknown as Record<string, unknown>,
          selectedSourcesMetadata,
          provider
        );

        return (
          <ReviewConfidenceStep
            selectedCover={selectedCover}
            selectedBanner={selectedBanner}
            selectedVolumes={selectedVolumes}
            setSelectedVolumes={setSelectedVolumes}
            displayVolumes={reviewDisplayVolumes}
            volumeDisplaySource={volumeDisplaySource}
            chapterDisplaySource={chapterDisplaySource}
            volumeCoversByProvider={reviewVolumeCoversByProvider}
            selectedGalleryImages={selectedGalleryImages}
            volumesData={volumesData}
            allChapterUrls={allChapterUrls}
            selectedChapters={selectedChapters}
            chapterMetadataCache={chapterMetadataCache}
            selectedMetadata={formData}
            selectedSourcesMetadata={selectedSourcesMetadata}
            externalIds={externalIds}
            externalLinks={externalLinks}
            mediaGallery={mediaGallery}
            provider={provider}
            isImporting={isImporting}
            importProgress={importProgress}
            onImport={handleImport}
            calculateFieldConfidence={calculateFieldConfidence}
            getConfidenceColor={getConfidenceColor}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <Suspense fallback={
      <Stack align="center" justify="center" style={{ minHeight: 400 }}>
        <Text>Loading step...</Text>
        <Progress value={100} animated style={{ width: '50%' }} />
      </Stack>
    }>
      {renderStep()}
    </Suspense>
  );
}
