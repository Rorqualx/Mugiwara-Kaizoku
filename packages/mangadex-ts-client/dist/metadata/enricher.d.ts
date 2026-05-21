/**
 * Multi-provider orchestration — one-click metadata retrieval
 * Fetches from all available providers in parallel with graceful degradation
 */
import { DataSource } from '../types/common';
import { EnrichedMetadata } from '../types/metadata';
import { MetadataProvider, SearchResult } from '../types/provider';
import { MergerConfig } from './merger';
export interface EnricherConfig {
    /** Merger configuration */
    merger?: Partial<MergerConfig>;
    /** Provider-specific IDs to skip search (e.g., { anilist: '30013', comicvine: '12345' }) */
    knownIds?: Partial<Record<DataSource, string>>;
    /** Whether to search secondary providers by title match */
    crossSearch?: boolean;
    /** Max search results to consider per provider */
    searchLimit?: number;
}
export declare class MetadataEnricher {
    private readonly providers;
    private readonly merger;
    constructor(providers: MetadataProvider[], mergerConfig?: Partial<MergerConfig>);
    /**
     * ONE-CLICK: Enrich metadata from a single ID + title
     * Fetches from all providers in parallel, merges, and scores
     */
    enrich(primarySource: DataSource, primaryId: string, title?: string, config?: EnricherConfig): Promise<EnrichedMetadata>;
    /**
     * ONE-CLICK by title only — searches all providers, auto-picks best match
     */
    enrichByTitle(title: string, config?: EnricherConfig): Promise<EnrichedMetadata>;
    /** Search across all providers */
    searchAll(query: string, limit?: number): Promise<SearchResult[]>;
    /** Get list of available providers */
    getAvailableProviders(): DataSource[];
    private extractTitle;
    private findBestMatch;
}
//# sourceMappingURL=enricher.d.ts.map