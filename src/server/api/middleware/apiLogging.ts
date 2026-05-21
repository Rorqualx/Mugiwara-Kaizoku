// TODO: Disabled until WantedItem and ApiMetric Prisma models are implemented in schema.prisma

/**
 * API Logging Middleware
 *
 * Logs API requests and responses
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
  // TODO: Re-enable when ApiMetric model is added to schema.prisma
  const { prisma: _prisma } = await import('@/server/db');

  const data: {
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    userAgent?: string;
    ipAddress?: string;
  } = {
    apiKeyId: metrics.apiKeyId,
    endpoint: metrics.endpoint,
    method: metrics.method,
    statusCode: metrics.statusCode,
    responseTime: metrics.responseTime,
  };

  if (metrics.userAgent !== undefined) data.userAgent = metrics.userAgent;
  if (metrics.ipAddress !== undefined) data.ipAddress = metrics.ipAddress;

  // Note: Type assertion needed because ApiMetric model doesn't exist yet in schema
  // This entire file is marked as TODO until the model is implemented
  // await (prisma.apiMetric as unknown as { create: (args: { data: typeof data }) => Promise<void> }).create({
  //   data,
  // });
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
