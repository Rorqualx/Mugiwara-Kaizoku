/**
 * Genre Blacklist Hook
 *
 * Manages a blacklist of genres that consistently return zero results from AniList.
 * Uses localStorage to persist the blacklist across sessions.
 *
 * This optimization prevents unnecessary API calls for genres/tags with no manga,
 * improving infinite scroll performance and reducing API load.
 *
 * @module hooks/useGenreBlacklist
 */

import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/utils/logger';

const BLACKLIST_STORAGE_KEY = 'genre-blacklist-v1';
const BLACKLIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BlacklistEntry {
  genre: string;
  addedAt: number;
  attemptCount: number;
}

interface BlacklistData {
  entries: BlacklistEntry[];
  version: number;
}

/**
 * Type guard to validate BlacklistEntry structure
 *
 * @param value - Value to validate
 * @returns True if value is a valid BlacklistEntry
 */
function isBlacklistEntry(value: unknown): value is BlacklistEntry {
  if (typeof value !== 'object' || value === null) return false;

  const entry = value as Record<string, unknown>;

  return (
    typeof entry['genre'] === 'string' &&
    typeof entry['addedAt'] === 'number' &&
    typeof entry['attemptCount'] === 'number'
  );
}

/**
 * Type guard to validate BlacklistData structure
 *
 * @param value - Value to validate
 * @returns True if value is a valid BlacklistData
 */
function isBlacklistData(value: unknown): value is BlacklistData {
  if (typeof value !== 'object' || value === null) return false;

  const data = value as Record<string, unknown>;

  if (typeof data['version'] !== 'number') return false;
  if (!Array.isArray(data['entries'])) return false;

  // Validate all entries
  return (data['entries'] as unknown[]).every(isBlacklistEntry);
}

/**
 * Return type for useGenreBlacklist hook
 */
export interface UseGenreBlacklistReturn {
  blacklist: Set<string>;
  isBlacklisted: (genre: string) => boolean;
  addToBlacklist: (genre: string) => void;
  removeFromBlacklist: (genre: string) => void;
  clearBlacklist: () => void;
  getStats: () => { total: number; entries: BlacklistEntry[] };
}

/**
 * Custom hook for managing the genre blacklist
 *
 * @returns Hook methods and state
 */
export function useGenreBlacklist(): UseGenreBlacklistReturn {
  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());

  // Load blacklist from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);

        if (!isBlacklistData(parsed)) {
          logger.warn('Invalid blacklist data structure, skipping load');
          return;
        }

        const data: BlacklistData = parsed;
        const now = Date.now();

        // Filter out expired entries (older than 7 days)
        const validEntries = data.entries.filter(
          (entry) => now - entry.addedAt < BLACKLIST_MAX_AGE_MS
        );

        const genreSet = new Set(validEntries.map((e) => e.genre));
        setBlacklist(genreSet);

        // Update storage if we filtered anything out
        if (validEntries.length !== data.entries.length) {
          const updated: BlacklistData = {
            entries: validEntries,
            version: data.version,
          };
          localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(updated));
        }

        logger.debug(`Loaded genre blacklist: ${validEntries.length} genres`, {
          genres: Array.from(genreSet).slice(0, 10), // Log first 10
        });
      }
    } catch (error) {
      logger.error('Failed to load genre blacklist:', error);
    }
  }, []);

  /**
   * Add a genre to the blacklist
   *
   * @param genre - Genre name to blacklist
   */
  const addToBlacklist = useCallback((genre: string) => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      let data: BlacklistData = { entries: [], version: 1 };

      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isBlacklistData(parsed)) {
          data = parsed;
        } else {
          logger.warn('Invalid blacklist data, creating new blacklist');
        }
      }

      // Check if genre already exists
      const existingIndex = data.entries.findIndex((e) => e.genre === genre);

      if (existingIndex >= 0) {
        // Increment attempt count
        const entry = data.entries[existingIndex];
        if (entry) {
          entry.attemptCount++;
        }
      } else {
        // Add new entry
        data.entries.push({
          genre,
          addedAt: Date.now(),
          attemptCount: 1,
        });

        logger.info(`Blacklisted genre: ${genre} (no manga found)`);
      }

      // Save updated blacklist
      localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(data));

      // Update state
      setBlacklist((prev) => new Set([...prev, genre]));
    } catch (error) {
      logger.error(`Failed to blacklist genre ${genre}:`, error);
    }
  }, []);

  /**
   * Remove a genre from the blacklist
   *
   * @param genre - Genre name to remove
   */
  const removeFromBlacklist = useCallback((genre: string) => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      if (!stored) return;

      const parsed: unknown = JSON.parse(stored);
      if (!isBlacklistData(parsed)) {
        logger.warn('Invalid blacklist data, cannot remove genre');
        return;
      }

      const data: BlacklistData = parsed;
      data.entries = data.entries.filter((e) => e.genre !== genre);

      localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(data));

      setBlacklist((prev) => {
        const updated = new Set(prev);
        updated.delete(genre);
        return updated;
      });

      logger.info(`Removed genre from blacklist: ${genre}`);
    } catch (error) {
      logger.error(`Failed to remove genre ${genre} from blacklist:`, error);
    }
  }, []);

  /**
   * Clear the entire blacklist
   */
  const clearBlacklist = useCallback(() => {
    try {
      localStorage.removeItem(BLACKLIST_STORAGE_KEY);
      setBlacklist(new Set());
      logger.info('Cleared genre blacklist');
    } catch (error) {
      logger.error('Failed to clear blacklist:', error);
    }
  }, []);

  /**
   * Check if a genre is blacklisted
   *
   * @param genre - Genre name to check
   * @returns True if blacklisted
   */
  const isBlacklisted = useCallback(
    (genre: string): boolean => {
      return blacklist.has(genre);
    },
    [blacklist]
  );

  /**
   * Get blacklist statistics
   */
  const getStats = useCallback(() => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      if (!stored) return { total: 0, entries: [] };

      const parsed: unknown = JSON.parse(stored);
      if (!isBlacklistData(parsed)) {
        logger.warn('Invalid blacklist data, returning empty stats');
        return { total: 0, entries: [] };
      }

      const data: BlacklistData = parsed;
      return {
        total: data.entries.length,
        entries: data.entries.slice(0, 20), // Top 20
      };
    } catch (error) {
      logger.error('Failed to get blacklist stats:', error);
      return { total: 0, entries: [] };
    }
  }, []);

  return {
    blacklist,
    isBlacklisted,
    addToBlacklist,
    removeFromBlacklist,
    clearBlacklist,
    getStats,
  };
}
