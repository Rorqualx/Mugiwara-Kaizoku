/**
 * Manga Adapter Class
 *
 * Provides conversion functions between Prisma entities, external APIs, and view models.
 * This is the central hub for all manga type transformations.
 */

import {
  MangaPublicationStatus,
  MangaLibraryStatus
} from '@prisma/client';

import type {
  ExternalAnilistManga,
  ExternalSuwayomiManga,
  ExternalMALManga
} from './external';
import type {
  MangaEntity,
  MangaCreateInput,
  MangaUpdateInput,
  MangaWithChapters,
  MangaComplete,
  MangaListView,
  MangaDetailView,
  MangaCardView,
  MangaOptionView,
  MangaFormData,
  MangaSearchResult
} from './index';
import type { Prisma } from '@prisma/client';


// Helper functions for safe type handling
// function isRecord(value: unknown): value is Record<string, unknown> {
//   return typeof value === 'object' && value !== null;
// }

export class MangaAdapter {
  // ============ External to Prisma Conversions ============

  /**
   * Convert Anilist manga data to Prisma create input
   */
  static fromAnilist(data: ExternalAnilistManga): Partial<MangaCreateInput> {
    const title = data["title"].english || data["title"].romaji || data["title"].native;
    const alternativeTitles = [
      data["title"].romaji,
      data["title"].english,
      data["title"].native,
      data["title"].userPreferred,
      ...(data.synonyms ?? [])
    ].filter((t): t is string => Boolean(t) && t !== title);

    // MangaCreateInput only accepts fields that exist in Prisma schema
    // Most metadata should be stored in providerMetadata JSON field
    const summary = data["description"]?.replace(/<[^>]*>/g, '');
    return {
      title,
      source: 'anilist',
      sourceId: String(data["id"]),
      ...(summary ? { summary } : {}),
      publicationStatus: this.mapAnilistStatus(data["status"]),
      // Store all provider data in JSON fields
      providerMetadata: {
        alternativeTitles,
        coverUrl: data.coverImage?.large ?? data.coverImage?.medium,
        coverImage: data.coverImage?.medium ?? data.coverImage?.large,
        bannerUrl: data.bannerImage,
        genres: data["genres"],
        tags: data["tags"]?.map(t => t["name"]),
        score: data.meanScore ? data.meanScore / 10 : undefined,
        popularity: data.popularity,
        favorites: data.favourites,
        releaseYear: data.startDate?.year,
        authors: data.staff?.nodes
          ?.filter(s => s.role?.toLowerCase().includes('story'))
          .map(s => ({ name: s["name"].full, role: s.role ?? 'Story' })),
        artists: data.staff?.nodes
          ?.filter(s => s.role?.toLowerCase().includes('art'))
          .map(s => ({ name: s["name"].full, role: s.role ?? 'Art' }))
      },
      rawProviderData: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue
    };
  }

  /**
   * Convert Suwayomi manga data to Prisma create input
   */
  static fromSuwayomi(data: ExternalSuwayomiManga): Partial<MangaCreateInput> {
    const summary = data["description"];
    return {
      title: data["title"],
      source: data["source"] || 'suwayomi',
      sourceId: data.sourceId,
      ...(summary ? { summary } : {}),
      publicationStatus: this.mapGenericStatus(data["status"]),
      libraryStatus: data.inLibrary ? MangaLibraryStatus.ACTIVE : MangaLibraryStatus.PLAN_TO_READ,
      providerMetadata: {
        coverImage: data.thumbnailUrl,
        coverUrl: data.thumbnailUrl,
        genres: data.genre,
        authors: data.author ? [{ name: data.author, role: 'Story' }] : undefined,
        artists: data.artist ? [{ name: data.artist, role: 'Art' }] : undefined
      },
      rawProviderData: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue
    };
  }

