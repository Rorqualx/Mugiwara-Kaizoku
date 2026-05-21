/**
 * Notification Services Type Guards
 *
 * This module contains type guard utilities for notification service configurations
 * to reduce complexity in the main config-types module.
 *
 * @module NotificationServicesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import {
  isOptionalString,
  isOptionalBoolean,
  isOptionalNumber,
  isOptionalDate,
  isOptionalStringArray
} from './base-settings';

/**
 * Validates that a value is a valid Discord configuration
 */
export function isValidDiscordConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["webhookUrl"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["avatarUrl"]) &&
    isOptionalString(candidate["channel"]) &&
    isOptionalString(candidate["iconEmoji"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalBoolean(candidate["notifyOnDownload"]) &&
    isOptionalBoolean(candidate["notifyOnError"]) &&
    isOptionalBoolean(candidate["notifyOnSync"]) &&
    isOptionalBoolean(candidate["notifyOnMetadata"]) &&
    isOptionalStringArray(candidate["excludedEvents"]) &&
    isOptionalDate(candidate["lastNotification"])
  );
}

/**
 * Validates that a value is a valid Email configuration
 */
export function isValidEmailConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["smtpHost"]) &&
    isOptionalNumber(candidate["smtpPort"]) &&
    isOptionalString(candidate["smtpUsername"]) &&
    isOptionalString(candidate["smtpPassword"]) &&
    isOptionalBoolean(candidate["smtpSsl"]) &&
    isOptionalString(candidate["fromAddress"]) &&
    isOptionalString(candidate["toAddress"]) &&
    isOptionalString(candidate["subjectPrefix"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalBoolean(candidate["notifyOnDownload"]) &&
    isOptionalBoolean(candidate["notifyOnError"]) &&
    isOptionalBoolean(candidate["notifyOnSync"]) &&
    isOptionalBoolean(candidate["notifyOnMetadata"]) &&
    isOptionalStringArray(candidate["excludedEvents"]) &&
    isOptionalDate(candidate["lastNotification"])
  );
}

/**
 * Validates that a value is a valid Slack configuration
 */
export function isValidSlackConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["webhookUrl"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["iconEmoji"]) &&
    isOptionalString(candidate["channel"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalBoolean(candidate["notifyOnDownload"]) &&
    isOptionalBoolean(candidate["notifyOnError"]) &&
    isOptionalBoolean(candidate["notifyOnSync"]) &&
    isOptionalBoolean(candidate["notifyOnMetadata"]) &&
    isOptionalStringArray(candidate["excludedEvents"]) &&
    isOptionalDate(candidate["lastNotification"])
  );
}

/**
 * Validates that a value is a valid Telegram configuration
 */
export function isValidTelegramConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["botToken"]) &&
    isOptionalString(candidate["chatId"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalBoolean(candidate["notifyOnDownload"]) &&
    isOptionalBoolean(candidate["notifyOnError"]) &&
    isOptionalBoolean(candidate["notifyOnSync"]) &&
    isOptionalBoolean(candidate["notifyOnMetadata"]) &&
    isOptionalStringArray(candidate["excludedEvents"]) &&
    isOptionalDate(candidate["lastNotification"])
  );
}

/**
 * Validates that a value is a valid notification settings field
 */
export function isValidNotificationField(candidate: Record<string, unknown>, field: string): boolean {
  return !(field in candidate) || field in candidate;
}

/**
 * Validates that a value is a valid notification settings
 */
export function isValidNotificationSettings(candidate: Record<string, unknown>): boolean {
  return (
    isValidNotificationField(candidate, "discord") &&
    isValidNotificationField(candidate, "email") &&
    isValidNotificationField(candidate, "slack") &&
    isValidNotificationField(candidate, "telegram") &&
    isValidNotificationField(candidate, "apprise") &&
    isValidNotificationField(candidate, "webhook")
  );
}
