/**
 * Event Configuration Service
 *
 * This service provides access to event configuration settings.
 * It includes functionality for managing event retention, logging levels,
 * visibility settings, and notification preferences.
 *
 * The service abstracts access to the configuration system,
 * providing a type-safe interface for event-related settings.
 */
import { logger } from '@/utils/logger';

import { EventSource, EventLevel } from './eventTypes';

import type { ConfigService } from '../config/configService';
/**
 * Interface for event configuration settings
 */
export interface EventConfig {
    retention: {
        days: number;
    };
    log: {
        minLevel: EventLevel;
    };
    display: {
        maxEvents: number;
    };
    notification: {
        onError: boolean;
        onWarning: boolean;
    };
    visibility: {
        sources: EventSource[];
        levels: EventLevel[];
    };
}
/**
 * Event Configuration Service
 *
 * This service provides methods for accessing and updating event
 * configuration through the centralized configuration system.
 */
export class EventConfigService {
    /**
     * Default event configuration
     */
    private defaultConfig: EventConfig = {
        retention: {
            days: 30,
        },
        log: {
            minLevel: EventLevel.INFO,
        },
        display: {
            maxEvents: 100,
        },
        notification: {
            onError: true,
            onWarning: false,
        },
        visibility: {
            sources: Object.values(EventSource),
            levels: Object.values(EventLevel),
        },
    };
    /**
     * Creates a new EventConfigService
     *
     * @param configService - The central configuration service
     */
    constructor(private configService: ConfigService) { }
    /**
     * Load all event configuration
     *
     * @returns Complete event configuration
     */
    async loadConfig(): Promise<EventConfig> {
        try {
            // Retention settings
            const retentionDays = await this.configService.get<number>('event.retention.days', this.defaultConfig.retention.days);
            // Logging settings
            const minLogLevel = await this.configService.get<EventLevel>('event.log.minLevel', this.defaultConfig.log.minLevel);
            // Display settings
            const maxEventsDisplayed = await this.configService.get<number>('event.display.maxEvents', this.defaultConfig.display.maxEvents);
            // Notification settings
            const notifyOnError = await this.configService.get<boolean>('event.notification.onError', this.defaultConfig.notification.onError);
            const notifyOnWarning = await this.configService.get<boolean>('event.notification.onWarning', this.defaultConfig.notification.onWarning);
            // Visibility settings
            const visibleSources = await this.configService.get<EventSource[]>('event.visibility.sources', this.defaultConfig.visibility.sources);
            const visibleLevels = await this.configService.get<EventLevel[]>('event.visibility.levels', this.defaultConfig.visibility.levels);
            return {
                retention: {
                    days: retentionDays,
                },
                log: {
                    minLevel: minLogLevel,
                },
                display: {
                    maxEvents: maxEventsDisplayed,
                },
                notification: {
                    onError: notifyOnError,
                    onWarning: notifyOnWarning,
                },
                visibility: {
                    sources: visibleSources,
                    levels: visibleLevels,
                },
            };
        }
        catch (error: unknown) {
            logger.error(`Failed to load event configuration: ${error instanceof Error ? error.message : String(error)}`);
            return this.defaultConfig;
        }
    }
    /**
     * Update retention settings
     *
     * @param days - Number of days to retain events
     */
    async updateRetentionDays(days: number): Promise<void> {
        try {
            await this.configService.set('event.retention.days', days);
        }
        catch (error: unknown) {
            logger.error(`Failed to update event retention days: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update minimum log level
     *
     * @param level - Minimum severity level to log
     */
    async updateMinLogLevel(level: EventLevel): Promise<void> {
        try {
            await this.configService.set('event.log.minLevel', level);
        }
        catch (error: unknown) {
            logger.error(`Failed to update minimum log level: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update maximum displayed events
     *
     * @param maxEvents - Maximum number of events to display
     */
    async updateMaxEvents(maxEvents: number): Promise<void> {
        try {
            await this.configService.set('event.display.maxEvents', maxEvents);
        }
        catch (error: unknown) {
            logger.error(`Failed to update maximum displayed events: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update notification settings
     *
     * @param settings - Notification settings to update
     */
    async updateNotificationSettings(settings: Partial<EventConfig['notification']>): Promise<void> {
        try {
            if (settings.onError !== undefined) {
                await this.configService.set('event.notification.onError', settings.onError);
            }
            if (settings.onWarning !== undefined) {
                await this.configService.set('event.notification.onWarning', settings.onWarning);
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update event notification settings: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update visibility settings
     *
     * @param settings - Visibility settings to update
     */
    async updateVisibilitySettings(settings: Partial<EventConfig['visibility']>): Promise<void> {
        try {
            if (settings.sources !== undefined) {
                await this.configService.set('event.visibility.sources', settings.sources);
            }
            if (settings.levels !== undefined) {
                await this.configService.set('event.visibility.levels', settings.levels);
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update event visibility settings: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Update all event configuration
     *
     * @param config - Partial event configuration to update
     */
    async updateConfig(config: Partial<EventConfig>): Promise<void> {
        try {
            if (config.retention?.days !== undefined) {
                await this.updateRetentionDays(config.retention.days);
            }
            if (config.log?.minLevel !== undefined) {
                await this.updateMinLogLevel(config.log.minLevel);
            }
            if (config.display?.maxEvents !== undefined) {
                await this.updateMaxEvents(config.display.maxEvents);
            }
            if (config.notification) {
                await this.updateNotificationSettings(config.notification);
            }
            if (config.visibility) {
                await this.updateVisibilitySettings(config.visibility);
            }
        }
        catch (error: unknown) {
            logger.error(`Failed to update event configuration: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Get the current event retention period
     *
     * @returns Number of days to retain events
     */
    async getRetentionDays(): Promise<number> {
        try {
            return await this.configService.get<number>('event.retention.days', this.defaultConfig.retention.days);
        }
        catch (error: unknown) {
            logger.error(`Failed to get event retention days: ${error instanceof Error ? error.message : String(error)}`);
            return this.defaultConfig.retention.days;
        }
    }
    /**
     * Check if a specific event level should be logged
     *
     * @param level - Event severity level to check
     * @returns Whether the level should be logged
     */
    async shouldLogLevel(level: EventLevel): Promise<boolean> {
        try {
            const minLevel = await this.configService.get<EventLevel>('event.log.minLevel', this.defaultConfig.log.minLevel);
            // Level importance order (least to most important)
            const levelOrder: EventLevel[] = [
                EventLevel.DEBUG,
                EventLevel.INFO,
                EventLevel.WARNING,
                EventLevel.ERROR,
                EventLevel.CRITICAL
            ];
            // Get indices
            const minLevelIndex = levelOrder.indexOf(minLevel);
            const levelIndex = levelOrder.indexOf(level);
            // Only log if level is equal or more important than minimum level
            return levelIndex >= minLevelIndex;
        }
        catch (error: unknown) {
            logger.error(`Failed to check if level should be logged: ${error instanceof Error ? error.message : String(error)}`);
            return true; // Default to logging when in doubt
        }
    }
    /**
     * Check if notifications should be shown for a specific event level
     *
     * @param level - Event severity level to check
     * @returns Whether notifications should be shown
     */
    async shouldShowNotification(level: EventLevel): Promise<boolean> {
        try {
            if (level === EventLevel.ERROR || level === EventLevel.CRITICAL) {
                return await this.configService.get<boolean>('event.notification.onError', this.defaultConfig.notification.onError);
            }
            else if (level === EventLevel.WARNING) {
                return await this.configService.get<boolean>('event.notification.onWarning', this.defaultConfig.notification.onWarning);
            }
            // Don't notify for info or debug by default
            return false;
        }
        catch (error: unknown) {
            logger.error(`Failed to check if notifications should be shown: ${error instanceof Error ? error.message : String(error)}`);
            return true; // Default to showing notifications when in doubt
        }
    }
}
/**
 * Factory function to create an event configuration service
 *
 * @param configService - The central configuration service
 * @returns Event configuration service instance
 */
export function getEventConfigService(configService: ConfigService): EventConfigService {
    return new EventConfigService(configService);
}
