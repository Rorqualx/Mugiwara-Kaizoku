/**
 * API Route Factory
 *
 * Factory functions to reduce boilerplate in API routes by providing
 * common middleware application, error handling, and response formatting.
 *
 * Enhanced with support for:
 * - Streaming responses (SSE, file streaming)
 * - Binary responses (images, files)
 * - Cache configuration
 * - Query parameter validation
 */
import { z } from 'zod';

import type { ApiRequest } from '@/server/api/middleware/apiMiddleware';
import { apiMiddleware } from '@/server/api/middleware/apiMiddleware';
import { validateRequest } from '@/server/api/middleware/apiValidation';
import { ApiPermissionError, ApiNotFoundError } from '@/types/api/v1/errors';
import type { AsyncResult } from '@/utils/async-result';
import { isSuccess, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import type { NextApiResponse } from 'next';

/**
 * Permission structure
 */
interface Permission {
  resource: string;
  actions?: string[];
}
/**
 * Route handler function type
 */
export type RouteHandler<T = unknown> = (req: ApiRequest, res: NextApiResponse<T>) => Promise<void> | void;
/**
 * Method handlers configuration
 */
export interface MethodHandlers {
    GET?: RouteHandler;
    POST?: RouteHandler;
    PUT?: RouteHandler;
    PATCH?: RouteHandler;
    DELETE?: RouteHandler;
}
/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Cache duration in seconds */
    maxAge: number;
    /** Whether the cache is private to the user */
    private?: boolean;
    /** Shared cache max age (CDN) */
    sMaxAge?: number;
    /** Whether to revalidate stale cache */
    mustRevalidate?: boolean;
    /** Stale-while-revalidate duration in seconds (serves stale content while fetching fresh) */
    staleWhileRevalidate?: number;
}
/**
 * Route configuration options
 */
export interface RouteConfig {
    /** Whether authentication is required */
    requireAuth?: boolean;
    /** Enable streaming mode (SSE, file streaming) */
    streaming?: boolean;
    /** Enable binary response mode */
    binary?: boolean;
    /** Enable range request support for partial content */
    rangeRequests?: boolean;
    /** Cache configuration */
    cache?: CacheConfig;
    /** Required permissions for each method */
    permissions?: {
        GET?: {
            resource: string;
            action: string;
        };
        POST?: {
            resource: string;
            action: string;
        };
        PUT?: {
            resource: string;
            action: string;
        };
        PATCH?: {
            resource: string;
            action: string;
        };
        DELETE?: {
            resource: string;
            action: string;
        };
    };
    /** Validation schemas */
    validation?: {
        GET?: z.ZodSchema; // For query params
        POST?: z.ZodSchema;
        PUT?: z.ZodSchema;
        PATCH?: z.ZodSchema;
        query?: z.ZodSchema; // Alternative way to specify query validation
    };
    /** Method handlers */
    handlers: MethodHandlers;
    /** Default error handler */
    onError?: (error: unknown, req: ApiRequest, res: NextApiResponse) => void;
}
/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
    status: 'success' | 'error';
    data?: T;
    error?: {
        code: string;
        message: string;
        timestamp: string;
        requestId?: string;
        details?: unknown;
    };
}
// ============================================================================
// Route Handler Helper Functions (extracted to reduce complexity)
// ============================================================================

/**
 * Creates a method not allowed error response
 */
