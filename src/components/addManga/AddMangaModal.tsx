import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";

import {
  Modal, Select, Group, TextInput, Tabs,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconBook, IconBooks, IconSearch } from '@tabler/icons-react';

import { ComicbookSearchPanel } from '@/components/comicbook/ComicbookSearchPanel';
import { useComicvineConfig } from '@/hooks/useComicvineConfig';
import { useLibrary } from '@/hooks/useLibrary';
import { useNavigation } from '@/hooks/useNavigation';
import { useRealTime } from '@/providers/RealTimeProvider';
import { CHANNEL_PATTERNS } from '@/types/api/v1/websocket';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import type { ID } from '@/types/search.types';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import ErrorBoundary from "../common/UnifiedErrorBoundary";

import { anilistToExtended, type AniListSearchResult } from './anilist-helpers';
import { AniListResultsGrid } from './AniListResultsGrid';
import { QuickAddProgressModal } from './QuickAddProgressModal';

import type { QuickAddProgress } from './services/quickAddService';

/** Shape of metadata refresh progress data from WebSocket events */
interface MetadataRefreshProgressData {
  mangaId: number;
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  message: string;
  error?: string;
}

/**
 * Mode for initial auto-selection when initialAnilistId is provided
 */
export type AddMangaInitialMode = 'quickAdd' | 'wizard';

/**
 * Props for the AddMangaModal component
 */
export interface AddMangaModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** ID of the library to add manga to */
  libraryId: ID;
  /** Callback to execute after manga is added, receives the new manga ID */
  onComplete?: (mangaId: number) => void;
  /** Optional AniList ID to pre-fill wizard (skips search step) */
  initialAnilistId?: number;
  /** Mode for initial auto-selection: 'quickAdd' triggers quick add, 'wizard' opens wizard (default) */
  initialMode?: AddMangaInitialMode;
}

/**
 * Add Manga Modal Component
 *
 * Shows AniList search interface. On result click, triggers add+enrich pipeline.
 * After successful import, navigates to the manga detail page.
 */
