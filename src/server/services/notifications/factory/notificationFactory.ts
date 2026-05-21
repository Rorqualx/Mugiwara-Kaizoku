/**
 * Notification Factory
 *
 * This module provides a factory for creating notification adapter instances
 * based on configuration. It follows the Factory Pattern to encapsulate
 * the creation logic and ensure proper initialization of adapters.
 *
 * @module notificationFactory
 */
import { configService } from '@/server/services/config/configService';
import type { NotificationConfig, EmailSettings, DiscordSettings, SlackSettings, WebhookSettings, TelegramSettings } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { DiscordAdapter } from '../adapters/discordAdapter';
import { EmailAdapter } from '../adapters/emailAdapter';
import { SlackAdapter } from '../adapters/slackAdapter';
import { TelegramAdapter } from '../adapters/telegramAdapter';
import { WebhookAdapter } from '../adapters/webhookAdapter';

import type { NotificationAdapter } from '../base/BaseNotificationAdapter';

/**
 * Result of adapter creation attempt
 */
interface AdapterCreationResult {
    adapter?: NotificationAdapter;
    created: boolean;
    skipped: boolean;
}

/**
 * Create email notification adapter
 *
 * @param {EmailSettings} emailConfig - Email configuration
 * @returns {AdapterCreationResult} Creation result
 */
function createEmailAdapter(emailConfig: EmailSettings & { ssl?: boolean }): AdapterCreationResult {
    try {
        const config: EmailSettings = {
            host: emailConfig.host,
            port: emailConfig.port,
            ...(emailConfig.username ? { username: emailConfig.username } : {}),
            ...(emailConfig.password ? { password: emailConfig.password } : {}),
            from: emailConfig.from,
            to: emailConfig.to,
            secure: emailConfig.ssl ?? false,
            enabled: emailConfig.enabled,
            events: []
        };
        const adapter = new EmailAdapter(config);
        if (adapter.isEnabled()) {
            logger.info('Email notification adapter created');
            return { adapter, created: true, skipped: false };
        }
        logger.debug('Email adapter skipped (disabled or invalid config)');
        return { created: false, skipped: true };
    } catch (error: unknown) {
        logger.error('Failed to create email adapter', error instanceof Error ? error.message : String(error));
        return { created: false, skipped: true };
    }
}

/**
 * Create Discord notification adapter
 *
 * @param {DiscordSettings} discordConfig - Discord configuration
 * @returns {AdapterCreationResult} Creation result
 */
function createDiscordAdapter(discordConfig: DiscordSettings): AdapterCreationResult {
    try {
        const adapter = new DiscordAdapter(discordConfig);
        if (adapter.isEnabled()) {
            logger.info('Discord notification adapter created');
            return { adapter, created: true, skipped: false };
        }
        logger.debug('Discord adapter skipped (disabled or invalid config)');
        return { created: false, skipped: true };
    } catch (error: unknown) {
        logger.error('Failed to create Discord adapter', error instanceof Error ? error.message : String(error));
        return { created: false, skipped: true };
    }
}

/**
 * Create Slack notification adapter
 *
 * @param {SlackSettings} slackConfig - Slack configuration
 * @returns {AdapterCreationResult} Creation result
 */
function createSlackAdapter(slackConfig: SlackSettings): AdapterCreationResult {
    try {
        const adapter = new SlackAdapter(slackConfig);
        if (adapter.isEnabled()) {
            logger.info('Slack notification adapter created');
            return { adapter, created: true, skipped: false };
        }
        logger.debug('Slack adapter skipped (disabled or invalid config)');
        return { created: false, skipped: true };
    } catch (error: unknown) {
        logger.error('Failed to create Slack adapter', error instanceof Error ? error.message : String(error));
        return { created: false, skipped: true };
    }
}

/**
 * Create Webhook notification adapter
 *
 * @param {WebhookSettings} webhookConfig - Webhook configuration
 * @param {number} globalRetryAttempts - Global retry attempts setting
 * @returns {AdapterCreationResult} Creation result
 */
function createWebhookAdapter(webhookConfig: WebhookSettings, globalRetryAttempts: number): AdapterCreationResult {
    try {
        const config: WebhookSettings = {
            enabled: webhookConfig.enabled,
            url: webhookConfig.url,
            method: (webhookConfig.method || 'POST') as 'GET' | 'POST' | 'PUT',
            ...(webhookConfig.headers ? { headers: webhookConfig.headers } : {}),
            timeout: 30000,
            retryAttempts: webhookConfig.retryAttempts ?? globalRetryAttempts,
            events: []
        };
        const adapter = new WebhookAdapter(config);
        if (adapter.isEnabled()) {
            logger.info('Webhook notification adapter created');
            return { adapter, created: true, skipped: false };
        }
        logger.debug('Webhook adapter skipped (disabled or invalid config)');
        return { created: false, skipped: true };
    } catch (error: unknown) {
        logger.error('Failed to create webhook adapter', error instanceof Error ? error.message : String(error));
        return { created: false, skipped: true };
    }
}

/**
 * Create Telegram notification adapter
 *
 * @param {TelegramSettings} telegramConfig - Telegram configuration
 * @returns {AdapterCreationResult} Creation result
 */
