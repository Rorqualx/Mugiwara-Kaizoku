/**
 * Home Page Main Content Sections
 *
 * Renders the main content sections of the home page:
 * - Continue Reading (authenticated users)
 * - New Chapters This Week
 * - Recently Added to Library
 * - Trending Now
 * - Most Popular
 * - New Series to Start
 * - Top 100 Highest Rated
 * - Light Novels
 * - One Shot Manga
 *
 * Extracted from: src/pages/index.tsx (lines 403-499)
 *
 * @module components/home/HomeSections
 */

import React from 'react';

import { Stack } from '@mantine/core';
import { useSession } from 'next-auth/react';

import {
  criticalQueryConfig,
  dynamicQueryConfig,
  freshQueryConfig,
  quickQueryConfig,
} from '@/hooks/home/useHomeQueryConfigs';
import { transformMangaData } from '@/utils/home/transformMangaData';
import { trpc } from '@/utils/trpc-client';

import { MangaRow } from './MangaRow';

import type { MangaRowCardProps } from './MangaRowCard';

/**
 * Props for HomeSections component
 */
export interface HomeSectionsProps {
  /** Set of manga IDs already displayed (for deduplication) */
  seenMangaIds: Set<number>;
  /** Whether to apply deduplication */
  deduplicateManga: boolean;
  /** Callback when manga is clicked */
  onMangaClick: (anilistId: number) => void;
}

/**
 * Home Sections Component
 *
 * Renders main content sections with horizontal scrolling manga rows.
 * Each section uses different query configurations for optimal caching.
 *
 * @param props - Component props
 * @returns React element containing all main sections
 */
