/**
 * NZBGet Proxy Endpoint
 *
 * POST /api/proxy/nzbget - Proxy requests to NZBGet JSON-RPC API
 *
 * This endpoint proxies requests to NZBGet's JSON-RPC API
 * while handling authentication and CORS issues.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Prevents unauthenticated access to usenet client
 */
import axios from 'axios';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createApiRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// Request validation schema
const nzbgetProxySchema = z.object({
    baseURL: z.string().url(),
    username: z.string(),
    password: z.string(),
    method: z.string().optional(),
    params: z.array(z.unknown()).optional(),
    id: z.number().optional(),
});
export default createApiRoute({
    requireAuth: true, // SECURITY: Require authentication for usenet client access (OWASP A01:2021)
    handlers: {
        POST: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized nzbget proxy access attempt', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                return res["status"](401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const { baseURL, username, password, method = 'status', params = [], id = 1 } = req.body as z.infer<typeof nzbgetProxySchema>;
            // Prepare the JSON-RPC request
            const requestPayload = {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: id,
            };
            logger.info('NZBGet proxy request:', {
                method: method,
                url: baseURL,
            });
            try {
                const response = await axios.post(`${baseURL}/jsonrpc`, requestPayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
                    },
                    timeout: 30000,
                });
                logger.info('NZBGet request successful');
                return res["status"](200).json(response.data);
            }
            catch (error: unknown) {
                logger.error('Error making request to NZBGet:', error);
                if (axios.isAxiosError(error)) {
                    if ((error instanceof Error ? error.code : String(error)) === 'ECONNREFUSED') {
                        return res["status"](503).json({
                            error: 'Cannot connect to NZBGet',
                            details: 'Connection refused. Please check if NZBGet is running.',
                        });
                    }
                    if ((error instanceof Error ? error.code : String(error)) === 'ETIMEDOUT') {
                        return res["status"](504).json({
                            error: 'Request to NZBGet timed out',
                            details: 'The request took too long to complete.',
                        });
                    }
                    if (error.response?.status === 401) {
                        return res["status"](401).json({
                            error: 'Authentication failed',
                            details: 'Invalid username or password for NZBGet',
                        });
                    }
                    return res["status"](502).json({
                        error: 'Error communicating with NZBGet',
                        details: (error instanceof Error ? error.message : String(error)),
                    });
                }
                return res["status"](500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
                });
            }
        },
    },
    validation: {
        POST: nzbgetProxySchema,
    },
});
