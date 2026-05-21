/**
 * Home Page Genre Sections Component
 *
 * Renders dynamic genre sections with progressive loading and infinite scroll.
 * Filters out blacklisted (empty) genres and provides manual load fallback.
 *
 * Features:
 * - Progressive genre loading (5 at a time)
 * - Infinite scroll with IntersectionObserver
 * - Automatic blacklisting of empty genres
 * - Manual load button fallback
 * - Staggered loading (2.5s delay) to prevent rate limits
 * - Loading progress tracking and statistics
 *
 * Extracted from: src/pages/index.tsx (lines 251-563)
 *
 * @module components/home/GenreSections
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { Center, Loader, Text, Button, Paper, Title, Progress } from '@mantine/core';

import { useGenreBlacklist } from '@/hooks/useGenreBlacklist';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import { GenreSection } from './GenreSection';

interface GenreSectionsProps {
  /**
   * Set of manga IDs that have already been displayed
   * Used for deduplication across genre sections
   */
  seenMangaIds: Set<number>;

  /**
   * Callback when manga are displayed in a genre section
   * Receives array of manga IDs for deduplication tracking
   */
  onMangaDisplayed: (mangaIds: number[]) => void;

  /**
   * Callback when a manga card is clicked
   * Opens the manga detail modal with the given AniList ID
   */
  onMangaClick: (anilistId: number) => void;
}

const BATCH_LOAD_SIZE = 5;
const MAX_LOADING_ATTEMPTS = 5;
const GENRE_STAGGER_MS = 2500; // 2.5 seconds between each genre request

/**
 * GenreSections Component
 *
 * Renders a list of genre sections with progressive loading and infinite scroll.
 * Automatically filters out empty genres (blacklist) and provides manual load fallback.
 *
 * @param props - Component props
 * @returns React element containing genre sections
 *
 * @example
 * ```tsx
 * <GenreSections
 *   seenMangaIds={seenMangaIds}
 *   onMangaDisplayed={handleMangaDisplayed}
 *   onMangaClick={openModal}
 * />
 * ```
 */
