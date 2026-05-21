/**
 * MangaDex MetadataProvider implementation
 */
import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { MangaDexClient } from './client';
export declare class MangaDexProvider implements MetadataProvider {
    readonly source: "mangadex";
    private readonly client;
    constructor(client?: MangaDexClient, _config?: ProviderConfig);
    isAvailable(): boolean;
    search(query: string, limit?: number): Promise<SearchResult[]>;
    getMetadata(id: string): Promise<ProviderResult>;
    getCovers(id: string): Promise<CoverImages>;
    /** Expose raw client for advanced usage */
    getClient(): MangaDexClient;
}
//# sourceMappingURL=provider.d.ts.map