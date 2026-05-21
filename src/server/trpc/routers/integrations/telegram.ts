/**
 * Telegram Integration Router
 *
 * Provides tRPC endpoints for Telegram bot notification integration.
 * Handles bot authentication and message delivery testing.
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
 * Input schema for testing Telegram connection
 */
const testConnectionSchema = z.object({
    botToken: z.string().min(1, 'Bot token is required'),
    chatId: z.string().min(1, 'Chat ID is required')
});

/**
 * Telegram API base URL
 */
const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Test Telegram bot token validity
 */
async function testBotToken(botToken: string): Promise<{ valid: boolean; botInfo?: { username: string; firstName: string; }; error?: string; }> {
    try {
        const response = await axios.get(`${TELEGRAM_API_BASE}/bot${botToken}/getMe`, {
            timeout: 10000
        });

        // Type guard for Telegram API response
        const data: unknown = response.data;
        const isOk = typeof data === 'object' && data !== null && 'ok' in data && data.ok === true;

        if (isOk && typeof data === 'object' && 'result' in data) {
            const result = data.result;
            const username = typeof result === 'object' && result !== null && 'username' in result && typeof result.username === 'string'
                ? result.username
                : '';
            const firstName = typeof result === 'object' && result !== null && 'first_name' in result && typeof result.first_name === 'string'
                ? result.first_name
                : '';

            return {
                valid: true,
                botInfo: {
                    username,
                    firstName
                }
            };
        }

        return {
            valid: false,
            error: 'Invalid bot token'
        };
    }
    catch (error: unknown) {
        logger.error('Telegram bot token test failed:', error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Failed to verify bot token'
        };
    }
}

/**
 * Test Telegram chat access
 */
async function testChatAccess(botToken: string, chatId: string): Promise<{ valid: boolean; chatInfo?: { title?: string; type: string; }; error?: string; }> {
    try {
        const response = await axios.get(`${TELEGRAM_API_BASE}/bot${botToken}/getChat`, {
            params: { chat_id: chatId },
            timeout: 10000
        });

        // Type guard for Telegram API response
        const data: unknown = response.data;
        const isOk = typeof data === 'object' && data !== null && 'ok' in data && data.ok === true;

        if (isOk && typeof data === 'object' && 'result' in data) {
            const result = data.result;
            const title = typeof result === 'object' && result !== null && 'title' in result && typeof result.title === 'string'
                ? result.title
                : undefined;
            const type = typeof result === 'object' && result !== null && 'type' in result && typeof result.type === 'string'
                ? result.type
                : 'unknown';

            return {
                valid: true,
                chatInfo: {
                    ...(title !== undefined ? { title } : {}),
                    type
                }
            };
        }

        return {
            valid: false,
            error: 'Cannot access chat - ensure the bot is added to the chat'
        };
    }
    catch (error: unknown) {
        logger.error('Telegram chat access test failed:', error);
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Failed to verify chat access'
        };
    }
}

/**
 * Send test message to Telegram
 */
