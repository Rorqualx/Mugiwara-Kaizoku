/**
 * MangaDex API Client — Extended from original client.ts
 * Adds statistics, typed aggregate, auto-pagination, and author details
 */
import { MangaSearchParams, ChapterSearchParams, MangaListResponse, ChapterListResponse, CoverArtListResponse, AuthorListResponse, StatisticsResponse, AggregateResponse, AtHomeResponse, Chapter, CoverArt, Author, MangaDexRelationshipType } from './types';
import { ApiError } from '../../types/errors';
export interface MangaDexClientConfig {
    baseUrl: string;
    timeout: number;
    rateLimit?: {
        maxRequests: number;
        perMilliseconds: number;
    };
    userAgent?: string;
    defaultContentRating?: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];
}
/**
 * Custom error class for MangaDex API errors (backward compat)
 */
export declare class MangaDexApiError extends ApiError {
    constructor(message: string, statusCode?: number, errors?: unknown[], requestId?: string);
}
/**
 * MangaDex API Client
 */
export declare class MangaDexClient {
    private readonly axiosInstance;
    private readonly rateLimiter?;
    private readonly defaultContentRating;
    constructor(config: MangaDexClientConfig);
    private validateConfig;
    private handleRequestError;
    private buildQueryParams;
    private safeRequest;
    ping(): Promise<string>;
    searchManga(params?: MangaSearchParams): Promise<MangaListResponse>;
    getManga(id: string, includes?: MangaDexRelationshipType[]): Promise<MangaListResponse>;
    getMangaChapters(mangaId: string, params?: ChapterSearchParams): Promise<ChapterListResponse>;
    getMangaAggregate(mangaId: string, translatedLanguage?: string[]): Promise<AggregateResponse>;
    getMangaCovers(mangaId: string, limit?: number, offset?: number): Promise<CoverArtListResponse>;
    getAuthor(authorId: string): Promise<AuthorListResponse>;
    getChapter(chapterId: string): Promise<ChapterListResponse>;
    getChapterImages(chapterId: string): Promise<AtHomeResponse>;
    /**
     * Get manga statistics (rating, follows, comments)
     */
    getStatistics(mangaId: string): Promise<StatisticsResponse>;
    /**
     * Get all chapters with auto-pagination
     */
    getAllChapters(mangaId: string, language?: string, limit?: number): Promise<Chapter[]>;
    /**
     * Get all covers with auto-pagination
     */
    getAllCovers(mangaId: string): Promise<CoverArt[]>;
    /**
     * Get author details
     */
    getAuthorDetails(authorId: string): Promise<Author | undefined>;
    /**
     * Validate UUID format
     */
    isValidUUID(uuid: string): boolean;
    /**
     * Get cover image URL — FIXED: includes mangaId in path
     */
    getCoverUrl(mangaId: string, cover: {
        fileName: string;
    }, size?: 'original' | '512' | '256'): string;
    /**
     * Legacy getCoverUrl without mangaId (backward compat, deprecated)
     */
    getCoverUrlLegacy(cover: {
        fileName: string;
    }, size?: 'original' | '512' | '256'): string;
    extractRelationships<T extends {
        id: string;
        type: string;
    }>(manga: {
        relationships: Array<{
            id: string;
            type: string;
            attributes?: Record<string, unknown>;
        }>;
    }, type: string): T[];
    getEnglishTitle(manga: {
        attributes: {
            title: Record<string, string | undefined>;
        };
    }): string;
    getEnglishDescription(manga: {
        attributes: {
            description: Record<string, string | undefined>;
        };
    }): string;
}
/**
 * Create a default MangaDex client with safe defaults
 */
export declare function createDefaultClient(): MangaDexClient;
//# sourceMappingURL=client.d.ts.map