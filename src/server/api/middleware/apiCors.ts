/**
 * API CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing for API requests.
 *
 * Default is same-origin only: with `API_ALLOWED_ORIGINS` unset no
 * `Access-Control-Allow-*` grant is sent, so browsers refuse cross-origin
 * reads. The app's own frontend calls the API same-origin and non-browser
 * clients (API keys, SDK) are not subject to CORS, so neither needs a grant.
 *
 * `API_ALLOWED_ORIGINS` is a comma-separated list of exact origins
 * (e.g. `https://reader.example.com`). A listed origin is echoed back with
 * credentials allowed. A literal `*` entry opts in to any origin, but never
 * with credentials.
 */

import type { ApiRequest } from './apiMiddleware';
import type { NextApiResponse } from 'next';

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

/** Origins explicitly allowed by configuration (read per request). */
function getAllowedOrigins(): string[] {
  return (process.env['API_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/** Send the grant for a cross-origin caller. Returns false when none applies. */
function grantCrossOrigin(origin: string | undefined, res: NextApiResponse): boolean {
  const allowedOrigins = getAllowedOrigins();
  if (origin !== undefined && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    return true;
  }
  if (allowedOrigins.includes('*')) {
    // Explicit wildcard opt-in: readable by any site, but never with cookies.
    res.setHeader('Access-Control-Allow-Origin', '*');
    return true;
  }
  return false;
}

/**
 * CORS middleware
 */
export function apiCorsMiddleware(req: ApiRequest, res: NextApiResponse): Promise<void> {
  const granted = grantCrossOrigin(req.headers.origin, res);

  if (granted) {
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  // Handle preflight requests. Without a grant the 204 carries no CORS
  // headers, which is how a browser learns the cross-origin call is refused.
  if (req.method === 'OPTIONS') {
    res["status"](204).end();
    return Promise.resolve();
  }
  return Promise.resolve();
}
