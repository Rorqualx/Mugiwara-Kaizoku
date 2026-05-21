/**
 * AniList MetadataProvider implementation
 */
import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { AniListClient } from './client';
export declare class AniListProvider implements MetadataProvider {
    readonly source: "anilist";
    private readonly client;
    constructor(_config?: ProviderConfig);
    isAvailable(): boolean;
    search(query: string, limit?: number): Promise<SearchResult[]>;
    getMetadata(id: string): Promise<ProviderResult>;
    getCovers(id: string): Promise<CoverImages>;
    getClient(): AniListClient;
}
//# sourceMappingURL=provider.d.ts.map