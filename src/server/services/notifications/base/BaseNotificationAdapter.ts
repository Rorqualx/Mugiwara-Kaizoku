/**
 * Base Notification Adapter
 * 
 * This module provides the base class and interfaces for notification adapters.
 * All notification providers (Email, Discord, Slack, etc.) extend this base class
 * to ensure consistent behavior and interface across different notification channels.
 * 
 * @module BaseNotificationAdapter
 */

import type { NotificationTestResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { NotificationEventType } from '@prisma/client';

/**
 * Notification payload interface
 * 
 * Represents the data structure for a notification message
 * that can be sent through any notification adapter.
 * 
 * @interface NotificationPayload
 * @property {string} title - The notification title/subject
 * @property {string} body - The main content of the notification
 * @property {string} [url] - Optional URL for additional details
 * @property {NotificationEventType} event - The type of event triggering the notification
 * @property {Record<string, unknown>} [metadata] - Optional additional data
 */
export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  event: NotificationEventType;
  metadata?: Record<string, unknown>;
}

/**
 * Notification adapter interface
 * 
 * Defines the contract that all notification adapters must implement.
 * This ensures consistent API across different notification providers.
 * 
 * @interface NotificationAdapter
 */
export interface NotificationAdapter {
  /**
   * Send a notification through the adapter
   * 
   * @param {NotificationPayload} payload - The notification data to send
   * @returns {Promise<AsyncResult<boolean, Error>>} Success/failure result
   */
  send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>>;
  
  /**
   * Test the notification adapter configuration
   * 
   * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
   */
  test(): Promise<AsyncResult<NotificationTestResult, Error>>;
  
  /**
   * Validate the adapter configuration
   * 
   * @returns {AsyncResult<boolean, Error>} Validation result
   */
  validateConfig(): AsyncResult<boolean, Error>;
  
  /**
   * Check if the adapter is enabled and properly configured
   * 
   * @returns {boolean} True if enabled and valid
   */
  isEnabled(): boolean;
}

/**
 * Abstract base class for notification adapters
 * 
 * Provides common functionality and enforces the implementation of required methods
 * for all notification adapters. Handles event filtering and error creation.
 * 
 * @abstract
 * @class BaseNotificationAdapter
 * @implements {NotificationAdapter}
 */
export abstract class BaseNotificationAdapter implements NotificationAdapter {
  /**
   * Whether this adapter is enabled
   * @protected
   */
  protected enabled: boolean = false;
  
  /**
   * List of events this adapter should handle
   * @protected
   */
  protected events: NotificationEventType[] = [];

  /**
   * Creates an instance of BaseNotificationAdapter
   * 
   * @constructor
   * @param {boolean} enabled - Whether the adapter is enabled
   * @param {NotificationEventType[]} events - Events to handle
   */
  constructor(enabled: boolean, events: NotificationEventType[]) {
    this.enabled = enabled;
    this.events = events;
  }

  /**
   * Send a notification (must be implemented by subclasses)
   * 
   * @abstract
   * @param {NotificationPayload} payload - The notification data
   * @returns {Promise<AsyncResult<boolean, Error>>} Send result
   */
  abstract send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>>;
  
  /**
   * Test the adapter (must be implemented by subclasses)
   * 
   * @abstract
   * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
   */
  abstract test(): Promise<AsyncResult<NotificationTestResult, Error>>;
  
  /**
   * Validate configuration (must be implemented by subclasses)
   * 
   * @abstract
   * @returns {AsyncResult<boolean, Error>} Validation result
   */
  abstract validateConfig(): AsyncResult<boolean, Error>;

  /**
   * Check if the adapter is enabled and properly configured
   * 
   * @returns {boolean} True if enabled and configuration is valid
   */
  isEnabled(): boolean {
    if (!this.enabled) {
      return false;
    }
    
    const validationResult = this.validateConfig();
    return validationResult["status"] === 'success' && validationResult.data === true;
  }

  /**
   * Check if this adapter should handle a specific event
   * 
   * @param {NotificationEventType} event - The event to check
   * @returns {boolean} True if the adapter should handle this event
   */
  shouldSendEvent(event: NotificationEventType): boolean {
    return this.events.includes(event);
  }

  /**
   * Create a standardized error with context
   * 
   * @protected
   * @param {string} message - The error message
   * @param {unknown} [originalError] - The original error if any
   * @returns {Error} A new Error object with context
   */
  protected createError(message: string, originalError?: unknown): Error {
    let errorMessage = message;
    
    if (originalError instanceof Error) {
      errorMessage = `${message}: ${originalError.message}`;
      logger.error(errorMessage, { 
        originalError: originalError.message,
        stack: originalError.stack 
      });
    } else if (originalError) {
      errorMessage = `${message}: ${String(originalError)}`;
      logger.error(errorMessage, { originalError: String(originalError) });
    } else {
      logger.error(errorMessage);
    }
    
    return new Error(errorMessage);
  }
}
