/**
 * Deluge Proxy Endpoint
 *
 * POST /api/proxy/deluge - Proxy requests to Deluge API
 *
 * This endpoint forwards requests to the Deluge JSON-RPC API while handling
 * authentication and CORS issues.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Prevents unauthenticated access to torrent client
 */
import axios from 'axios';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createApiRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// Request validation schema
const delugeProxySchema = z.object({
    baseURL: z.string().url(),
    password: z.string(),
    method: z.string(),
    params: z.array(z.unknown()).optional(),
    id: z.number().optional(),
});

// Deluge API response schema for type safety
interface DelugeApiResponse {
    result: boolean | unknown;
    error: { message: string; code: number } | null;
    id: number;
}
export default createApiRoute({
    requireAuth: true, // SECURITY: Require authentication for torrent client access (OWASP A01:2021)
    handlers: {
        POST: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized deluge proxy access attempt', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                return res["status"](401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const { baseURL, password, method, params = [], id = 1 } = req.body as z.infer<typeof delugeProxySchema>;
            logger.info('Deluge proxy request received:', {
                method: req.method,
                rpcMethod: method,
            });
            try {
                // First, authenticate with Deluge
                const authResponse = await axios.post<DelugeApiResponse>(`${baseURL}/json`, {
                    method: 'auth.login',
                    params: [password],
                    id: 1,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true,
                    timeout: 10000,
                });
                if (!authResponse.data.result) {
                    return res["status"](401).json({
                        error: 'Authentication failed',
                        details: 'Invalid password for Deluge',
                    });
                }
                // Get the session cookie
                const cookies = authResponse.headers['set-cookie'];
                const sessionCookie = cookies?.find((c: string) => c.includes('_session_id'));
                if (!sessionCookie) {
                    return res["status"](500).json({
                        error: 'Failed to get session cookie',
                        details: 'Authentication succeeded but no session cookie received',
                    });
                }
                // Make the actual request
                const response = await axios.post(`${baseURL}/json`, {
                    method,
                    params,
                    id,
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': sessionCookie,
                    },
                    timeout: 30000,
                });
                logger.info('Deluge request successful');
                return res["status"](200).json(response.data);
            }
            catch (error: unknown) {
                logger.error('Error making request to Deluge:', error);
                if (axios.isAxiosError(error)) {
                    if ((error instanceof Error ? error.code : String(error)) === 'ECONNREFUSED') {
                        return res["status"](503).json({
                            error: 'Cannot connect to Deluge',
                            details: 'Connection refused. Please check if Deluge is running and accessible.',
                        });
                    }
                    if ((error instanceof Error ? error.code : String(error)) === 'ETIMEDOUT') {
                        return res["status"](504).json({
                            error: 'Request to Deluge timed out',
                            details: 'The request took too long to complete.',
                        });
                    }
                    return res["status"](502).json({
                        error: 'Error communicating with Deluge',
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
        POST: delugeProxySchema,
    },
});
