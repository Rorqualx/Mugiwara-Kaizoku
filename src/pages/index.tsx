/**
 * Home Page - Netflix-style Browse Interface
 *
 * Main landing page displaying manga in horizontal scrolling sections.
 *
 * Architecture (Orchestrator Pattern):
 * - hooks/home/useHomeQueryConfigs.ts - Query cache configurations
 * - utils/home/transformMangaData.ts - Data transformation utilities
 * - components/home/HomeSections.tsx - Main content sections
 * - components/home/GenreSections.tsx - Genre sections with infinite scroll
 * - utils/ssr/getHomeServerSideProps.ts - SSR handler
 *
 * Features:
 * - Continue Reading (authenticated users only)
 * - Recently Released manga with new chapters
 * - Recently Added to library
 * - Trending Now
 * - Most Popular
 * - New Series to Start
 * - Dynamic genre sections with infinite scroll
 *
 * Authentication Flow:
 * 1. Checks for existing users
 * 2. Redirects to setup if no users exist
 * 3. Shows all content (authenticated users see Continue Reading)
 *
 * Performance:
 * - Tiered cache strategies (5-30 minutes)
 * - Lazy loading as user scrolls
 * - Heavy JSONB fields stripped from responses
 * - Efficient pagination with limits
 *
 * Original: 711 lines → Refactored: ~250 lines (65% reduction)
 *
 * @module pages/index
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

import { Box } from '@mantine/core';
import { useRouter } from 'next/router';

import { QuickAddProgressModal } from '@/components/addManga/QuickAddProgressModal';
import type { QuickAddProgress } from '@/components/addManga/services/quickAddService';
import { TrendingBanner, MangaDetailModal, HomeSections, GenreSections } from '@/components/home';
import type { MangaDetailData } from '@/components/home';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { LibraryPickerModal } from '@/components/library/LibraryPickerModal';
import { criticalQueryConfig } from '@/hooks/home/useHomeQueryConfigs';
import { useLibrary } from '@/hooks/useLibrary';
import { useMangaDetailModal } from '@/hooks/useMangaDetailModal';
import { useUIStore } from '@/store/uiSlice';
import { formatAniListDateISO } from '@/utils/home/format-anilist-date';
import { transformMangaData } from '@/utils/home/transformMangaData';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

// Import SSR handler
export { getHomeServerSideProps as getServerSideProps } from '@/utils/ssr/getHomeServerSideProps';

/**
 * Home Page Component
 *
 * Orchestrates the rendering of the Netflix-style home page.
 * Delegates sections to extracted components for better maintainability.
 *
 * @returns React element containing the home page layout
 */
