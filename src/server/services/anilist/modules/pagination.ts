/**
 * Pagination Support for AniList API
 *
 * This module provides comprehensive pagination support for AniList GraphQL queries,
 * including metadata, helpers for fetching all pages, and cursor-based navigation.
 */
/**
 * Pagination parameters for AniList queries
 */
export interface PaginationParams {
    /**
     * Page number (1-indexed)
     * @default 1
     */
    page?: number;
    /**
     * Number of items per page
     * @default 10
     * @minimum 1
     * @maximum 50
     */
    perPage?: number;
}
/**
 * Pagination metadata returned with results
 */
export interface PaginationInfo {
    /**
     * Total number of items across all pages
     */
    total: number;
    /**
     * Current page number (1-indexed)
     */
    currentPage: number;
    /**
     * Last page number
     */
    lastPage: number;
    /**
     * Whether there is a next page
     */
    hasNextPage: boolean;
    /**
     * Number of items per page
     */
    perPage: number;
}
/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    /**
     * The actual data items for this page
     */
    data: T[];
    /**
     * Pagination metadata
     */
    pageInfo: PaginationInfo;
}
/**
 * Options for fetching all pages
 */
export interface FetchAllPagesOptions {
    /**
     * Maximum number of pages to fetch
     * @default Infinity
     */
    maxPages?: number;
    /**
     * Delay between page requests in milliseconds
     * @default 100
     */
    delayBetweenPages?: number;
    /**
     * Callback function called after each page is fetched
     */
    onPageFetched?: (page: number, items: unknown[], pageInfo: PaginationInfo) => void;
    /**
     * Whether to stop fetching if an error occurs
     * @default false
     */
    stopOnError?: boolean;
    /**
     * Items per page for batch fetching
     * @default 50
     */
    perPage?: number;
}
/**
 * AniList Page response structure
 */
export interface AniListPageInfo {
    total: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
    perPage: number;
}
/**
 * AniList Page response wrapper
 */
export interface AniListPage<T> {
    pageInfo: AniListPageInfo;
    media?: T[];
    characters?: T[];
    staff?: T[];
    studios?: T[];
}
/**
 * Helper to build pagination variables for GraphQL queries
 */
export function buildPaginationVariables(params: PaginationParams = {}): Record<string, number> {
    return {
        page: params.page ?? 1,
        perPage: Math.min(params.perPage ?? 10, 50) // Cap at 50 per AniList limits
    };
}
/**
 * Helper to extract pagination info from AniList Page response
 */
export function extractPaginationInfo(pageResponse: AniListPageInfo): PaginationInfo {
    return {
        total: pageResponse.total,
        currentPage: pageResponse.currentPage,
        lastPage: pageResponse.lastPage,
        hasNextPage: pageResponse.hasNextPage,
        perPage: pageResponse.perPage
    };
}
/**
 * Helper to calculate optimal page size based on total items
 */
export function calculateOptimalPageSize(totalItems: number, preferredPageSize: number = 20): number {
    // For small result sets, fetch all at once
    if (totalItems <= 10) {
        return 10;
    }
    // For medium result sets, use a moderate page size
    if (totalItems <= 50) {
        return Math.min(totalItems, 20);
    }
    // For large result sets, use the maximum allowed
    return Math.min(preferredPageSize, 50);
}
/**
 * Helper to determine if more pages should be fetched
 */
export function shouldFetchMorePages(currentPage: number, lastPage: number, maxPages: number = Infinity, hasNextPage: boolean = true): boolean {
    return hasNextPage && currentPage < lastPage && currentPage < maxPages;
}
/**
 * Creates an async iterator for paginated results
 */
export async function* createPaginationIterator<T>(fetchPage: (page: number) => Promise<PaginatedResponse<T>>, options: FetchAllPagesOptions = {}): AsyncGenerator<T[], void, unknown> {
    let currentPage = 1;
    let hasMore = true;
    // Pagination must be sequential - each page depends on previous response
    while (hasMore) {
        try {
            // eslint-disable-next-line no-await-in-loop -- Required for pagination - each page depends on previous response
            const response = await fetchPage(currentPage);
            // Yield the current page's data
            yield response.data;
            // Call the callback if provided
            if (options.onPageFetched) {
                options.onPageFetched(currentPage, response.data, response.pageInfo);
            }
            // Check if we should continue
            hasMore = shouldFetchMorePages(currentPage, response.pageInfo.lastPage, options.maxPages, response.pageInfo.hasNextPage);
            if (hasMore) {
                currentPage++;
                // Add delay between requests to be respectful to the API
                if (options.delayBetweenPages && options.delayBetweenPages > 0) {
                    // eslint-disable-next-line no-await-in-loop -- Required for API rate limiting between pagination requests
                    await new Promise(resolve => {
                        setTimeout(resolve, options.delayBetweenPages);
                    });
                }
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
if (options.stopOnError) {
                throw new Error(errorMessage);
            }
            // Otherwise, stop iteration but don't throw
            hasMore = false;
        }
    }
}
/**
 * Fetches all pages and returns them as a single array
 */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<PaginatedResponse<T>>, options: FetchAllPagesOptions = {}): Promise<T[]> {
    const allItems: T[] = [];
    for await (const pageItems of createPaginationIterator(fetchPage, options)) {
        allItems.push(...pageItems);
    }
    return allItems;
}
/**
 * Batches multiple queries into optimal page requests
 */
export class PaginationBatcher {
    private pendingQueries: Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: unknown) => void;
    }[]> = new Map();
    private batchTimeout: NodeJS.Timeout | null = null;
    private batchDelay: number;
    constructor(batchDelay: number = 50) {
        this.batchDelay = batchDelay;
    }
    /**
     * Adds a query to the batch
     */
    public async addQuery<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Add to pending queries
            if (!this.pendingQueries.has(key)) {
                this.pendingQueries.set(key, []);
            }
            const queries = this.pendingQueries.get(key);
            if (queries) {
                queries.push({ resolve: resolve as (value: unknown) => void, reject });
            }
            // Schedule batch execution
            this.batchTimeout ??= setTimeout(() => { void this.executeBatch(fetchFn); }, this.batchDelay);
        });
    }
    /**
     * Executes all pending queries in the batch
     */
    private async executeBatch<T>(fetchFn: () => Promise<T>): Promise<void> {
        const queries = new Map(this.pendingQueries);
        this.pendingQueries.clear();
        this.batchTimeout = null;
        try {
            // Execute the fetch function once
            const result = await fetchFn();
            // Resolve all pending queries with the result
            for (const [, callbacks] of queries) {
                callbacks.forEach(({ resolve }) => resolve(result));
            }
        }
        catch (error: unknown) {
            // Reject all pending queries with the error
            for (const [, callbacks] of queries) {
                callbacks.forEach(({ reject }) => reject(error));
            }
        }
    }
    /**
     * Clears all pending queries
     */
    public clear(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        this.pendingQueries.clear();
    }
}
