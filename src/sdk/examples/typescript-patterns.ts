/**
 * Kaizoku API SDK - TypeScript Patterns and Best Practices
 */

import type {
  AsyncResult
} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
  isSuccess,
  isError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  createKaizokuApiClient,
  ApiError
} from '../kaizoku-api-sdk';

import type {
  MangaResource,
  PaginatedResponse,
  KaizokuApiConfig
} from '../kaizoku-api-sdk';


/**
 * Pattern 1: Type-safe configuration
 */
const createTypedClient = (overrides?: Partial<KaizokuApiConfig>): ReturnType<typeof createKaizokuApiClient> => {
  const defaultConfig: KaizokuApiConfig = {
     
    baseUrl: process.env["KAIZOKU_API_URL"] ?? 'https://api.kaizoku.app',
    apiKey: process.env["KAIZOKU_API_KEY"] ?? '',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  };
  
  return createKaizokuApiClient({ ...defaultConfig, ...overrides });
};

/**
 * Pattern 2: Custom error handling with type guards
 */
class KaizokuApiService {
  private client = createTypedClient();
  
  // Type guard for API errors
  private isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
  
  // Type guard for specific error codes
  private isNotFoundError(error: unknown): boolean {
    return this.isApiError(error) && error.statusCode === 404;
  }
  
  private isRateLimitError(error: unknown): boolean {
    return this.isApiError(error) && error.statusCode === 429;
  }
  
  async getMangaSafely(id: string | number): Promise<MangaResource | null> {
    try {
      const response = await this.client.manga.get(id);
      return response.data ?? null;
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        logger.info(`Manga ${id} not found`);
        return null;
      }
      
      if (this.isRateLimitError(error)) {
        console.error('Rate limit exceeded, please retry later');
        throw error;
      }
      
      // Re-throw unexpected errors
      throw error;
    }
  }
}

/**
 * Pattern 3: Result wrapper using centralized AsyncResult pattern
 */

class SafeApiClient {
  private client = createTypedClient();

  async getManga(id: string | number): Promise<AsyncResult<MangaResource, Error>> {
    try {
      const response = await this.client.manga.get(id);
      if (!response.data) {
        return createErrorResult(
          createContextualError(
            'No data returned',
            'NO_DATA',
            { statusCode: 200 }
          )
        );
      }
      return createSuccessResult(response.data);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        return createErrorResult(
          createContextualError(
            error.message,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            error.code ?? 'API_ERROR',
            { statusCode: error.statusCode }
          )
        );
      }
      return createErrorResult(
        createContextualError(
          'Unknown error occurred',
          'UNKNOWN',
          { statusCode: 500 }
        )
      );
    }
  }
  
  // Usage with type narrowing using AsyncResult
  async processManga(id: string): Promise<void> {
    const result = await this.getManga(id);

    if (isSuccess(result)) {
      // TypeScript knows result.data is MangaResource
      logger.info(`Processing manga: ${result.data["title"]}`);
      logger.info(`Status: ${result.data["status"]}`);
    } else if (isError(result)) {
      // TypeScript knows result.error is Error
      console.error(`Failed to get manga: ${result.error.message}`);
      const contextualError = result.error as unknown as { context?: Record<string, unknown> };
      console.error(`Error context:`, contextualError.context);
    }
  }
}

/**
 * Pattern 4: Generic pagination handler
 */
async function* paginateResults<T>(
  fetcher: (page: number) => Promise<PaginatedResponse<T>>,
  maxPages?: number
): AsyncGenerator<T[], void, unknown> {
  let page = 1;
  let hasMore = true;

  // Example demonstrating pagination pattern - sequential await required for pagination
  while (hasMore && (!maxPages || page <= maxPages)) {
    // eslint-disable-next-line no-await-in-loop -- Example pattern: pagination requires sequential processing
    const response = await fetcher(page);

    if (response.data && response.data.length > 0) {
      yield response.data;
    }

    hasMore = response.meta?.hasMore ?? false;
    page++;
  }
}

// Usage example
// eslint-disable-next-line @typescript-eslint/naming-convention
async function _getAllManga(client: ReturnType<typeof createTypedClient>): Promise<MangaResource[]> {
  const allManga: MangaResource[] = [];
  
  for await (const batch of paginateResults(
    (page) => client.manga.list({ page, limit: 50 }),
    10 // Max 10 pages
  )) {
    allManga.push(...batch);
    logger.info(`Fetched ${batch.length} manga, total: ${allManga.length}`);
  }
  
  return allManga;
}

/**
 * Pattern 5: Request builder pattern
 */
class MangaQueryBuilder {
  private params: Record<string, unknown> = {};

  withStatus(status: MangaResource['status']): this {
    this.params['status'] = status;
    return this;
  }

  withLibrary(libraryId: string): this {
    this.params['libraryId'] = libraryId;
    return this;
  }

  withSearch(query: string): this {
    this.params['search'] = query;
    return this;
  }

  withPagination(page: number, limit: number): this {
    this.params['page'] = page;
    this.params['limit'] = limit;
    return this;
  }

  build(): {
    page?: number;
    limit?: number;
    libraryId?: string;
    status?: string;
    search?: string;
  } {
    return this.params as {
      page?: number;
      limit?: number;
      libraryId?: string;
      status?: string;
      search?: string;
    };
  }
}

// Usage
// eslint-disable-next-line @typescript-eslint/naming-convention
async function _searchActiveManga(client: ReturnType<typeof createTypedClient>): Promise<PaginatedResponse<MangaResource>> {
  const query = new MangaQueryBuilder()
    .withStatus('ACTIVE')
    .withSearch('One Piece')
    .withPagination(1, 20)
    .build();

  return client.manga.list(query);
}

