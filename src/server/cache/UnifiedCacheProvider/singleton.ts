/**
 * Singleton cache provider instance
 *
 * @module server/cache/UnifiedCacheProvider/singleton
 */

import { UnifiedCacheProvider } from './core';

export const cacheProvider = UnifiedCacheProvider.getInstance();
