import { EventLevel, EventSource, EventType } from '../server/services/events/eventTypes';
import { logger } from '../utils/logger';

import { toStringId } from "./id-converters";

/**
 * Type Guards for System Events
 *
 * Provides comprehensive type validation for system events to ensure
 * type safety throughout the events system.
 *
 * @module utils/eventTypeGuards
 */
import type { SystemEvent, EventAction } from '../hooks/useSystemEvents';
/**
 * Check if a value is a valid EventLevel
 *
 * @param level - The value to check
 * @returns Type predicate indicating if the value is a valid EventLevel
 */
export function isValidEventLevel(level: unknown): level is EventLevel {
  return typeof level === 'string' && Object.values(EventLevel).includes(level as EventLevel);
}
/**
 * Check if a value is a valid EventSource
 *
 * @param source - The value to check
 * @returns Type predicate indicating if the value is a valid EventSource
 */
export function isValidEventSource(source: unknown): source is EventSource {
  return typeof source === 'string' && Object.values(EventSource).includes(source as EventSource);
}
/**
 * Check if a value is a valid EventType
 *
 * @param type - The value to check
 * @returns Type predicate indicating if the value is a valid EventType
 */
export function isValidEventType(type: unknown): type is EventType {
  return typeof type === 'string' && Object.values(EventType).includes(type as EventType);
}
/**
 * Check if a value is a valid EventAction
 *
 * @param action - The value to check
 * @returns Type predicate indicating if the value is a valid EventAction
 */
export function isValidEventAction(action: unknown): action is EventAction {
  if (!action || typeof action !== 'object') {
    return false;
  }
  const obj = action as Record<string, unknown>;
  return typeof obj["label"] === 'string' && typeof obj["action"] === 'string' && (obj["url"] === null || typeof obj["url"] === 'string') && (obj["entityId"] === null || typeof obj["entityId"] === 'string' || typeof obj["entityId"] === 'number');
}
/**
 * Validate required fields of a SystemEvent
 */
function hasValidRequiredFields(obj: Record<string, unknown>): boolean {
  return (
    typeof obj["id"] === 'string' &&
    typeof obj["type"] === 'string' &&
    typeof obj["source"] === 'string' &&
    typeof obj["level"] === 'string' &&
    typeof obj["message"] === 'string' &&
    (obj["timestamp"] instanceof Date || typeof obj["timestamp"] === 'string')
  );
}

/**
 * Validate optional details field
 */
function hasValidDetails(obj: Record<string, unknown>): boolean {
  return obj["details"] === undefined || obj["details"] === null || typeof obj["details"] === 'object';
}

/**
 * Validate optional relatedID field
 */
function hasValidRelatedID(obj: Record<string, unknown>): boolean {
  return obj["relatedID"] === undefined || obj["relatedID"] === null || typeof obj["relatedID"] === 'string';
}

/**
 * Validate optional relatedEntityType field
 */
function hasValidRelatedEntityType(obj: Record<string, unknown>): boolean {
  return obj["relatedEntityType"] === undefined || obj["relatedEntityType"] === null || typeof obj["relatedEntityType"] === 'string';
}

/**
 * Validate optional actions field
 */
function hasValidActions(obj: Record<string, unknown>): boolean {
  if (obj["actions"] === undefined) {
    return true;
  }

  if (!Array.isArray(obj["actions"])) {
    return false;
  }

  return obj["actions"].every(isValidEventAction);
}

/**
 * Check if a value is a valid SystemEvent
 *
 * @param event - The value to check
 * @returns Type predicate indicating if the value is a valid SystemEvent
 */
export function isValidSystemEvent(event: unknown): event is SystemEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const obj = event as Record<string, unknown>;

  return (
    hasValidRequiredFields(obj) &&
    hasValidDetails(obj) &&
    hasValidRelatedID(obj) &&
    hasValidRelatedEntityType(obj) &&
    hasValidActions(obj)
  );
}
/**
 * Normalize an event level to ensure it's valid
 *
 * @param level - The level to normalize
 * @param defaultLevel - The default level to use if invalid
 * @returns A valid EventLevel
 */
export function normalizeEventLevel(level: unknown, defaultLevel: EventLevel = EventLevel.INFO): EventLevel {
  if (isValidEventLevel(level)) {
    return level;
  }
  // Try to convert common variations
  if (typeof level === 'string') {
    const upperLevel = level.toUpperCase();
    if (isValidEventLevel(upperLevel)) {
      return upperLevel as EventLevel;
    }
  }
  return defaultLevel;
}
/**
 * Validate and transform raw event data into a SystemEvent
 *
 * @param rawEvent - The raw event data to validate
 * @returns A validated SystemEvent or null if invalid
 */
export function validateSystemEvent(rawEvent: unknown): SystemEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }
  const obj = rawEvent as Record<string, unknown>;
  try {
    // Build validated event
    const event: SystemEvent = {
      id: typeof obj["id"] === 'string' ? obj["id"] : toStringId(obj["id"] ?? ''),
      type: typeof obj["type"] === 'string' ? obj["type"] : '',
      source: typeof obj["source"] === 'string' ? obj["source"] : '',
      level: normalizeEventLevel(obj["level"]),
      message: typeof obj["message"] === 'string' ? obj["message"] : String(obj["message"] ?? ''),
      timestamp: obj["timestamp"] instanceof Date ? obj["timestamp"] : new Date(String(obj["timestamp"] ?? new Date()))
    };
    // Add optional fields if valid
    if (obj["details"] && typeof obj["details"] === 'object') {
      event.details = obj["details"] as Record<string, unknown>;
    }
    if (typeof obj["relatedID"] === 'string') {
      event.relatedID = obj["relatedID"];
    }
    if (typeof obj["relatedEntityType"] === 'string') {
      event.relatedEntityType = obj["relatedEntityType"];
    }
    if (Array.isArray(obj["actions"])) {
      const validActions = obj["actions"].filter(isValidEventAction);
      if (validActions.length > 0) {
        event.actions = validActions;
      }
    }
    return event;
  }
  catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[EventTypeGuards] Failed to validate event:', errorMessage);
    return null;
  }
}
/**
 * Type guard to check if event details contain a specific property
 *
 * @param event - The event to check
 * @param property - The property name to check for
 * @returns Type predicate indicating if the property exists
 */
export function hasEventDetailProperty<K extends string>(event: SystemEvent, property: K): event is SystemEvent & {
  details: Record<K, unknown>;
} {
  return typeof event.details === 'object' && property in event.details;
}
/**
 * Safe getter for event detail properties
 *
 * @param event - The event to get the property from
 * @param property - The property name
 * @param defaultValue - Default value if property doesn't exist
 * @returns The property value or default
 */
export function getEventDetail<T>(event: SystemEvent, property: string, defaultValue: T): T {
  if (hasEventDetailProperty(event, property)) {
    const value = event.details[property];
    // Type-safe return based on expected type
    if (typeof defaultValue === 'string' && typeof value === 'string') {
      return value as T;
    } else
    if (typeof defaultValue === 'number' && typeof value === 'number') {
      return value as T;
    } else
    if (typeof defaultValue === 'boolean' && typeof value === 'boolean') {
      return value as T;
    } else
    if (defaultValue === null && value === null) {
      return value as T;
    } else
    if (Array.isArray(defaultValue) && Array.isArray(value)) {
      return value as T;
    } else
    if (typeof defaultValue === 'object' && typeof value === 'object' && value !== null) {
      return value as T;
    }
  }
  return defaultValue;
}