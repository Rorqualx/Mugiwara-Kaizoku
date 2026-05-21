/**
 * Logout API Endpoint
 *
 * Handles user logout for the Kaizoku application with NextAuth.
 * This is a compatibility endpoint that redirects to the NextAuth signout endpoint.
 *
 * @module pages/api/auth/logout
 */
import { createApiRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

export default createApiRoute({
    requireAuth: false, // Logout should work even if auth is already invalid
    handlers: {
        POST: (req, res): Promise<void> => {
            try {
                logger.info('Processing logout request');
                // For API routes, we can't directly call signOut (client-side only),
                // but we can return success and let the client handle the signout
                // Clear any server-side session data if needed
                // This is handled by NextAuth when client redirects to /api/auth/signout
                return Promise.resolve(res["status"](200).json({
                    success: true,
                    message: 'Logout processed successfully. Client should redirect to /api/auth/signout.',
                    redirectTo: '/api/auth/signout'
                }));
            }
            catch (error: unknown) {
                logger.error('Logout error:', error);
                return Promise.resolve(res["status"](500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
                }));
            }
        },
    },
});
