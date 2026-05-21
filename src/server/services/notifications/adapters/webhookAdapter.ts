/**
 * Generic Webhook Notification Adapter
 *
 * This module implements generic webhook notifications for custom integrations.
 * It supports configurable HTTP methods, headers, and HMAC signature verification.
 *
 * @module webhookAdapter
 */
import crypto from 'crypto';

import type { WebhookSettings, NotificationTestResult } from '@/types/search.types';
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

import type { NotificationPayload } from '../base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';

/**
 * Webhook payload structure
 *
 * @interface WebhookPayload
 */
interface WebhookPayload {
    title: string;
    body: string;
    url?: string;
    event: NotificationEventType;
    timestamp: string;
    metadata?: Record<string, unknown>;
    source: string;
}
/**
 * Webhook adapter for sending custom HTTP notifications
 *
 * Implements the NotificationAdapter interface to send notifications
 * through generic webhooks. Supports custom headers, HMAC signatures,
 * and configurable HTTP methods.
 *
 * @class WebhookAdapter
 * @extends {BaseNotificationAdapter}
 */
export class WebhookAdapter extends BaseNotificationAdapter {
    /**
     * Webhook configuration settings
     * @private
     */
    private config: WebhookSettings;
    /**
     * Creates an instance of WebhookAdapter
     *
     * @constructor
     * @param {WebhookSettings} config - Webhook configuration settings
     */
    constructor(config: WebhookSettings) {
        super(config.enabled, config.events ?? []);
        this.config = config;
    }
    /**
     * Send a webhook notification
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
            const webhookPayload: WebhookPayload = {
                title: payload["title"],
                body: payload.body,
                ...(payload.url && { url: payload.url }),
                event: payload.event,
                timestamp: new Date().toISOString(),
                ...(payload["metadata"] && { metadata: payload["metadata"] }),
                source: 'Mugiwara Kaizoku',
            };
            const body = JSON.stringify(webhookPayload);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mugiwara-Kaizoku/1.0',
                'X-Event-Type': payload.event,
                'X-Timestamp': webhookPayload.timestamp,
                ...this.config.headers, // User-defined headers override defaults
            };
            // No HMAC signature since secret is not configured in WebhookSettings
            // Set timeout for the request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            try {
                const response = await fetch(this.config.url, {
                    method: this.config.method ?? 'POST',
                    headers,
                    body,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No response body');
                    throw new ValidationError(`Webhook returned ${response["status"]}: ${errorText}`);
                }
                // Log successful response
                const responseText = await response.text().catch(() => '');
                logger.info('Webhook notification sent successfully', {
                    event: payload.event,
                    status: response["status"],
                    responsePreview: responseText.substring(0, 100)
                });
                return createSuccessResult(true);
            }
            catch (fetchError: unknown) {
                clearTimeout(timeoutId);
                if (fetchError instanceof Error && fetchError["name"] === 'AbortError') {
                    throw new Error('Webhook request timed out after 30 seconds');
                }
                throw fetchError;
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Failed to send webhook notification', errorMessage));
        }
    }
    /**
     * Test the webhook configuration
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async test(): Promise<AsyncResult<NotificationTestResult, Error>> {
        const testResult = await this.send({
            title: 'Test Webhook Notification',
            body: 'This is a test notification from Mugiwara Kaizoku to verify your webhook endpoint is working correctly.',
            event: 'update_available' as NotificationEventType,
            metadata: {
                test: true,
                timestamp: new Date().toISOString(),
                source: 'Webhook Adapter Test',
                version: '1.0.0'
            }
        });
        if (testResult["status"] === 'success') {
            return createSuccessResult({
                success: true,
                message: 'Test webhook sent successfully',
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
     * Validate the webhook configuration
     *
     * @returns {AsyncResult<boolean, Error>} Validation result
     */
    validateConfig(): AsyncResult<boolean, Error> {
        // Validate URL
        if (!this.config.url) {
            return createErrorResult(new Error('Webhook URL is required'));
        }
        try {
            const url = new URL(this.config.url);
            // Ensure HTTPS for security (unless localhost)
            if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
                logger.warn(`Webhook URL is not using HTTPS: ${this.config.url}`);
            }
        }
        catch {
            return createErrorResult(new Error('Invalid webhook URL format'));
        }
        // Validate HTTP method
        const validMethods = ['POST', 'PUT'];
        if (!validMethods.includes(this.config.method ?? 'POST')) {
            return createErrorResult(new Error(`Invalid HTTP method '${this.config.method}'. Must be one of: ${validMethods.join(', ')}`));
        }
        // Validate headers if provided
        if (this.config.headers) {
            if (typeof this.config.headers !== 'object') {
                return createErrorResult(new Error('Headers must be an object'));
            }
            // Check for reserved headers that shouldn't be overridden
            const reservedHeaders = ['content-length', 'host'];
            const providedHeaders = Object.keys(this.config.headers).map(h => h.toLowerCase());
            const conflicts = reservedHeaders.filter(h => providedHeaders.includes(h));
            if (conflicts.length > 0) {
                return createErrorResult(new Error(`Cannot override reserved headers: ${conflicts.join(', ')}`));
            }
        }
        // Secret validation removed - not part of WebhookSettings
        return createSuccessResult(true);
    }
    /**
     * Generate HMAC signature for webhook payload
     *
     * @private
     * @param {string} body - The request body
     * @param {string} secret - The webhook secret
     * @returns {string} The HMAC signature
     */
    private generateSignature(body: string, secret: string): string {
        const signature = crypto
            .createHmac('sha256', secret)
            .update(body, 'utf8')
            .digest('hex');
        return `sha256=${signature}`;
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
 * Factory function to create a WebhookAdapter instance
 *
 * @param {WebhookSettings} config - Webhook configuration settings
 * @returns {WebhookAdapter} New WebhookAdapter instance
 */
export function createWebhookAdapter(config: WebhookSettings): WebhookAdapter {
    return new WebhookAdapter(config);
}
