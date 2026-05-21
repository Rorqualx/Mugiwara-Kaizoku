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
/**
 * Send method not allowed response
 */
function sendMethodNotAllowed(req: ApiRequest, res: NextApiResponse): void {
    res["status"](405).json({
        status: 'error',
        error: {
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${req.method} not allowed`,
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
        },
    } as ApiResponse);
}

/**
 * Send unauthorized response
 */
function sendUnauthorized(req: ApiRequest, res: NextApiResponse): void {
    res["status"](401).json({
        status: 'error',
        error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.requestId ?? '',
        },
    } as ApiResponse);
}

/**
 * Check if user has required permission for the method
 */
function checkPermission(
    req: ApiRequest,
    method: keyof MethodHandlers,
    permissions: RouteConfig['permissions']
): void {
    const requiredPermission = permissions?.[method];
    if (!requiredPermission) {
        return;
    }

    const authUser = req.auth && typeof req.auth === 'object' && 'permissions' in req.auth
        ? req.auth as { permissions?: Permission[] }
        : null;

    const hasPermission = authUser?.permissions?.some(
        p => p.resource === requiredPermission.resource && p.actions?.includes(requiredPermission.action)
    );

    if (!hasPermission) {
        throw new ApiPermissionError(`Missing permission: ${requiredPermission.resource}:${requiredPermission.action}`);
    }
}

/**
 * Validate request data (query or body) based on method
 */
async function validateRequestData(
    req: ApiRequest,
    method: keyof MethodHandlers,
    validation: RouteConfig['validation']
): Promise<void> {
    if (!validation) {
        return;
    }

    // Validate query parameters for GET requests
    if (method === 'GET' && (validation.GET ?? validation.query)) {
        const schema = validation.GET ?? validation.query;
        if (schema) {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-unsafe-assignment
            req.query = await validateRequest(req.query, schema);
        }
        return;
    }

    // Validate request body for other methods
    const schema = validation[method as keyof typeof validation];
    if (schema && req.body && method !== 'GET') {
        // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-unsafe-assignment
        req.body = await validateRequest(req.body, schema);
    }
}

/**
 * Set cache headers for GET requests
 */
function setCacheHeaders(
    res: NextApiResponse,
    method: keyof MethodHandlers,
    cache: CacheConfig | undefined
): void {
    if (cache && method === 'GET') {
        const cacheControl = buildCacheControl(cache);
        res.setHeader('Cache-Control', cacheControl);
    }
}

/**
 * Handle errors in route execution
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

    // Use custom error handler if provided
    if (config.onError) {
        config.onError(error, req, res);
        return;
    }

    // Default error handling
    handleApiError(error, req, res);
}

/**
 * Creates a standardized API route handler with common middleware and error handling
 *
 * @param config - Route configuration including handlers
 * @returns Next.js API route handler
 */
export function createApiRoute(config: RouteConfig): RouteHandler {
    const internalHandler = async (req: ApiRequest, res: NextApiResponse): Promise<void> => {
        try {
            // Check if method is supported
            const method = req.method as keyof MethodHandlers;
            const handler = config.handlers[method];

            if (!handler) {
                return sendMethodNotAllowed(req, res);
            }

            // Check authentication if required
            if (config.requireAuth && !req.auth) {
                return sendUnauthorized(req, res);
            }

            // Check permissions
            checkPermission(req, method, config.permissions);

            // Validate request data
            await validateRequestData(req, method, config.validation);

            // Set cache headers
            setCacheHeaders(res, method, config.cache);

            // For streaming/binary routes, execute handler directly
            if (config.streaming ?? config.binary) {
                await handler(req, res);
                return;
            }

            // Execute the handler with standard response wrapping
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