function createTelegramAdapter(telegramConfig: TelegramSettings): AdapterCreationResult {
    try {
        const config = {
            enabled: telegramConfig.enabled,
            botToken: telegramConfig.botToken,
            chatId: telegramConfig.chatId,
            sendSilently: false,
            events: []
        };
        const adapter = new TelegramAdapter(config);
        if (adapter.isEnabled()) {
            logger.info('Telegram notification adapter created');
            return { adapter, created: true, skipped: false };
        }
        logger.debug('Telegram adapter skipped (disabled or invalid config)');
        return { created: false, skipped: true };
    } catch (error: unknown) {
        logger.error('Failed to create Telegram adapter', error instanceof Error ? error.message : String(error));
        return { created: false, skipped: true };
    }
}

/**
 * Process adapter creation result
 *
 * @param {AdapterCreationResult} result - Creation result
 * @param {NotificationAdapter[]} adapters - Adapter array to push to
 * @returns {{ created: number; skipped: number }} Count update
 */
function processAdapterResult(
    result: AdapterCreationResult,
    adapters: NotificationAdapter[]
): { created: number; skipped: number } {
    if (result.adapter) {
        adapters.push(result.adapter);
    }
    return {
        created: result.created ? 1 : 0,
        skipped: result.skipped ? 1 : 0
    };
}

/**
 * Factory class for creating notification adapters
 *
 * Creates and configures notification adapters based on the provided
 * configuration. Only creates adapters that are enabled and properly
 * configured.
 *
 * @class NotificationFactory
 */
export class NotificationFactory {
    /**
     * Create notification adapters from configuration
     *
     * @static
     * @param {NotificationConfig} config - Notification configuration
     * @returns {Promise<NotificationAdapter[]>} Array of enabled notification adapters
     */
    static async createAdapters(config: NotificationConfig): Promise<NotificationAdapter[]> {
        const adapters: NotificationAdapter[] = [];
        let createdCount = 0;
        let skippedCount = 0;

        // Fetch global retry attempts setting once for all adapters
        const globalRetryAttempts = await configService.get<number>('download.retryAttempts', 3);

        // Create Email adapter
        if (config.email) {
            const result = createEmailAdapter(config.email as EmailSettings & { ssl?: boolean });
            const counts = processAdapterResult(result, adapters);
            createdCount += counts.created;
            skippedCount += counts.skipped;
        }

        // Create Discord adapter
        if (config.discord) {
            const result = createDiscordAdapter(config.discord);
            const counts = processAdapterResult(result, adapters);
            createdCount += counts.created;
            skippedCount += counts.skipped;
        }

        // Create Slack adapter
        if (config.slack) {
            const result = createSlackAdapter(config.slack);
            const counts = processAdapterResult(result, adapters);
            createdCount += counts.created;
            skippedCount += counts.skipped;
        }

        // Create Webhook adapter
        if (config.webhook) {
            const result = createWebhookAdapter(config.webhook as WebhookSettings, globalRetryAttempts);
            const counts = processAdapterResult(result, adapters);
            createdCount += counts.created;
            skippedCount += counts.skipped;
        }

        // Create Telegram adapter
        if (config.telegram) {
            const result = createTelegramAdapter(config.telegram);
            const counts = processAdapterResult(result, adapters);
            createdCount += counts.created;
            skippedCount += counts.skipped;
        }

        // TODO: Add Apprise adapter when refactored
        // if (config.apprise) {
        //   try {
        //     const adapter = new AppriseAdapter(config.apprise);
        //     if (adapter.isEnabled()) {
        //       adapters.push(adapter);
        //       createdCount++;
        //       logger.info('Apprise notification adapter created');
        //     }
        //   } catch (error) {
        //     logger.error('Failed to create Apprise adapter', error);
        //   }
        // }

        logger.info(`Notification adapters initialized`, {
            created: createdCount,
            skipped: skippedCount,
            total: createdCount + skippedCount
        });

        return adapters;
    }

    /**
     * Create a single adapter by type
     *
     * @static
     * @param {keyof NotificationConfig} type - The adapter type
     * @param {any} config - The adapter configuration
     * @returns {NotificationAdapter | null} The created adapter or null if creation failed
     */
    static createAdapter(type: keyof NotificationConfig, config: unknown): NotificationAdapter | null {
        try {
            switch (type) {
                case 'email':
                    return new EmailAdapter(config as EmailSettings);
                case 'discord':
                    return new DiscordAdapter(config as DiscordSettings);
                case 'slack':
                    return new SlackAdapter(config as SlackSettings);
                case 'webhook':
                    return new WebhookAdapter(config as WebhookSettings);
                case 'telegram': {
                    const telegramConfig = config as TelegramSettings;
                    return new TelegramAdapter({
                        ...telegramConfig,
                        enabled: telegramConfig.enabled,
                        events: telegramConfig.events ?? [],
                        sendSilently: telegramConfig.sendSilently ?? false
                    });
                }
                // case 'apprise':
                //   return new AppriseAdapter(config);
                default:
                    logger.error(`Unknown notification adapter type: ${String(type)}`);
                    return null;
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to create ${String(type)} adapter`, error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    /**
     * Get available adapter types
     *
     * @static
     * @returns {string[]} Array of available adapter type names
     */
    static getAvailableTypes(): string[] {
        return ['email', 'discord', 'slack', 'webhook', 'telegram'];
    }

    /**
     * Validate if a type is supported
     *
     * @static
     * @param {string} type - The adapter type to check
     * @returns {boolean} True if the type is supported
     */
    static isTypeSupported(type: string): boolean {
        return this.getAvailableTypes().includes(type);
    }
}
