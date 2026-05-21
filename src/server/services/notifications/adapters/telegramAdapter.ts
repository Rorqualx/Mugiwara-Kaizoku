/**
 * Telegram Notification Adapter
 *
 * This module implements Telegram bot notifications.
 * It supports HTML formatting, silent notifications, and web page previews.
 *
 * @module telegramAdapter
 */
import TelegramBot from 'node-telegram-bot-api';

import type { NotificationTestResult } from '@/types/search.types';
import {
  createSuccessResult,
  createErrorResult,
  isError
} from '@/utils/async-result';
import type {
  AsyncResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseNotificationAdapter } from '../base/BaseNotificationAdapter';
import { getEventEmoji } from '../utils/event-helpers';

import type { NotificationPayload } from '../base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';
/**
 * Extended Telegram settings with additional options
 *
 * @interface ExtendedTelegramSettings
 */
interface ExtendedTelegramSettings {
    enabled: boolean;
    events: NotificationEventType[];
    botToken: string;
    chatId: string;
    sendSilently?: boolean;
}
/**
 * Telegram adapter for sending bot notifications
 *
 * Implements the NotificationAdapter interface to send notifications
 * through the Telegram Bot API. Supports HTML formatting and silent
 * message delivery.
 *
 * @class TelegramAdapter
 * @extends {BaseNotificationAdapter}
 */
export class TelegramAdapter extends BaseNotificationAdapter {
    /**
     * Telegram configuration settings
     * @private
     */
    private config: ExtendedTelegramSettings;
    /**
     * Telegram bot instance
     * @private
     */
    private bot: TelegramBot | null = null;
    /**
     * Creates an instance of TelegramAdapter
     *
     * @constructor
     * @param {ExtendedTelegramSettings} config - Telegram configuration settings
     */
    constructor(config: ExtendedTelegramSettings) {
        super(config.enabled, config.events);
        this.config = config;
        if (this.enabled && this.config.botToken) {
            try {
                // Initialize bot in polling: false mode since we only send messages
                this.bot = new TelegramBot(this.config.botToken, { polling: false });
                logger.info('Telegram bot initialized successfully');
            }
            catch (error: unknown) {
                logger.error('Failed to initialize Telegram bot', error instanceof Error ? error.message : String(error));
                this.bot = null;
            }
        }
    }
    /**
     * Send a Telegram notification
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        // Check if adapter should handle this event
        if (!this.isEnabled() || !this.shouldSendEvent(payload.event)) {
            return createSuccessResult(true);
        }
        if (!this.bot) {
            return createErrorResult(new Error('Telegram bot not initialized'));
        }
        try {
            const message = this.formatTelegramMessage(payload);
            const options: TelegramBot.SendMessageOptions = {
                parse_mode: 'HTML',
                disable_notification: this.config.sendSilently ?? false,
                disable_web_page_preview: false,
            };
            // Add inline keyboard if URL is provided
            if (payload.url) {
                options.reply_markup = {
                    inline_keyboard: [[
                            {
                                text: '🔗 View Details',
                                url: payload.url
                            }
                        ]]
                };
            }
            await this.bot.sendMessage(this.config.chatId, message, options);
            logger.info('Telegram notification sent successfully', {
                event: payload.event,
                chatId: this.config.chatId
            });
            return createSuccessResult(true);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Failed to send Telegram notification', errorMessage));
        }
    }
    /**
     * Test the Telegram bot configuration
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async test(): Promise<AsyncResult<NotificationTestResult, Error>> {
        if (!this.bot) {
            return createErrorResult(new Error('Telegram bot not initialized'));
        }
        try {
            // Test bot token by getting bot info
            const botInfo = await this.bot.getMe();
            logger.info('Telegram bot info retrieved', {
                username: botInfo.username,
                id: botInfo.id
            });
            // Send test message
            const testResult = await this.send({
                title: '🧪 Test Notification',
                body: 'This is a test notification from Mugiwara Kaizoku to verify your Telegram bot is working correctly.',
                event: 'UPDATE_AVAILABLE' as NotificationEventType,
                metadata: {
                    test: true,
                    timestamp: new Date().toISOString(),
                    botUsername: botInfo.username,
                    source: 'Telegram Adapter Test'
                }
            });
            if (testResult["status"] === 'success') {
                return createSuccessResult({
                    success: true,
                    message: `Test notification sent successfully to chat ${this.config.chatId}`,
                });
            }
            else if (isError(testResult)) {
                return createErrorResult(testResult.error);
            }
            else {
                return createErrorResult(new Error('Unknown test result status'));
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Telegram test failed', errorMessage));
        }
    }
    /**
     * Validate the Telegram configuration
     *
     * @returns {AsyncResult<boolean, Error>} Validation result
     */
    validateConfig(): AsyncResult<boolean, Error> {
        if (!this.config.botToken) {
            return createErrorResult(new Error('Telegram bot token is required'));
        }
        // Validate bot token format (rough check)
        const tokenPattern = /^\d+:[\w-]+$/;
        if (!tokenPattern.test(this.config.botToken)) {
            return createErrorResult(new Error('Invalid Telegram bot token format. Expected format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'));
        }
        if (!this.config.chatId) {
            return createErrorResult(new Error('Telegram chat ID is required'));
        }
        // Validate chat ID format (can be negative for groups/channels)
        if (!/^-?\d+$/.test(this.config.chatId)) {
            return createErrorResult(new Error('Invalid Telegram chat ID format. Must be a number (can be negative for groups/channels)'));
        }
        return createSuccessResult(true);
    }
    /**
     * Format a message for Telegram with HTML markup
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} HTML-formatted message string
     */
    private formatTelegramMessage(payload: NotificationPayload): string {
        const emoji = getEventEmoji(payload.event);
        // Escape HTML special characters in user content
        const escapeHtml = (text: string): string => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        let message = `${emoji} <b>${escapeHtml(payload["title"])}</b>\n\n`;
        message += escapeHtml(payload.body);
        // Add metadata if present
        if (payload["metadata"] && Object.keys(payload["metadata"]).length > 0) {
            message += '\n\n<i>Details:</i>\n';
            for (const [key, value] of Object.entries(payload["metadata"])) {
                if (key === 'test' || key === 'timestamp')
                    continue; // Skip internal metadata
                const formattedKey = key
                    .split(/[_-]/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                const formattedValue = value === null
                    ? 'N/A'
                    : String(value);
                message += `• <b>${escapeHtml(formattedKey)}:</b> ${escapeHtml(formattedValue)}\n`;
            }
        }
        // Add footer
        message += '\n<i>Sent by Mugiwara Kaizoku</i>';
        // Telegram has a 4096 character limit
        if (message.length > 4090) {
            message = message.substring(0, 4087) + '...';
        }
        return message;
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
 * Factory function to create a TelegramAdapter instance
 *
 * @param {ExtendedTelegramSettings} config - Telegram configuration settings
 * @returns {TelegramAdapter} New TelegramAdapter instance
 */
export function createTelegramAdapter(config: ExtendedTelegramSettings): TelegramAdapter {
    return new TelegramAdapter(config);
}
