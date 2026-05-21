/**
 * Apprise Integration Router
 *
 * Provides tRPC endpoints for Apprise multi-service notification integration.
 * Apprise supports 90+ notification services through a unified API.
 *
 * @see https://github.com/caronc/apprise
 */
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { z } from 'zod';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getIntegrationConfigService } from '@/server/services/integration/configService';
import {
  createConnectedStatus,
  createDefaultStatus,
  createDisconnectedStatus,
  createErrorStatus,
  STATUS_CHECK_TIMEOUT_MS,
  type CachedIntegrationStatus
} from '@/server/services/integration/statusCache';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

/**
 * Input schema for testing Apprise connection
 */
const testConnectionSchema = z.object({
    serviceUrl: z.string().url('Must be a valid URL'),
    services: z.array(z.string()).min(1, 'At least one service URL is required')
});

/**
 * Test Apprise server availability
 */
async function testAppriseServer(serviceUrl: string): Promise<{ available: boolean; version?: string; error?: string; }> {
    try {
        // Remove trailing slash
        const baseUrl = serviceUrl.replace(/\/$/, '');

        // Try to reach the root endpoint
        const response = await axios.get(baseUrl, {
            timeout: 10000,
            validateStatus: (status) => status < 500 // Accept any non-5xx status
        });

        // Apprise returns JSON with version info on the root endpoint
        if (response.status === 200) {
            const data: unknown = response.data;
            const version = typeof data === 'object' && data !== null && 'version' in data && typeof data.version === 'string'
                ? data.version
                : 'unknown';

            return {
                available: true,
                version
            };
        }

        return {
            available: false,
            error: `Server returned status ${response.status}`
        };
    }
    catch (error: unknown) {
        logger.error('Apprise server availability test failed:', error);
        return {
            available: false,
            error: error instanceof Error ? error.message : 'Failed to reach Apprise server'
        };
    }
}

/**
 * Send test notification via Apprise
 */
