// PreloaderService - Smart page preloading based on reading patterns

import {
  PRELOADER_MAX_CACHE_SIZE,
  PRELOADER_CACHE_TTL_MS,
  FAST_READER_THRESHOLD_MS,
  MAX_ADAPTIVE_BUFFER_PAGES,
  FORWARD_PRELOAD_RATIO,
  BACKWARD_PRELOAD_RATIO,
  MIN_READING_INTERVAL_MS,
  MAX_READING_INTERVAL_MS,
  READING_SPEED_HISTORY_SIZE,
  DEFAULT_READING_SPEED_MS,
  MAX_CONCURRENT_PRELOADS
} from './constants';

interface PreloadedPage {
  pageNumber: number;
  url: string;
  timestamp: number;
}

interface PreloadQueueItem {
  pageNumber: number;
  priority: number;
  url: string;
}

export class PreloaderService {
  private cache = new Map<number, PreloadedPage>();
  private preloadQueue: PreloadQueueItem[] = [];
  private readingSpeed: number[] = [];
  private lastPageTime = Date.now();
  private isPreloading = false;
  private maxCacheSize = PRELOADER_MAX_CACHE_SIZE;
  private cacheTimeout = PRELOADER_CACHE_TTL_MS;
  private preloadingUrls = new Set<string>();
  private activePreloads = 0;
  private pendingPreloads: Array<{ url: string; pageNumber: number }> = [];

  /**
   * Handle successful image preload - updates cache and processes next.
   */
  private handlePreloadSuccess(url: string, pageNumber: number): void {
    this.preloadingUrls.delete(url);
    this.activePreloads--;
    this.cache.set(pageNumber, {
      pageNumber,
      url,
      timestamp: Date.now()
    });
    this.processNextPreload();
  }

  /**
   * Handle failed image preload - cleanup and process next.
   */
  private handlePreloadError(url: string): void {
    this.preloadingUrls.delete(url);
    this.activePreloads--;
    this.processNextPreload();
  }

  /**
   * Actually preload an image by creating an Image object.
   * This triggers the browser to fetch and cache the image.
   */
  private preloadImage(url: string, pageNumber: number): void {
    if (this.preloadingUrls.has(url)) return;

    this.preloadingUrls.add(url);
    this.activePreloads++;

     
    const img = new window.Image();
    img.onload = (): void => this.handlePreloadSuccess(url, pageNumber);
    img.onerror = (): void => this.handlePreloadError(url);
    img.src = url;
  }

  /**
   * Process the next pending preload if we have capacity.
   * This implements throttling by limiting concurrent preloads.
   */
  private processNextPreload(): void {
    while (this.activePreloads < MAX_CONCURRENT_PRELOADS && this.pendingPreloads.length > 0) {
      const next = this.pendingPreloads.shift();
      if (next && !this.cache.has(next.pageNumber)) {
        this.preloadImage(next.url, next.pageNumber);
      }
    }
  }

  /**
   * Queue a preload request. If under capacity, starts immediately.
   * Otherwise, adds to pending queue for later processing.
   */
  private queuePreload(url: string, pageNumber: number): void {
    if (this.cache.has(pageNumber) || this.preloadingUrls.has(url)) {
      return; // Already cached or in progress
    }

    if (this.activePreloads < MAX_CONCURRENT_PRELOADS) {
      this.preloadImage(url, pageNumber);
      return;
    }

    // Add to pending queue if not already queued
    const alreadyQueued = this.pendingPreloads.some(p => p.pageNumber === pageNumber);
    if (!alreadyQueued) {
      this.pendingPreloads.push({ url, pageNumber });
    }
  }

