/**
 * Notification Configuration Service
 *
 * Provides centralized access to notification-specific configuration options.
 * This service acts as an adapter between the main configuration system
 * and the notification services, abstracting away configuration storage details.
 *
 * Features:
 * - Type-safe configuration access
 * - Default values
 * - Centralized configuration schema
 * - Multiple notification providers support (Telegram, Apprise)
 */
import { logger } from '@/utils/logger';

import type { ConfigService } from '../config/configService';
/**
 * Interface for Telegram notification configuration
 */
export interface TelegramConfig {
    enabled: boolean;
    token: string;
    chatId: string;
    sendSilently: boolean;
}
/**
 * Interface for Apprise notification configuration
 */
export interface AppriseConfig {
    enabled: boolean;
    host: string;
    urls: string[];
}
/**
 * Interface for all notification settings
 */
export interface NotificationConfig {
    telegram: TelegramConfig;
    apprise: AppriseConfig;
}
/**
 * Service for managing notification configuration
 */
export class NotificationConfigService {
    /**
     * Default configuration values
     */
    private defaultConfig: NotificationConfig = {
        telegram: {
            enabled: false,
            token: '',
            chatId: '',
            sendSilently: false
        },
        apprise: {
            enabled: false,
            host: '',
            urls: []
        }
    };
    constructor(private configService: ConfigService) { }
    /**
     * Load the current notification configuration
     *
     * @returns Promise resolving to the current configuration
     */
    async loadConfig(): Promise<NotificationConfig> {
        try {
            // Telegram settings
            const telegramEnabled = await this.configService.get<boolean>('notifications.telegram.enabled', this.defaultConfig.telegram.enabled);
            const telegramToken = await this.configService.get<string>('notifications.telegram.token', this.defaultConfig.telegram.token);
            const telegramChatId = await this.configService.get<string>('notifications.telegram.chatId', this.defaultConfig.telegram.chatId);
            const telegramSendSilently = await this.configService.get<boolean>('notifications.telegram.sendSilently', this.defaultConfig.telegram.sendSilently);
            // Apprise settings
            const appriseEnabled = await this.configService.get<boolean>('notifications.apprise.enabled', this.defaultConfig.apprise.enabled);
            const appriseHost = await this.configService.get<string>('notifications.apprise.host', this.defaultConfig.apprise.host);
            const appriseUrls = await this.configService.get<string[]>('notifications.apprise.urls', this.defaultConfig.apprise.urls);
            // Return consolidated configuration
            return {
                telegram: {
                    enabled: telegramEnabled,
                    token: telegramToken,
                    chatId: telegramChatId,
                    sendSilently: telegramSendSilently
                },
                apprise: {
                    enabled: appriseEnabled,
                    host: appriseHost,
                    urls: appriseUrls
                }
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error loading notification configuration: ${errorMessage}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update notification configuration
     *
     * @param config - Partial configuration to update
     * @returns Promise resolving when the update is complete
     */
    async updateConfig(config: Partial<NotificationConfig>): Promise<void> {
        try {
            // Update Telegram settings
            if (config.telegram) {
                if ('enabled' in config.telegram) {
                    await this.configService.set('notifications.telegram.enabled', config.telegram.enabled);
                }
                if ('token' in config.telegram) {
                    await this.configService.set('notifications.telegram.token', config.telegram.token);
                }
                if ('chatId' in config.telegram) {
                    await this.configService.set('notifications.telegram.chatId', config.telegram.chatId);
                }
                if ('sendSilently' in config.telegram) {
                    await this.configService.set('notifications.telegram.sendSilently', config.telegram.sendSilently);
                }
            }
            // Update Apprise settings
            if (config.apprise) {
                if ('enabled' in config.apprise) {
                    await this.configService.set('notifications.apprise.enabled', config.apprise.enabled);
                }
                if ('host' in config.apprise) {
                    await this.configService.set('notifications.apprise.host', config.apprise.host);
                }
                if ('urls' in config.apprise) {
                    await this.configService.set('notifications.apprise.urls', config.apprise.urls);
                }
            }
            logger.info('Notification configuration updated successfully');
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error updating notification configuration: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get Telegram configuration
     *
     * @returns Promise resolving to Telegram configuration
     */
    async getTelegramConfig(): Promise<TelegramConfig> {
        const config = await this.loadConfig();
        return config.telegram;
    }
    /**
     * Get Apprise configuration
     *
     * @returns Promise resolving to Apprise configuration
     */
    async getAppriseConfig(): Promise<AppriseConfig> {
        const config = await this.loadConfig();
        return config.apprise;
    }
    /**
     * Check if Telegram notifications are enabled
     *
     * @returns Promise resolving to whether Telegram is enabled
     */
    async isTelegramEnabled(): Promise<boolean> {
        const telegramConfig = await this.getTelegramConfig();
        return telegramConfig.enabled && !!telegramConfig.token && !!telegramConfig.chatId;
    }
    /**
     * Check if Apprise notifications are enabled
     *
     * @returns Promise resolving to whether Apprise is enabled
     */
    async isAppriseEnabled(): Promise<boolean> {
        const appriseConfig = await this.getAppriseConfig();
        return appriseConfig.enabled && !!appriseConfig.host && appriseConfig.urls.length > 0;
    }
    /**
     * Check if any notification provider is enabled
     *
     * @returns Promise resolving to whether any provider is enabled
     */
    async areNotificationsEnabled(): Promise<boolean> {
        const [telegramEnabled, appriseEnabled] = await Promise.all([
            this.isTelegramEnabled(),
            this.isAppriseEnabled()
        ]);
        return telegramEnabled || appriseEnabled;
    }
}
// Create and export the config service for server-side usage
let notificationConfigServiceInstance: NotificationConfigService | null = null;
/**
 * Get the notification config service singleton instance
 *
 * @param configService - The main config service to use
 * @returns The notification config service instance
 */
export function getNotificationConfigService(configService: ConfigService): NotificationConfigService {
    notificationConfigServiceInstance ??= new NotificationConfigService(configService);
    return notificationConfigServiceInstance;
}
