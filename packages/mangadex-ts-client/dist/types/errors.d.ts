/**
 * Error types for the metadata system
 */
import { DataSource } from './common';
/** Base metadata error */
export declare class MetadataError extends Error {
    readonly source?: DataSource | undefined;
    readonly cause?: unknown | undefined;
    constructor(message: string, source?: DataSource | undefined, cause?: unknown | undefined);
}
/** API request error */
export declare class ApiError extends MetadataError {
    readonly statusCode?: number | undefined;
    readonly errors?: unknown[] | undefined;
    readonly requestId?: string | undefined;
    constructor(message: string, statusCode?: number | undefined, errors?: unknown[] | undefined, requestId?: string | undefined, source?: DataSource);
}
/** Data validation error */
export declare class ValidationError extends MetadataError {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined, source?: DataSource);
}
/** HTML scraping error */
export declare class ScrapingError extends MetadataError {
    readonly url?: string | undefined;
    constructor(message: string, url?: string | undefined, source?: DataSource);
}
/** Rate limit exceeded error */
export declare class RateLimitError extends MetadataError {
    readonly retryAfterMs?: number | undefined;
    constructor(message: string, retryAfterMs?: number | undefined, source?: DataSource);
}
//# sourceMappingURL=errors.d.ts.map