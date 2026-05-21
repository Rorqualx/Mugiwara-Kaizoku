/**
 * GenreSection Component
 *
 * Self-contained component that manages its own genre query independently.
 * Each instance handles its own data fetching, loading state, and rendering.
 *
 * Key Features:
 * - Independent query management (complies with React rules of hooks)
 * - Lazy loading (only queries when mounted)
 * - Cached queries (5-minute stale time)
 * - Error handling with empty state
 *
 * @module components/home/GenreSection
 */

import React, { useEffect, useMemo } from 'react';

import { useUIStore } from '@/store/uiSlice';
import { trpc } from '@/utils/trpc-client';

import { MangaRow } from './MangaRow';

/**
 * Props for the GenreSection component
 */
export interface GenreSectionProps {
  /** Genre or tag name to display */
  genre: string;
  /** Number of manga to fetch (default: 15) */
  limit?: number;
  /** Set of manga IDs that have already been displayed (for deduplication) */
  seenMangaIds?: Set<number>;
  /** Callback when manga are displayed (for tracking in parent) */
  onMangaDisplayed?: (mangaIds: number[]) => void;
  /** Callback when this section renders with content (for tracking progress) */
  onRendered?: () => void;
  /** Callback when this genre has no manga (for blacklisting) */
  onEmpty?: (genre: string) => void;
  /** Delay in milliseconds before fetching data (for staggered loading) */
  delay?: number;
  /** Callback when a manga card is clicked (opens detail modal) */
  onMangaClick?: (anilistId: number) => void;
}

/**
 * Transform manga data to match MangaRow expected format
 * The home queries return manga with metadata and chapterCount
 * MangaRow expects: { id, title, metadata, _count: { chapters } }
 *
 * Optionally applies deduplication to filter out already-seen manga.
 * PURE FUNCTION - does not mutate seenMangaIds (mutation happens in useEffect).
 */
function transformMangaData(
  data:
    | Array<{
        id: number;
        title: string;
        anilistId: number | null; // Required for manga detail modal click handlers
        metadata?: unknown;
        chapterCount?: number;
        _count?: { chapters: number };
      }>
    | undefined,
  deduplicateManga: boolean,
  seenMangaIds?: Set<number>,
  libraryAnilistIds?: ReadonlySet<number>
): Array<{
  id: number;
  title: string;
  anilistId: number | null;
  metadata: {
    cover?: string;
    coverMedium?: string;
    status?: string;
  } | null;
  _count: {
    chapters: number;
  };
  inLibrary: boolean;
}> {
  if (!data) return [];

  // Apply deduplication if enabled and seenMangaIds provided
  // NOTE: This is read-only - we don't mutate seenMangaIds here (that happens in useEffect)
  const filteredData = deduplicateManga && seenMangaIds
    ? data.filter((manga) => !seenMangaIds.has(manga.id))
    : data;

  return filteredData.map((manga) => ({
    id: manga.id,
    title: manga.title,
    anilistId: manga.anilistId, // Pass through for detail modal
    metadata: manga.metadata as {
      cover?: string;
      coverMedium?: string;
      status?: string;
    } | null,
    _count: {
      chapters: manga.chapterCount ?? manga._count?.chapters ?? 0,
    },
    inLibrary:
      libraryAnilistIds !== undefined &&
      manga.anilistId !== null &&
      libraryAnilistIds.has(manga.anilistId),
  }));
}

/**
 * GenreSection Component
 *
 * Displays a horizontal scrolling section of manga for a specific genre/tag.
 * Each section manages its own tRPC query independently.
 *
 * @param props - Component properties
 * @param props.genre - Genre or tag name to display
 * @param props.limit - Number of manga to fetch (default: 15)
 * @param props.seenMangaIds - Set of manga IDs already displayed (for deduplication)
 * @param props.onMangaDisplayed - Callback when manga are displayed
 * @param props.onRendered - Callback when this section renders with content
 * @param props.onEmpty - Callback when this genre has no manga
 * @returns Rendered genre section or null if no data
 *
 * @example
 * ```tsx
 * <GenreSection genre="Action" />
 * <GenreSection genre="Isekai" limit={20} seenMangaIds={seenIds} onMangaDisplayed={handleDisplayed} onRendered={handleRendered} onEmpty={handleEmpty} />
 * ```
 */
export const GenreSection = React.memo(function GenreSection({
  genre,
  limit = 15,
  seenMangaIds,
  onMangaDisplayed,
  onRendered,
  onEmpty,
  delay = 0,
  onMangaClick
}: GenreSectionProps): React.ReactElement | null {
  // Get deduplication setting from UI store
  const deduplicateManga = useUIStore(state => state.deduplicateManga);

  // Stagger query execution to avoid rate limits
  const [enableQuery, setEnableQuery] = React.useState(delay === 0);

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => {
        setEnableQuery(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [delay]);

  // Query configuration for caching (dynamic content - 20 minutes)
  // Increased from 5 to 20 minutes to stagger cache expiration and reduce AniList API load
  const queryConfig = {
    staleTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: false,
    enabled: enableQuery, // Only query after delay
  };

  // Independent query for this genre
  const genreQuery = trpc.home.getByGenre.useQuery(
    { genre, limit },
    queryConfig
  );

  // AniList IDs already in library (TanStack Query dedupes across instances)
  const libraryAnilistIdsQuery = trpc.home.getLibraryAnilistIds.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const libraryAnilistIds = useMemo(
    () => new Set<number>(libraryAnilistIdsQuery.data ?? []),
    [libraryAnilistIdsQuery.data]
  );

  // Transform data with deduplication (memoized to prevent recalculation on every render)
  const transformedData = useMemo(
    () => transformMangaData(genreQuery.data, deduplicateManga, seenMangaIds, libraryAnilistIds),
    [genreQuery.data, deduplicateManga, seenMangaIds, libraryAnilistIds]
  );

  // Notify parent of displayed manga IDs and that we rendered (only when data actually changes)
  useEffect(() => {
    // Only notify if we have data and the callback exists
    if (genreQuery.data && genreQuery.data.length > 0 && transformedData.length > 0) {
      const displayedIds = transformedData.map(manga => manga.id);

      // Add displayed manga to seenMangaIds FIRST (if deduplication enabled)
      // This prevents other sections from duplicating these manga
      if (deduplicateManga && seenMangaIds) {
        displayedIds.forEach(id => seenMangaIds.add(id));
      }

      // Notify parent of displayed manga IDs (for deduplication tracking)
      if (onMangaDisplayed) {
        onMangaDisplayed(displayedIds);
      }

      // Notify parent that this section rendered with content (for progress tracking)
      if (onRendered) {
        onRendered();
      }
    }

    // Notify parent if this genre returned no data (for blacklisting)
    if (!genreQuery.isLoading && genreQuery.data?.length === 0 && onEmpty) {
      onEmpty(genre);
    }
  }, [genreQuery.data, genreQuery.isLoading, transformedData, deduplicateManga, seenMangaIds, onMangaDisplayed, onRendered, onEmpty, genre]);

  // Don't render if no data after deduplication (keep loading state to ensure page height increases)
  if (transformedData.length === 0) {
    return null;
  }

  return (
    <MangaRow
      title={`${genre} Manga`}
      manga={transformedData}
      loading={genreQuery.isLoading}
      viewAllHref={`/manga/genre/${encodeURIComponent(genre)}`}
      emptyMessage={`No ${genre.toLowerCase()} manga found`}
      {...(onMangaClick && { onMangaClick })}
    />
  );
});
