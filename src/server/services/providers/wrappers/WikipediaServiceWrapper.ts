/**
 * Wikipedia Service Wrapper
 * 
 * Provides backward compatibility for existing WikipediaService usage
 * while redirecting to the unified provider registry.
 */

import { MetadataProvider } from '@prisma/client';

import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { ProviderRegistry } from '../registry';
/**
 * Wrapper class that maintains WikipediaService API compatibility
 * while using the new provider registry internally
 */
export class WikipediaServiceWrapper {
  private registry: ProviderRegistry;
  private static instance?: WikipediaServiceWrapper;
  constructor(registry?: ProviderRegistry) {
    this.registry = registry ?? ProviderRegistry.getInstance();
    logger.info('[WikipediaServiceWrapper] Initialized with provider registry');
  }
  /**
   * Get singleton instance
   */
  public static getInstance(): WikipediaServiceWrapper {
    WikipediaServiceWrapper.instance ??= new WikipediaServiceWrapper();
    return WikipediaServiceWrapper.instance;
  }
  /**
   * Search Wikipedia for manga articles
   */
  public async search(
    query: string,
    options?: {
      limit?: number;
      language?: string;
    }
  ): Promise<SearchResult[]> {
    try {
      const result = await this.registry.searchWithProvider(
        MetadataProvider.WIKIPEDIA,
        query,
        {
          limit: options?.limit
        }
      );
      if (isSuccess(result)) {
        return result.data;
      }
      if ('error' in result && result.error instanceof Error) {
        logger.error('[WikipediaServiceWrapper] Search failed:', result.error);
      }
      return [];
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Search errorMessage:', errorMessage);
      return [];
    }
  }
  /**
   * Get page content from Wikipedia
   */
  public async getPageContent(
    pageTitle: string,
    _options?: {
      language?: string;
      format?: 'html' | 'wikitext' | 'json';
    }
  ): Promise<string | null> {
    try {
      const result = await this.registry.getMetadataWithFallback(
        MetadataProvider.WIKIPEDIA,
        pageTitle
      );
      if (isSuccess(result)) {
        // For backward compatibility, return description as content
        return result.data["description"] ?? null;
      }
      return null;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Get page content errorMessage:', errorMessage);
      return null;
    }
  }
  /**
   * Get metadata for a specific Wikipedia page
   */
  public async getMetadata(
    pageTitle: string,
    _options?: {
      language?: string;
    }
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    return this.registry.getMetadataWithFallback(MetadataProvider.WIKIPEDIA, pageTitle);
  }
  /**
   * Extract summary from Wikipedia page
   */
  public async getSummary(
    pageTitle: string,
    options?: {
      language?: string;
      sentences?: number;
    }
  ): Promise<string | null> {
    try {
      const result = await this.getMetadata(pageTitle, options);
      if (isSuccess(result)) {
        const description = result.data["description"] ?? '';
        if (options?.sentences) {
          // Split into sentences and return requested number
          const sentences = description.match(/[^.!?]+[.!?]+/g) ?? [];
          return sentences.slice(0, options.sentences).join(' ').trim();
        }
        return description;
      }
      return null;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Get summary errorMessage:', errorMessage);
      return null;
    }
  }
  /**
   * Get page images from Wikipedia
   */
  public async getImages(
    pageTitle: string,
    options?: {
      language?: string;
      limit?: number;
    }
  ): Promise<string[]> {
    try {
      const result = await this.getMetadata(pageTitle, options);
      if (isSuccess(result)) {
        const images: string[] = [];
        if (result.data.coverImage) {
          images.push(result.data.coverImage);
        }
        if (result.data.bannerImage) {
          images.push(result.data.bannerImage);
        }
        // Additional images from metadata if available
        const metadata = result.data as unknown as { metadata?: { images?: unknown } };
        if (metadata.metadata?.images && Array.isArray(metadata.metadata.images)) {
          const imageList = metadata.metadata.images as string[];
          images.push(...imageList);
        }
        // Apply limit if specified
        if (options?.limit) {
          return images.slice(0, options.limit);
        }
        return images;
      }
      return [];
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Get images errorMessage:', errorMessage);
      return [];
    }
  }
  /**
   * Check if Wikipedia provider is enabled
   */
  public async isEnabled(): Promise<boolean> {
    const provider = this.registry.getProvider(MetadataProvider.WIKIPEDIA);
    return provider ? provider.isEnabled() : false;
  }
  /**
   * Update Wikipedia provider configuration
   */
  public updateConfig(config: unknown): void {
    // Type guard to validate config structure
    if (typeof config === 'object' && config !== null) {
      this.registry.updateProviderConfig(MetadataProvider.WIKIPEDIA, config as Record<string, unknown>);
    }
  }
  /**
   * Get categories for a Wikipedia page
   */
  public async getCategories(
    pageTitle: string,
    options?: {
      language?: string;
    }
  ): Promise<string[]> {
    try {
      const result = await this.getMetadata(pageTitle, options);
      if (isSuccess(result)) {
        // Combine genres and tags as categories
        const categories: string[] = [];
        if (result.data["genres"]) {
          categories.push(...result.data["genres"]);
        }
        if (result.data["tags"]) {
          const tags = result.data["tags"];
          // Handle different tag formats
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (typeof tag === 'string') {
                categories.push(tag);
              } else if (tag && typeof tag === 'object' && 'name' in tag && typeof tag.name === 'string') {
                categories.push(tag.name);
              }
            });
          }
        }
        // Remove duplicates
        return [...new Set(categories)];
      }
      return [];
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Get categories errorMessage:', errorMessage);
      return [];
    }
  }
  /**
   * Get external links from a Wikipedia page
   */
  public async getExternalLinks(
    pageTitle: string,
    options?: {
      language?: string;
    }
  ): Promise<Record<string, string>> {
    try {
      const result = await this.getMetadata(pageTitle, options);
      if (isSuccess(result) && result.data.externalLinks) {
        const links = result.data.externalLinks;
        // Type guard to validate externalLinks structure - links is already truthy from parent condition
        if (!Array.isArray(links)) {
          return links as Record<string, string>;
        }
      }
      return {};
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[WikipediaServiceWrapper] Get external links errorMessage:', errorMessage);
      return {};
    }
  }
}
// Export as WikipediaService for backward compatibility
export { WikipediaServiceWrapper as WikipediaService };
// Default export
export default WikipediaServiceWrapper;