/**
 * Calendar Cache Service
 *
 * Provides caching functionality for calendar-related data to improve performance
 * and reduce API calls to external providers.
 */

import { createLogger } from '@/utils/logger';

import type { CalendarEvent, ReleaseSchedule } from '@prisma/client';

const logger = createLogger('CalendarCacheService');

// Type definition for recent releases
interface RecentRelease {
  id: string;
  mangaId: string;
  chapterNumber: number;
  releaseDate: Date;
  provider: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CalendarCacheService {
  private eventCache: Map<string, CacheEntry<CalendarEvent[]>>;
  private scheduleCache: Map<string, CacheEntry<ReleaseSchedule>>;
  private releaseCache: Map<string, CacheEntry<RecentRelease[]>>;
  private defaultTTL: number;
  
  constructor(defaultTTL: number = 3600000) { // 1 hour default
    this.eventCache = new Map();
    this.scheduleCache = new Map();
    this.releaseCache = new Map();
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * Get cached calendar events
   */
  getEvents(key: string): CalendarEvent[] | null {
    const entry = this.eventCache.get(key);
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.eventCache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set calendar events in cache
   */
  setEvents(key: string, events: CalendarEvent[], ttl?: number): void {
    this.eventCache.set(key, {
      data: events,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL
    });
  }
  
  /**
   * Get cached release schedule
   */
  getSchedule(mangaId: string): ReleaseSchedule | null {
    const entry = this.scheduleCache.get(mangaId);
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.scheduleCache.delete(mangaId);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set release schedule in cache
   */
  setSchedule(mangaId: string, schedule: ReleaseSchedule, ttl?: number): void {
    this.scheduleCache.set(mangaId, {
      data: schedule,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL
    });
  }
  
  /**
   * Get cached recent releases
   */
  getReleases(mangaId: string): RecentRelease[] | null {
    const entry = this.releaseCache.get(mangaId);
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.releaseCache.delete(mangaId);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set recent releases in cache
   */
  setReleases(mangaId: string, releases: RecentRelease[], ttl?: number): void {
    this.releaseCache.set(mangaId, {
      data: releases,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL
    });
  }
  
  /**
   * Clear all caches
   */
  clearAll(): void {
    this.eventCache.clear();
    this.scheduleCache.clear();
    this.releaseCache.clear();
    logger.info('All calendar caches cleared', {});
  }

  /**
   * Clear cache entries for a specific manga
   * More efficient than clearAll() as it only removes relevant entries
   */
  clearForManga(mangaId: string | number): void {
    const mangaIdStr = String(mangaId);
    let cleared = 0;

    // Clear schedule cache for this manga
    if (this.scheduleCache.has(mangaIdStr)) {
      this.scheduleCache.delete(mangaIdStr);
      cleared++;
    }

    // Clear release cache for this manga
    if (this.releaseCache.has(mangaIdStr)) {
      this.releaseCache.delete(mangaIdStr);
      cleared++;
    }

    // Clear event cache entries that contain this manga
    // Event cache keys include date ranges, so we need to check all entries
    for (const [key, entry] of this.eventCache.entries()) {
      // Check if any event in the cached data belongs to this manga
      const hasEvent = entry.data.some((event) => String(event.mangaId) === mangaIdStr);
      if (hasEvent) {
        this.eventCache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`Cleared ${cleared} cache entries for manga ${mangaIdStr}`, { mangaId: mangaIdStr, cleared });
    }
  }

  /**
   * Invalidate all event cache entries
   * Use when events are modified but schedule/release caches are still valid
   */
  invalidateEvents(): void {
    const count = this.eventCache.size;
    this.eventCache.clear();
    if (count > 0) {
      logger.info(`Invalidated ${count} event cache entries`, { count });
    }
  }

  /**
   * Invalidate event cache entries for a specific manga
   */
  invalidateEventsForManga(mangaId: string | number): void {
    const mangaIdStr = String(mangaId);
    let cleared = 0;

    for (const [key, entry] of this.eventCache.entries()) {
      const hasEvent = entry.data.some((event) => String(event.mangaId) === mangaIdStr);
      if (hasEvent) {
        this.eventCache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`Invalidated ${cleared} event cache entries for manga ${mangaIdStr}`, { mangaId: mangaIdStr, cleared });
    }
  }
  
  /**
   * Clear expired entries
   */
  clearExpired(): void {
    let cleared = 0;
    
    // Clear expired events
    for (const [key, entry] of this.eventCache.entries()) {
      if (this.isExpired(entry)) {
        this.eventCache.delete(key);
        cleared++;
      }
    }
    
    // Clear expired schedules
    for (const [key, entry] of this.scheduleCache.entries()) {
      if (this.isExpired(entry)) {
        this.scheduleCache.delete(key);
        cleared++;
      }
    }
    
    // Clear expired releases
    for (const [key, entry] of this.releaseCache.entries()) {
      if (this.isExpired(entry)) {
        this.releaseCache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      logger.info(`Cleared ${cleared} expired cache entries`, { cleared });
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    eventCount: number;
    scheduleCount: number;
    releaseCount: number;
    totalSize: number;
  } {
    return {
      eventCount: this.eventCache.size,
      scheduleCount: this.scheduleCache.size,
      releaseCount: this.releaseCache.size,
      totalSize: this.eventCache.size + this.scheduleCache.size + this.releaseCache.size
    };
  }
  
  /**
   * Check if cache entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}

// Singleton instance
let cacheInstance: CalendarCacheService | null = null;

/**
 * Get or create calendar cache instance
 */
export function getCalendarCache(): CalendarCacheService {
  cacheInstance ??= new CalendarCacheService();
  return cacheInstance;
}

// Export default instance
export const calendarCache = getCalendarCache();