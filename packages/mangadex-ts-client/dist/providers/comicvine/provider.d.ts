/**
 * ComicVine MetadataProvider implementation
 */
import { MetadataProvider, SearchResult, ProviderResult, ProviderConfig } from '../../types/provider';
import { CoverImages } from '../../types/metadata';
import { ComicVineClient } from './client';
export declare class ComicVineProvider implements MetadataProvider {
    readonly source: "comicvine";
    private readonly client;
    private readonly apiKey;
    constructor(config?: ProviderConfig);
    isAvailable(): boolean;
    search(query: string, limit?: number): Promise<SearchResult[]>;
    getMetadata(id: string): Promise<ProviderResult>;
    getCovers(id: string): Promise<CoverImages>;
    getClient(): ComicVineClient | undefined;
}
//# sourceMappingURL=provider.d.ts.map