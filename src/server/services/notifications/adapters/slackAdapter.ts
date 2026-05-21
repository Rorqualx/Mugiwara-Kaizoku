/**
 * Slack Notification Adapter
 *
 * This module implements Slack webhook notifications using the official @slack/webhook package.
 * It supports rich message formatting with attachments, colors, and actions.
 *
 * @module slackAdapter
 */
import { IncomingWebhook } from '@slack/webhook';

import type { SlackSettings, NotificationTestResult } from '@/types/search.types';
import {
  createSuccessResult,
  createErrorResult,
  isError
} from '@/utils/async-result';
import type {
  AsyncResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseNotificationAdapter } from '../base/BaseNotificationAdapter';
import { getEventEmoji, getEventColor } from '../utils/event-helpers';

import type { NotificationPayload } from '../base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';
import type { IncomingWebhookSendArguments } from '@slack/webhook';
/**
 * Slack message attachment structure
 *
 * @interface SlackAttachment
 */
interface SlackAttachment {
    color?: string;
    fallback?: string;
    pretext?: string;
    author_name?: string;
    author_link?: string;
    author_icon?: string;
    title?: string;
    title_link?: string;
    text?: string;
    fields?: Array<{
        title: string;
        value: string;
        short?: boolean;
    }>;
    image_url?: string;
    thumb_url?: string;
    footer?: string;
    footer_icon?: string;
    ts?: string;
    actions?: Array<{
        type: "button" | "select";
        text: string;
        url?: string;
        style?: "default" | "primary" | "danger";
    }>;
}
/**
 * Slack adapter for sending webhook notifications
 *
 * Implements the NotificationAdapter interface to send notifications
 * through Slack incoming webhooks. Supports rich message formatting
 * with attachments and interactive elements.
 *
 * @class SlackAdapter
 * @extends {BaseNotificationAdapter}
 */
export class SlackAdapter extends BaseNotificationAdapter {
    /**
     * Slack webhook client instance
     * @private
     */
    private webhook: IncomingWebhook | null = null;
    /**
     * Slack configuration settings
     * @private
     */
    private config: SlackSettings;
    /**
     * Creates an instance of SlackAdapter
     *
     * @constructor
     * @param {SlackSettings} config - Slack configuration settings
     */
    constructor(config: SlackSettings) {
        super(config.enabled, config.events ?? []);
        this.config = config;
        if (this.enabled && this.config.webhookUrl) {
            try {
                this.webhook = new IncomingWebhook(this.config.webhookUrl);
                logger.info('Slack webhook initialized successfully');
            }
            catch (error: unknown) {
                logger.error('Failed to initialize Slack webhook', error instanceof Error ? error.message : String(error));
                this.webhook = null;
            }
        }
    }
    /**
     * Send a Slack notification
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        // Check if adapter should handle this event
        if (!this.isEnabled() || !this.shouldSendEvent(payload.event)) {
            return createSuccessResult(true);
        }
        if (!this.webhook) {
            return createErrorResult(new Error('Slack webhook not initialized'));
        }
        try {
            const attachment: SlackAttachment = {
                color: this.getColorForEvent(payload.event),
                title: payload["title"],
                text: payload.body,
                footer: 'Mugiwara Kaizoku',
                footer_icon: 'https://kaizoku.example.com/icon.png', // You may want to configure this
                ts: Math.floor(Date.now() / 1000).toString(),
            };
            // Add action button if URL is provided
            if (payload.url) {
                attachment.actions = [
                    {
                        type: 'button',
                        text: 'View Details',
                        url: payload.url,
                        style: 'primary'
                    },
                ];
            }
            // Add metadata as fields if present
            if (payload["metadata"] && Object.keys(payload["metadata"]).length > 0) {
                attachment.fields = this.formatMetadataFields(payload["metadata"]);
            }
            const message: IncomingWebhookSendArguments = {
                text: this.formatNotificationText(payload),
                username: this.config.username ?? 'Mugiwara Kaizoku',
                attachments: [attachment],
                // Disable link unfurling for cleaner messages
                unfurl_links: false,
                unfurl_media: false,
            };
            if (this.config.channel) {
                message.channel = this.config.channel;
            }
            await this.webhook.send(message);
            logger.info('Slack notification sent successfully', { event: payload.event });
            return createSuccessResult(true);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Failed to send Slack notification', errorMessage));
        }
    }
    /**
     * Test the Slack webhook configuration
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async test(): Promise<AsyncResult<NotificationTestResult, Error>> {
        const testResult = await this.send({
            title: '🧪 Test Notification',
            body: 'This is a test notification from Mugiwara Kaizoku to verify your Slack webhook is working correctly.',
            event: 'UPDATE_AVAILABLE' as NotificationEventType,
            metadata: {
                test: true,
                timestamp: new Date().toISOString(),
                source: 'Slack Adapter Test'
            }
        });
        if (testResult["status"] === 'success') {
            return createSuccessResult({
                success: true,
                message: 'Test notification sent to Slack successfully',
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
     * Validate the Slack configuration
     *
     * @returns {AsyncResult<boolean, Error>} Validation result
     */
    validateConfig(): AsyncResult<boolean, Error> {
        if (!this.config.webhookUrl) {
            return createErrorResult(new Error('Slack webhook URL is required'));
        }
        // Validate webhook URL format
        const webhookPattern = /^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/;
        if (!webhookPattern.test(this.config.webhookUrl)) {
            return createErrorResult(new Error('Invalid Slack webhook URL format. Expected: https://hooks.slack.com/services/...'));
        }
        // Validate channel format if provided
        if (this.config.channel) {
            if (!this.config.channel.startsWith('#') && !this.config.channel.startsWith('@')) {
                return createErrorResult(new Error('Slack channel must start with # (for channels) or @ (for direct messages)'));
            }
        }
        return createSuccessResult(true);
    }
    /**
     * Format the main notification text
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} Formatted text
     */
    private formatNotificationText(payload: NotificationPayload): string {
        const emoji = getEventEmoji(payload.event);
        const eventName = payload.event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `${emoji} *${eventName}*`;
    }
    /**
     * Format metadata as Slack attachment fields
     *
     * @private
     * @param {Record<string, unknown>} metadata - The metadata object
     * @returns {Array<{title: string, value: string, short?: boolean}>} Formatted fields
     */
    private formatMetadataFields(metadata: Record<string, unknown>): Array<{
        title: string;
        value: string;
        short?: boolean;
    }> {
        const fields: Array<{
            title: string;
            value: string;
            short?: boolean;
        }> = [];
        // Slack has practical limits on the number of fields
        const entries = Object.entries(metadata).slice(0, 10);
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
            // Slack has practical limits on field value length
            if (formattedValue.length > 1000) {
                formattedValue = formattedValue.substring(0, 997) + '...';
            }
            fields.push({
                title: formattedKey,
                value: formattedValue,
                short: formattedValue.length < 40
            });
        }
        return fields;
    }
    /**
     * Get the attachment color for a specific event
     *
     * @private
     * @param {NotificationEventType} event - The notification event
     * @returns {string} Slack color value (hex or named)
     */
    private getColorForEvent(event: NotificationEventType): string {
        const colorNum = getEventColor(event);
        // Convert number to hex color string
        return '#' + colorNum.toString(16).padStart(6, '0');
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
 * Factory function to create a SlackAdapter instance
 *
 * @param {SlackSettings} config - Slack configuration settings
 * @returns {SlackAdapter} New SlackAdapter instance
 */
export function createSlackAdapter(config: SlackSettings): SlackAdapter {
    return new SlackAdapter(config);
}
