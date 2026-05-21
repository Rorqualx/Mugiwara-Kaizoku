"use strict";
/**
 * MangaDex API Client — Extended from original client.ts
 * Adds statistics, typed aggregate, auto-pagination, and author details
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangaDexClient = exports.MangaDexApiError = void 0;
exports.createDefaultClient = createDefaultClient;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("./types");
const rate_limiter_1 = require("../../core/rate-limiter");
const errors_1 = require("../../types/errors");
/**
 * Custom error class for MangaDex API errors (backward compat)
 */
class MangaDexApiError extends errors_1.ApiError {
    constructor(message, statusCode, errors, requestId) {
        super(message, statusCode, errors, requestId, 'mangadex');
        this.name = 'MangaDexApiError';
    }
}
exports.MangaDexApiError = MangaDexApiError;
/**
 * MangaDex API Client
 */
class MangaDexClient {
    axiosInstance;
    rateLimiter;
    defaultContentRating;
    constructor(config) {
        this.validateConfig(config);
        this.defaultContentRating = config.defaultContentRating || ['safe', 'suggestive', 'erotica'];
        this.axiosInstance = axios_1.default.create({
            baseURL: config.baseUrl,
            timeout: config.timeout,
            headers: {
                'User-Agent': config.userAgent || 'MangaDex-TypeScript-Client/2.0.0',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 500,
        });
        if (config.rateLimit) {
            this.rateLimiter = new rate_limiter_1.RateLimiter(config.rateLimit.maxRequests, config.rateLimit.perMilliseconds);
        }
        this.axiosInstance.interceptors.request.use(async (requestConfig) => {
            if (this.rateLimiter) {
                await this.rateLimiter.waitIfNeeded();
            }
            return requestConfig;
        });
        this.axiosInstance.interceptors.response.use((response) => response, (error) => {
            return this.handleRequestError(error);
        });
    }
    validateConfig(config) {
        if (!config.baseUrl)
            throw new Error('Base URL is required');
        try {
            new URL(config.baseUrl);
        }
        catch {
            throw new Error('Invalid base URL');
        }
        if (config.timeout <= 0)
            throw new Error('Timeout must be positive');
        if (config.rateLimit) {
            if (config.rateLimit.maxRequests <= 0)
                throw new Error('Rate limit maxRequests must be positive');
            if (config.rateLimit.perMilliseconds <= 0)
                throw new Error('Rate limit perMilliseconds must be positive');
        }
    }
    handleRequestError(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            let message = `API request failed with status ${status}`;
            let errors = [];
            let requestId;
            if ((0, types_1.isMangaDexErrorResponse)(data)) {
                message = data.errors[0]?.detail || message;
                errors = data.errors;
            }
            requestId = error.response.headers['x-request-id'];
            throw new MangaDexApiError(message, status, errors, requestId);
        }
        else if (error.request) {
            throw new MangaDexApiError('No response received from server.');
        }
        else {
            throw new MangaDexApiError(`Request setup error: ${error.message}`);
        }
    }
    buildQueryParams(params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null)
                continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item !== undefined && item !== null) {
                        searchParams.append(`${key}[]`, String(item));
                    }
                }
            }
            else if (typeof value === 'boolean') {
                searchParams.append(key, value ? '1' : '0');
            }
            else if (typeof value === 'object') {
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedValue !== undefined && nestedValue !== null) {
                        searchParams.append(`${key}[${nestedKey}]`, String(nestedValue));
                    }
                }
            }
            else {
                searchParams.append(key, String(value));
            }
        }
        const queryString = searchParams.toString();
        return queryString ? `?${queryString}` : '';
    }
    async safeRequest(config) {
        try {
            const response = await this.axiosInstance.request(config);
            if ((0, types_1.isMangaDexErrorResponse)(response.data)) {
                const errorData = response.data;
                throw new MangaDexApiError(errorData.errors[0]?.detail || 'API returned error', response.status, errorData.errors, response.headers['x-request-id']);
            }
            return response.data;
        }
        catch (error) {
            if (error instanceof MangaDexApiError)
                throw error;
            throw new MangaDexApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // ==================== Original Public API (preserved) ====================
    async ping() {
        const response = await this.axiosInstance.get('/ping', {
            responseType: 'text',
        });
        return response.data;
    }
    async searchManga(params = {}) {
        const safeParams = {
            ...params,
            contentRating: params.contentRating || this.defaultContentRating,
            limit: Math.min(params.limit || 10, 100),
        };
        const queryString = this.buildQueryParams(safeParams);
        return this.safeRequest({ method: 'GET', url: `/manga${queryString}` });
    }
    async getManga(id, includes = ['author', 'artist', 'cover_art']) {
        if (!this.isValidUUID(id))
            throw new MangaDexApiError(`Invalid UUID: ${id}`);
        const queryString = this.buildQueryParams({ includes });
        return this.safeRequest({ method: 'GET', url: `/manga/${id}${queryString}` });
    }
    async getMangaChapters(mangaId, params = {}) {
        if (!this.isValidUUID(mangaId))
            throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
        const safeParams = {
            ...params,
            limit: Math.min(params.limit || 100, 500),
            manga: mangaId,
        };
        const queryString = this.buildQueryParams(safeParams);
        return this.safeRequest({ method: 'GET', url: `/chapter${queryString}` });
    }
    async getMangaAggregate(mangaId, translatedLanguage) {
        if (!this.isValidUUID(mangaId))
            throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
        const queryString = this.buildQueryParams({ translatedLanguage });
        return this.safeRequest({
            method: 'GET',
            url: `/manga/${mangaId}/aggregate${queryString}`,
        });
    }
    async getMangaCovers(mangaId, limit = 100, offset = 0) {
        if (!this.isValidUUID(mangaId))
            throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
        const queryString = this.buildQueryParams({
            limit: Math.min(limit, 100),
            offset,
            manga: [mangaId],
            order: { volume: 'asc' },
        });
        return this.safeRequest({ method: 'GET', url: `/cover${queryString}` });
    }
    async getAuthor(authorId) {
        if (!this.isValidUUID(authorId))
            throw new MangaDexApiError(`Invalid UUID: ${authorId}`);
        return this.safeRequest({ method: 'GET', url: `/author/${authorId}` });
    }
    async getChapter(chapterId) {
        if (!this.isValidUUID(chapterId))
            throw new MangaDexApiError(`Invalid UUID: ${chapterId}`);
        return this.safeRequest({ method: 'GET', url: `/chapter/${chapterId}` });
    }
    async getChapterImages(chapterId) {
        if (!this.isValidUUID(chapterId))
            throw new MangaDexApiError(`Invalid UUID: ${chapterId}`);
        return this.safeRequest({
            method: 'GET',
            url: `/at-home/server/${chapterId}`,
        });
    }
    // ==================== NEW: Extended Methods ====================
    /**
     * Get manga statistics (rating, follows, comments)
     */
    async getStatistics(mangaId) {
        if (!this.isValidUUID(mangaId))
            throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
        return this.safeRequest({
            method: 'GET',
            url: `/statistics/manga/${mangaId}`,
        });
    }
    /**
     * Get all chapters with auto-pagination
     */
    async getAllChapters(mangaId, language, limit = 500) {
        const allChapters = [];
        let offset = 0;
        const pageLimit = Math.min(limit, 500);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const params = {
                limit: pageLimit,
                offset,
                translatedLanguage: language ? [language] : undefined,
                order: { chapter: 'asc' },
                includes: ['scanlation_group'],
            };
            const response = await this.getMangaChapters(mangaId, params);
            const chapters = Array.isArray(response.data)
                ? response.data.filter((ch) => ch != null)
                : (response.data ? [response.data] : []);
            allChapters.push(...chapters);
            if (!response.total || allChapters.length >= response.total || chapters.length < pageLimit) {
                break;
            }
            offset += pageLimit;
        }
        return allChapters;
    }
    /**
     * Get all covers with auto-pagination
     */
    async getAllCovers(mangaId) {
        const allCovers = [];
        let offset = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const response = await this.getMangaCovers(mangaId, 100, offset);
            const covers = Array.isArray(response.data)
                ? response.data.filter((c) => c != null)
                : (response.data ? [response.data] : []);
            allCovers.push(...covers);
            if (!response.total || allCovers.length >= response.total || covers.length < 100) {
                break;
            }
            offset += 100;
        }
        return allCovers;
    }
    /**
     * Get author details
     */
    async getAuthorDetails(authorId) {
        try {
            const response = await this.getAuthor(authorId);
            if (Array.isArray(response.data))
                return response.data[0];
            return response.data;
        }
        catch {
            return undefined;
        }
    }
    // ==================== Utility Methods (isValidUUID now public) ====================
    /**
     * Validate UUID format
     */
    isValidUUID(uuid) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    }
    /**
     * Get cover image URL — FIXED: includes mangaId in path
     */
    getCoverUrl(mangaId, cover, size = '512') {
        const baseUrl = 'https://uploads.mangadex.org/covers';
        const fileName = encodeURIComponent(cover.fileName);
        switch (size) {
            case 'original':
                return `${baseUrl}/${mangaId}/${fileName}`;
            case '512':
                return `${baseUrl}/${mangaId}/${fileName}.512.jpg`;
            case '256':
                return `${baseUrl}/${mangaId}/${fileName}.256.jpg`;
            default:
                return `${baseUrl}/${mangaId}/${fileName}.512.jpg`;
        }
    }
    /**
     * Legacy getCoverUrl without mangaId (backward compat, deprecated)
     */
    getCoverUrlLegacy(cover, size = '512') {
        const baseUrl = 'https://uploads.mangadex.org/covers';
        const fileName = encodeURIComponent(cover.fileName);
        switch (size) {
            case 'original':
                return `${baseUrl}/${fileName}`;
            case '512':
                return `${baseUrl}/${fileName}.512.jpg`;
            case '256':
                return `${baseUrl}/${fileName}.256.jpg`;
            default:
                return `${baseUrl}/${fileName}.512.jpg`;
        }
    }
    extractRelationships(manga, type) {
        return manga.relationships
            .filter((rel) => rel.type === type)
            .map((rel) => ({ id: rel.id, type: rel.type, attributes: rel.attributes }));
    }
    getEnglishTitle(manga) {
        const titles = manga.attributes.title;
        if (titles['en'])
            return titles['en'];
        if (titles['ja-ro'])
            return titles['ja-ro'];
        if (titles['ja'])
            return titles['ja'];
        const firstTitle = Object.values(titles).find((title) => title !== undefined);
        return firstTitle || 'Unknown Title';
    }
    getEnglishDescription(manga) {
        const descriptions = manga.attributes.description;
        return descriptions['en'] || descriptions['ja-ro'] || descriptions['ja'] || '';
    }
}
exports.MangaDexClient = MangaDexClient;
/**
 * Create a default MangaDex client with safe defaults
 */
function createDefaultClient() {
    return new MangaDexClient({
        baseUrl: 'https://api.mangadex.org',
        timeout: 30000,
        rateLimit: {
            maxRequests: 5,
            perMilliseconds: 1000,
        },
        defaultContentRating: ['safe', 'suggestive', 'erotica'],
        userAgent: 'MangaDex-TypeScript-Client/2.0.0',
    });
}
//# sourceMappingURL=client.js.map