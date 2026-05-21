/**
 * Chapter Detail Service - Cache Configuration Factory
 *
 * Provides factory function to initialize properly configured MultiTierCache
 * instance with chapter detail service settings.
 *
 * This module encapsulates cache initialization logic, making it easy to
 * create cache instances with consistent configuration across the service.
 *
 * @module chapter-detail/cache-config
 */

import { UnifiedCacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { backgroundPrisma } from '@/server/db';
import { MultiTierCache } from '@/server/services/comicvine/modules/multiTierCache';

import { CACHE_CONFIG } from './constants';

import type { ChapterDetail } from './types';

/**
 * Create cache service instance with chapter detail configuration.
 *
 * Uses the background DB pool by default so enrichment never starves UI requests.
 * - L1: 500 entries max, 5 minute TTL (in-memory for ultra-fast access)
 * - L2: 24 hour TTL (PostgreSQL persistent cache via background pool)
 * - Namespace: 'fandom:chapter-details'
 */
export function createChapterDetailCache(): MultiTierCache<ChapterDetail> {
  return new MultiTierCache<ChapterDetail>({
    l1MaxSize: CACHE_CONFIG.l1MaxSize,
    l1TtlMs: CACHE_CONFIG.l1TtlMs,
    l2Enabled: true,
    l2TtlMs: CACHE_CONFIG.ttlMs,
    l2Namespace: CACHE_CONFIG.namespace,
    // Use background pool so cache queries don't compete with UI
    l2Provider: UnifiedCacheProvider.createForBackground(backgroundPrisma),
  });
}
