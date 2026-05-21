/**
 * API Performance Middleware
 * 
 * Adds performance optimization features to API requests
 */

import { promisify } from 'util';
import zlib from 'zlib';

import { logger } from '@/utils/logger';

import { performanceService } from '../services/performanceService';

import type { ApiRequest } from './apiMiddleware';
import type { NextApiResponse } from 'next';


const gzip = promisify(zlib.gzip);

/**
 * Performance optimization middleware
 */
export function apiPerformanceMiddleware(
  req: ApiRequest,
  res: NextApiResponse
): Promise<void> {
  const startTime = Date.now();

  // Check if client supports compression
  const acceptEncoding = req.headers['accept-encoding'] ?? '';
  const supportsGzip = acceptEncoding.includes('gzip');

  // Check for ETag support
  const ifNoneMatch = req.headers['if-none-match'];

  // Override response methods to add performance features
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);

  // Track response for metrics
  const trackResponse = (): void => {
    const responseTime = Date.now() - startTime;
    performanceService['trackResponseTime'](responseTime);

    // Set performance headers
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    // Track errors
    if (res.statusCode >= 400) {
      performanceService.trackError();
    }
  };

  // Enhanced JSON response with compression and caching
  // eslint-disable-next-line no-param-reassign
  res.json = function(data: unknown) {
    trackResponse();

    // Generate ETag
    const etag = performanceService.generateETag(data);
    res.setHeader('ETag', etag);

    // Check if ETag matches
    if (ifNoneMatch && performanceService.checkETag(ifNoneMatch, data)) {
      // eslint-disable-next-line no-param-reassign
      res.statusCode = 304; // Not Modified
      return res.end();
    }

    // Set cache headers for successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const cacheControl = getCacheControl(req);
      if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl);
      }
    }

    // Compress response if supported and beneficial
    const jsonString = JSON.stringify(data);

    if (supportsGzip && jsonString.length > 1024) { // Only compress if > 1KB
      void gzip(jsonString)
        .then(compressed => {
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Length', compressed.length);
          res.end(compressed);
        })
        .catch((error: unknown) => {
          logger.error('Compression error:', error);
          // Fall back to uncompressed
          originalJson(data);
        });
      return res;
    }

    return originalJson(data);
  };

  // Enhanced send response
  // eslint-disable-next-line no-param-reassign
  res.send = function(data: unknown) {
    trackResponse();
    return originalSend(data);
  };

  // Enhanced end response
  // eslint-disable-next-line no-param-reassign
  res.end = function(...args: unknown[]) {
    trackResponse();
    if (typeof originalEnd === 'function') {
      // Type assertion needed for compatibility with NextApiResponse.end() signature
      return (originalEnd as (...args: unknown[]) => NextApiResponse)(...args);
    }
    // Fallback: this should never happen as end() is always defined on NextApiResponse
    // Return res to maintain method chaining compatibility
    return res as NextApiResponse;
  };

  // Add performance hints
  res.setHeader('X-Powered-By', 'Kaizoku API');
  res.setHeader('X-Performance-Mode', 'optimized');
  return Promise.resolve();
}

/**
 * Determine cache control header based on endpoint
 */
function getCacheControl(req: ApiRequest): string | null {
  const path = req.url ?? '';
  
  // Health check - short cache
  if (path.includes('/health')) {
    return 'public, max-age=10';
  }
  
  // Metadata endpoints - medium cache
  if (path.includes('/metadata') || path.includes('/providers')) {
    return 'public, max-age=300'; // 5 minutes
  }
  
  // Search results - short cache
  if (path.includes('/search')) {
    return 'private, max-age=60'; // 1 minute
  }
  
  // System metrics - no cache
  if (path.includes('/metrics') || path.includes('/events')) {
    return 'no-cache, no-store, must-revalidate';
  }
  
  // Default for GET requests
  if (req.method === 'GET') {
    return 'private, max-age=60';
  }
  
  // No cache for mutations
  return null;
}

/**
 * Cache middleware for GET requests
 */
export async function apiCacheMiddleware(
  req: ApiRequest,
  res: NextApiResponse,
  handler: () => Promise<unknown>
): Promise<void> {
  // Only cache GET requests
  if (req.method !== 'GET') {
    await handler();
    return;
  }
  
  // Generate cache key
  const cacheKey = `api:${req.url}:${JSON.stringify(req.query)}`;
  
  // Try to get from cache
  const cached = await performanceService.get(cacheKey);
  
  if (cached["status"] === 'success') {
    // Return cached response
    res.json(cached.data);
    return;
  }
  
  // Execute handler and cache result
  const originalJson = res.json.bind(res);
  let _responseData: unknown;

  // eslint-disable-next-line no-param-reassign
  res.json = function(data: unknown) {
    _responseData = data;

    // Cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const ttl = getCacheTTL(req);
      if (ttl > 0) {
        void performanceService.set(cacheKey, data, {
          ttl,
          tags: getCacheTags(req),
        });
      }
    }

    return originalJson(data);
  };

  await handler();
}

/**
 * Get cache TTL based on endpoint
 */
function getCacheTTL(req: ApiRequest): number {
  const path = req.url ?? '';
  
  if (path.includes('/health')) return 10000; // 10 seconds
  if (path.includes('/metadata')) return 300000; // 5 minutes
  if (path.includes('/manga') && req.query["id"]) return 60000; // 1 minute for specific manga
  if (path.includes('/libraries')) return 300000; // 5 minutes
  if (path.includes('/search')) return 30000; // 30 seconds
  
  return 0; // No cache
}

/**
 * Get cache tags based on endpoint
 */
function getCacheTags(req: ApiRequest): string[] {
  const path = req.url ?? '';
  const tags: string[] = ['api'];
  
  if (path.includes('/manga')) {
    tags.push('manga');
    if (req.query["id"]) tags.push(`manga:${req.query["id"]}`);
    if (req.query["libraryId"]) tags.push(`library:${req.query["libraryId"]}`);
  }
  
  if (path.includes('/libraries')) {
    tags.push('library');
    if (req.query["id"]) tags.push(`library:${req.query["id"]}`);
  }
  
  if (path.includes('/chapters')) {
    tags.push('chapter');
    if (req.query["mangaId"]) tags.push(`manga:${req.query["mangaId"]}`);
  }
  
  return tags;
}