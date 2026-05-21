/**
 * API CORS Middleware
 * 
 * Handles Cross-Origin Resource Sharing for API requests
 */

import type { ApiRequest } from './apiMiddleware';
import type { NextApiResponse } from 'next';

/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = process.env["API_ALLOWED_ORIGINS"]?.split(',') ?? ['*'];

/**
 * Allowed methods
 */
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/**
 * Allowed headers
 */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-API-Key',
  'X-Request-ID',
];

/**
 * CORS middleware
 */
export function apiCorsMiddleware(req: ApiRequest, res: NextApiResponse): Promise<void> {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  }

  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res["status"](204).end();
    return Promise.resolve();
  }
  return Promise.resolve();
}