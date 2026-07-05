"use client";
/* eslint-disable max-lines-per-function -- Complex banner component with multiple features */

/** Netflix-style hero banner with auto-rotation, keyboard navigation, and hover pause. */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { Box, Text, Group, Badge, ActionIcon, Skeleton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconStar } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

import { getMangaStatusColor } from '@/utils/home/status-color';

/**
 * Manga data structure for banner display
 */
export interface BannerManga {
  id: number;
  title: string;
  anilistId?: number | null;
  metadata?: {
    cover?: string;
    coverMedium?: string;
    bannerImage?: string;
    status?: string;
    genres?: string[];
    averageScore?: number;
    popularity?: number;
    author?: string | null;
  } | null;
}

/**
 * Props for TrendingBanner component
 */
export interface TrendingBannerProps {
  /** Array of manga to display (max 5) */
  manga: BannerManga[];
  /** Loading state */
  loading?: boolean;
  /** Auto-play interval in milliseconds (default: 3000) */
  autoPlayInterval?: number;
  /** Click handler for banner - receives AniList ID */
  onMangaClick?: (anilistId: number) => void;
  /**
   * AniList outage message. When set, a red/white banner is shown across the top
   * of the discover hero (the manga underneath are last-known-good/stale).
   */
  statusMessage?: string | null;
}

/**
 * Red/white outage strip pinned across the top of the discover hero. Shown
 * while AniList is unavailable; the discovery data underneath is served stale.
 */
function AnilistStatusBar({ message }: { message: string }): React.JSX.Element {
  return (
    <Box
      role="status"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        backgroundColor: '#c62828',
        color: '#ffffff',
        padding: '6px 16px',
        textAlign: 'center',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.3,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
      }}
    >
      {message}
    </Box>
  );
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Returns a new shuffled array without modifying the original
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    const swapItem = shuffled[j];
    if (temp !== undefined && swapItem !== undefined) {
      shuffled[i] = swapItem;
      shuffled[j] = temp;
    }
  }
  return shuffled;
}

/**
 * Get banner image URL with fallback
 * Prefers bannerImage (landscape) over cover (portrait) for hero banners
 */
function getCoverUrl(manga: BannerManga): string {
  const raw =
    manga.metadata?.bannerImage ??
    manga.metadata?.cover ??
    manga.metadata?.coverMedium ??
    null;
  if (!raw) return `/api/local-cover/${manga.id}`;
  return raw;
}

