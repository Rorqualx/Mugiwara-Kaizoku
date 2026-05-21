/**
 * Home Page Data Transformation Utilities
 *
 * Transforms raw API data into MangaRow component format.
 * Handles deduplication and type normalization.
 *
 * Extracted from: src/pages/index.tsx (lines 317-384)
 */

/**
 * Represents manga data transformed for MangaRow component display
 */
export interface TransformedManga {
  id: number;
  title: string;
  anilistId: number | null;
  metadata: {
    cover?: string;
    coverMedium?: string;
    bannerImage?: string;
    status?: string;
    genres?: string[];
    averageScore?: number;
    popularity?: number;
    author?: string | null;
  } | null;
  _count: {
    chapters: number;
  };
  inLibrary?: boolean;
}

/**
 * Transform manga data to match MangaRow expected format
 *
 * The home queries return manga with metadata and chapterCount.
 * MangaRow expects: { id, title, metadata, _count: { chapters } }
 *
 * Optionally applies deduplication to filter out already-seen manga.
 *
 * @param data - Raw data from tRPC query (unknown array)
 * @param seenIds - Set of manga IDs already displayed (for deduplication)
 * @param deduplicate - Whether to filter out already-seen manga
 * @returns Typed array ready for MangaRow component
 */
export function transformMangaData(
  data: unknown[] | undefined,
  seenIds?: Set<number>,
  deduplicate = false,
  libraryAnilistIds?: ReadonlySet<number>
): TransformedManga[] {
  if (!data) return [];

  // Type assertion: we know the structure from tRPC router
  const typedData = data as Array<{
    id: number;
    title: string;
    anilistId: number | null;
    metadata?: unknown;
    chapterCount?: number;
    _count?: { chapters: number };
    libraryStatus?: string;
  }>;

  // Apply deduplication if enabled
  const filteredData =
    deduplicate && seenIds
      ? typedData.filter((manga) => {
          if (seenIds.has(manga.id)) {
            return false; // Skip if already seen
          }
          seenIds.add(manga.id); // Track this manga
          return true; // Include if new
        })
      : typedData;

  return filteredData.map((manga) => {
    const anilistMatch =
      libraryAnilistIds !== undefined &&
      manga.anilistId !== null &&
      libraryAnilistIds.has(manga.anilistId);
    const localMatch = manga.libraryStatus === 'ACTIVE';

    return {
      id: manga.id,
      title: manga.title,
      anilistId: manga.anilistId,
      metadata: manga.metadata as TransformedManga['metadata'],
      _count: {
        chapters: (manga.chapterCount ?? manga._count?.chapters) ?? 0,
      },
      inLibrary: anilistMatch || localMatch,
    };
  });
}