  /**
   * Convert MyAnimeList manga data to Prisma create input
   */
  static fromMAL(data: ExternalMALManga): Partial<MangaCreateInput> {
    const alternativeTitles = [
      data.alternative_titles?.en,
      data.alternative_titles?.ja,
      ...(data.alternative_titles?.synonyms ?? [])
    ].filter((t): t is string => Boolean(t) && t !== data["title"]);

    const summary = data.synopsis;
    return {
      title: data["title"],
      source: 'myanimelist',
      sourceId: String(data["id"]),
      ...(summary ? { summary } : {}),
      publicationStatus: this.mapMALStatus(data["status"]),
      providerMetadata: {
        alternativeTitles,
        coverUrl: data.main_picture?.large ?? data.main_picture?.medium,
        thumbnailUrl: data.main_picture?.medium ?? data.main_picture?.large,
        genres: data["genres"]?.map(g => g["name"]),
        score: data.mean,
        popularity: data.popularity,
        releaseYear: data.start_date ? new Date(data.start_date).getFullYear() : undefined,
        authors: data["authors"]?.map(a => ({
          name: `${a.node.first_name ?? ''} ${a.node.last_name ?? ''}`.trim(),
          role: a.role ?? 'Author'
        }))
      },
      rawProviderData: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue
    };
  }

  // ============ Helper Methods ============

  /**
   * Extract metadata from manga entity
   */
  private static getMetadata(manga: MangaEntity | MangaComplete): Record<string, unknown> | null {
    return 'Metadata' in manga ? manga['Metadata'] : null;
  }

  /**
   * Get authors from metadata
   */
  private static getAuthors(metadata: Record<string, unknown> | null): Array<{ name: string; role: string }> {
    if (!metadata?.['authors']) return [];

    const authors = metadata['authors'];
    if (!Array.isArray(authors)) return [];

    const validAuthors = authors.filter((author): author is string =>
      typeof author === 'string'
    );

    return validAuthors.map((name: string) => ({ name, role: 'Author' }));
  }

  /**
   * Get artists from metadata
   */
  private static getArtists(metadata: Record<string, unknown> | null): Array<{ name: string; role: string }> {
    if (!metadata?.['artists']) return [];

    const artists = metadata['artists'];
    if (!Array.isArray(artists)) return [];

    const validArtists = artists.filter((artist): artist is string =>
      typeof artist === 'string'
    );

    return validArtists.map((name: string) => ({ name, role: 'Artist' }));
  }

  /**
   * Check if manga has new chapters
   */
  private static hasRecentUpdate(lastSyncAt: Date | null): boolean {
    if (!lastSyncAt) return false;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastSyncAt > oneDayAgo;
  }

  /**
   * Build search result metadata from manga entity
   */
  private static buildSearchMetadata(
    manga: MangaEntity | MangaComplete,
    metadata: Record<string, unknown> | null
  ): Partial<MangaSearchResult> {
    const result: Partial<MangaSearchResult> = {};

    const alternativeTitles = metadata?.['synonyms'] as string[] | undefined;
    if (alternativeTitles) result.alternativeTitles = alternativeTitles;

    const description = (metadata?.['summary'] as string | undefined) ?? manga.summary;
    if (description) result.description = description;

    const coverUrl = metadata?.['coverUrl'] as string | undefined;
    if (coverUrl) result.coverUrl = coverUrl;

    const authors = metadata?.['authors'] as string[] | undefined;
    if (authors) result.authors = authors;

    const genres = metadata?.['genres'] as string[] | undefined;
    if (genres) result.genres = genres;

    const year = metadata?.['startDate'] ? new Date(metadata['startDate'] as string).getFullYear() : undefined;
    if (year) result.year = year;

    const score = metadata?.['averageScore'] as number | undefined;
    if (score) result.score = score;

    if (manga.libraryStatus === 'ACTIVE') result.isInLibrary = true;

    return result;
  }

  // ============ Prisma to View Conversions ============

  /**
   * Convert Manga entity to list view
   * Note: Some fields may be null/undefined when metadata is not loaded
   */
  static toListView(
    manga: MangaEntity | MangaWithChapters | MangaComplete,
    chapterCount = 0,
    unreadCount = 0
  ): MangaListView {
    const chapters = 'Chapter' in manga ? manga['Chapter'] : [];
    const metadata = this.getMetadata(manga);

    return {
      id: manga["id"],
      title: manga["title"],
      displayTitle: manga.mangaTitle || manga["title"], // Use mangaTitle field or fallback to title
      coverUrl: (metadata?.['coverUrl'] as string | undefined) || (metadata?.['cover'] as string | undefined) || '/cover-not-found.jpg',
      thumbnailUrl: (metadata?.['coverMedium'] as string | undefined) || (metadata?.['coverUrl'] as string | undefined) || '/cover-not-found.jpg',
      chapterCount: chapterCount || (Array.isArray(chapters) ? chapters.length : 0),
      unreadCount,
      publicationStatus: manga.publicationStatus,
      libraryStatus: manga.libraryStatus,
      lastUpdatedAt: manga.updatedAt,
      hasNewChapters: this.hasRecentUpdate(manga.lastSyncAt)
    };
  }