  /**
   * Build preload queue from pages to preload, filtering out cached pages.
   */
  private buildPreloadQueue(
    pagesToPreload: number[],
    getPageUrl: (pageNumber: number) => string | null
  ): PreloadQueueItem[] {
    const queue: PreloadQueueItem[] = [];

    for (let index = 0; index < pagesToPreload.length; index++) {
      const pageNum = pagesToPreload[index];
      if (pageNum === undefined || this.cache.has(pageNum)) continue;

      const url = getPageUrl(pageNum);
      if (url) {
        queue.push({ pageNumber: pageNum, priority: index, url });
      }
    }

    return queue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Calculate pages to preload based on reading patterns.
   * Uses throttled preloading to avoid network congestion.
   */
  preloadPages(
    pages: string[],
    currentPage: number,
    direction: 'forward' | 'backward' | 'both',
    baseBufferSize: number,
    getPageUrl: (pageNumber: number) => string | null
  ): void {
    if (this.isPreloading) return;

    this.isPreloading = true;

    const pagesToPreload = this.calculatePagesToPreload(
      currentPage,
      pages.length,
      direction,
      baseBufferSize
    );

    this.preloadQueue = this.buildPreloadQueue(pagesToPreload, getPageUrl);

    // Queue preloads with throttling (max concurrent limit)
    for (const item of this.preloadQueue) {
      this.queuePreload(item.url, item.pageNumber);
    }

    this.cleanupCache();
    this.isPreloading = false;
  }

  private calculatePagesToPreload(
  current: number,
  total: number,
  direction: string,
  baseBuffer: number)
  : number[] {
    // Adaptive buffer based on reading speed
    const avgSpeed = this.getAverageReadingSpeed();
    const fastReader = avgSpeed < FAST_READER_THRESHOLD_MS;
    const buffer = fastReader ? Math.min(MAX_ADAPTIVE_BUFFER_PAGES, baseBuffer * 2) : baseBuffer;

    const pages: number[] = [];

    if (direction === 'forward' || direction === 'both') {
      // Preload more pages forward
      const forwardBuffer = direction === 'both' ? Math.ceil(buffer * FORWARD_PRELOAD_RATIO) : buffer;
      for (let i = 1; i <= forwardBuffer; i++) {
        const page = current + i;
        if (page <= total) pages.push(page);
      }
    }

    if (direction === 'backward' || direction === 'both') {
      // Preload fewer pages backward
      const backwardBuffer = direction === 'both' ? Math.floor(buffer * BACKWARD_PRELOAD_RATIO) : Math.floor(buffer / 2);
      for (let i = 1; i <= backwardBuffer; i++) {
        const page = current - i;
        if (page >= 1) pages.push(page);
      }
    }

    return pages;
  }

  // Record page view for reading speed calculation
  recordPageView(_pageNumber: number): void {
    const now = Date.now();
    const timeDiff = now - this.lastPageTime;

    // Only record if reasonable time (between min and max intervals)
    if (timeDiff > MIN_READING_INTERVAL_MS && timeDiff < MAX_READING_INTERVAL_MS) {
      this.readingSpeed.push(timeDiff);

      // Keep only last N readings
      if (this.readingSpeed.length > READING_SPEED_HISTORY_SIZE) {
        this.readingSpeed.shift();
      }
    }

    this.lastPageTime = now;
  }

  // Get average reading speed in milliseconds
  private getAverageReadingSpeed(): number {
    if (this.readingSpeed.length === 0) return DEFAULT_READING_SPEED_MS;

    const sum = this.readingSpeed.reduce((a, b) => a + b, 0);
    return sum / this.readingSpeed.length;
  }

  // Get preloaded URL if available
  getPreloadedUrl(pageNumber: number): string | null {
    const cached = this.cache.get(pageNumber);

    if (cached) {
      // Check if cache is still valid
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.url;
      } else {
        // Remove expired cache
        this.cache.delete(pageNumber);
      }
    }

    return null;
  }

  // Clean up old cache entries
  private cleanupCache(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [pageNumber, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        URL.revokeObjectURL(entry.url);
        this.cache.delete(pageNumber);
      }
    }

    // If cache is too large, remove oldest entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
      toRemove.forEach(([pageNumber, entry]) => {
        URL.revokeObjectURL(entry.url);
        this.cache.delete(pageNumber);
      });
    }
  }

  // Get preload statistics
  getStats(): {
    cacheSize: number;
    averageSpeed: number;
    isPreloading: boolean;
    queueSize: number;
  } {
    return {
      cacheSize: this.cache.size,
      averageSpeed: this.getAverageReadingSpeed(),
      isPreloading: this.isPreloading,
      queueSize: this.preloadQueue.length
    };
  }

  // Clear a specific page from cache
  clearPage(pageNumber: number): void {
    const cached = this.cache.get(pageNumber);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.cache.delete(pageNumber);
    }
  }

  // Clean up all resources
  cleanup(): void {
    // Revoke all blob URLs
    this.cache.forEach((entry) => URL.revokeObjectURL(entry.url));
    this.cache.clear();
    this.preloadQueue = [];
    this.readingSpeed = [];
  }
}