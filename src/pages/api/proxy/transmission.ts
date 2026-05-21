/**
 * Transmission Proxy Endpoint
 *
 * POST /api/proxy/transmission - Proxy requests to Transmission API
 *
 * This endpoint forwards requests to the Transmission API while handling
 * session IDs and CORS issues.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Prevents unauthenticated access to torrent client
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createApiRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

import type { NextApiResponse } from 'next';

// ============================================================================
// Types
// ============================================================================

/**
 * Transmission API response structure
 */
interface TransmissionResponse {
    result?: string;
    arguments?: unknown;
    tag?: number;
}

/**
 * Error response structure
 */
interface TransmissionErrorResponse {
    error: string;
    code?: string | undefined;
    sessionId?: string | undefined;
    details?: unknown;
}

// Request validation schema
const transmissionProxySchema = z.object({
    baseURL: z.string().url(),
    apiKey: z.string(),
    method: z.string(),
    arguments: z.unknown().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extracts the Transmission session ID from response headers
 */
function getSessionIdFromHeaders(response: AxiosResponse<unknown>): string | undefined {
    const headers = response.headers as Record<string, string | string[] | undefined>;
    const sessionId = headers['x-transmission-session-id'];
    if (typeof sessionId === 'string') {
        return sessionId;
    }
    if (Array.isArray(sessionId) && sessionId.length > 0) {
        return sessionId[0];
    }
    return undefined;
}

/**
 * Handles Axios errors and returns appropriate response
 */
function handleAxiosError(error: AxiosError, res: NextApiResponse): void {
    if (error.code === 'ECONNREFUSED') {
        res.status(503).json({
            error: 'Cannot connect to Transmission',
            details: 'Connection refused. Please check if Transmission is running and accessible.'
        });
        return;
    }
    if (error.code === 'ETIMEDOUT') {
        res.status(504).json({
            error: 'Request to Transmission timed out',
            details: 'The request took too long to complete.'
        });
        return;
    }
    res.status(502).json({
        error: 'Error communicating with Transmission',
        details: error.message
    });
}

/**
 * Handles the 409 Conflict response (session ID required)
 */
function handleSessionIdRequired(
    response: AxiosResponse<unknown>,
    res: NextApiResponse
): void {
    const sessionId = getSessionIdFromHeaders(response);
    logger.info('Received 409 Conflict - Session ID required:', sessionId);

    if (sessionId) {
        res.setHeader('x-transmission-session-id', sessionId);
    }

    const errorResponse: TransmissionErrorResponse = {
        error: 'Session ID required',
        sessionId: sessionId
    };
    res.status(409).json(errorResponse);
}

/**
 * Build request headers for Transmission API
 */
function buildRequestHeaders(
    sessionId: string | string[] | undefined,
    apiKey: string | undefined
): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Add session ID if provided
    if (sessionId) {
        headers['X-Transmission-Session-Id'] = Array.isArray(sessionId) ? sessionId[0] ?? '' : sessionId;
    }

    // Add authorization if API key is provided
    if (apiKey) {
        const authStr = apiKey.includes(':') ? apiKey : `:${apiKey}`;
        headers['Authorization'] = `Basic ${Buffer.from(authStr).toString('base64')}`;
        logger.info('Added Authorization header for authentication');
    }

    return headers;
}

/**
 * Build the RPC URL for Transmission
 */
function buildRpcUrl(baseURL: string): string {
    let rpcUrl = baseURL;
    if (!rpcUrl.endsWith('/')) {
        rpcUrl += '/';
    }
    if (!rpcUrl.endsWith('transmission/rpc')) {
        rpcUrl += 'transmission/rpc';
    }
    // Remove double slashes
    return rpcUrl.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Handle successful Transmission response
 */
function handleSuccessResponse(
    response: AxiosResponse<unknown>,
    res: NextApiResponse
): void {
    const sessionId = getSessionIdFromHeaders(response);
    if (sessionId) {
        res.setHeader('x-transmission-session-id', sessionId);
    }
    logger.info('Transmission request successful');
    const responseData = response.data as TransmissionResponse;
    res.status(200).json(responseData);
}

/**
 * Handle error status codes from Transmission
 */
function handleErrorStatusCode(
    response: AxiosResponse<unknown>,
    res: NextApiResponse
): void {
    const responseData = response.data as TransmissionResponse | undefined;
    logger.error('Transmission error:', response.status, responseData);
    res.status(response.status).json({
        error: `Transmission API error: ${response.status}`,
        details: responseData
    });
}

export default createApiRoute({
    requireAuth: true, // SECURITY: Require authentication for torrent client access (OWASP A01:2021)
    handlers: {
        POST: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized transmission proxy access attempt', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                res.status(401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
                return;
            }

            const { baseURL, apiKey, method, arguments: args } = req.body as z.infer<typeof transmissionProxySchema>;
            logger.info('Transmission proxy request received:', {
                method: req.method,
                body: JSON.stringify(req.body, null, 2)
            });

            const headers = buildRequestHeaders(req.headers['x-transmission-session-id'], apiKey);
            const rpcUrl = buildRpcUrl(baseURL);
            logger.info(`Making request to final URL: ${rpcUrl}`);

            // Validate URL format
            try {
                new URL(rpcUrl);
            } catch (_error: unknown) {
                logger.error('Invalid URL format:', rpcUrl);
                res.status(400).json({
                    errorMessage: 'Invalid URL format',
                    details: `URL validation failed for: ${rpcUrl}`
                });
                return;
            }

            try {
                const response = await axios.post<TransmissionResponse>(rpcUrl, {
                    method,
                    arguments: args
                }, {
                    headers,
                    timeout: 30000,
                    validateStatus: () => true // Accept all status codes
                });

                logger.info('Transmission response status:', response.status);
                logger.info('Transmission response headers:', JSON.stringify(response.headers, null, 2));

                // Handle 409 Conflict (session ID required)
                if (response.status === 409) {
                    handleSessionIdRequired(response, res);
                    return;
                }

                // Handle other error status codes
                if (response.status >= 400) {
                    handleErrorStatusCode(response, res);
                    return;
                }

                handleSuccessResponse(response, res);
            } catch (error: unknown) {
                logger.error('Error making request to Transmission:', error);

                if (axios.isAxiosError(error)) {
                    handleAxiosError(error, res);
                    return;
                }

                res.status(500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        },
    },
    validation: {
        POST: transmissionProxySchema,
    },
});