async function sendTestMessage(botToken: string, chatId: string): Promise<{ success: boolean; error?: string; }> {
    try {
        const message = `🤖 Mugiwara Kaizoku Test Message\n\nYour Telegram notification integration is working correctly!`;

        const response = await axios.post(
            `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            },
            { timeout: 10000 }
        );

        // Type guard for Telegram API response
        const data: unknown = response.data;
        const isOk = typeof data === 'object' && data !== null && 'ok' in data && data.ok === true;

        if (isOk) {
            return { success: true };
        }

        return {
            success: false,
            error: 'Failed to send test message'
        };
    }
    catch (error: unknown) {
        logger.error('Failed to send Telegram test message:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send test message'
        };
    }
}

/**
 * Test Telegram connection with reduced timeout for status checks
 * Exported for use by the main integrations router
 */
export async function testTelegramConnection(): Promise<CachedIntegrationStatus> {
  try {
    const configService = getGlobalConfigService();
    const integrationConfigService = getIntegrationConfigService(configService);
    const config = await integrationConfigService.getTelegramConfig();

    if (!config.botToken || !config.chatId) {
      return createDefaultStatus(config.enabled, false);
    }

    // Test bot token with reduced timeout
    const botTest = await axios.get(`${TELEGRAM_API_BASE}/bot${config.botToken}/getMe`, {
      timeout: STATUS_CHECK_TIMEOUT_MS
    }).then((response) => {
      const data: unknown = response.data;
      return typeof data === 'object' && data !== null && 'ok' in data && data.ok === true;
    }).catch(() => false);

    if (!botTest) {
      return createDisconnectedStatus(config.enabled, 'Invalid bot token');
    }

    // Test chat access with reduced timeout
    const chatTest = await axios.get(`${TELEGRAM_API_BASE}/bot${config.botToken}/getChat`, {
      params: { chat_id: config.chatId },
      timeout: STATUS_CHECK_TIMEOUT_MS
    }).then((response) => {
      const data: unknown = response.data;
      return typeof data === 'object' && data !== null && 'ok' in data && data.ok === true;
    }).catch(() => false);

    if (!chatTest) {
      return createDisconnectedStatus(config.enabled, 'Cannot access chat');
    }

    return createConnectedStatus(config.enabled);
  } catch (error: unknown) {
    logger.error('Telegram connection test failed:', error);
    return createErrorStatus(false, error instanceof Error ? error.message : 'Unknown error');
  }
}

export const telegramRouter = router({
    /**
     * Test connection to Telegram bot
     */
    testConnection: adminProcedure
        .input(testConnectionSchema)
        .mutation(async ({ input }): Promise<{
            success: boolean;
            message: string;
            botInfo?: { username: string; firstName: string; };
            chatInfo?: { title?: string; type: string; };
        }> => {
        try {
            logger.info('Testing Telegram connection');

            // Test bot token
            const botTest = await testBotToken(input.botToken);
            if (!botTest.valid) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: botTest.error ?? 'Invalid bot token'
                });
            }

            // Test chat access
            const chatTest = await testChatAccess(input.botToken, input.chatId);
            if (!chatTest.valid) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: chatTest.error ?? 'Cannot access chat'
                });
            }

            // Send test message
            const messageTest = await sendTestMessage(input.botToken, input.chatId);
            if (!messageTest.success) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: messageTest.error ?? 'Failed to send test message'
                });
            }

            return {
                success: true,
                message: 'Connection successful - test message sent!',
                ...(botTest.botInfo ? { botInfo: botTest.botInfo } : {}),
                ...(chatTest.chatInfo ? { chatInfo: chatTest.chatInfo } : {})
            };
        }
        catch (error: unknown) {
            logger.error('Telegram connection test failed:', error);
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
     * Get Telegram integration status
     */
    getStatus: protectedProcedure.query(async (): Promise<{
        enabled: boolean;
        configured: boolean;
        connectionStatus?: 'connected' | 'disconnected' | 'error' | 'not-configured';
        connectionError?: string | null;
        botInfo?: { username: string; firstName: string; };
    }> => {
        try {
            const configService = getGlobalConfigService();
            const integrationConfigService = getIntegrationConfigService(configService);
            const config = await integrationConfigService.getTelegramConfig();

            const status = {
                enabled: config.enabled,
                configured: !!(config.botToken && config.chatId),
                connectionStatus: 'not-configured' as const
            };

            // If configured, try to test connection
            if (status.configured && status.enabled) {
                try {
                    const botTest = await testBotToken(config.botToken);

                    if (!botTest.valid) {
                        return {
                            ...status,
                            connectionStatus: 'disconnected',
                            connectionError: botTest.error ?? 'Invalid bot token'
                        };
                    }

                    const chatTest = await testChatAccess(config.botToken, config.chatId);

                    if (!chatTest.valid) {
                        return {
                            ...status,
                            connectionStatus: 'disconnected',
                            connectionError: chatTest.error ?? 'Cannot access chat'
                        };
                    }

                    return {
                        ...status,
                        connectionStatus: 'connected',
                        connectionError: null,
                        ...(botTest.botInfo ? { botInfo: botTest.botInfo } : {})
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
            logger.error('Failed to get Telegram status:', error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get Telegram status'
            });
        }
    })
});