function createMethodNotAllowedResponse(req: ApiRequest): ApiResponse {
    return {
        status: 'error',
        error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${req.method} not allowed`,
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
        },
    };
}

/**
 * Creates an unauthorized error response
 */
function createUnauthorizedResponse(req: ApiRequest): ApiResponse {
    return {
        status: 'error',
        error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
        },
    };
}

/**
 * Checks if the user has the required permission
 */
function checkPermission(
    req: ApiRequest,
    requiredPermission: { resource: string; action: string }
): boolean {
    const authUser = typeof req.auth === 'object' && 'permissions' in req.auth
        ? req.auth as { permissions?: Permission[] }
        : null;
    return authUser?.permissions?.some(
        p => p.resource === requiredPermission.resource && p.actions?.includes(requiredPermission.action)
    ) ?? false;
}

/**
 * Validates request data (query or body) against schema
 */
async function validateRequestData(
    req: ApiRequest,
    config: RouteConfig,
    method: keyof MethodHandlers
): Promise<void> {
    // Validate query parameters for GET requests
    if (method === 'GET' && (config.validation?.GET ?? config.validation?.query)) {
        const schema = config.validation.GET ?? config.validation.query;
        if (schema) {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-unsafe-assignment
            req.query = await validateRequest(req.query, schema);
        }
    }
    // Validate request body for other methods
    if (config.validation?.[method as keyof typeof config.validation] && req.body) {
        const schema = config.validation[method as keyof typeof config.validation];
        if (schema && method !== 'GET') {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-unsafe-assignment
            req.body = await validateRequest(req.body, schema);
        }
    }
}

/**
 * Handles errors in route handlers
 */
function handleRouteError(
    error: unknown,
    req: ApiRequest,
    res: NextApiResponse,
    config: RouteConfig
): void {
    // For streaming/binary routes that have already started responding
    if (res.headersSent) {
        logger.error('Error after headers sent:', error);
        res.end();
        return;
    }
    // Strip any cache-control header set pre-handler — error responses must
    // never be cached by the browser. Belt-and-suspenders alongside the
    // res.status() wrapper installed in createApiRoute.
    if (res.getHeader('Cache-Control')) {
        res.removeHeader('Cache-Control');
    }
    // Use custom error handler if provided
    if (config.onError) {
        config.onError(error, req, res);
        return;
    }
    // Default error handling
    handleApiError(error, req, res);
}

// ============================================================================
// Main Factory Function
// ============================================================================

/**
 * Creates a standardized API route handler with common middleware and error handling
 *
 * @param config - Route configuration including handlers
 * @returns Next.js API route handler
 */
export function createApiRoute(config: RouteConfig): RouteHandler {
    const internalHandler = async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
        try {
            const method = req.method as keyof MethodHandlers;
            const handler = config.handlers[method];

            // Check if method is supported
            if (!handler) {
                return res["status"](405).json(createMethodNotAllowedResponse(req));
            }

            // Check authentication if required
            if (config.requireAuth && !req.auth) {
                return res["status"](401).json(createUnauthorizedResponse(req));
            }

            // Check permissions
            const requiredPermission = config.permissions?.[method];
            if (requiredPermission && req.auth && !checkPermission(req, requiredPermission)) {
                throw new ApiPermissionError(`Missing permission: ${requiredPermission.resource}:${requiredPermission.action}`);
            }

            // Validate request data
            await validateRequestData(req, config, method);

            // Set cache headers if configured. Apply optimistically (defaults
            // to 200 if the handler never calls res.status) and wrap res.status
            // so error responses (>= 400) drop the header — otherwise a 24h
            // max-age would pin a transient error in the user's browser cache.
            if (config.cache && method === 'GET') {
                const cacheControl = buildCacheControl(config.cache);
                res.setHeader('Cache-Control', cacheControl);
                const originalStatus = res.status.bind(res);
                // eslint-disable-next-line no-param-reassign
                res.status = (code: number): NextApiResponse => {
                    if (code >= 400) {
                        res.removeHeader('Cache-Control');
                    } else if (res.getHeader('Cache-Control') !== cacheControl) {
                        res.setHeader('Cache-Control', cacheControl);
                    }
                    return originalStatus(code);
                };
            }

            // Execute the handler
            await handler(req, res);
        }
        catch (error: unknown) {
            handleRouteError(error, req, res, config);
        }
    };

    // Wrap with apiMiddleware to apply authentication
    return apiMiddleware(internalHandler);
}
/**
 * Build Cache-Control header from cache config
 */
function buildCacheControl(cache: CacheConfig): string {
    const parts: string[] = [];
    if (cache.private) {
        parts.push('private');
    }
    else {
        parts.push('public');
    }
    parts.push(`max-age=${cache.maxAge}`);
    if (cache.sMaxAge !== undefined) {
        parts.push(`s-maxage=${cache.sMaxAge}`);
    }
    if (cache.staleWhileRevalidate !== undefined) {
        parts.push(`stale-while-revalidate=${cache.staleWhileRevalidate}`);
    }
    if (cache.mustRevalidate) {
        parts.push('must-revalidate');
    }
    return parts.join(', ');
}
/**
 * Creates a streaming API route (SSE, file streaming, etc.)
 *
 * @param config - Streaming route configuration
 * @returns Route handler for streaming responses
 */
export function createStreamingRoute(config: Omit<RouteConfig, 'streaming'>): RouteHandler {
    return createApiRoute({
        ...config,
        streaming: true,
    });
}
/**
 * Creates a binary response API route (images, files, etc.)
 *
 * @param config - Binary route configuration
 * @returns Route handler for binary responses
 */
export function createBinaryRoute(config: Omit<RouteConfig, 'binary'>): RouteHandler {
    return createApiRoute({
        ...config,
        binary: true,
    });
}
/**
 * Default error handler for API routes
 */
export function handleApiError(error: unknown, req: ApiRequest, res: NextApiResponse): void {
    // Handle specific error types
    if (error instanceof ApiPermissionError) {
        res["status"](403).json({
            status: 'error',
            error: {
                code: 'FORBIDDEN',
                message: (error instanceof Error ? error.message : String(error)),
                timestamp: new Date().toISOString(),
                requestId: req.requestId ?? '',
            },
        } as ApiResponse);
        return;
    }
    if (error instanceof ApiNotFoundError) {
        res["status"](404).json({
            status: 'error',
            error: {
                code: 'NOT_FOUND',
                message: (error instanceof Error ? error.message : String(error)),
                timestamp: new Date().toISOString(),
                requestId: req.requestId ?? '',
            },
        } as ApiResponse);
        return;
    }
    // Handle validation errors
    if (error instanceof z.ZodError) {
        res["status"](400).json({
            status: 'error',
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                timestamp: new Date().toISOString(),
                requestId: req.requestId ?? '',
                details: error.errors,
            },
        } as ApiResponse);
        return;
    }
    // Generic error handling
    const message = error instanceof Error ? error.message : 'Internal server error';
    let statusCode = 500;
    if (error instanceof Error && 'statusCode' in error) {
        const code = (error as { statusCode: unknown }).statusCode;
        statusCode = typeof code === 'number' ? code : 500;
    }
    res["status"](statusCode).json({
        status: 'error',
        error: {
            code: 'INTERNAL_ERROR',
            message,
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
        },
    } as ApiResponse);
}
/**
 * Helper to create success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
    return {
        status: 'success',
        data,
    };
}
/**
 * Helper to handle AsyncResult and return appropriate response
 */
export function handleAsyncResult<T>(result: AsyncResult<T>, res: NextApiResponse, successCode: number = 200): void {
    if (isSuccess(result)) {
        res["status"](successCode).json(successResponse(result.data));
        return;
    }
    if (isError(result)) {
        throw result.error;
    }
    throw new ValidationError('Unexpected async result state');
}
/**
 * Helper to extract and validate ID from query parameters
 */
export function extractIdFromQuery(query: Partial<{
    [key: string]: string | string[];
}>, paramName: string = 'id'): string {
    const id = query[paramName];
    if (!id || Array.isArray(id)) {
        throw new ValidationError(`Invalid ${paramName} parameter`);
    }
    return id;
}
/**
 * Helper to create paginated response
 */
export interface PaginatedResponse<T> {
    status: 'success';
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export function paginatedResponse<T>(data: T[], page: number, limit: number, total: number): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    return {
        status: 'success',
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
/**
 * Range request utilities for file serving
 */
export interface RangeInfo {
    start: number;
    end: number;
    total: number;
}
/**
 * Parse Range header for partial content requests
 */
export function parseRangeHeader(rangeHeader: string | undefined, totalSize: number): RangeInfo | null {
    if (!rangeHeader?.startsWith('bytes=')) {
        return null;
    }
    const range = rangeHeader.replace('bytes=', '');
    const parts = range.split('-');
    const start = parts[0] ? parseInt(parts[0], 10) : 0;
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
    if (isNaN(start) || isNaN(end) || start > end || start < 0 || end >= totalSize) {
        return null;
    }
    return { start, end, total: totalSize };
}
/**
 * Set range response headers for partial content
 */
export function setRangeHeaders(res: NextApiResponse, range: RangeInfo, contentType: string = 'application/octet-stream'): void {
    const contentLength = range.end - range.start + 1;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${range.total}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res["status"](206); // Partial Content
}
/**
 * Create a file serving route with range request support
 */
export function createFileRoute(config: Omit<RouteConfig, 'binary' | 'rangeRequests'>): RouteHandler {
    return createApiRoute({
        ...config,
        binary: true,
        rangeRequests: true,
    });
}
/**
 * Export the apiMiddleware wrapper for routes that need custom handling
 */
export { apiMiddleware };