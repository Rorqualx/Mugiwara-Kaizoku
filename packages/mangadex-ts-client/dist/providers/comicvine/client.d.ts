/**
 * ComicVine API client
 * Rate limit: 200 requests/hour (~1 per 18 seconds)
 * Requires API key
 */
import { CVVolume, CVIssue, CVSearchResult } from './types';
export interface ComicVineClientConfig {
    apiKey: string;
    userAgent?: string;
    cacheTtlMs?: number;
}
export declare class ComicVineClient {
    private readonly http;
    private readonly apiKey;
    constructor(config: ComicVineClientConfig);
    /** Search volumes (manga series) */
    searchVolumes(query: string, limit?: number): Promise<CVSearchResult[]>;
    /** Get a single volume by ID */
    getVolume(id: number): Promise<CVVolume>;
    /** Get all issues for a volume (auto-paginated) */
    getAllIssues(volumeId: number): Promise<CVIssue[]>;
    /** Get a single issue by ID */
    getIssue(issueId: number): Promise<CVIssue>;
    /** Fetch raw HTML page (for scraping) */
    fetchPage(url: string): Promise<string>;
    private checkResponse;
}
//# sourceMappingURL=client.d.ts.map