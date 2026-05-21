/**
 * AniList GraphQL client
 * No API key required for public data
 * Rate limit: 90 requests/minute
 */
import { AniListMedia } from './types';
export interface AniListClientConfig {
    rateLimit?: {
        maxRequests: number;
        perMilliseconds: number;
    };
    cacheTtlMs?: number;
}
export declare class AniListClient {
    private readonly http;
    private retryCount;
    private readonly maxRetries;
    constructor(config?: AniListClientConfig);
    /** Search for manga */
    searchManga(query: string, limit?: number): Promise<AniListMedia[]>;
    /** Get full manga details by AniList ID */
    getMangaDetails(id: number): Promise<AniListMedia>;
    /** Execute a GraphQL request with retry on 429 */
    private graphqlRequest;
    /** Retry with exponential backoff */
    private retryWithBackoff;
}
//# sourceMappingURL=client.d.ts.map