/**
 * Pattern 6: Retry with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    shouldRetry = (error) => !(error instanceof ApiError && error.statusCode < 500)
  } = options;

  let lastError: string | undefined;

  // Example demonstrating retry pattern - sequential await required for retry logic
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Example pattern: retry requires sequential attempts
      return await operation();
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
lastError = errorMessage;

      if (!shouldRetry(errorMessage) || attempt === maxAttempts - 1) {
        throw new Error(errorMessage);
      }

      const waitTime = backoff === 'exponential'
        ? delay * Math.pow(2, attempt)
        : delay * (attempt + 1);

      logger.info(`Retry attempt ${attempt + 1} after ${waitTime}ms`);
      // eslint-disable-next-line no-await-in-loop -- Example pattern: exponential backoff delay between retries
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), waitTime);
      });
    }
  }

  throw new Error(lastError ?? 'Operation failed');
}

/**
 * Pattern 7: Type-safe event handling
 */
type EventTypes = {
  'manga.created': { id: number; title: string; source: string };
  'manga.updated': { id: number; title: string; changes: string[] };
  'chapter.downloaded': {
    chapterId: number;
    mangaId: number;
    chapterTitle: string;
    mangaTitle: string;
    sizeBytes: number;
  };
  'task.completed': { type: string; duration: number; result: unknown };
};

class TypedEventHandler {
  private eventSource: EventSource | null = null;
  private handlers = new Map<keyof EventTypes, Set<(data: unknown) => void>>();
  
  connect(client: ReturnType<typeof createTypedClient>): void {
    this.eventSource = client.events.stream({
      events: Array.from(this.handlers.keys()),
    });
  }
  
  on<T extends keyof EventTypes>(
    event: T,
    handler: (data: EventTypes[T]) => void
  ): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    // Create a type-erased handler for storage
    const untypedHandler = handler as (data: unknown) => void;
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.add(untypedHandler);
    }

    // Add listener to EventSource
    if (this.eventSource) {
      this.eventSource.addEventListener(event, (e: Event) => {
        try {
          const messageEvent = e as MessageEvent;
          const data = JSON.parse(messageEvent.data as string) as EventTypes[T];
          handler(data);
        } catch (error: unknown) {
          console.error(`Failed to parse event ${event}:`, error);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(untypedHandler);
    };
  }
  
  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

// Usage with full type safety
const eventHandler = new TypedEventHandler();

eventHandler.on('manga.created', (data) => {
  // TypeScript knows data has { id, title, source }
  logger.info(`New manga: ${data["title"]} from ${data["source"]}`);
});

eventHandler.on('chapter.downloaded', (data) => {
  // TypeScript knows all properties of chapter.downloaded event
  const sizeMB = (data.sizeBytes / 1024 / 1024).toFixed(2);
  logger.info(`Downloaded ${data.chapterTitle} (${sizeMB} MB)`);
});

/**
 * Pattern 8: Cancellable operations manager
 */
class OperationManager {
  private operations = new Map<string, AbortController>();
  
  async execute<T>(
    id: string,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    // Cancel any existing operation with the same ID
    this.cancel(id);
    
    const controller = new AbortController();
    this.operations.set(id, controller);
    
    try {
      const result = await operation(controller.signal);
      this.operations.delete(id);
      return result;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.operations.delete(id);
      throw new Error(errorMessage);
    }
  }
  
  cancel(id: string): boolean {
    const controller = this.operations.get(id);
    if (controller) {
      controller.abort();
      this.operations.delete(id);
      return true;
    }
    return false;
  }
  
  cancelAll(): void {
    this.operations.forEach(controller => controller.abort());
    this.operations.clear();
  }
}

/**
 * Pattern 9: API response cache with TTL
 */
class ApiCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  
  set(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }
  
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Cached API client
class CachedApiClient {
  private client = createTypedClient();
  private cache = new ApiCache<MangaResource>();

  async getManga(id: string | number, useCache = true): Promise<MangaResource | null> {
    const cacheKey = `manga:${id}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const response = await this.client.manga.get(id);
    if (response.data) {
      this.cache.set(cacheKey, response.data, 300000); // 5 minutes
    }

    return response.data ?? null;
  }
}

/**
 * Pattern 10: Batch request queue
 */
class BatchQueue<T> {
  private queue: Array<{ id: string; operation: () => Promise<T> }> = [];
  private processing = false;
  private concurrency: number;
  
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
  }
  
  add(id: string, operation: () => Promise<T>): void {
    this.queue.push({ id, operation });
    if (!this.processing) {
      void this.process();
    }
  }
  
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    // Example demonstrating batch queue pattern - sequential batch processing
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);

      // eslint-disable-next-line no-await-in-loop -- Example pattern: sequential batch processing with controlled concurrency
      await Promise.allSettled(
        batch.map(async ({ id, operation }) => {
          try {
            await operation();
            logger.info(`✅ Completed: ${id}`);
          } catch (error: unknown) {
            console.error(`❌ Failed: ${id}`, error);
          }
        })
      );
    }

    this.processing = false;
  }
}

// Export patterns for use
export {
  createTypedClient,
  KaizokuApiService,
  SafeApiClient,
  paginateResults,
  MangaQueryBuilder,
  withRetry,
  TypedEventHandler,
  OperationManager,
  ApiCache,
  CachedApiClient,
  BatchQueue,
  type EventTypes
};