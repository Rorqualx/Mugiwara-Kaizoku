/**
 * Main Notification Service
 *
 * This module provides the main notification service that coordinates
 * sending notifications through multiple adapters. It handles adapter
 * lifecycle, error aggregation, and provides a unified interface for
 * the application to send notifications.
 *
 * @module notifications
 */
import type { NotificationConfig, NotificationTestResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { NotificationFactory } from './factory/notificationFactory';

import type { NotificationPayload, NotificationAdapter } from './base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';
/**
 * Result of sending notifications through multiple adapters
 *
 * @interface NotificationSendResult
 */
interface NotificationSendResult {
    totalAdapters: number;
    successCount: number;
    failureCount: number;
    errors: Array<{
        adapter: string;
        error: Error;
    }>;
}
/**
 * Main notification service
 *
 * Manages notification adapters and provides methods to send notifications
 * through all enabled channels. Handles errors gracefully and provides
 * detailed results about notification delivery.
 *
 * @class NotificationService
 */
export class NotificationService {
    /**
     * Current notification configuration
     * @private
     */
    private config: NotificationConfig;
    /**
     * Active notification adapters
     * @private
     */
    private adapters: NotificationAdapter[];
    /**
     * Create a new notification service
     *
     * @param {NotificationConfig} config - Notification configuration
     */
    constructor(config: NotificationConfig) {
        this.config = config;
        this.adapters = []; // Will be initialized asynchronously
    }

    /**
     * Initialize the notification service adapters
     * Must be called after construction to load adapters with global config
     *
     * @returns {Promise<void>}
     */
    async initialize(): Promise<void> {
        this.adapters = await NotificationFactory.createAdapters(this.config);
        logger.info('NotificationService initialized', {
            adapterCount: this.adapters.length
        });
    }
    /**
     * Send a notification through all enabled adapters
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<NotificationSendResult, Error>>} Result of the send operation
     */
    async send(payload: NotificationPayload): Promise<AsyncResult<NotificationSendResult, Error>> {
        if (this.adapters.length === 0) {
            logger.warn('No notification adapters are enabled');
            return createSuccessResult({
                totalAdapters: 0,
                successCount: 0,
                failureCount: 0,
                errors: []
            });
        }
        logger.info('Sending notification', {
            event: payload.event,
            title: payload["title"],
            adapterCount: this.adapters.length
        });
        // Send notifications through all adapters in parallel
        const results = await Promise.allSettled(this.adapters.map(adapter => adapter.send(payload)));
        const sendResult: NotificationSendResult = {
            totalAdapters: this.adapters.length,
            successCount: 0,
            failureCount: 0,
            errors: []
        };
        // Process results
        results.forEach((result, index) => {
            const adapter = this.adapters[index];
            if (!adapter) return;
            const adapterName = this.getAdapterName(adapter);
            if (result["status"] === 'fulfilled') {
                const asyncResult = result.value;
                if (asyncResult["status"] === 'success') {
                    sendResult.successCount++;
                    logger.debug(`Notification sent successfully via ${adapterName}`);
                }
                else if (asyncResult["status"] === 'error') {
                    sendResult.failureCount++;
                    sendResult.errors.push({
                        adapter: adapterName,
                        error: asyncResult.error
                    });
                    logger.error(`Notification failed via ${adapterName}`, asyncResult.error instanceof Error ? asyncResult.error.message : String(asyncResult.error));
                }
            }
            else {
                // Promise rejected
                sendResult.failureCount++;
                const error = result.reason instanceof Error
                    ? result.reason
                    : new Error(String(result.reason));
                sendResult.errors.push({
                    adapter: adapterName,
                    error
                });
                logger.error(`Notification adapter ${adapterName} threw error`, (error instanceof Error ? error.message : String(error)));
            }
        });
        // Log summary
        logger.info('Notification send completed', {
            event: payload.event,
            totalAdapters: sendResult.totalAdapters,
            successCount: sendResult.successCount,
            failureCount: sendResult.failureCount
        });
        // Return error if all adapters failed
        if (sendResult.successCount === 0 && sendResult.failureCount > 0) {
            const errorMessages = sendResult.errors
                .map(e => `${e.adapter}: ${e.error instanceof Error ? e.error.message : String(e.error)}`)
                .join('; ');
            return createErrorResult(new Error(`All notification adapters failed: ${errorMessages}`));
        }
        return createSuccessResult(sendResult);
    }
    /**
     * Test a specific notification provider
     *
     * @param {string} provider - The provider type to test
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async testProvider(provider: string): Promise<AsyncResult<NotificationTestResult, Error>> {
        const configKey = provider as keyof NotificationConfig;
        const providerConfig = this.config[configKey];
        if (!providerConfig) {
            return createErrorResult(new Error(`Provider ${provider} is not configured`));
        }
        // Create a temporary adapter for testing
        const adapter = NotificationFactory.createAdapter(configKey, providerConfig);
        if (!adapter) {
            return createErrorResult(new Error(`Failed to create adapter for provider ${provider}`));
        }
        if (!adapter.isEnabled()) {
            return createErrorResult(new Error(`Provider ${provider} is not enabled or has invalid configuration`));
        }
        try {
            return await adapter.test();
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error
                ? error
                : new Error(`Test failed: ${String(error)}`));
        }
    }
    /**
     * Update the notification configuration
     *
     * @param {NotificationConfig} config - New notification configuration
     * @returns {Promise<void>}
     */
    async updateConfig(config: NotificationConfig): Promise<void> {
        logger.info('Updating notification service configuration');
        this.config = config;
        this.adapters = await NotificationFactory.createAdapters(config);
        logger.info('Notification service configuration updated', {
            adapterCount: this.adapters.length
        });
    }
    /**
     * Get the list of enabled adapter types
     *
     * @returns {string[]} Array of enabled adapter type names
     */
    getEnabledAdapters(): string[] {
        return this.adapters.map(adapter => this.getAdapterName(adapter));
    }
    /**
     * Check if a specific provider is enabled
     *
     * @param {string} provider - The provider type to check
     * @returns {boolean} True if the provider is enabled
     */
    isProviderEnabled(provider: string): boolean {
        const configKey = provider as keyof NotificationConfig;
        const providerConfig = this.config[configKey];
        if (!providerConfig || typeof providerConfig !== 'object') {
            return false;
        }
        return 'enabled' in providerConfig && providerConfig.enabled === true;
    }
    /**
     * Get available notification event types
     *
     * @static
     * @returns {NotificationEventType[]} Array of available event types
     */
    static getAvailableEvents(): NotificationEventType[] {
        return [
            'MANGA_ADDED' as NotificationEventType,
            'MANGA_UPDATED' as NotificationEventType,
            'CHAPTER_DOWNLOADED' as NotificationEventType,
            'DOWNLOAD_FAILED' as NotificationEventType,
            'TASK_FAILED' as NotificationEventType,
            'SYNC_COMPLETED' as NotificationEventType,
            'BACKUP_COMPLETED' as NotificationEventType,
            'UPDATE_AVAILABLE' as NotificationEventType
        ];
    }
    /**
     * Get the name of an adapter
     *
     * @private
     * @param {NotificationAdapter} adapter - The adapter instance
     * @returns {string} The adapter name
     */
    private getAdapterName(adapter: NotificationAdapter): string {
        // Get the constructor name and remove "Adapter" suffix
        const name = adapter.constructor["name"].replace(/Adapter$/, '');
        return name.charAt(0).toLowerCase() + name.slice(1);
    }
}
/**
 * Singleton instance of the notification service
 * @private
 */
let notificationService: NotificationService | null = null;
/**
 * Get or create the notification service instance
 *
 * @param {NotificationConfig} config - Notification configuration
 * @returns {Promise<NotificationService>} The notification service instance
 */
export async function getNotificationService(config: NotificationConfig): Promise<NotificationService> {
    if (!notificationService) {
        notificationService = new NotificationService(config);
        await notificationService.initialize();
    }
    else {
        await notificationService.updateConfig(config);
    }
    return notificationService;
}
/**
 * Send a notification using the singleton service
 *
 * @param {NotificationPayload} payload - The notification data
 * @param {NotificationConfig} config - Notification configuration
 * @returns {Promise<AsyncResult<NotificationSendResult, Error>>} Result of the send operation
 */
export async function sendNotification(payload: NotificationPayload, config: NotificationConfig): Promise<AsyncResult<NotificationSendResult, Error>> {
    const service = await getNotificationService(config);
    return service.send(payload);
}
// Export types for convenience
export type { NotificationPayload, NotificationAdapter } from './base/BaseNotificationAdapter';
export type { NotificationSendResult };
export { NotificationFactory } from './factory/notificationFactory';
export { BaseNotificationAdapter } from './base/BaseNotificationAdapter';