export function HomeSections({
  seenMangaIds,
  deduplicateManga,
  onMangaClick,
}: HomeSectionsProps): React.ReactElement {
  const { data: session } = useSession();

  // Check if local manga exists
  const hasManga = trpc.home.hasManga.useQuery(undefined, quickQueryConfig);

  // AniList IDs of manga already in library — used to mark "In Library" on cards
  const libraryAnilistIdsQuery = trpc.home.getLibraryAnilistIds.useQuery(
    undefined,
    quickQueryConfig
  );
  const libraryAnilistIds = React.useMemo(
    () => new Set<number>(libraryAnilistIdsQuery.data ?? []),
    [libraryAnilistIdsQuery.data]
  );

  // Fetch sections
  const continueReading = trpc.home.getContinueReading.useQuery(undefined, {
    ...quickQueryConfig,
    enabled: !!session?.user,
  });

  const recentlyReleased = trpc.home.getRecentlyReleased.useQuery(
    { limit: 20, days: 7 },
    {
      ...freshQueryConfig,
      enabled: hasManga.data === true,
    }
  );

  const recentlyAdded = trpc.home.getRecentlyAdded.useQuery(
    { limit: 20 },
    {
      ...freshQueryConfig,
      enabled: hasManga.data === true,
    }
  );

  const trending = trpc.home.getTrending.useQuery({ limit: 20 }, criticalQueryConfig);
  const popular = trpc.home.getPopular.useQuery({ limit: 20 }, criticalQueryConfig);
  const top100 = trpc.home.getTop100.useQuery({ limit: 100 }, criticalQueryConfig);

  const newSeries = trpc.home.getNewSeries.useQuery(
    { limit: 20 },
    {
      ...freshQueryConfig,
      enabled: hasManga.data === true,
    }
  );

  const lightNovels = trpc.home.getByFormat.useQuery(
    { format: 'NOVEL', limit: 20 },
    dynamicQueryConfig
  );

  const oneShots = trpc.home.getByFormat.useQuery(
    { format: 'ONE_SHOT', limit: 20 },
    dynamicQueryConfig
  );

  return (
    <Stack gap="xl" style={{ width: '100%' }}>
      {/* Continue Reading - Only for authenticated users */}
      {session?.user && continueReading.data && continueReading.data.items.length > 0 && (
        <MangaRow
          title="Continue Reading"
          manga={transformMangaData(continueReading.data.items, seenMangaIds, deduplicateManga, libraryAnilistIds)}
          loading={continueReading.isLoading}
          emptyMessage="No manga in progress"
          onMangaClick={onMangaClick}
        />
      )}

      {/* Recently Released - Only show if manga exists and has new chapters */}
      {hasManga.data && recentlyReleased.data && recentlyReleased.data.length > 0 && (
        <MangaRow
          title="New Chapters This Week"
          manga={transformMangaData(recentlyReleased.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
          loading={recentlyReleased.isLoading}
          viewAllHref="/manga/recent-chapters"
          emptyMessage="No new chapters this week"
          onMangaClick={onMangaClick}
        />
      )}

      {/* Recently Added - Only show if manga exists in database */}
      {hasManga.data && (
        <MangaRow
          title="Recently Added to Library"
          manga={transformMangaData(recentlyAdded.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
          loading={recentlyAdded.isLoading}
          viewAllHref="/manga/recent"
          emptyMessage="No recently added manga"
          onMangaClick={onMangaClick}
        />
      )}

      {/* Trending Now */}
      <MangaRow
        title="Trending Now"
        manga={transformMangaData(trending.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
        loading={trending.isLoading}
        viewAllHref="/manga/trending"
        emptyMessage="No trending manga"
        onMangaClick={onMangaClick}
      />

      {/* Popular Manga */}
      <MangaRow
        title="Most Popular"
        manga={transformMangaData(popular.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
        loading={popular.isLoading}
        viewAllHref="/manga/popular"
        emptyMessage="No popular manga found"
        onMangaClick={onMangaClick}
      />

      {/* New Series - Only show if manga exists and has new series */}
      {hasManga.data && newSeries.data && newSeries.data.length > 0 && (
        <MangaRow
          title="New Series to Start"
          manga={transformMangaData(newSeries.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
          loading={newSeries.isLoading}
          viewAllHref="/manga/new"
          emptyMessage="No new series found"
          onMangaClick={onMangaClick}
        />
      )}

      {/* Top 100 Highest Rated Manga */}
      <MangaRow
        title="Top 100 Highest Rated"
        manga={transformMangaData(top100.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
        loading={top100.isLoading}
        viewAllHref="/manga/top100"
        emptyMessage="No top manga found"
        onMangaClick={onMangaClick}
      />

      {/* Light Novels */}
      <MangaRow
        title="Light Novels"
        manga={transformMangaData(lightNovels.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
        loading={lightNovels.isLoading}
        viewAllHref="/manga/format/light-novel"
        emptyMessage="No light novels found"
        onMangaClick={onMangaClick}
      />

      {/* One Shot Manga */}
      <MangaRow
        title="One Shot Manga"
        manga={transformMangaData(oneShots.data, seenMangaIds, deduplicateManga, libraryAnilistIds)}
        loading={oneShots.isLoading}
        viewAllHref="/manga/format/one-shot"
        emptyMessage="No one shot manga found"
        onMangaClick={onMangaClick}
      />

      {/* Personalized sections from library metadata */}
      {hasManga.data && <PersonalizedSections onMangaClick={onMangaClick} />}
    </Stack>
  );
}

/** Library-based personalized rows (by author, by publisher) */
function PersonalizedSections({ onMangaClick }: { onMangaClick: (id: number) => void }): React.ReactElement | null {
  const { data } = trpc.browse.getPersonalizedSections.useQuery(undefined, dynamicQueryConfig);

  if (!data) return null;

  const toCards = (items: Array<{ id: number; title: string; Metadata: { cover: string; coverLarge?: string | null; status?: string } | null }>): MangaRowCardProps['manga'][] =>
    items.map(m => ({
      id: m.id,
      title: m.title,
      metadata: {
        cover: m.Metadata?.coverLarge ?? m.Metadata?.cover ?? '/cover-not-found.jpg',
        ...(m.Metadata?.status ? { status: m.Metadata.status } : {}),
      },
      inLibrary: true,
    }));

  return (
    <>
      {data.author && data.author.manga.length > 1 && (
        <MangaRow
          title={`More by ${data.author.name}`}
          manga={toCards(data.author.manga)}
          loading={false}
          viewAllHref={`/author/${encodeURIComponent(data.author.name)}`}
          emptyMessage=""
          onMangaClick={onMangaClick}
        />
      )}
      {data.publisher && data.publisher.manga.length > 1 && (
        <MangaRow
          title={`From ${data.publisher.name}`}
          manga={toCards(data.publisher.manga)}
          loading={false}
          viewAllHref={`/publisher/${encodeURIComponent(data.publisher.name)}`}
          emptyMessage=""
          onMangaClick={onMangaClick}
        />
      )}
    </>
  );
}
