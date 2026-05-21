/**
 * Login API Endpoint
 *
 * Standardized API endpoint for authentication using the route factory pattern.
 * Provides a consistent interface for user authentication.
 *
 * @module pages/api/auth/login
 */
import { z } from 'zod';

import { validateCredentials } from '@/lib/auth/server-auth';
import { sanitizeCredentials } from '@/server/utils/log-sanitizer';
import { createApiRoute } from '@/utils/api-route-factory';
import type { ApiResponse } from '@/utils/api-route-factory';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


// Validation schema for login request
const loginSchema = z.object({
    identifier: z.string().min(1, 'Username/email is required'),
    password: z.string().min(1, 'Password is required')
});
// Response type
interface LoginResponse {
    user: {
        id: string;
        username: string;
        email: string;
        role: string;
    };
}
const handler = createApiRoute({
    handlers: {
        POST: async (req, res): Promise<void> => {
            const { identifier, password } = req.body as z.infer<typeof loginSchema>;
            // SECURITY: Log sanitized credentials to prevent password leaks
            logger.info('Login attempt:', sanitizeCredentials({ identifier, password }));
            // Use the standardized validation function
            const validationResult = await validateCredentials(identifier, password);

            if (isError(validationResult)) {
                return res["status"](401).json({
                    status: 'error',
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: validationResult.error.message || 'Invalid credentials',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId ?? ''
                    }
                } as ApiResponse);
            }

            if (!isSuccess(validationResult)) {
                return res["status"](401).json({
                    status: 'error',
                    error: {
                        code: 'INVALID_CREDENTIALS',
                        message: 'Invalid credentials',
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId ?? ''
                    }
                } as ApiResponse);
            }

            // Get user from validation result
            const user = validationResult.data;
            // Return success response with domain-typed user
            // SECURITY: Log sanitized user data (no sensitive fields)
            logger.info('Login successful:', { username: user.username, userId: user.id });
            return res["status"](200).json({
                status: 'success',
                data: {
                    user: {
                        id: user["id"],
                        username: user.username,
                        email: user.email,
                        role: user.role as string
                    }
                }
            } as ApiResponse<LoginResponse>);
        }
    },
    requireAuth: false, // Login endpoint doesn't require existing auth
    validation: {
        POST: loginSchema
    }
});
export default handler;