async function sendTestNotification(
    serviceUrl: string,
    services: string[]
): Promise<{ success: boolean; successCount?: number; failureCount?: number; error?: string; }> {
    try {
        // Remove trailing slash
        const baseUrl = serviceUrl.replace(/\/$/, '');

        const payload = {
            urls: services,
            title: 'Mugiwara Kaizoku Test',
            body: '🤖 Your Apprise notification integration is working correctly!',
            type: 'info'
        };

        const response = await axios.post(`${baseUrl}/notify`, payload, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200 || response.status === 204) {
            // Apprise returns 200 with success/failure counts, or 204 for simple success
            const data: unknown = response.data;
            const successCount = typeof data === 'object' && data !== null && 'success' in data && typeof data.success === 'number'
                ? data.success
                : services.length;
            const failureCount = typeof data === 'object' && data !== null && 'failure' in data && typeof data.failure === 'number'
                ? data.failure
                : 0;

            return {
                success: true,
                successCount,
                failureCount
            };
        }

        return {
            success: false,
            error: `Server returned status ${response.status}`
        };
    }
    catch (error: unknown) {
        logger.error('Failed to send Apprise test notification:', error);

        if (axios.isAxiosError(error) && error.response) {
            return {
                success: false,
                error: `Server error: ${error.response.status} - ${error.response.statusText}`
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send test notification'
        };
    }
}

/**
 * Test Apprise connection with reduced timeout for status checks
 * Exported for use by the main integrations router
 */
export async function testAppriseConnection(): Promise<CachedIntegrationStatus> {
  try {
    const configService = getGlobalConfigService();
    const integrationConfigService = getIntegrationConfigService(configService);
    const config = await integrationConfigService.getAppriseConfig();

    if (!config.serviceUrl || config.services.length === 0) {
      return createDefaultStatus(config.enabled, false);
    }

    // Test server availability with reduced timeout
    const baseUrl = config.serviceUrl.replace(/\/$/, '');

    try {
      const response = await axios.get(baseUrl, {
        timeout: STATUS_CHECK_TIMEOUT_MS,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        const data: unknown = response.data;
        const version = typeof data === 'object' && data !== null && 'version' in data && typeof data.version === 'string'
          ? data.version
          : 'unknown';

        return createConnectedStatus(config.enabled, { version });
      }

      return createDisconnectedStatus(config.enabled, `Server returned status ${response.status}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reach Apprise server';
      return createDisconnectedStatus(config.enabled, errorMessage);
    }
  } catch (error: unknown) {
    logger.error('Apprise connection test failed:', error);
    return createErrorStatus(false, error instanceof Error ? error.message : 'Unknown error');
  }
}

export const appriseRouter = router({
    /**
     * Test connection to Apprise server
     */
    testConnection: adminProcedure
        .input(testConnectionSchema)
        .mutation(async ({ input }): Promise<{
            success: boolean;
            message: string;
            version?: string;
            successCount?: number;
            failureCount?: number;
        }> => {
        try {
            logger.info('Testing Apprise connection');

            // Test server availability
            const serverTest = await testAppriseServer(input.serviceUrl);
            if (!serverTest.available) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: serverTest.error ?? 'Apprise server is not reachable'
                });
            }

            // Send test notification
            const notificationTest = await sendTestNotification(input.serviceUrl, input.services);
            if (!notificationTest.success) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: notificationTest.error ?? 'Failed to send test notification'
                });
            }

            // Check if any notifications failed
            if (notificationTest.failureCount && notificationTest.failureCount > 0) {
                const successCount = notificationTest.successCount ?? 0;
                const totalCount = input.services.length;

                return {
                    success: true,
                    message: `Partial success: ${successCount}/${totalCount} notifications sent. Check your service URLs.`,
                    ...(serverTest.version ? { version: serverTest.version } : {}),
                    successCount,
                    failureCount: notificationTest.failureCount
                };
            }

            return {
                success: true,
                message: 'Connection successful - test notifications sent to all services!',
                ...(serverTest.version ? { version: serverTest.version } : {}),
                ...(notificationTest.successCount !== undefined ? { successCount: notificationTest.successCount } : {}),
                ...(notificationTest.failureCount !== undefined ? { failureCount: notificationTest.failureCount } : {})
            };
        }
        catch (error: unknown) {
            logger.error('Apprise connection test failed:', error);
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: error instanceof Error ? error.message : 'Failed to test connection'
            });
        }
    }),

    /**
     * Get Apprise integration status
     */
    getStatus: protectedProcedure.query(async (): Promise<{
        enabled: boolean;
        configured: boolean;
        serviceCount: number;
        connectionStatus?: 'connected' | 'disconnected' | 'error' | 'not-configured';
        connectionError?: string | null;
        version?: string;
    }> => {
        try {
            const configService = getGlobalConfigService();
            const integrationConfigService = getIntegrationConfigService(configService);
            const config = await integrationConfigService.getAppriseConfig();

            const status = {
                enabled: config.enabled,
                configured: !!(config.serviceUrl && config.services.length > 0),
                serviceCount: config.services.length,
                connectionStatus: 'not-configured' as const
            };

            // If configured, try to test connection
            if (status.configured && status.enabled) {
                try {
                    const serverTest = await testAppriseServer(config.serviceUrl);

                    if (!serverTest.available) {
                        return {
                            ...status,
                            connectionStatus: 'disconnected',
                            connectionError: serverTest.error ?? 'Cannot reach Apprise server'
                        };
                    }

                    // Try a quick notification test (we won't actually send to avoid spam)
                    // Just verify the server is responsive
                    return {
                        ...status,
                        connectionStatus: 'connected',
                        connectionError: null,
                        ...(serverTest.version ? { version: serverTest.version } : {})
                    };
                }
                catch (error: unknown) {
                    return {
                        ...status,
                        connectionStatus: 'error',
                        connectionError: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }

            // Not configured or not enabled
            return status;
        }
        catch (error: unknown) {
            logger.error('Failed to get Apprise status:', error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get Apprise status'
            });
        }
    })
});
