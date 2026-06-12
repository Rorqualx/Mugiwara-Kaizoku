/**
 * API Logging Middleware
 *
 * Logs API requests and responses, and persists per-key request metrics
 * to ApiMetric for the /api/v1/metrics endpoints.
 */

import crypto from 'crypto';

import { logger } from '@/utils/logger';

import type { ApiRequest } from './apiMiddleware';
import type { NextApiResponse } from 'next';

/**
 * Logging middleware
 */
export function apiLoggingMiddleware(req: ApiRequest, res: NextApiResponse): Promise<void> {
  const startTime = Date.now();

  // Log request
  interface SocketWithRemoteAddress {
    remoteAddress?: string;
  }
  const socket = req.socket as unknown as SocketWithRemoteAddress;

  logger.info('API request', {
    type: 'api_request',
    requestId: req.requestId,
    method: req.method ?? 'UNKNOWN',
    url: req.url ?? '',
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'x-api-key': req.headers['x-api-key'] ? '[REDACTED]' : undefined,
    },
    ip: socket.remoteAddress,
  });

  // Capture original res.end to log response
  const originalEnd = res.end.bind(res);

  // Create wrapper function with proper typing
  const endWrapper = (...args: Parameters<typeof res.end>): ReturnType<typeof res.end> => {
    const responseTime = Date.now() - startTime;

    // Log response
    logger.info('API response', {
      type: 'api_response',
      requestId: req.requestId,
      method: req.method ?? 'UNKNOWN',
      url: req.url ?? '',
      statusCode: res.statusCode,
      responseTime,
      headers: res.getHeaders(),
    });

    // Store metrics if API key is present
    if (req.auth && typeof req.auth === 'object' && 'apiKey' in req.auth) {
      const authObj = req.auth as { apiKey: string };
      const metricsData: {
        apiKeyId: string;
        endpoint: string;
        method: string;
        statusCode: number;
        responseTime: number;
        userAgent?: string;
        ipAddress?: string;
      } = {
        apiKeyId: authObj.apiKey,
        endpoint: req.url ?? '',
        method: req.method ?? '',
        statusCode: res.statusCode,
        responseTime,
      };
      const userAgent = req.headers['user-agent'];
      if (userAgent !== undefined) metricsData.userAgent = userAgent as string;
      const ipAddress = hashIpAddress(req.socket.remoteAddress);
      if (ipAddress !== undefined) metricsData.ipAddress = ipAddress;

      void storeApiMetrics(metricsData).catch(error => {
        logger.error('Failed to store API metrics', error);
      });
    }

    // Call original end
    return originalEnd(...args);
  };

  // Override res.end - this is necessary for middleware pattern
  // eslint-disable-next-line no-param-reassign
  res.end = endWrapper as typeof res.end;

  return Promise.resolve();
}

/**
 * Store API metrics in database
 */
async function storeApiMetrics(metrics: {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
}): Promise<void> {
  const { prisma } = await import('@/server/db');

  await prisma.apiMetric.create({
    data: {
      apiKeyId: metrics.apiKeyId,
      endpoint: metrics.endpoint,
      method: metrics.method,
      statusCode: metrics.statusCode,
      responseTime: metrics.responseTime,
      ...(metrics.userAgent !== undefined ? { userAgent: metrics.userAgent } : {}),
      ...(metrics.ipAddress !== undefined ? { ipAddress: metrics.ipAddress } : {})
    }
  });
}

/**
 * Hash IP address for privacy
 */
function hashIpAddress(ip?: string): string | undefined {
  if (!ip) return undefined;

  return crypto
    .createHash('sha256')
    .update(ip)
    .digest('hex')
    .substring(0, 16);
}
