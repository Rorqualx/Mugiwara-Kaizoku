/**
 * Discord Notification Adapter
 *
 * This module implements Discord webhook notifications.
 * It supports rich embeds with colors, timestamps, and footer information.
 *
 * @module discordAdapter
 */
import type { DiscordSettings, NotificationTestResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isError
} from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { BaseNotificationAdapter } from '../base/BaseNotificationAdapter';
import { getEventEmoji, getEventDiscordColor } from '../utils/event-helpers';

import type { NotificationPayload } from '../base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';

/**
 * Discord embed structure
 *
 * @interface DiscordEmbed
 */
interface DiscordEmbed {
    title: string;
    description: string;
    url?: string;
    color: number;
    timestamp: string;
    footer?: {
        text: string;
        icon_url?: string;
    };
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
}
/**
 * Discord webhook payload structure
 *
 * @interface DiscordWebhookPayload
 */
interface DiscordWebhookPayload {
    username?: string;
    avatar_url?: string;
    embeds: DiscordEmbed[];
}
/**
 * Discord adapter for sending webhook notifications
 *
 * Implements the NotificationAdapter interface to send notifications
 * through Discord webhooks. Supports rich embeds with custom colors
 * and formatting based on notification events.
 *
 * @class DiscordAdapter
 * @extends {BaseNotificationAdapter}
 */
