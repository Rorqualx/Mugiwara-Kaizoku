/**
 * Fully Protected ComicVine API Client
 *
 * Integrates all 5 phases of protection:
 * 1. Rate limiting (200 requests/hour)
 * 2. Velocity detection prevention
 * 3. Retry logic with exponential backoff
 * 4. Multi-tier caching and deduplication
 * 5. Circuit breaker pattern
 */
import nodeFetch from 'node-fetch';

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess} from '@/utils/async-result';
import { ApiError, AppError } from '@/utils/error-handling';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { CircuitBreaker, CircuitState } from './circuitBreaker';
import { FieldOptimizer } from './fieldOptimizer';
import { MultiTierCache } from './multiTierCache';
import { ComicVineRateLimiter } from './rateLimiter';
import { ComicVineRetryHandler } from './retryHandler';
import { VelocityDetector } from './velocityDetector';

/**
 * Fetch function type (compatible with both node-fetch and global fetch)
 */
type FetchFunction = typeof fetch;

/**
 * Configuration for fully protected client
 */
export interface FullyProtectedClientConfig {
    apiKey: string;
    apiEndpoint?: string;
    // Protection layers
    rateLimiting?: boolean;
    velocityDetection?: boolean;
    retryLogic?: boolean;
    caching?: boolean;
    circuitBreaker?: boolean;
    fieldOptimization?: boolean;
    // Custom configurations
    rateLimiterConfig?: unknown;
    velocityConfig?: unknown;
    retryConfig?: unknown;
    cacheConfig?: unknown;
    circuitConfig?: unknown;
    // Dependency injection for testing
    fetchFn?: FetchFunction;
}
/**
 * API request options
 */
interface RequestOptions {
    path: string;
    params?: Record<string, string>;
    fields?: string[];
    operation?: string;
    skipCache?: boolean;
    fallbackData?: unknown;
}
/**
 * Fully Protected ComicVine Client
 *
 * Production-ready client with all protection mechanisms
 */
