"use strict";
/**
 * ComicVine API client
 * Rate limit: 200 requests/hour (~1 per 18 seconds)
 * Requires API key
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComicVineClient = void 0;
const http_client_1 = require("../../core/http-client");
const errors_1 = require("../../types/errors");
const VOLUME_FIELDS = [
    'id', 'name', 'aliases', 'api_detail_url', 'site_detail_url',
    'count_of_issues', 'date_added', 'date_last_updated', 'deck',
    'description', 'image', 'publisher', 'start_year', 'first_issue',
    'last_issue', 'genres', 'characters', 'concepts', 'people', 'story_arcs',
].join(',');
const ISSUE_FIELDS = [
    'id', 'name', 'issue_number', 'api_detail_url', 'site_detail_url',
    'volume', 'date_added', 'date_last_updated', 'cover_date', 'deck',
    'description', 'image', 'person_credits', 'character_credits',
    'story_arc_credits', 'concept_credits',
].join(',');
class ComicVineClient {
    http;
    apiKey;
    constructor(config) {
        if (!config.apiKey) {
            throw new Error('ComicVine API key is required');
        }
        this.apiKey = config.apiKey;
        this.http = new http_client_1.HttpClient({
            baseURL: 'https://comicvine.gamespot.com/api',
            timeout: 30000,
            userAgent: config.userAgent ?? 'MangaDex-Metadata-Client/2.0.0',
            rateLimit: {
                maxRequests: 1,
                perMilliseconds: 18000, // 200/hour ≈ 1 per 18s
            },
            cacheTtlMs: config.cacheTtlMs ?? 10 * 60 * 1000,
            source: 'comicvine',
            headers: {},
        });
    }
    /** Search volumes (manga series) */
    async searchVolumes(query, limit = 10) {
        const response = await this.http.get(`/search/`, {
            params: {
                api_key: this.apiKey,
                format: 'json',
                resources: 'volume',
                query,
                limit,
            },
        });
        this.checkResponse(response);
        return response.results;
    }
    /** Get a single volume by ID */
    async getVolume(id) {
        const response = await this.http.get(`/volume/4050-${id}/`, {
            params: {
                api_key: this.apiKey,
                format: 'json',
                field_list: VOLUME_FIELDS,
            },
        });
        this.checkResponse(response);
        return response.results;
    }
    /** Get all issues for a volume (auto-paginated) */
    async getAllIssues(volumeId) {
        const allIssues = [];
        let offset = 0;
        const pageLimit = 100;
        while (true) {
            const response = await this.http.get(`/issues/`, {
                params: {
                    api_key: this.apiKey,
                    format: 'json',
                    filter: `volume:${volumeId}`,
                    field_list: ISSUE_FIELDS,
                    limit: pageLimit,
                    offset,
                    sort: 'issue_number:asc',
                },
            });
            this.checkResponse(response);
            allIssues.push(...response.results);
            if (allIssues.length >= response.number_of_total_results ||
                response.results.length < pageLimit) {
                break;
            }
            offset += pageLimit;
        }
        return allIssues;
    }
    /** Get a single issue by ID */
    async getIssue(issueId) {
        const response = await this.http.get(`/issue/4000-${issueId}/`, {
            params: {
                api_key: this.apiKey,
                format: 'json',
                field_list: ISSUE_FIELDS,
            },
        });
        this.checkResponse(response);
        return response.results;
    }
    /** Fetch raw HTML page (for scraping) */
    async fetchPage(url) {
        const response = await this.http.get(url, {
            skipCache: true,
            responseType: 'text',
            baseURL: undefined,
        });
        return response;
    }
    checkResponse(response) {
        if (response.status_code !== 1) {
            throw new errors_1.ApiError(`ComicVine error: ${response.error}`, response.status_code, undefined, undefined, 'comicvine');
        }
    }
}
exports.ComicVineClient = ComicVineClient;
//# sourceMappingURL=client.js.map