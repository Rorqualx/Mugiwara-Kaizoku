/**
 * Scan Item Detail View Component - Main Orchestrator
 *
 * Three-step import workflow:
 * 1. Search across providers and select primary source
 * 2. Fetch metadata and match local files to chapters/volumes
 * 3. Review matches and import
 *
 * Architecture:
 * - types.ts - Type definitions
 * - utils/ - Utility functions (title cleaning, filename parsing, provider formatting)
 * - hooks/ - Custom hooks (search results, source selection, file matching)
 * - components/ - Step components (SearchStep, MatchFilesStep, ReviewStep)
 *
 * Original file: 1005 lines -> Refactored: ~150 lines (85% reduction)
 *
 * @module components/library/library-manager/components/ScanItemDetailView
 */

import { memo, useState, useCallback, useEffect, useMemo, type JSX } from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  Stepper,
  Divider
} from '@mantine/core';
import {
  IconSearch,
  IconFolder,
  IconFileCheck,
  IconLink
} from '@tabler/icons-react';

import { getQuickAddService } from '@/components/addManga/services/quickAddService';
import type { QuickAddProgress } from '@/components/addManga/services/quickAddService';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client';

import { SearchStep, MatchFilesStep, ReviewStep, SelectedSourceCard } from './components';
import { useFileMatching } from './hooks/useFileMatching';
import { useSearchResults } from './hooks/useSearchResults';
import { useSourceSelection } from './hooks/useSourceSelection';
import { cleanTitleForSearch } from './utils/title-cleaning';

import type { ScanItemDetailViewProps } from './types';

/**
 * Detailed view for a scanned item with search, matching, and import
 */
