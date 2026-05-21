/**
 * Fandom Provider Strategy Stub
 * 
 * TODO: This is a placeholder for the FandomProviderStrategy.
 * The actual Fandom implementation is in src/server/services/fandom/
 * This stub prevents build errors until the strategy is properly integrated.
 */


import { MetadataProvider } from '@prisma/client';

import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import type { ProviderStrategy, ProviderConfig } from '../registry';

export class FandomProviderStrategy implements ProviderStrategy {
  name = 'fandom';
  type = MetadataProvider.FANDOM;
  
  private config: ProviderConfig = {
    enabled: false,
    priority: 999
  };
  
  search(_query: string): Promise<AsyncResult<SearchResult[], Error>> {
    logger.warn('FandomProviderStrategy is a stub - use FandomService directly');
    return Promise.resolve(createSuccessResult([]));
  }

  getMetadata(_id: string): Promise<AsyncResult<MangaMetadata, Error>> {
    logger.warn('FandomProviderStrategy is a stub - use FandomService directly');
    return Promise.resolve(createErrorResult(new Error('FandomProviderStrategy not implemented')));
  }

  isEnabled(): Promise<boolean> {
    return Promise.resolve(false);
  }
  
  getConfig(): ProviderConfig {
    return this.config;
  }
  
  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}