  /**
   * Convert Manga entity to detail view
   * Requires MangaComplete with metadata relation loaded
   */
  static toDetailView(
    manga: MangaEntity | MangaComplete,
    chapterCount = 0,
    unreadCount = 0
  ): MangaDetailView {
    const listView = this.toListView(manga, chapterCount, unreadCount);
    const metadata = this.getMetadata(manga);

    return {
      ...listView,
      description: (metadata?.['summary'] as string | undefined) ?? manga.summary,
      summary: manga.summary,
      authors: this.getAuthors(metadata),
      artists: this.getArtists(metadata),
      genres: (metadata?.['genres'] as string[] | undefined) ?? [],
      tags: (metadata?.['tags'] as string[] | undefined) ?? [],
      alternativeTitles: (metadata?.['synonyms'] as string[] | undefined) ?? [],
      score: (metadata?.['averageScore'] as number | undefined) ?? null,
      popularity: (metadata?.['popularity'] as number | undefined) ?? null,
      releaseYear: metadata?.['startDate'] ? new Date(metadata['startDate'] as string).getFullYear() : null,
      source: manga["source"],
      sourceUrl: manga.sourceId ? `https://example.com/manga/${manga.sourceId}` : null,
      fileStatus: manga.fileStatus,
      lastSyncAt: manga.lastSyncAt,
      errorMessage: manga.errorMessage
    };
  }

  /**
   * Convert Manga entity to card view
   */
  static toCardView(
    manga: MangaEntity | MangaComplete,
    latestChapter?: { number?: string; title?: string },
    unreadCount = 0
  ): MangaCardView {
    const metadata = this.getMetadata(manga);

    return {
      id: manga["id"],
      title: manga["title"],
      displayTitle: manga.mangaTitle || manga["title"],
      coverUrl: (metadata?.['coverUrl'] as string | undefined) || (metadata?.['cover'] as string | undefined) || '/cover-not-found.jpg',
      thumbnailUrl: (metadata?.['coverMedium'] as string | undefined) || (metadata?.['coverUrl'] as string | undefined) || '/cover-not-found.jpg',
      latestChapterNumber: latestChapter?.number || null,
      latestChapterTitle: latestChapter?.title || null,
      unreadCount,
      isUpdated: this.hasRecentUpdate(manga.lastSyncAt),
      publicationStatus: manga.publicationStatus
    };
  }

  /**
   * Convert Manga entity to option view (for dropdowns)
   */
  static toOptionView(manga: MangaEntity): MangaOptionView {
    return {
      id: manga["id"],
      title: manga["title"],
      displayTitle: manga.mangaTitle ?? manga["title"],
      source: manga.source
    };
  }

  /**
   * Convert Manga entity to search result
   */
  static toSearchResult(manga: MangaEntity | MangaComplete): MangaSearchResult {
    const metadata = this.getMetadata(manga);
    const searchMetadata = this.buildSearchMetadata(manga, metadata);

    return {
      id: manga.sourceId || String(manga["id"]),
      title: manga.mangaTitle || manga["title"],
      source: manga["source"] || '',
      sourceId: manga.sourceId || String(manga["id"]),
      ...searchMetadata
    };
  }

  // ============ Form Data Conversions ============

  /**
   * Convert form data to Prisma create input
   */
  static fromFormData(data: MangaFormData): MangaCreateInput {
    const mangaTitle = data.displayTitle;
    const summary = data.summary ?? data["description"];
    const sourceId = data.sourceId;

    return {
      title: data["title"],
      ...(mangaTitle ? { mangaTitle } : {}),
      ...(summary ? { summary } : {}),
      source: data["source"],
      ...(sourceId ? { sourceId } : {}),
      Library: { connect: { id: data.libraryId } },
      searchProvider: data.searchProvider ?? 'anilist',
      publicationStatus: data.publicationStatus ?? MangaPublicationStatus.UNKNOWN,
      libraryStatus: data.libraryStatus ?? MangaLibraryStatus.ACTIVE,
      updatedAt: new Date(),
      // Store form data in providerMetadata
      providerMetadata: {
        genres: data["genres"],
        tags: data["tags"],
        alternativeTitles: data["alternativeTitles"],
        authors: data["authors"],
        artists: data.artists,
        coverUrl: data.coverUrl,
        coverImage: data.thumbnailUrl,
        releaseYear: data.releaseYear
      }
    };
  }