export function AddMangaModal({
  opened,
  onClose,
  libraryId,
  onComplete,
  initialAnilistId,
}: AddMangaModalProps): React.ReactElement {
  const { navigateTo } = useNavigation();

  // Get all available libraries
  const { libraries } = useLibrary();

  // Feature flag — hides the Comicbook tab when ComicVine comicbook tracking is off
  const { config: cvConfig } = useComicvineConfig();
  const comicbookTrackingEnabled = cvConfig.comicbookTrackingEnabled;

  const [isNavigating, setIsNavigating] = useState(false);

  // Tabs: "manga" (AniList search) or "comicbook" (ComicVine search). Reset
  // to "manga" whenever the modal closes so reopening starts in the default
  // mode regardless of the prior state.
  const [activeTab, setActiveTab] = useState<'manga' | 'comicbook'>('manga');

  // State for selected library (when multiple libraries exist)
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);

  // State for quick-add flow
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddProgress, setQuickAddProgress] = useState<QuickAddProgress>({
    stage: 'loading_preferences',
    message: 'Starting quick add...',
    progress: 0
  });
  const [quickAddManga, setQuickAddManga] = useState<ExtendedMangaSearchResult | null>(null);

  // AniList search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 400);

  // Search mutation
  const searchMutation = trpc.anilist.searchManga.useMutation();

  // Convert prop libraryId to string for comparison
  const propLibraryIdString = toStringId(libraryId);

  // Initialize selected library from prop when modal opens
  useEffect(() => {
    if (opened && !selectedLibraryId) {
      setSelectedLibraryId(propLibraryIdString);
    }
    // Reset when modal closes
    if (!opened) {
      setSelectedLibraryId(null);
      setSearchQuery('');
      setActiveTab('manga');
      searchMutation.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchMutation.reset is stable
  }, [opened, propLibraryIdString, selectedLibraryId]);

  // Determine the active library ID (user selection or prop fallback)
  const activeLibraryId = selectedLibraryId ?? propLibraryIdString;
  const numericLibraryId = toNumberId(activeLibraryId);

  // Check if we should show library selector (multiple libraries)
  const showLibrarySelector = libraries.length > 1;

  // Convert libraries to Select data format
  const librarySelectData = useMemo(() =>
    libraries.map(lib => ({
      value: toStringId(lib.id),
      label: lib.name || 'Unnamed Library'
    })),
    [libraries]
  );

  // tRPC mutations for add+enrich pipeline
  const addMangaMutation = trpc.manga.add.useMutation();
  const enrichMutation = trpc.manga.oneClickEnrich.useMutation();

  // State for completed manga (for "View Manga" button)
  const [completedMangaId, setCompletedMangaId] = useState<number | null>(null);

  // WebSocket subscription for real-time enrichment progress
  const { subscribe } = useRealTime();
  const quickAddProgressRef = useRef(quickAddProgress);
  quickAddProgressRef.current = quickAddProgress;

  const handleWsProgress = useCallback((event: WebSocketEvent) => {
    const data = event.data as MetadataRefreshProgressData;
    // Don't override completion/error states set by the mutation handler
    if (quickAddProgressRef.current.stage === 'complete' || quickAddProgressRef.current.stage === 'error') return;
    if (data.phase === 'completed' || data.phase === 'error') return;

    const percent = Math.round(30 + (data.phaseIndex / data.totalPhases) * 65);
    setQuickAddProgress({
      stage: 'fetching_metadata',
      progress: Math.min(percent, 95),
      message: data.message,
    });
  }, []);

  useEffect(() => {
    if (!completedMangaId || !isQuickAdding) return;

    const channel = CHANNEL_PATTERNS.METADATA_REFRESH_PROGRESS(completedMangaId);
    const unsubscribe = subscribe(channel, handleWsProgress);
    return unsubscribe;
  }, [completedMangaId, isQuickAdding, subscribe, handleWsProgress]);

  // Fetch AniList data if initialAnilistId is provided (using mutation to avoid caching issues)
  const { mutate: fetchMangaDetails } = trpc.anilist.getMangaDetails.useMutation();
  const [initialAniListData, setInitialAniListData] = React.useState<Awaited<ReturnType<ReturnType<typeof trpc.anilist.getMangaDetails.useMutation>['mutateAsync']>> | null>(null);

  // Track which initialAnilistId we've already fetched to prevent duplicate calls
  const lastFetchedInitialIdRef = React.useRef<number | null>(null);

  // Track whether we've already auto-selected for this initialAnilistId
  const hasAutoSelectedRef = React.useRef(false);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchMutation.mutate({ query: debouncedQuery });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- searchMutation.mutate is stable
  }, [debouncedQuery]);

  /**
   * Trigger mutation to fetch AniList data when initialAnilistId changes
   */
  useEffect(() => {
    if (initialAnilistId && opened && lastFetchedInitialIdRef.current !== initialAnilistId) {
      lastFetchedInitialIdRef.current = initialAnilistId;

      setInitialAniListData(null);
      fetchMangaDetails(
        { anilistId: initialAnilistId },
        {
          onSuccess: (data) => {
            setInitialAniListData(data);
          },
          onError: (error) => {
            logger.error('[AddMangaModal] Failed to fetch AniList data:', error);
            setInitialAniListData(null);
            lastFetchedInitialIdRef.current = null;
          },
        }
      );
    }

    if (!opened) {
      lastFetchedInitialIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchMangaDetails is stable, only react to opened/initialAnilistId changes
  }, [initialAnilistId, opened]);

  /**
   * Auto-select AniList data when initialAnilistId is provided
   */
  useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (isQuickAdding) return;

    if (initialAnilistId && initialAniListData && typeof initialAniListData !== 'string' && opened) {
      hasAutoSelectedRef.current = true;
      void handleAddToLibrary(anilistToExtended(initialAniListData));
    }

    if (!opened) {
      hasAutoSelectedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleAddToLibrary changes on every render
  }, [initialAnilistId, initialAniListData, opened, isQuickAdding]);

  /**
   * Handle successful manga import
   */
  const handleImportComplete = (mangaId: number): void => {
    setIsNavigating(true);
    void navigateTo(`/manga/${mangaId}?new=1`);
    onClose();

    if (onComplete) {
      onComplete(mangaId);
    }
  };

  /**
   * Handle modal close - resets all state
   */
  const handleModalClose = (): void => {
    setIsNavigating(false);
    setIsQuickAdding(false);
    setQuickAddManga(null);
    setCompletedMangaId(null);
    setSearchQuery('');
    searchMutation.reset();
    onClose();
  };

  /**
   * Add manga to library and auto-enrich via oneClickEnrich pipeline.
   */
  const handleAddToLibrary = async (result: ExtendedMangaSearchResult): Promise<void> => {
    const title = result.title;

    setIsQuickAdding(true);
    setQuickAddManga(result);
    setCompletedMangaId(null);
    setQuickAddProgress({ stage: 'importing', message: 'Adding to library...', progress: 30 });

    try {
      const manga = await addMangaMutation.mutateAsync({
        title,
        source: result.provider,
        libraryId: numericLibraryId,
        mangaId: result.anilistId ? String(result.anilistId) : String(result.id),
        metadata: {
          cover: result.coverImage ?? result.cover,
          description: result.description,
          status: result.status,
          genres: result.genres,
          sourceId: result.anilistId ? String(result.anilistId) : String(result.id),
        },
      });

      setCompletedMangaId(manga.id);

      // Linked title already exists in the shared catalog with metadata — reuse
      // it instead of re-running enrichment (which re-downloads the same data
      // and churns the shared title for every user).
      if (manga.linked) {
        setQuickAddProgress({ stage: 'complete', message: 'Added from existing catalog — metadata reused.', progress: 100 });
        return;
      }

      setQuickAddProgress({ stage: 'fetching_metadata', message: 'Fetching metadata from providers...', progress: 35 });

      try {
        await enrichMutation.mutateAsync({ mangaId: manga.id, title });
      } catch (enrichError) {
        logger.warn('Enrichment failed, manga still added:', enrichError);
      }

      setQuickAddProgress({ stage: 'complete', message: 'Complete!', progress: 100 });
    } catch (error) {
      logger.error('Failed to add manga:', error);
      setQuickAddProgress({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Failed to add manga. Please try again.',
        progress: 0,
      });
    }
  };

  const handleViewAddedManga = (): void => {
    if (completedMangaId) {
      handleImportComplete(completedMangaId);
    }
  };

  const handleQuickAddClose = (): void => {
    setIsQuickAdding(false);
    setQuickAddManga(null);
    setCompletedMangaId(null);
  };

  const handleResultSelect = (result: AniListSearchResult): void => {
    void handleAddToLibrary(anilistToExtended(result));
  };

  const results = searchMutation.data?.results ?? [];
  const isSearching = searchMutation.isPending;
  const hasSearched = searchMutation.data !== undefined || searchMutation.isError;

  return (
    <ErrorBoundary>
      <Modal
        opened={opened && !isNavigating}
        onClose={() => { void handleModalClose(); }}
        title="Add to Library"
        size="xl"
        padding="lg"
        centered
      >
        {/* Library selector - shown when multiple libraries exist */}
        {showLibrarySelector && (
          <Group mb="md" align="flex-end">
            <Select
              label="Add to Library"
              placeholder="Select library"
              data={librarySelectData}
              value={activeLibraryId}
              onChange={(value) => value && setSelectedLibraryId(value)}
              leftSection={<IconBooks size={16} />}
              style={{ flex: 1, maxWidth: 300 }}
            />
          </Group>
        )}

        <Tabs value={activeTab} onChange={(v) => setActiveTab((v as 'manga' | 'comicbook' | null) ?? 'manga')}>
          <Tabs.List>
            <Tabs.Tab value="manga" leftSection={<IconBooks size={14} />}>Manga</Tabs.Tab>
            {comicbookTrackingEnabled && (
              <Tabs.Tab value="comicbook" leftSection={<IconBook size={14} />}>Comicbook</Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="manga" pt="md">
            <TextInput
              placeholder="Search AniList..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              autoFocus
              mb="md"
            />
            <AniListResultsGrid
              isSearching={isSearching}
              results={results}
              hasSearched={hasSearched}
              debouncedQuery={debouncedQuery}
              isError={searchMutation.isError}
              onSelect={handleResultSelect}
            />
          </Tabs.Panel>

          {comicbookTrackingEnabled && (
            <Tabs.Panel value="comicbook" pt="md">
              <ComicbookSearchPanel
                libraryId={numericLibraryId}
                onComplete={handleImportComplete}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      </Modal>

      {/* Quick Add Progress Modal */}
      <QuickAddProgressModal
        opened={isQuickAdding}
        mangaTitle={quickAddManga?.title ?? 'Unknown Manga'}
        coverImage={quickAddManga?.coverImage ?? quickAddManga?.cover}
        progress={quickAddProgress}
        onViewManga={handleViewAddedManga}
        onClose={() => { void handleQuickAddClose(); }}
      />
    </ErrorBoundary>
  );
}

export { useAddMangaModal } from './modalHooks';