/** Rolling banner of trending manga with auto-rotation, shuffle-on-mount, and click-to-detail. */
export function TrendingBanner({
  manga,
  loading = false,
  autoPlayInterval = 3000,
  onMangaClick,
  statusMessage,
}: TrendingBannerProps): React.JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Track previously seen manga IDs to detect when we have new content
  const prevMangaIdsRef = useRef<string>('');
  // Store the shuffled manga array in a ref to prevent re-shuffling
  const shuffledMangaRef = useRef<BannerManga[]>([]);
  // Track if we've initialized with valid data
  const hasInitializedRef = useRef(false);

  // Create a stable ID string from manga array to detect actual content changes
  const mangaIds = useMemo(
    () =>
      manga
        .filter((m) => m.metadata?.bannerImage)
        .map((m) => m.id)
        .sort((a, b) => a - b)
        .join(','),
    [manga]
  );

  // Only shuffle once when valid data arrives or when manga content actually changes
  const displayManga = useMemo(() => {
    const mangaWithBanners = manga.filter((m) => m.metadata?.bannerImage);

    // If no manga with banners, return empty
    if (mangaWithBanners.length === 0) {
      return [];
    }

    // If this is first initialization or manga content changed, shuffle
    if (!hasInitializedRef.current || prevMangaIdsRef.current !== mangaIds) {
      shuffledMangaRef.current = shuffleArray(mangaWithBanners).slice(0, 5);
      prevMangaIdsRef.current = mangaIds;
      hasInitializedRef.current = true;
    }

    return shuffledMangaRef.current;
  }, [manga, mangaIds]);

  // Reset currentIndex when displayManga length changes to prevent out-of-bounds
  useEffect(() => {
    if (currentIndex >= displayManga.length && displayManga.length > 0) {
      setCurrentIndex(0);
    }
  }, [displayManga.length, currentIndex]);

  const currentManga = displayManga[currentIndex];

  /**
   * Navigate to next manga
   */
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % displayManga.length);
  }, [displayManga.length]);

  /**
   * Navigate to previous manga
   */
  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + displayManga.length) % displayManga.length);
  }, [displayManga.length]);

  /**
   * Auto-rotation effect
   */
  useEffect(() => {
    if (isPaused || displayManga.length <= 1 || loading) return;

    const intervalId = setInterval(nextSlide, autoPlayInterval);

    return () => clearInterval(intervalId);
  }, [isPaused, displayManga.length, loading, autoPlayInterval, nextSlide]);

  const bannerRef = useRef<HTMLDivElement>(null);

  const handleBannerKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    },
    [nextSlide, prevSlide]
  );

  // Loading skeleton
  if (loading) {
    return (
      <Box
        style={{
          width: '100%',
          height: '500px',
          position: 'relative',
        }}
      >
        <Skeleton height="100%" width="100%" />
      </Box>
    );
  }

  // No manga available - fallback to simple banner
  if (!currentManga || displayManga.length === 0) {
    return (
      <Box
        style={{
          position: 'relative',
          width: '100%',
          height: '300px',
          padding: '60px 20px 40px',
          background: 'linear-gradient(180deg, rgba(37, 38, 43, 0) 0%, rgba(37, 38, 43, 1) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {statusMessage && <AnilistStatusBar message={statusMessage} />}
        <Text size="xl" fw={700} c="white">
          Discover Manga
        </Text>
      </Box>
    );
  }

  const coverUrl = getCoverUrl(currentManga);
  const genres = currentManga.metadata?.genres?.slice(0, 3) ?? [];
  const status = currentManga.metadata?.status;
  const score = currentManga.metadata?.averageScore;
  const statusColor = getMangaStatusColor(status);

  return (
    <>
      <Box
        ref={bannerRef}
        tabIndex={0}
        onKeyDown={handleBannerKeyDown}
        style={{
          width: '100%',
          height: 'clamp(300px, 50vw, 500px)',
          position: 'relative',
          overflow: 'hidden',
          cursor: onMangaClick && currentManga.anilistId ? 'pointer' : 'default',
          outline: 'none',
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={() => {
          if (currentManga.anilistId && onMangaClick) {
            onMangaClick(currentManga.anilistId);
          }
        }}
      >
      {/* AniList outage strip (data below is last-known-good) */}
      {statusMessage && <AnilistStatusBar message={statusMessage} />}

      {/* Background Image with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </AnimatePresence>

      {/* Gradient Overlay */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />

      {/* Content */}
      <Box
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '40px',
          right: '40px',
          zIndex: 2,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Title */}
            <Text
              size="2.5rem"
              fw={700}
              c="white"
              style={{
                marginBottom: '8px',
                textShadow: '2px 2px 8px rgba(0, 0, 0, 0.8)',
                lineHeight: 1.2,
              }}
            >
              {currentManga.title}
            </Text>

            {/* Author name below title */}
            {currentManga.metadata?.author && (
              <Text
                size="md"
                c="dimmed"
                mb="md"
                style={{
                  textShadow: '1px 1px 4px rgba(0, 0, 0, 0.8)',
                }}
              >
                {currentManga.metadata.author}
              </Text>
            )}

            {/* Badges */}
            <Group gap="xs" mb="md">
              {/* Score */}
              {score && (
                <Badge
                  size="lg"
                  variant="filled"
                  color="yellow"
                  leftSection={<IconStar size={14} />}
                  style={{
                    backgroundColor: 'rgba(255, 193, 7, 0.9)',
                    color: '#000',
                  }}
                >
                  {score / 10}/10
                </Badge>
              )}

              {/* Status */}
              {status && (
                <Badge
                  size="lg"
                  variant="filled"
                  color={statusColor}
                  style={{
                    backgroundColor: `var(--mantine-color-${statusColor}-9)`,
                  }}
                >
                  {status}
                </Badge>
              )}

              {/* Genres */}
              {genres.map((genre) => (
                <Badge
                  key={genre}
                  size="lg"
                  variant="outline"
                  color="white"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                  }}
                >
                  {genre}
                </Badge>
              ))}
            </Group>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Navigation Arrows (Always visible, transparent) */}
      {displayManga.length > 1 && (
        <>
          <ActionIcon
            size="xl"
            variant="filled"
            color="dark"
            radius="xl"
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
          >
            <IconChevronLeft size={24} color="white" />
          </ActionIcon>

          <ActionIcon
            size="xl"
            variant="filled"
            color="dark"
            radius="xl"
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 3,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
          >
            <IconChevronRight size={24} color="white" />
          </ActionIcon>
        </>
      )}

      {/* Indicator Dots */}
      {displayManga.length > 1 && (
        <Group
          gap="xs"
          justify="center"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
          }}
        >
          {displayManga.map((_, index) => (
            <Box
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              style={{
                width: index === currentIndex ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor:
                  index === currentIndex
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Group>
      )}

      </Box>
    </>
  );
}
