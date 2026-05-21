/**
 * Shared HTTP client with rate limiting and caching
 */
import { AxiosRequestConfig } from 'axios';
import { DataSource } from '../types/common';
export interface HttpClientConfig {
    baseURL: string;
    timeout?: number;
    userAgent?: string;
    rateLimit?: {
        maxRequests: number;
        perMilliseconds: number;
    };
    cacheTtlMs?: number;
    maxCacheEntries?: number;
    source: DataSource;
    headers?: Record<string, string>;
}
export declare class HttpClient {
    private readonly axios;
    private readonly rateLimiter?;
    private readonly cache;
    private readonly source;
    constructor(config: HttpClientConfig);
    get<T>(url: string, config?: AxiosRequestConfig & {
        skipCache?: boolean;
    }): Promise<T>;
    post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
    request<T>(config: AxiosRequestConfig): Promise<T>;
    clearCache(): void;
}
//# sourceMappingURL=http-client.d.ts.map