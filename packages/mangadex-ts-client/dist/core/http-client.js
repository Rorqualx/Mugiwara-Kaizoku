"use strict";
/**
 * Shared HTTP client with rate limiting and caching
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const rate_limiter_1 = require("./rate-limiter");
const cache_1 = require("./cache");
const errors_1 = require("../types/errors");
class HttpClient {
    axios;
    rateLimiter;
    cache;
    source;
    constructor(config) {
        this.source = config.source;
        this.axios = axios_1.default.create({
            baseURL: config.baseURL,
            timeout: config.timeout ?? 30000,
            headers: {
                'User-Agent': config.userAgent ?? 'MangaDex-Metadata-Client/2.0.0',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                ...config.headers,
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 500,
        });
        if (config.rateLimit) {
            this.rateLimiter = new rate_limiter_1.RateLimiter(config.rateLimit.maxRequests, config.rateLimit.perMilliseconds);
            this.axios.interceptors.request.use(async (reqConfig) => {
                if (this.rateLimiter) {
                    await this.rateLimiter.waitIfNeeded();
                }
                return reqConfig;
            });
        }
        this.cache = new cache_1.TTLCache({
            ttlMs: config.cacheTtlMs ?? 5 * 60 * 1000,
            maxEntries: config.maxCacheEntries ?? 500,
            enabled: true,
        });
    }
    async get(url, config) {
        const cacheKey = `GET:${url}:${JSON.stringify(config?.params ?? {})}`;
        if (!config?.skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined)
                return cached;
        }
        const response = await this.request({ ...config, method: 'GET', url });
        this.cache.set(cacheKey, response);
        return response;
    }
    async post(url, data, config) {
        return this.request({ ...config, method: 'POST', url, data });
    }
    async request(config) {
        try {
            const response = await this.axios.request(config);
            if (response.status === 429) {
                const retryAfter = Number(response.headers['retry-after'] ?? 60) * 1000;
                throw new errors_1.RateLimitError(`Rate limit exceeded for ${this.source}`, retryAfter, this.source);
            }
            if (response.status >= 400) {
                throw new errors_1.ApiError(`HTTP ${response.status}: ${config.url}`, response.status, undefined, response.headers['x-request-id'], this.source);
            }
            return response.data;
        }
        catch (error) {
            if (error instanceof errors_1.ApiError || error instanceof errors_1.RateLimitError) {
                throw error;
            }
            if (axios_1.default.isAxiosError(error)) {
                const axiosErr = error;
                if (axiosErr.response) {
                    throw new errors_1.ApiError(`API request failed: ${axiosErr.message}`, axiosErr.response.status, undefined, axiosErr.response.headers['x-request-id'], this.source);
                }
                throw new errors_1.ApiError(`Network error: ${axiosErr.message}`, undefined, undefined, undefined, this.source);
            }
            throw new errors_1.ApiError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, undefined, undefined, undefined, this.source);
        }
    }
    clearCache() {
        this.cache.clear();
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map