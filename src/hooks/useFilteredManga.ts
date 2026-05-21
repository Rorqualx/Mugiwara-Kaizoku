import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';

// OutOfSyncChapter type no longer exists - using Job system instead
// Unused type preserved for documentation purposes
import { getArrayData } from '../utils/async-result';

import type { MangaWithRelations } from '../types/search.types';
import type { AsyncResult} from '../utils/async-result';

/**
 * Fields that can be used for sorting manga
 */
export type SortField = 'title' | 'lastChecked' | 'status';

/**
 * Sort direction options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Options for filtering manga list
 * 
 * @property {string} [source] - Filter by manga source
 * @property {string} [status] - Filter by manga status
 */
export interface FilterOptions {
  source?: string;
  status?: string;
  // Out-of-sync now tracked via Job system
}

/**
 * Statistics about the manga list
 */
export interface MangaStats {
  /** Total number of manga */
  total: number;
  /** Number of manga with out-of-sync chapters */
  outOfSync: number;
  /** Count of manga by source */
  bySource: Record<string, number>;
  /** Count of manga by status */
  byStatus: Record<string, number>;
}

/**
 * Return type for the useFilteredManga hook
 */
export interface UseFilteredMangaResult {
  /** Filtered and sorted manga list */
  manga: MangaWithRelations[];
  /** Current sort field */
  sortField: SortField;
  /** Function to update sort field */
  setSortField: Dispatch<SetStateAction<SortField>>;
  /** Current sort order */
  sortOrder: SortOrder;
  /** Function to update sort order */
  setSortOrder: Dispatch<SetStateAction<SortOrder>>;
  /** Current filter options */
  filters: FilterOptions;
  /** Function to update filter options */
  setFilters: Dispatch<SetStateAction<FilterOptions>>;
  /** Current search term */
  searchTerm: string;
  /** Function to update search term */
  setSearchTerm: Dispatch<SetStateAction<string>>;
  /** List of unique sources */
  availableSources: string[];
  /** List of unique statuses */
  availableStatuses: string[];
  /** Statistics about the manga list */
  stats: MangaStats;
}

/**
 * Overloaded hook to handle both direct arrays and AsyncResult types
 */
export function useFilteredManga(mangaList: MangaWithRelations[] | AsyncResult<MangaWithRelations[], Error>): UseFilteredMangaResult {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Safely extract manga list, handling both direct arrays and AsyncResult
  const safeMangaList = useMemo(() => {
    if (Array.isArray(mangaList)) {
      return mangaList;
    }

    // If it's an AsyncResult, safely extract the data array or use empty array
    return getArrayData(mangaList as AsyncResult<MangaWithRelations[], Error>, []);
  }, [mangaList]);

  /**
   * Type guard to check if value is an array of strings
   */
  function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  // hasOutOfSyncChapters function removed - out-of-sync tracking moved to Job system

  const filteredAndSortedManga = useMemo(() => {
    let result = [...safeMangaList];

    // Apply filters
    if (filters["source"]) {
      result = result.filter((manga) => manga["source"] === filters["source"]);
    }
    if (filters["status"]) {
      result = result.filter((manga) => {
        // Check all three status fields
        return manga.publicationStatus === filters["status"] ||
        manga.fileStatus === filters["status"] ||
        manga.libraryStatus === filters["status"];
      });
    }

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((manga) => {
        // Always search by title
        const titleMatch = manga["title"].toLowerCase().includes(searchLower);
        if (titleMatch) return true;

        // Check if metadata exists and has genres
        const metadata = manga.Metadata;
        if (metadata && typeof metadata === 'object') {
          const metadataObj = metadata as Record<string, unknown>;
          const genres = metadataObj['genres'];
          if (genres && isStringArray(genres)) {
            const genreMatch = genres.some((genre: string) =>
              genre.toLowerCase().includes(searchLower)
            );
            if (genreMatch) return true;
          }

          const tags = metadataObj['tags'];
          if (tags && isStringArray(tags)) {
            const tagMatch = tags.some((tag: string) =>
              tag.toLowerCase().includes(searchLower)
            );
            if (tagMatch) return true;
          }
        }

        return false;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'title':
          comparison = a["title"].localeCompare(b["title"]);
          break;
        case 'lastChecked':
          {
            // Type-safe date handling
            const aTime = a.lastChecked ?
            typeof a.lastChecked === 'object' ?
            a.lastChecked instanceof Date ?
            a.lastChecked.getTime() :
            new Date(String(a.lastChecked)).getTime() :
            typeof a.lastChecked === 'string' ?
            new Date(a.lastChecked).getTime() :
            0 :
            0;

            const bTime = b.lastChecked ?
            typeof b.lastChecked === 'object' ?
            b.lastChecked instanceof Date ?
            b.lastChecked.getTime() :
            new Date(String(b.lastChecked)).getTime() :
            typeof b.lastChecked === 'string' ?
            new Date(b.lastChecked).getTime() :
            0 :
            0;

            comparison = aTime - bTime;
          }
          break;
        case 'status': {
          // Use publicationStatus as the primary status for sorting
          const aStatus = a.publicationStatus;
          const bStatus = b.publicationStatus;
          comparison = aStatus.localeCompare(bStatus);
          break;
        }
        default:
          // Default to title sorting
          comparison = a["title"].localeCompare(b["title"]);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [safeMangaList, sortField, sortOrder, filters, searchTerm]);

  const availableSources = useMemo(() => {
    const sources: string[] = [];
    safeMangaList.forEach((manga) => {
      if (manga["source"] && typeof manga["source"] === 'string' && manga["source"].trim() !== '') {
        if (!sources.includes(manga["source"])) {
          sources.push(manga["source"]);
        }
      }
    });
    return sources.sort();
  }, [safeMangaList]);

  const availableStatuses = useMemo(() => {
    const statuses: string[] = [];
    safeMangaList.forEach((manga) => {
      // Collect all status types - these are non-nullable Prisma enums with defaults
      [manga.publicationStatus, manga.fileStatus, manga.libraryStatus].forEach((status) => {
        if (!statuses.includes(status)) {
          statuses.push(status);
        }
      });
    });
    return statuses.sort();
  }, [safeMangaList]);

  const stats = useMemo(() => {
    // Initialize stats object
    const statsObj: MangaStats = {
      total: safeMangaList.length,
      outOfSync: 0, // Out-of-sync now tracked via Job system
      bySource: {},
      byStatus: {}
    };

    // Count manga by source with type safety
    safeMangaList.forEach((manga) => {
      // Handle source counts
      if (manga["source"] && typeof manga["source"] === 'string' && manga["source"].trim() !== '') {
        const source = manga["source"];
        statsObj.bySource[source] = (statsObj.bySource[source] ?? 0) + 1;
      }

      // Handle status counts (use publicationStatus as primary)
      // publicationStatus is a non-nullable Prisma enum with default value
      const status = manga.publicationStatus;
      statsObj.byStatus[status] = (statsObj.byStatus[status] ?? 0) + 1;
    });

    return statsObj;
  }, [safeMangaList]);

  return {
    manga: filteredAndSortedManga,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    filters,
    setFilters,
    searchTerm,
    setSearchTerm,
    availableSources,
    availableStatuses,
    stats
  };
}