export default function HomePage(): React.ReactElement {
  const router = useRouter();

  // Manga detail modal
  const { opened, anilistId, openModal, closeModal } = useMangaDetailModal();

  // Add-to-library progress state
  const [progressOpened, setProgressOpened] = useState(false);
  const [progressTitle, setProgressTitle] = useState<string | undefined>();
  const [progressCover, setProgressCover] = useState<string | undefined>();
  const [progress, setProgress] = useState<QuickAddProgress>({ stage: 'importing', message: 'Starting...', progress: 0 });
  const [addedMangaId, setAddedMangaId] = useState<number | null>(null);

  // Libraries
  const { refetchLibraries } = useLibrary();

  // tRPC mutations
  const addMutation = trpc.manga.add.useMutation();
  const enrichMutation = trpc.manga.oneClickEnrich.useMutation();

  // Library picker — every add prompts the user for a destination library
  // (or to create one), so a title never lands without an explicit library.
  const [pickerOpened, setPickerOpened] = useState(false);
  const [pendingManga, setPendingManga] = useState<MangaDetailData | null>(null);

  // Deduplication
  const deduplicateManga = useUIStore((state) => state.deduplicateManga);
  const seenMangaIds = useRef(new Set<number>());

  // Reset seen IDs on setting change
  useEffect(() => {
    seenMangaIds.current.clear();
  }, [deduplicateManga]);

  // Callback to track displayed manga from genre sections
  const handleMangaDisplayed = useCallback((mangaIds: number[]) => {
    mangaIds.forEach((id) => seenMangaIds.current.add(id));
  }, []);

  /**
   * Perform the add into the chosen library, then auto-enrich. Called after the
   * user picks a destination library in the picker.
   */
  const doAdd = useCallback(
    async (manga: MangaDetailData, libraryId: number): Promise<void> => {
      const title = manga.title.english ?? manga.title.romaji ?? manga.title.native ?? 'Unknown';

      setProgressTitle(title);
      setProgressCover(manga.coverImage.large ?? manga.coverImage.medium ?? undefined);
      setProgress({ stage: 'importing', message: 'Adding to library...', progress: 30 });
      setAddedMangaId(null);
      setProgressOpened(true);

      try {
        // Step 1: Create / link manga into the chosen library
        const result = await addMutation.mutateAsync({
          title,
          source: 'anilist',
          libraryId,
          mangaId: String(manga.id),
          metadata: {
            cover: manga.coverImage.large ?? manga.coverImage.medium,
            coverLarge: manga.coverImage.extraLarge ?? manga.coverImage.large,
            bannerImage: manga.bannerImage,
            description: manga.description,
            status: manga.status,
            genres: manga.genres,
            synonyms: manga.synonyms,
            averageScore: manga.averageScore,
            popularity: manga.popularity,
            sourceId: String(manga.id),
            authors: manga.author ? [manga.author] : [],
            tags: manga.tags?.map((t: { name?: string }) => t.name).filter((n): n is string => Boolean(n)),
            startDate: formatAniListDateISO(manga.startDate),
            endDate: formatAniListDateISO(manga.endDate),
          },
        });

        const mangaId = result.id;
        setAddedMangaId(mangaId);

        // A linked title already exists in the shared catalog with its metadata —
        // reuse it instead of re-running enrichment (which would re-download the
        // same data and churn the shared title for everyone).
        if (result.linked) {
          setProgress({ stage: 'complete', message: 'Added from existing catalog — metadata reused.', progress: 100 });
          void refetchLibraries();
          return;
        }

        // Step 2: Enrich metadata for a brand-new title (non-blocking for navigation)
        setProgress({ stage: 'fetching_metadata', message: 'Enriching metadata...', progress: 70 });

        try {
          await enrichMutation.mutateAsync({ mangaId, title });
        } catch (enrichError) {
          // Enrichment failure is non-fatal — manga is already in library
          logger.warn('Enrichment failed, manga still added:', enrichError);
        }

        // Step 3: Complete
        setProgress({ stage: 'complete', message: 'Complete!', progress: 100 });
        void refetchLibraries();
      } catch (error) {
        logger.error('Failed to add manga:', error);
        setProgress({
          stage: 'error',
          message: error instanceof Error ? error.message : 'Failed to add manga. Please try again.',
          progress: 0,
        });
      }
    },
    [addMutation, enrichMutation, refetchLibraries]
  );

  /**
   * "Add to Library" from MangaDetailModal — open the library picker so the
   * user explicitly chooses (or creates) the destination library first.
   */
  const handleAdd = useCallback(
    (manga: MangaDetailData) => {
      setPendingManga(manga);
      setPickerOpened(true);
      closeModal();
    },
    [closeModal]
  );

  /** A library was chosen in the picker → run the add. */
  const handlePickerConfirm = useCallback(
    (libraryId: number) => {
      setPickerOpened(false);
      const manga = pendingManga;
      setPendingManga(null);
      if (manga) {
        void doAdd(manga, libraryId);
      }
    },
    [pendingManga, doAdd]
  );

  const handlePickerClose = useCallback(() => {
    setPickerOpened(false);
    setPendingManga(null);
  }, []);

  const pendingTitle = pendingManga
    ? (pendingManga.title.english ?? pendingManga.title.romaji ?? pendingManga.title.native ?? undefined)
    : undefined;

  /**
   * Navigate to the newly added manga page
   */
  const handleViewManga = useCallback(() => {
    if (addedMangaId) {
      setProgressOpened(false);
      void router.push(`/manga/${addedMangaId}?new=1`);
    }
  }, [addedMangaId, router]);

  /**
   * Close progress modal and reset state
   */
  const handleProgressClose = useCallback(() => {
    setProgressOpened(false);
    setAddedMangaId(null);
  }, []);

  // Fetch trending for banner
  const trending = trpc.home.getTrending.useQuery({ limit: 20 }, criticalQueryConfig);

  // AniList reachability - drives the outage banner over the discover hero.
  // Re-checks periodically so the banner clears on its own once AniList is back.
  const anilistStatus = trpc.home.getAnilistStatus.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const anilistMessage =
    anilistStatus.data && !anilistStatus.data.available ? anilistStatus.data.message : null;

  return (
    <ResponsiveMainLayout>
      <Box
        style={{
          width: '100%',
          minHeight: '100vh',
          paddingBottom: '40px',
        }}
      >
        {/* Hero Banner with Trending Manga */}
        <TrendingBanner
          manga={transformMangaData(trending.data, seenMangaIds.current, deduplicateManga)}
          loading={trending.isLoading}
          onMangaClick={openModal}
          statusMessage={anilistMessage}
        />

        {/* Main Content Sections */}
        <HomeSections
          seenMangaIds={seenMangaIds.current}
          deduplicateManga={deduplicateManga}
          onMangaClick={openModal}
        />

        {/* Dynamic Genre Sections with Infinite Scroll */}
        <GenreSections
          seenMangaIds={seenMangaIds.current}
          onMangaDisplayed={handleMangaDisplayed}
          onMangaClick={openModal}
        />
      </Box>

      {/* Manga Detail Modal - Shows rich AniList data */}
      <MangaDetailModal
        opened={opened}
        anilistId={anilistId}
        onClose={closeModal}
        onAdd={handleAdd}
      />

      {/* Library Picker - choose/create a destination library before adding */}
      <LibraryPickerModal
        opened={pickerOpened}
        onClose={handlePickerClose}
        onConfirm={handlePickerConfirm}
        mangaTitle={pendingTitle}
      />

      {/* Add to Library Progress Modal */}
      <QuickAddProgressModal
        opened={progressOpened}
        mangaTitle={progressTitle}
        coverImage={progressCover}
        progress={progress}
        onViewManga={handleViewManga}
        onClose={handleProgressClose}
      />
    </ResponsiveMainLayout>
  );
}
