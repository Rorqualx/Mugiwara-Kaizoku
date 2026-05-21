/**
 * SABnzbd Proxy Endpoint
 *
 * GET/POST /api/proxy/sabnzbd - Proxy requests to SABnzbd API
 *
 * This endpoint proxies requests to SABnzbd's API
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
const sabnzbdProxySchema = z.object({
    baseURL: z.string().url(),
    apiKey: z.string(),
    params: z.record(z.unknown()).optional(),
});
export default createApiRoute({
    requireAuth: true, // SECURITY: Require authentication for usenet client access (OWASP A01:2021)
    handlers: {
        GET: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized sabnzbd proxy access attempt', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                return res["status"](401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const query = req.query as { baseURL?: string; apiKey?: string; [key: string]: string | string[] | undefined };
            const { baseURL, apiKey, ...params } = query;
            if (!baseURL || !apiKey) {
                return res["status"](400).json({
                    error: 'Missing required parameters',
                    details: 'baseURL and apiKey are required',
                });
            }
            try {
                // Build SABnzbd API URL
                const url = new URL(`${baseURL}/api`);
                url.searchParams.append('apikey', apiKey);
                url.searchParams.append('output', 'json');
                // Add additional parameters
                Object.keys(params).forEach(key => {
                    const value = params[key];
                    if (value !== undefined) {
                        url.searchParams.append(key, String(value));
                    }
                });
                logger.info('SABnzbd proxy request:', {
                    method: 'GET',
                    url: url.toString().replace(apiKey, '***'),
                });
                const response = await axios.get(url.toString(), {
                    timeout: 30000,
                });
                logger.info('SABnzbd request successful');
                return res["status"](200).json(response.data);
            }
            catch (error: unknown) {
                logger.error('Error making request to SABnzbd:', error);
                if (axios.isAxiosError(error)) {
                    if ((error instanceof Error ? error.code : String(error)) === 'ECONNREFUSED') {
                        return res["status"](503).json({
                            error: 'Cannot connect to SABnzbd',
                            details: 'Connection refused. Please check if SABnzbd is running.',
                        });
                    }
                    if ((error instanceof Error ? error.code : String(error)) === 'ETIMEDOUT') {
                        return res["status"](504).json({
                            error: 'Request to SABnzbd timed out',
                            details: 'The request took too long to complete.',
                        });
                    }
                    if (error.response?.status === 401) {
                        return res["status"](401).json({
                            error: 'Authentication failed',
                            details: 'Invalid API key for SABnzbd',
                        });
                    }
                    return res["status"](502).json({
                        error: 'Error communicating with SABnzbd',
                        details: (error instanceof Error ? error.message : String(error)),
                    });
                }
                return res["status"](500).json({
                    error: 'Internal server error',
                    details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
                });
            }
        },
        POST: async (req, res): Promise<void> => {
            // SECURITY: Verify authentication (OWASP A01:2021)
            const session = await getServerSession(req, res, authOptions);
            if (!session?.user) {
                logger.warn('Unauthorized sabnzbd proxy access attempt (POST)', {
                    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
                });
                return res["status"](401).json({
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const { baseURL, apiKey, params = {} } = req.body as z.infer<typeof sabnzbdProxySchema>;
            try {
                // Build SABnzbd API URL
                const url = new URL(`${baseURL}/api`);
                logger.info('SABnzbd proxy request:', {
                    method: 'POST',
                    url: url.toString(),
                    params: Object.keys(params),
                });
                // Prepare form data for POST request
                const formData = new URLSearchParams();
                formData.append('apikey', apiKey);
                formData.append('output', 'json');
                // Add additional parameters
                Object.keys(params).forEach(key => {
                    const value = params[key];
                    if (typeof value === 'string') {
                        formData.append(key, value);
                    } else if (typeof value === 'number' || typeof value === 'boolean') {
                        formData.append(key, String(value));
                    }
                });
                const response = await axios.post(url.toString(), formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 30000,
                });
                logger.info('SABnzbd request successful');
                return res["status"](200).json(response.data);
            }
            catch (error: unknown) {
                logger.error('Error making request to SABnzbd:', error);
                if (axios.isAxiosError(error)) {
                    if ((error instanceof Error ? error.code : String(error)) === 'ECONNREFUSED') {
                        return res["status"](503).json({
                            error: 'Cannot connect to SABnzbd',
                            details: 'Connection refused. Please check if SABnzbd is running.',
                        });
                    }
                    if ((error instanceof Error ? error.code : String(error)) === 'ETIMEDOUT') {
                        return res["status"](504).json({
                            error: 'Request to SABnzbd timed out',
                            details: 'The request took too long to complete.',
                        });
                    }
                    if (error.response?.status === 401) {
                        return res["status"](401).json({
                            error: 'Authentication failed',
                            details: 'Invalid API key for SABnzbd',
                        });
                    }
                    return res["status"](502).json({
                        error: 'Error communicating with SABnzbd',
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
        POST: sabnzbdProxySchema,
    },
});
