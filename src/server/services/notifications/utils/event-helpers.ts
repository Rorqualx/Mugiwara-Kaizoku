/**
 * Notification Event Helper Functions
 * 
 * Provides utility functions for handling notification events.
 * Uses centralized constants from event-constants module.
 */

import {
  EVENT_EMOJIS,
  EVENT_TITLES,
  EVENT_COLORS,
  DEFAULT_EVENT_EMOJI,
  DEFAULT_EVENT_TITLE,
  DEFAULT_EVENT_COLOR,
  groupEventsByCategory as groupEvents,
} from '../event-constants';

import type { NotificationEventType } from '@prisma/client';

// Re-export centralized constants for backward compatibility
export const DEFAULT_EVENT_EMOJIS = EVENT_EMOJIS;
export const DEFAULT_EVENT_TITLES = EVENT_TITLES;
export const DEFAULT_EVENT_COLORS = EVENT_COLORS;

/**
 * Get emoji for a notification event
 */
export function getEventEmoji(event: NotificationEventType): string {
  return EVENT_EMOJIS[event] || DEFAULT_EVENT_EMOJI;
}

/**
 * Get title for a notification event
 */
export function getEventTitle(event: NotificationEventType): string {
  return EVENT_TITLES[event] || DEFAULT_EVENT_TITLE;
}

/**
 * Get color for a notification event
 */
export function getEventColor(event: NotificationEventType): number {
  return EVENT_COLORS[event] || DEFAULT_EVENT_COLOR;
}

/**
 * Get Discord color for a notification event (alias for getEventColor)
 */
export function getEventDiscordColor(event: NotificationEventType): number {
  return getEventColor(event);
}

/**
 * Group events by category
 * Delegates to centralized function
 */
export function groupEventsByCategory(): Record<string, NotificationEventType[]> {
  return groupEvents(getAllNotificationEvents());
}

/**
 * Get all available notification events
 */
export function getAllNotificationEvents(): NotificationEventType[] {
  return Object.keys(EVENT_EMOJIS) as NotificationEventType[];
}

/**
 * Check if a string is a valid notification event
 */
export function isValidNotificationEvent(event: string): event is NotificationEventType {
  return getAllNotificationEvents().includes(event as NotificationEventType);
}

/**
 * Get event category from event type
 */
export function getEventCategory(event: NotificationEventType): string {
  const categories = groupEvents(getAllNotificationEvents());
  for (const [category, events] of Object.entries(categories)) {
    if (events.includes(event)) {
      return category;
    }
  }
  return 'other';
}

/**
 * Format event data for display
 */
export function formatEventData(event: NotificationEventType, data: Record<string, unknown>): {
  title: string;
  body: string;
  emoji: string;
  color: number;
} {
  const title = getEventTitle(event);
  const emoji = getEventEmoji(event);
  const color = getEventColor(event);
  
  // Simple template replacement for body
  let body = title;
  if (typeof data["mangaTitle"] === 'string') {
    body = body.replace('{{mangaTitle}}', data["mangaTitle"]);
  }
  if (typeof data["chapterTitle"] === 'string') {
    body = body.replace('{{chapterTitle}}', data["chapterTitle"]);
  }
  if (typeof data["error"] === 'string') {
    body = body.replace('{{error}}', data["error"]);
  }
  
  return { title, body, emoji, color };
}