  /**
   * Convert form data to Prisma update input
   */
  static toUpdateInput(data: Partial<MangaFormData>): MangaUpdateInput {
    const updates: MangaUpdateInput = {};

    if (data.displayTitle !== undefined) updates.mangaTitle = data.displayTitle;
    const summaryValue = data.summary ?? data["description"];
    if (summaryValue !== undefined) {
      updates.summary = summaryValue;
    }
    if (data["source"] !== undefined) updates["source"] = data["source"];
    if (data.publicationStatus !== undefined) updates.publicationStatus = data.publicationStatus;
    if (data.libraryStatus !== undefined) updates.libraryStatus = data.libraryStatus;

    // Update providerMetadata if any metadata fields changed
    const metadataUpdates: Record<string, unknown> = {};
    if (data["genres"] !== undefined) metadataUpdates["genres"] = data["genres"];
    if (data["tags"] !== undefined) metadataUpdates["tags"] = data["tags"];
    if (data["alternativeTitles"] !== undefined) metadataUpdates["alternativeTitles"] = data["alternativeTitles"];
    if (data["authors"] !== undefined) metadataUpdates["authors"] = data["authors"];
    if (data['artists'] !== undefined) metadataUpdates['artists'] = data['artists'];
    if (data['coverUrl'] !== undefined) metadataUpdates['coverUrl'] = data['coverUrl'];
    if (data['thumbnailUrl'] !== undefined) metadataUpdates['coverImage'] = data['thumbnailUrl'];
    if (data['releaseYear'] !== undefined) metadataUpdates['releaseYear'] = data['releaseYear'];

    if (Object.keys(metadataUpdates).length > 0) {
      updates.providerMetadata = JSON.parse(JSON.stringify(metadataUpdates)) as Prisma.InputJsonValue;
    }

    return updates;
  }

  // ============ Status Mapping Utilities ============

  private static mapAnilistStatus(status?: string): MangaPublicationStatus {
    switch (status) {
      case 'RELEASING': return MangaPublicationStatus.ONGOING;
      case 'FINISHED': return MangaPublicationStatus.COMPLETED;
      case 'NOT_YET_RELEASED': return MangaPublicationStatus.NOT_YET_RELEASED;
      case 'CANCELLED': return MangaPublicationStatus.CANCELLED;
      case 'HIATUS': return MangaPublicationStatus.HIATUS;
      default: return MangaPublicationStatus.UNKNOWN;
    }
  }

  private static mapMALStatus(status?: string): MangaPublicationStatus {
    switch (status) {
      case 'currently_publishing': return MangaPublicationStatus.ONGOING;
      case 'finished': return MangaPublicationStatus.COMPLETED;
      case 'not_yet_published': return MangaPublicationStatus.NOT_YET_RELEASED;
      case 'discontinued': return MangaPublicationStatus.CANCELLED;
      case 'on_hiatus': return MangaPublicationStatus.HIATUS;
      default: return MangaPublicationStatus.UNKNOWN;
    }
  }

  private static mapGenericStatus(status?: string): MangaPublicationStatus {
    const normalized = status?.toLowerCase();
    if (!normalized) return MangaPublicationStatus.UNKNOWN;
    
    if (normalized.includes('ongoing') || normalized.includes('releasing')) {
      return MangaPublicationStatus.ONGOING;
    }
    if (normalized.includes('complete') || normalized.includes('finished')) {
      return MangaPublicationStatus.COMPLETED;
    }
    if (normalized.includes('hiatus')) {
      return MangaPublicationStatus.HIATUS;
    }
    if (normalized.includes('cancel') || normalized.includes('discontinue')) {
      return MangaPublicationStatus.CANCELLED;
    }
    
    return MangaPublicationStatus.UNKNOWN;
  }

}