export const ScanItemDetailView = memo<ScanItemDetailViewProps>(function ScanItemDetailView({
  opened,
  onClose,
  item,
  libraryId,
  onImportComplete
}: ScanItemDetailViewProps): JSX.Element | null {
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<QuickAddProgress | null>(null);

  // Step state (0: Search, 1: Match, 2: Review)
  const [activeStep, setActiveStep] = useState(0);

  // Custom hooks
  const {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    searchLoading,
    resultsByProvider
  } = useSearchResults(opened);

  const {
    selectedSources,
    selectedResult,
    selectedSourcesList,
    selectedSourcesCount,
    handleSelectResult,
    handleSetPrimary,
    handleRemoveSource,
    resetSelection
  } = useSourceSelection();

  const {
    files,
    editingFileIndex,
    matchStats,
    handleUpdateMatch,
    setEditingFileIndex,
    directoryQuery
  } = useFileMatching(item?.path, activeStep, opened);

  // Reset state when item changes
  useEffect(() => {
    if (item?.title) {
      const cleanedTitle = cleanTitleForSearch(item.title);
      setSearchQuery(cleanedTitle);
    }
    resetSelection();
    setActiveStep(0);
    setEditingFileIndex(null);
    setIsImporting(false);
    setImportError(null);
    setImportProgress(null);
  }, [item, resetSelection, setSearchQuery, setEditingFileIndex]);

  // Fetch detailed metadata when on step 1+
  const { data: detailedMetadata, isLoading: metadataLoading } = trpc.search.getMetadata.useQuery(
    {
      provider: selectedResult?.provider ?? 'anilist',
      id: String(selectedResult?.id ?? ''),
      title: selectedResult?.title
    },
    { enabled: activeStep >= 1 && !!selectedResult?.id, refetchOnWindowFocus: false }
  );

  // Expected chapters/volumes from metadata
  const expectedChapters = useMemo(() => {
    if (detailedMetadata && typeof detailedMetadata === 'object' && 'chapters' in detailedMetadata) {
      return (detailedMetadata as { chapters?: number }).chapters;
    }
    return selectedResult?.chapters;
  }, [detailedMetadata, selectedResult?.chapters]);

  const expectedVolumes = useMemo(() => {
    if (detailedMetadata && typeof detailedMetadata === 'object' && 'volumes' in detailedMetadata) {
      return (detailedMetadata as { volumes?: number }).volumes;
    }
    return selectedResult?.volumes;
  }, [detailedMetadata, selectedResult?.volumes]);

  // Handle next step
  const handleNextStep = useCallback(() => {
    const hasSelectedSources = Object.keys(selectedSources).length > 0;
    if (activeStep === 0 && hasSelectedSources) {
      setActiveStep(1);
    } else if (activeStep === 1) {
      setActiveStep(2);
    }
  }, [activeStep, selectedSources]);

  // Handle back step
  const handleBackStep = useCallback(() => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }, [activeStep]);

  // Handle import - uses QuickAddService for full metadata import
  const handleImport = useCallback(async () => {
    if (!selectedResult || !item || Object.keys(selectedSources).length === 0) return;

    setIsImporting(true);
    setImportError(null);
    setImportProgress(null);

    try {
      // Convert selected sources to ExtendedMangaSearchResult format
      const allSearchResults: Record<string, ExtendedMangaSearchResult[]> = {};

      Object.entries(selectedSources).forEach(([provider, result]) => {
        const extendedResult = {
          id: result.id,
          title: result.title,
          alternativeTitles: result.alternativeTitles ?? [],
          coverImage: result.coverImage,
          description: result.description,
          status: result.status,
          year: result.year,
          provider: result.provider,
          chapters: result.chapters,
          volumes: result.volumes,
          cover: result.coverImage ?? '',
          source: result.provider,
          sourceId: String(result.id)
        } as ExtendedMangaSearchResult;
        allSearchResults[provider] = [extendedResult];
      });

      // Get the primary result as ExtendedMangaSearchResult
      const primaryResult = {
        id: selectedResult.id,
        title: selectedResult.title,
        alternativeTitles: selectedResult.alternativeTitles ?? [],
        coverImage: selectedResult.coverImage,
        description: selectedResult.description,
        status: selectedResult.status,
        year: selectedResult.year,
        provider: selectedResult.provider,
        chapters: selectedResult.chapters,
        volumes: selectedResult.volumes,
        cover: selectedResult.coverImage ?? '',
        source: selectedResult.provider,
        sourceId: String(selectedResult.id)
      } as ExtendedMangaSearchResult;

      // Use QuickAddService for full import with preferences
      const quickAddService = await getQuickAddService();
      await quickAddService.quickAddManga(
        primaryResult,
        allSearchResults,
        libraryId,
        {
          onProgress: (progress) => {
            setImportProgress(progress);
          },
          onSuccess: (id) => {
            setIsImporting(false);
            setImportProgress(null);
            onImportComplete(id, selectedResult.title);
            onClose();
          },
          onError: (error) => {
            setIsImporting(false);
            setImportError(error.message);
          }
        }
      );
    } catch (error) {
      setIsImporting(false);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    }
  }, [selectedResult, item, libraryId, selectedSources, onImportComplete, onClose]);

  if (!item) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="1200px"
      title={
        <Group gap="xs">
          <IconFolder size={20} />
          <Text fw={600}>Import: {item.title}</Text>
        </Group>
      }
    >
      <Stack gap="md">
        {/* Stepper */}
        <Stepper active={activeStep} size="sm">
          <Stepper.Step label="Select Source" description="Search & pick metadata" icon={<IconSearch size={18} />} />
          <Stepper.Step label="Match Files" description="Verify chapter mapping" icon={<IconLink size={18} />} />
          <Stepper.Step label="Import" description="Review & confirm" icon={<IconFileCheck size={18} />} />
        </Stepper>

        <Divider />

        {/* Step 0: Search & Select */}
        {activeStep === 0 && (
          <>
            <SearchStep
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              debouncedQuery={debouncedQuery}
              searchLoading={searchLoading}
              resultsByProvider={resultsByProvider}
              selectedSources={selectedSources}
              selectedSourcesCount={selectedSourcesCount}
              handleSelectResult={handleSelectResult}
              onNext={handleNextStep}
              onClose={onClose}
            />

            {/* Selected Sources Preview */}
            {selectedSourcesCount > 0 && (
              <SelectedSourceCard
                selectedSourcesList={selectedSourcesList}
                selectedSourcesCount={selectedSourcesCount}
                handleSetPrimary={handleSetPrimary}
                handleRemoveSource={handleRemoveSource}
              />
            )}
          </>
        )}

        {/* Step 1: Match Files */}
        {activeStep === 1 && selectedSourcesCount > 0 && (
          <MatchFilesStep
            selectedSourcesList={selectedSourcesList}
            selectedSourcesCount={selectedSourcesCount}
            handleSetPrimary={handleSetPrimary}
            handleRemoveSource={handleRemoveSource}
            matchStats={matchStats}
            files={files}
            editingFileIndex={editingFileIndex}
            setEditingFileIndex={setEditingFileIndex}
            handleUpdateMatch={handleUpdateMatch}
            directoryQuery={directoryQuery}
            metadataLoading={metadataLoading}
            onNext={handleNextStep}
            onBack={handleBackStep}
          />
        )}

        {/* Step 2: Review & Import */}
        {activeStep === 2 && selectedSourcesCount > 0 && selectedResult && (
          <ReviewStep
            selectedResult={selectedResult}
            selectedSourcesList={selectedSourcesList}
            selectedSourcesCount={selectedSourcesCount}
            matchStats={matchStats}
            itemPath={item.path}
            expectedChapters={expectedChapters}
            expectedVolumes={expectedVolumes}
            isImporting={isImporting}
            importProgress={importProgress}
            importError={importError}
            onImport={() => { void handleImport(); }}
            onBack={handleBackStep}
          />
        )}
      </Stack>
    </Modal>
  );
});

ScanItemDetailView.displayName = 'ScanItemDetailView';

// Re-export types for backward compatibility
export type { SelectedMetadata } from './types';
