/**
 * Base Fandom API Client with Rate Limiting and Error Handling
 */

import { logger } from '@/utils/logger';

import type {
  FandomAPIConfig,
  FandomAPIError,
  CacheEntry
} from './types';

export class RateLimiter {
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => void> = [];
  private processing: boolean = false;
  
  constructor(
    private requestsPerSecond: number = 2,
    private burstLimit: number = 5
  ) {}

  async throttle(): Promise<void> {
    return new Promise((resolve) => {
      this.requestQueue.push(resolve);
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minDelay = 1000 / this.requestsPerSecond;

      if (timeSinceLastRequest < minDelay) {
        // eslint-disable-next-line no-await-in-loop -- Rate limiting requires sequential queue processing with delays between batches
        await this.sleep(minDelay - timeSinceLastRequest);
      }

      // Process burst of requests
      const batch = this.requestQueue.splice(0, Math.min(this.burstLimit, this.requestQueue.length));
      this.lastRequestTime = Date.now();

      batch.forEach(resolve => resolve());

      if (this.requestQueue.length > 0) {
        // eslint-disable-next-line no-await-in-loop -- Rate limiting requires sequential delays between request batches to enforce rate limits
        await this.sleep(minDelay);
      }
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

export class FandomCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private ttl: number = 3600) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + (this.ttl * 1000)
    };

    this.cache.set(key, entry);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

export class FandomAPIClient {
  protected rateLimiter: RateLimiter;
  protected cache: FandomCache | null = null;
  protected log = logger.child('FandomAPIClient');

  constructor(protected config: FandomAPIConfig) {
    this.rateLimiter = new RateLimiter(
      config.rateLimit?.requestsPerSecond ?? 2,
      config.rateLimit?.burstLimit ?? 5
    );

    if (config.cache?.enabled) {
      this.cache = new FandomCache(config.cache.ttl);
    }
  }

  protected buildUrl(endpoint: string, params: Record<string, unknown>): string {
    const url = new URL(endpoint, this.config.baseUrl);

    // Add CORS support for browser requests
    const urlParams = { ...params };
    if (!urlParams["origin"]) {
      urlParams["origin"] = '*';
    }

    Object.entries(urlParams).forEach(([key, value]) => {
      if (value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  protected getCacheKey(endpoint: string, params: Record<string, unknown>): string {
    return `${endpoint}:${JSON.stringify(params)}`;
  }

  /**
   * Check if cached response is available
   */
  protected checkCache<T>(cacheKey: string, endpoint: string, params: Record<string, unknown>): T | null {
    if (!this.cache) {
      return null;
    }

    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) {
      this.log.debug('Cache hit', { endpoint, params });
    }
    return cached;
  }

  /**
   * Perform HTTP fetch with timeout
   */
  protected async performFetch(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    // 5 second timeout per request to allow sequential MediaWiki + v1 API calls
    // to complete within the 12-second per-wiki timeout in FandomProvider
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? 5000
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...options.headers
        }
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Validate HTTP response status
   */
  protected validateResponse(response: Response, endpoint: string): void {
    if (response.ok) {
      return;
    }

    if (response["status"] === 404) {
      throw new FandomAPIErrorImpl(
        'Resource not found',
        'NOT_FOUND',
        404,
        endpoint
      );
    }

    if (response["status"] >= 500) {
      throw new FandomAPIErrorImpl(
        `Server error: ${response.statusText}`,
        'SERVER_ERROR',
        response["status"],
        endpoint
      );
    }

    throw new FandomAPIErrorImpl(
      `HTTP ${response["status"]}: ${response.statusText}`,
      'HTTP_ERROR',
      response["status"],
      endpoint
    );
  }

  /**
   * Check for API-specific errors in response data
   */
  protected checkApiErrors(data: Record<string, unknown>, endpoint: string): void {
    if (!data['error']) {
      return;
    }

    const error = data['error'] as unknown;
    const errorInfo = typeof error === 'object' && error !== null && 'info' in error
      ? (error as Record<string, unknown>)['info']
      : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new FandomAPIErrorImpl(
      typeof errorInfo === 'string' ? errorInfo : errorMessage || 'API Error',
      errorMessage,
      undefined,
      endpoint
    );
  }

  /**
   * Handle request error and determine if retry is needed
   */
  protected async handleRequestError(
    error: unknown,
    attempt: number,
    maxRetries: number,
    endpoint: string
  ): Promise<boolean> {
    const errorObj = error as Error;

    // Don't retry 404s
    if (error instanceof FandomAPIErrorImpl && error.statusCode === 404) {
      throw error;
    }

    // Retry if attempts remain
    if (attempt < maxRetries) {
      this.log.warn(`Request attempt ${attempt} failed, retrying...`, {
        endpoint,
        error: errorObj.message
      });

      // Exponential backoff
      await this.sleep(1000 * Math.pow(2, attempt - 1));
      return true; // Continue retrying
    }

    return false; // No more retries
  }

  /**
   * Perform single request attempt
   */
  protected async attemptRequest(
    url: string,
    endpoint: string,
    options: RequestInit
  ): Promise<Record<string, unknown>> {
    const response = await this.performFetch(url, options);
    this.validateResponse(response, endpoint);

    const data = await response.json() as Record<string, unknown>;
    this.checkApiErrors(data, endpoint);

    return data;
  }

  protected async request<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const cacheKey = this.getCacheKey(endpoint, params);

    // Check cache for GET requests
    if (options.method === 'GET') {
      const cached = this.checkCache<T>(cacheKey, endpoint, params);
      if (cached !== null) {
        return cached;
      }
    }

    // Apply rate limiting
    await this.rateLimiter.throttle();

    // Perform request with retries (reduced to 1 for faster fail-fast behavior)
    const maxRetries = this.config.retries ?? 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log.debug('Making request', { url, attempt });

        // eslint-disable-next-line no-await-in-loop -- Retry logic requires sequential attempts with exponential backoff between failures
        const data = await this.attemptRequest(url, endpoint, options);

        // Cache successful GET requests
        if (this.cache && options.method === 'GET') {
          this.cache.set(cacheKey, data);
        }

        return data as T;

      } catch (error: unknown) {
        lastError = error as Error;
        // eslint-disable-next-line no-await-in-loop -- Retry with backoff requires sequential error handling and delay calculation
        const shouldRetry = await this.handleRequestError(error, attempt, maxRetries, endpoint);

        if (!shouldRetry) {
          break;
        }
      }
    }

    this.log.error('All request attempts failed', {
      endpoint,
      params,
      error: lastError?.message
    });

    throw new FandomAPIErrorImpl(
      `Failed after ${maxRetries} attempts: ${lastError?.message}`,
      'MAX_RETRIES',
      undefined,
      endpoint
    );
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  public clearCache(): void {
    this.cache?.clear();
  }

  public destroy(): void {
    this.cache?.destroy();
  }
}

// Error class implementation
export class FandomAPIErrorImpl extends Error implements FandomAPIError {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this["name"] = 'FandomAPIError';
    Error.captureStackTrace(this, this.constructor);
  }
}