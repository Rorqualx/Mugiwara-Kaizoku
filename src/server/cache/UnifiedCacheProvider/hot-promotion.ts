/**
 * Hot Data Promotion Logic
 *
 * Checks if frequently accessed cache entries should be promoted
 * to the hot data cache for faster access.
 *
 * @module server/cache/UnifiedCacheProvider/hot-promotion
 */

import { logger } from '@/utils/logger';

import type { EntityType } from '../HotDataCacheProvider';

/**
 * Extract entity type and ID from cache key
 * Supports patterns like: manga:123, chapter:456, user:789, metadata:123
 */
export function extractEntityInfo(key: string, namespace: string): { entityType: EntityType; entityId: string } | null {
  const match = key.match(/^(manga|chapter|user|metadata):(.+)$/);
  if (match) {
    return {
      entityType: match[1] as EntityType,
      entityId: match[2] ?? ''
    };
  }

  if (['manga', 'chapter', 'user', 'metadata'].includes(namespace)) {
    return {
      entityType: namespace as EntityType,
      entityId: key
    };
  }

  return null;
}

/**
 * Check if entity should be promoted to hot cache.
 * Called automatically when access count reaches thresholds.
 */
export async function checkHotPromotion(
  key: string,
  namespace: string,
  value: unknown,
  accessCount: number
): Promise<void> {
  try {
    if (accessCount < 10) return;

    const { hotCacheProvider } = await import('../HotDataCacheProvider');
    const entityInfo = extractEntityInfo(key, namespace);
    if (!entityInfo) return;

    const shouldPromote = await hotCacheProvider.shouldPromote(
      entityInfo.entityType,
      entityInfo.entityId,
      accessCount
    );

    if (shouldPromote) {
      await hotCacheProvider.promoteToHot(
        entityInfo.entityType,
        entityInfo.entityId,
        value,
        accessCount
      );
      logger.info(`Auto-promoted ${entityInfo.entityType}:${entityInfo.entityId} to hot cache`, {
        accessCount,
        key
      });
    }
  } catch (error) {
    logger.debug('Hot promotion error:', error);
  }
}