export const GenreSections = ({
  seenMangaIds,
  onMangaDisplayed,
  onMangaClick,
}: GenreSectionsProps): React.ReactElement => {
  // State for progressive loading
  const [visibleGenreCount, setVisibleGenreCount] = useState(5);
  const [renderedSectionCount, setRenderedSectionCount] = useState(0);
  const [loadingAttempts, setLoadingAttempts] = useState(0);
  const [lastRenderedCount, setLastRenderedCount] = useState(0);
  const [batchStartTime, setBatchStartTime] = useState<number>(Date.now());
  const [countdown, setCountdown] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Genre blacklist
  const { blacklist, isBlacklisted, addToBlacklist } = useGenreBlacklist();

  // Fetch available genres
  const genres = trpc.home.getAvailableGenres.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });

  // Filter and slice genres - memoize to prevent unnecessary recalculations
  const allGenres = useMemo(() => genres.data ?? [], [genres.data]);
  const filteredGenres = useMemo(
    () => allGenres.filter((genre) => !isBlacklisted(genre)),
    [allGenres, isBlacklisted]
  );
  const visibleGenres = useMemo(
    () => filteredGenres.slice(0, visibleGenreCount),
    [filteredGenres, visibleGenreCount]
  );
  const hasMoreGenres = allGenres.length > 0 && visibleGenreCount < allGenres.length;

  // Calculate total time for current batch (last genre's delay)
  const batchTotalTimeMs = useMemo(() => {
    const lastIndex = visibleGenres.length - 1;
    return lastIndex > 0 ? lastIndex * GENRE_STAGGER_MS : 0;
  }, [visibleGenres.length]);

  // Reset batch start time when visible count changes
  useEffect(() => {
    setBatchStartTime(Date.now());
  }, [visibleGenreCount]);

  // Use ref for batchStartTime to avoid triggering effects
  const batchStartTimeRef = useRef<number>(batchStartTime);
  batchStartTimeRef.current = batchStartTime;

  // Countdown timer - updates every second
  // Use ref for interval to prevent recreation on every render
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (batchTotalTimeMs <= 0) {
      setCountdown(0);
      return;
    }

    const updateCountdown = (): void => {
      const elapsed = Date.now() - batchStartTimeRef.current;
      const remaining = Math.max(0, batchTotalTimeMs - elapsed);
      const newCountdown = Math.ceil(remaining / 1000);
      setCountdown((prev) => {
        // Only update if value actually changed to prevent unnecessary re-renders
        if (prev !== newCountdown) {
          return newCountdown;
        }
        return prev;
      });
    };

    // Initial update
    updateCountdown();

    // Update every second
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [batchTotalTimeMs]);

  // Callbacks
  const handleGenreRendered = useCallback(() => {
    setRenderedSectionCount((prev) => prev + 1);
  }, []);

  const handleGenreEmpty = useCallback(
    (genre: string) => {
      addToBlacklist(genre);
    },
    [addToBlacklist]
  );

  // Log blacklist stats - use ref to avoid effect re-running on every blacklist change
  const blacklistRef = useRef<Set<string>>(blacklist);
  blacklistRef.current = blacklist;

  useEffect(() => {
    if (blacklistRef.current.size > 0) {
      logger.info(`Genre blacklist active: ${blacklistRef.current.size} genres filtered`, {
        blacklisted: Array.from(blacklistRef.current).slice(0, 10), // Show first 10
        total: allGenres.length,
        filtered: filteredGenres.length,
      });
    }
    // Only log when counts change, not when blacklist Set reference changes
  }, [allGenres.length, filteredGenres.length]);

  // Log loading progress
  useEffect(() => {
    if (visibleGenreCount > 20) {
      logger.info(
        `Genre loading progress: ${visibleGenreCount}/${filteredGenres.length} genres loaded, ${renderedSectionCount} sections rendered, ${blacklist.size} filtered`
      );
    }
  }, [visibleGenreCount, filteredGenres.length, renderedSectionCount, blacklist.size]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreGenres) return;

    // Prevent infinite loop - stop loading if we've tried too many times without progress
    if (loadingAttempts >= MAX_LOADING_ATTEMPTS) {
      logger.warn(`Stopped auto-loading genres after ${MAX_LOADING_ATTEMPTS} attempts without progress`);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- entries[0] should exist but defensive programming
        if (entries[0]?.isIntersecting && hasMoreGenres) {
          setVisibleGenreCount((prev) => Math.min(prev + BATCH_LOAD_SIZE, genres.data?.length ?? prev));
          setLoadingAttempts((prev) => prev + 1);

          logger.debug(
            `Loading more genres: ${visibleGenreCount} → ${Math.min(visibleGenreCount + BATCH_LOAD_SIZE, genres.data?.length ?? visibleGenreCount)} (attempt ${loadingAttempts + 1}/${MAX_LOADING_ATTEMPTS})`
          );
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMoreGenres, genres.data?.length, loadingAttempts, visibleGenreCount]);

  // Reset loading attempts when rendered sections increase (we made progress!)
  useEffect(() => {
    // Reset attempts if we've made ANY progress since last check
    if (renderedSectionCount > lastRenderedCount) {
      logger.debug(
        `Progress detected: ${lastRenderedCount} → ${renderedSectionCount} sections, resetting attempts`
      );
      setLoadingAttempts(0);
      setLastRenderedCount(renderedSectionCount);
    }
  }, [renderedSectionCount, lastRenderedCount]);

  if (genres.isLoading) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <>
      {/* Genre Sections */}
      {visibleGenres.length > 0 &&
        visibleGenres.map((genre, index) => (
          <GenreSection
            key={genre}
            genre={genre}
            limit={15}
            seenMangaIds={seenMangaIds}
            onMangaDisplayed={onMangaDisplayed}
            onRendered={handleGenreRendered}
            onEmpty={handleGenreEmpty}
            onMangaClick={onMangaClick}
            // Stagger requests: 2.5s delay per genre to match backend queue timing
            // Backend queue enforces 2s minimum between requests to avoid burst limiting
            delay={index * GENRE_STAGGER_MS}
          />
        ))}

      {/* Infinite Scroll Trigger - Shows loading state during auto-load */}
      {hasMoreGenres && loadingAttempts < MAX_LOADING_ATTEMPTS && (
        <div ref={loadMoreRef} style={{ height: 'auto', margin: '20px 0', padding: '0 20px' }}>
          <Center mb="xs">
            <Loader size="sm" />
            <Text size="xs" c="dimmed" ml="md">
              Loading genres... {countdown > 0 && <strong>({countdown}s remaining)</strong>}
            </Text>
          </Center>
          {countdown > 0 && (
            <Progress
              value={((batchTotalTimeMs / 1000 - countdown) / (batchTotalTimeMs / 1000)) * 100}
              size="xs"
              radius="xl"
              color="blue"
              animated
              style={{ maxWidth: '300px', margin: '0 auto' }}
            />
          )}
          <Text size="xs" c="dimmed" ta="center" mt="xs">
            {visibleGenreCount}/{allGenres.length} queried • {blacklist.size} empty filtered
          </Text>
        </div>
      )}

      {/* Manual load button - Fallback if auto-loading stalls */}
      {hasMoreGenres && (
        <Center mt="xl" mb="xl" style={{ position: 'relative', zIndex: 100 }}>
          <Paper p="xl" radius="md" withBorder style={{ textAlign: 'center', maxWidth: '600px' }}>
            <Title order={4} mb="md">
              Load More Genres
            </Title>
            <Text size="sm" mb="md" c="dimmed">
              Showing {renderedSectionCount} genre sections with manga
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              {visibleGenreCount}/{allGenres.length} genres queried • {blacklist.size} empty genres
              filtered
            </Text>
            {countdown > 0 && (
              <>
                <Text size="sm" c="blue" mb="xs" fw={600}>
                  Next genre loading in {countdown}s
                </Text>
                <Progress
                  value={((batchTotalTimeMs / 1000 - countdown) / (batchTotalTimeMs / 1000)) * 100}
                  size="sm"
                  radius="xl"
                  color="blue"
                  animated
                  mb="md"
                />
              </>
            )}
            <Text size="xs" c="dimmed" mb="lg" fw={500}>
              Genres load every 2.5s to prevent AniList rate limits.
            </Text>
            <Button
              onClick={() => {
                setVisibleGenreCount((prev) => Math.min(prev + BATCH_LOAD_SIZE, allGenres.length));
                setLoadingAttempts(0); // Reset attempts
              }}
              variant="filled"
              size="lg"
              fullWidth
            >
              Load Next {Math.min(BATCH_LOAD_SIZE, allGenres.length - visibleGenreCount)} Genres
            </Button>
          </Paper>
        </Center>
      )}
    </>
  );
}
