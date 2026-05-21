/**
 * Provider interface and related types
 */
import { DataSource } from './common';
import { UnifiedManga, CoverImages } from './metadata';
/** Search result from any provider */
export interface SearchResult {
    id: string;
    title: string;
    altTitles?: string[];
    description?: string;
    coverImage?: string;
    year?: number;
    status?: string;
    source: DataSource;
}
/** Result from a single provider's metadata fetch */
export interface ProviderResult {
    manga: Partial<UnifiedManga>;
    source: DataSource;
    confidence: number;
    fetchedAt: string;
}
/** Provider configuration */
export interface ProviderConfig {
    enabled: boolean;
    apiKey?: string;
    rateLimit?: {
        maxRequests: number;
        perMilliseconds: number;
    };
    cacheTtlMs?: number;
}
/** Metadata provider interface */
export interface MetadataProvider {
    readonly source: DataSource;
    /** Search for manga by title */
    search(query: string, limit?: number): Promise<SearchResult[]>;
    /** Get full metadata by provider-specific ID */
    getMetadata(id: string): Promise<ProviderResult>;
    /** Get cover images for a manga */
    getCovers(id: string): Promise<CoverImages>;
    /** Check if the provider is available/configured */
    isAvailable(): boolean;
}
//# sourceMappingURL=provider.d.ts.map