export class DiscordAdapter extends BaseNotificationAdapter {
    /**
     * Discord configuration settings
     * @private
     */
    private config: DiscordSettings;
    /**
     * Creates an instance of DiscordAdapter
     *
     * @constructor
     * @param {DiscordSettings} config - Discord configuration settings
     */
    constructor(config: DiscordSettings) {
        super(config.enabled, config.events ?? []);
        this.config = config;
    }
    /**
     * Send a Discord notification
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        // Check if adapter should handle this event
        if (!this.isEnabled() || !this.shouldSendEvent(payload.event)) {
            return createSuccessResult(true);
        }
        try {
            const embed: DiscordEmbed = {
                title: this.formatTitle(payload),
                description: this.formatDescription(payload),
                ...(payload.url && { url: payload.url }),
                color: this.getColorForEvent(payload.event),
                timestamp: new Date().toISOString(),
            };
            // Add footer if avatar URL is configured
            if (this.config.avatarUrl) {
                embed.footer = {
                    text: 'Mugiwara Kaizoku',
                    icon_url: this.config.avatarUrl,
                };
            }
            else {
                embed.footer = {
                    text: 'Mugiwara Kaizoku',
                };
            }
            // Add metadata as fields if present
            if (payload["metadata"] && Object.keys(payload["metadata"]).length > 0) {
                embed.fields = this.formatMetadataFields(payload["metadata"]);
            }
            const webhookPayload: DiscordWebhookPayload = {
                username: this.config.username ?? 'Mugiwara Kaizoku',
                ...(this.config.avatarUrl && { avatar_url: this.config.avatarUrl }),
                embeds: [embed],
            };
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload),
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Discord webhook failed with status ${response["status"]}`;
                // Parse Discord error response if possible
                try {
                    const errorJson: unknown = JSON.parse(errorText);
                    if (
                        errorJson &&
                        typeof errorJson === 'object' &&
                        'message' in errorJson &&
                        typeof errorJson.message === 'string'
                    ) {
                        errorMessage += `: ${errorJson.message}`;
                    }
                }
                catch {
                    errorMessage += `: ${errorText}`;
                }
                throw new ValidationError(errorMessage);
            }
            logger.info('Discord notification sent successfully', { event: payload.event });
            return createSuccessResult(true);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Failed to send Discord notification', errorMessage));
        }
    }
    /**
     * Test the Discord webhook configuration
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async test(): Promise<AsyncResult<NotificationTestResult, Error>> {
        const testResult = await this.send({
            title: '🧪 Test Notification',
            body: 'This is a test notification from Mugiwara Kaizoku to verify your Discord webhook is working correctly.',
            event: 'UPDATE_AVAILABLE' as NotificationEventType,
            metadata: {
                test: true,
                timestamp: new Date().toISOString(),
                source: 'Discord Adapter Test'
            }
        });
        if (testResult["status"] === 'success') {
            return createSuccessResult({
                success: true,
                message: 'Test notification sent to Discord successfully',
            });
        }
        else if (isError(testResult)) {
            return createErrorResult(testResult.error);
        }
        else {
            return createErrorResult(new Error('Unknown test result status'));
        }
    }
    /**
     * Validate the Discord configuration
     *
     * @returns {AsyncResult<boolean, Error>} Validation result
     */
    validateConfig(): AsyncResult<boolean, Error> {
        if (!this.config.webhookUrl) {
            return createErrorResult(new Error('Discord webhook URL is required'));
        }
        // Validate webhook URL format
        const webhookPattern = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
        if (!webhookPattern.test(this.config.webhookUrl)) {
            return createErrorResult(new Error('Invalid Discord webhook URL format. Expected: https://discord.com/api/webhooks/{id}/{token}'));
        }
        // Validate avatar URL if provided
        if (this.config.avatarUrl) {
            try {
                new URL(this.config.avatarUrl);
            }
            catch {
                return createErrorResult(new Error('Invalid avatar URL format'));
            }
        }
        return createSuccessResult(true);
    }
    /**
     * Format the notification title with event-specific emoji
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} Formatted title
     */
    private formatTitle(payload: NotificationPayload): string {
        const emoji = getEventEmoji(payload.event);
        return `${emoji} ${payload["title"]}`;
    }
    /**
     * Format the notification description
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} Formatted description
     */
    private formatDescription(payload: NotificationPayload): string {
        // Discord has a 4096 character limit for embed descriptions
        if (payload.body.length > 4000) {
            return payload.body.substring(0, 3997) + '...';
        }
        return payload.body;
    }
    /**
     * Format metadata as Discord embed fields
     *
     * @private
     * @param {Record<string, unknown>} metadata - The metadata object
     * @returns {Array<{name: string, value: string, inline?: boolean}>} Formatted fields
     */
    private formatMetadataFields(metadata: Record<string, unknown>): Array<{
        name: string;
        value: string;
        inline?: boolean;
    }> {
        const fields: Array<{
            name: string;
            value: string;
            inline?: boolean;
        }> = [];
        // Discord has a limit of 25 fields per embed
        const entries = Object.entries(metadata).slice(0, 25);
        for (const [key, value] of entries) {
            const formattedKey = key
                .split(/[_-]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            let formattedValue: string;
            if (value === null) {
                formattedValue = 'N/A';
            }
            else if (typeof value === 'object') {
                formattedValue = JSON.stringify(value, null, 2);
            }
            else {
                formattedValue = String(value);
            }
            // Discord has a 1024 character limit for field values
            if (formattedValue.length > 1020) {
                formattedValue = formattedValue.substring(0, 1017) + '...';
            }
            fields.push({
                name: formattedKey,
                value: formattedValue,
                inline: formattedValue.length < 50
            });
        }
        return fields;
    }
    /**
     * Get the embed color for a specific event
     *
     * @private
     * @param {NotificationEventType} event - The notification event
     * @returns {number} Discord color value (decimal)
     */
    private getColorForEvent(event: NotificationEventType): number {
        return getEventDiscordColor(event);
    }
    /**
     * Wrapper method for compatibility with notification providers
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async sendNotification(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        return this.send(payload);
    }
    /**
     * Wrapper method for compatibility with notification providers
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async testConnection(): Promise<AsyncResult<NotificationTestResult, Error>> {
        return this.test();
    }
    /**
     * Check if the adapter is configured
     *
     * @returns {boolean} True if configured
     */
    isConfigured(): boolean {
        return this.isEnabled();
    }
}
/**
 * Factory function to create a DiscordAdapter instance
 *
 * @param {DiscordSettings} config - Discord configuration settings
 * @returns {DiscordAdapter} New DiscordAdapter instance
 */
export function createDiscordAdapter(config: DiscordSettings): DiscordAdapter {
    return new DiscordAdapter(config);
}
