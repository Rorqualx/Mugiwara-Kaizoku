"use strict";
/**
 * AniList GraphQL client
 * No API key required for public data
 * Rate limit: 90 requests/minute
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AniListClient = void 0;
const http_client_1 = require("../../core/http-client");
const errors_1 = require("../../types/errors");
const queries_1 = require("./queries");
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
class AniListClient {
    http;
    retryCount = 0;
    maxRetries = 3;
    constructor(config) {
        this.http = new http_client_1.HttpClient({
            baseURL: ANILIST_ENDPOINT,
            timeout: 30000,
            userAgent: 'MangaDex-Metadata-Client/2.0.0',
            rateLimit: config?.rateLimit ?? {
                maxRequests: 90,
                perMilliseconds: 60000,
            },
            cacheTtlMs: config?.cacheTtlMs ?? 5 * 60 * 1000,
            source: 'anilist',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }
    /** Search for manga */
    async searchManga(query, limit = 10) {
        const response = await this.graphqlRequest(queries_1.SEARCH_MANGA, {
            search: query,
            page: 1,
            perPage: Math.min(limit, 50),
        });
        return response.Page.media;
    }
    /** Get full manga details by AniList ID */
    async getMangaDetails(id) {
        const response = await this.graphqlRequest(queries_1.GET_MANGA_DETAILS, {
            id,
        });
        return response.Media;
    }
    /** Execute a GraphQL request with retry on 429 */
    async graphqlRequest(query, variables) {
        try {
            const response = await this.http.post('', {
                query,
                variables,
            });
            if (response.errors && response.errors.length > 0) {
                const firstError = response.errors[0];
                if (firstError.status === 429) {
                    return this.retryWithBackoff(query, variables);
                }
                throw new errors_1.ApiError(`AniList GraphQL error: ${firstError.message}`, firstError.status, response.errors, undefined, 'anilist');
            }
            this.retryCount = 0;
            return response.data;
        }
        catch (error) {
            if (error instanceof errors_1.RateLimitError) {
                return this.retryWithBackoff(query, variables);
            }
            throw error;
        }
    }
    /** Retry with exponential backoff */
    async retryWithBackoff(query, variables) {
        if (this.retryCount >= this.maxRetries) {
            this.retryCount = 0;
            throw new errors_1.RateLimitError('AniList rate limit exceeded after retries', undefined, 'anilist');
        }
        this.retryCount++;
        const waitMs = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        return this.graphqlRequest(query, variables);
    }
}
exports.AniListClient = AniListClient;
//# sourceMappingURL=client.js.map