export class FullyProtectedComicVineClient {
    private apiKey: string;
    private apiEndpoint: string;
    private fetchFn: FetchFunction;
    // Protection layers
    private rateLimiter: ComicVineRateLimiter;
    private velocityDetector: VelocityDetector;
    private retryHandler: ComicVineRetryHandler;
    private cache: MultiTierCache;
    private fieldOptimizer: FieldOptimizer;
    private circuitBreaker: CircuitBreaker;
    // Feature flags
    private useRateLimiting: boolean;
    private useVelocityDetection: boolean;
    private useRetryLogic: boolean;
    private useCaching: boolean;
    private useCircuitBreaker: boolean;
    private useFieldOptimization: boolean;
    constructor(config: FullyProtectedClientConfig) {
        if (!config.apiKey) {
            throw new ValidationError('ComicVine API key is required');
        }
        this.apiKey = config.apiKey;
        this.apiEndpoint = config.apiEndpoint ?? 'https://comicvine.gamespot.com/api';
        this.fetchFn = config.fetchFn ?? (nodeFetch as unknown as FetchFunction);
        // Initialize protection layers
        this.rateLimiter = new ComicVineRateLimiter(config.rateLimiterConfig ?? {
            maxRequestsPerHour: 200,
            minDelayMs: 1000,
            safeDelayMs: 2000,
            maxDelayMs: 5000,
            warningThreshold: 0.75
        });
        this.velocityDetector = new VelocityDetector(config.velocityConfig || {
            minJitterMs: 100,
            maxJitterMs: 500,
            burstThreshold: 5,
            burstCooldownMs: 10000,
            humanizeRequests: true
        });
        this.retryHandler = new ComicVineRetryHandler(config.retryConfig || {
            maxRetries: 5,
            baseDelayMs: 2000,
            maxDelayMs: 64000,
            jitterMs: 500
        });
        const cacheConfigInput = config.cacheConfig as unknown as {
            l1MaxSize?: number;
            l1TtlMs?: number;
            l2Enabled?: boolean;
            l2MaxSize?: number;
            l2TtlMs?: number;
            l3Enabled?: boolean;
            l3TtlMs?: number;
            deduplicationEnabled?: boolean;
            deduplicationWindowMs?: number;
        } | undefined;
        this.cache = new MultiTierCache(cacheConfigInput ?? {
            l1MaxSize: 100,
            l1TtlMs: 300000, // 5 minutes
            l2Enabled: true,
            l2MaxSize: 1000,
            l2TtlMs: 3600000, // 1 hour
            l3Enabled: true,
            l3TtlMs: 86400000, // 24 hours
            deduplicationEnabled: true,
            deduplicationWindowMs: 5000
        });
        this.fieldOptimizer = new FieldOptimizer();
        this.circuitBreaker = new CircuitBreaker(config.circuitConfig || {
            failureThreshold: 5,
            successThreshold: 3,
            timeout: 60000,
            errorThresholdPercentage: 50,
            fallbackFunction: () => this.getFallbackData()
        });
        // Set feature flags
        this.useRateLimiting = config.rateLimiting !== false;
        this.useVelocityDetection = config.velocityDetection !== false;
        this.useRetryLogic = config.retryLogic !== false;
        this.useCaching = config.caching !== false;
        this.useCircuitBreaker = config.circuitBreaker !== false;
        this.useFieldOptimization = config.fieldOptimization !== false;
        logger.info('Fully protected ComicVine client initialized', {
            rateLimiting: this.useRateLimiting,
            velocityDetection: this.useVelocityDetection,
            retryLogic: this.useRetryLogic,
            caching: this.useCaching,
            circuitBreaker: this.useCircuitBreaker,
            fieldOptimization: this.useFieldOptimization
        });
    }
    /**
     * Make a protected API request
     *
     * @param options Request options
     * @returns API response with full protection
     */
    public async request<T>(options: RequestOptions): Promise<AsyncResult<T>> {
        try {
            // Generate cache key
            const cacheKey = this.generateCacheKey(options);
            // Check cache first (if enabled and not skipped)
            if (this.useCaching && !options.skipCache) {
                const cached = await this.cache.get(cacheKey);
                if (cached !== undefined) {
                    logger.debug('Cache hit', { path: options.path, cacheKey });
                    return createSuccessResult(cached as T);
                }
            }
            // Use deduplication for concurrent identical requests
            if (this.useCaching) {
                const result = await this.cache.getOrFetch(cacheKey, async () => {
                    const asyncResult = await this.executeProtectedRequest<T>(options);
                    // Cache successful results
                    if (isSuccess(asyncResult)) {
                        await this.cache.set(cacheKey, asyncResult.data);
                    }
                    return asyncResult;
                });
                return result as AsyncResult<T>;
            }
            // Execute without deduplication if caching is disabled
            return await this.executeProtectedRequest<T>(options);
        }
        catch (error: unknown) {
            logger.error('Request failed', {
                path: options.path,
                error: error instanceof Error ? error.message : String(error)
            });
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Execute request with all protection layers
     */
    private async executeProtectedRequest<T>(options: RequestOptions): Promise<AsyncResult<T>> {
        // Determine resource type for rate limiting
        const resource = this.getResourceType(options.path);
        // Build the request function with all protection layers
        const protectedRequest = async (): Promise<T> => {
            // Apply circuit breaker
            if (this.useCircuitBreaker) {
                return this.circuitBreaker.execute(async () => {
                    return this.executeWithRateLimiting<T>(options, resource);
                });
            }
            return this.executeWithRateLimiting<T>(options, resource);
        };
        // Apply retry logic
        if (this.useRetryLogic) {
            try {
                const result = await this.retryHandler.executeWithRetry(protectedRequest, {
                    resource,
                    ...(options.operation !== undefined && { operation: options.operation })
                });
                return createSuccessResult(result);
            }
            catch (error: unknown) {
                return createErrorResult(error instanceof Error ? error : new Error(String(error)));
            }
        }
        // Execute without retry
        try {
            const result = await protectedRequest();
            return createSuccessResult(result);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * Execute with rate limiting and velocity detection
     */
    private async executeWithRateLimiting<T>(options: RequestOptions, resource: string): Promise<T> {
        // Apply rate limiting
        if (this.useRateLimiting) {
            await this.rateLimiter.acquireSlot(resource);
        }
        // Apply velocity detection
        if (this.useVelocityDetection) {
            const baseDelay = this.useRateLimiting
                ? this.rateLimiter.getDelayMs(resource)
                : 0;
            const additionalDelay = this.velocityDetector.calculateAdditionalDelay(baseDelay, resource);
            if (additionalDelay > 0) {
                await this.sleep(additionalDelay);
            }
        }
        // Make the actual API request
        return this.makeApiRequest<T>(options);
    }
    /**
     * Make the actual API request
     */
    private async makeApiRequest<T>(options: RequestOptions): Promise<T> {
        // Build URL
        const url = new URL(options.path, this.apiEndpoint);
        url.searchParams.append('api_key', this.apiKey);
        url.searchParams.append('format', 'json');
        // Apply field optimization
        if (this.useFieldOptimization && options.operation) {
            type ValidOperation = 'minimal' | 'standard' | 'extended' | 'search' | 'volumes' | 'issues' | 'custom';

            // Map operation to valid field set operation
            const operationMap: Record<string, ValidOperation> = {
                'volume': 'volumes',
                'issue': 'issues',
                'search': 'search',
                'custom': 'custom'
            };

            const mappedOperation = operationMap[options.operation] ?? 'standard';
            const optimizedFields = this.fieldOptimizer.getFields(mappedOperation, options.fields);
            url.searchParams.append('field_list', optimizedFields);
        }
        else if (options.fields) {
            url.searchParams.append('field_list', options.fields.join(','));
        }
        // Add other parameters
        if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
                url.searchParams.append(key, value);
            }
        }
        // Make request
        const response = await this.fetchFn(url.toString(), {
            headers: {
                'User-Agent': 'MangaManager/1.0',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new ApiError(`ComicVine API error: ${response.statusText}`, response["status"], { path: options.path, status: response["status"] });
        }
        const data = await response.json() as unknown;
        const dataRecord = data as Record<string, unknown>;
        if (dataRecord['error'] !== 'OK' && dataRecord['error']) {
            throw new AppError(`ComicVine API returned error: ${String(dataRecord['error'])}`, { response: data, path: options.path });
        }
        return data as T;
    }
    /**
     * Get resource type from path
     */
    private getResourceType(path: string): string {
        if (path.includes('/volumes'))
            return 'volumes';
        if (path.includes('/volume/'))
            return 'volume';
        if (path.includes('/issues'))
            return 'issues';
        if (path.includes('/issue/'))
            return 'issue';
        if (path.includes('/search'))
            return 'search';
        if (path.includes('/characters'))
            return 'characters';
        if (path.includes('/publishers'))
            return 'publishers';
        return 'general';
    }
    /**
     * Generate cache key
     */
    private generateCacheKey(options: RequestOptions): string {
        const parts = [
            options.path,
            JSON.stringify(options.params ?? {}),
            JSON.stringify(options.fields ?? []),
            options.operation ?? ''
        ];
        return parts.join(':');
    }
    /**
     * Get fallback data for circuit breaker
     */
    private getFallbackData(): Record<string, unknown> {
        return {
            results: [],
            error: 'Service temporarily unavailable',
            cached: true,
            fallback: true
        };
    }
    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
    /**
     * Get comprehensive health status
     */
    public getHealthStatus(): { rateLimiter: unknown; velocityDetector: unknown; retryHandler: unknown; cache: unknown; fieldOptimizer: unknown; circuitBreaker: unknown; summary: { healthy: boolean; recommendations: string[] } } {
        return {
            rateLimiter: this.useRateLimiting ? this.rateLimiter.getStats() : null,
            velocityDetector: this.useVelocityDetection ? this.velocityDetector.getStats() : null,
            retryHandler: this.useRetryLogic ? this.retryHandler.getStats() : null,
            cache: this.useCaching ? this.cache.getStats() : null,
            fieldOptimizer: this.useFieldOptimization ? this.fieldOptimizer.getStats() : null,
            circuitBreaker: this.useCircuitBreaker ? this.circuitBreaker.getHealth() : null,
            summary: {
                healthy: this.isHealthy(),
                recommendations: this.getHealthRecommendations()
            }
        };
    }
    /**
     * Check overall health
     */
    private isHealthy(): boolean {
        // Check circuit breaker state
        if (this.useCircuitBreaker) {
            const health = this.circuitBreaker.getHealth();
            if (health.state === CircuitState.OPEN) {
                return false;
            }
        }
        // Check rate limit usage
        if (this.useRateLimiting) {
            const stats = this.rateLimiter.getStats();
            if (stats.usagePercentage > 90) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get health recommendations
     */
    private getHealthRecommendations(): string[] {
        const recommendations: string[] = [];
        // Check circuit breaker
        if (this.useCircuitBreaker) {
            const health = this.circuitBreaker.getHealth();
            if (health.errorRate > 30) {
                recommendations.push('High error rate detected. Review error patterns.');
            }
        }
        // Check rate limiting
        if (this.useRateLimiting) {
            const stats = this.rateLimiter.getStats();
            if (stats.usagePercentage > 75) {
                recommendations.push('Approaching rate limit. Consider caching more aggressively.');
            }
        }
        // Check cache effectiveness
        if (this.useCaching) {
            const stats = this.cache.getStats();
            const hitRate = stats.l1.hits / (stats.l1.hits + stats.l1.misses);
            if (hitRate < 0.3) {
                recommendations.push('Low cache hit rate. Review cache keys and TTL settings.');
            }
        }
        return recommendations;
    }
    /**
     * Reset all protection mechanisms
     */
    public async reset(): Promise<void> {
        this.rateLimiter.reset();
        this.velocityDetector.reset();
        this.retryHandler.reset();
        await this.cache.clear();
        this.fieldOptimizer.reset();
        this.circuitBreaker.reset();
        logger.info('All protection mechanisms reset');
    }
}
