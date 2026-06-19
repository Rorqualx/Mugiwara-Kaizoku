/**
 * Authentication Check API Endpoint
 *
 * Verifies if a user is currently authenticated via NextAuth.
 * Returns user data and authentication status.
 *
 * Features:
 * - Session validation
 * - User data retrieval
 * - Safe exposure of non-sensitive user data
 *
 * @module pages/api/auth/check
 */
import { auth } from '@/lib/auth/auth-options';
import { createApiRoute, successResponse } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

/**
 * Authentication check handler
 *
 * @param {NextApiRequest} req - HTTP request
 * @param {NextApiResponse} res - HTTP response
 */
export default createApiRoute({
    handlers: {
        GET: async (req, res): Promise<void> => {
            // Set CORS headers for development
            if (process.env.NODE_ENV === 'development') {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            }
            try {
                // Get the session using Auth.js
                const session = await auth();
                if (!session) {
                    // No authenticated session found
                    return res["status"](200).json({
                        authenticated: false,
                        user: null
                    });
                }
                // Map NextAuth session to the expected format for backward compatibility
                const user = {
                    id: session.user.id,
                    userName: session.user.name ?? '',
                    email: session.user.email ?? '',
                    role: session.user.role
                };
                // Return authenticated status and user data
                return res["status"](200).json(successResponse({
                    authenticated: true,
                    user
                }));
            }
            catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Authentication check errorMessage:', errorMessage);
                // Return errorMessage response
                return res["status"](500).json(successResponse({
                    authenticated: false,
                    errorMessage: 'Failed to check authentication status'
                }));
            }
        }
    },
    requireAuth: false // Public endpoint for checking auth status
});
