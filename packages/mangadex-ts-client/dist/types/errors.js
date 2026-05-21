"use strict";
/**
 * Error types for the metadata system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.ScrapingError = exports.ValidationError = exports.ApiError = exports.MetadataError = void 0;
/** Base metadata error */
class MetadataError extends Error {
    source;
    cause;
    constructor(message, source, cause) {
        super(message);
        this.source = source;
        this.cause = cause;
        this.name = 'MetadataError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MetadataError);
        }
    }
}
exports.MetadataError = MetadataError;
/** API request error */
class ApiError extends MetadataError {
    statusCode;
    errors;
    requestId;
    constructor(message, statusCode, errors, requestId, source) {
        super(message, source);
        this.statusCode = statusCode;
        this.errors = errors;
        this.requestId = requestId;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
/** Data validation error */
class ValidationError extends MetadataError {
    field;
    constructor(message, field, source) {
        super(message, source);
        this.field = field;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/** HTML scraping error */
class ScrapingError extends MetadataError {
    url;
    constructor(message, url, source) {
        super(message, source);
        this.url = url;
        this.name = 'ScrapingError';
    }
}
exports.ScrapingError = ScrapingError;
/** Rate limit exceeded error */
class RateLimitError extends MetadataError {
    retryAfterMs;
    constructor(message, retryAfterMs, source) {
        super(message, source);
        this.retryAfterMs = retryAfterMs;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=errors.js.map