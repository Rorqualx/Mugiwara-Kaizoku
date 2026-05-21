/**
 * System Event Emitter
 *
 * This module provides a client-side interface for working with system events.
 * It serves as a compatibility layer during the transition from mock events
 * to real database-backed events.
 *
 * @module utils/eventEmitter
 */
import type { SystemEvent } from '@/hooks/useSystemEvents';

import { logger } from '../utils/logger';
/**
 * Defines the possible types of system events
 *
 * @typedef {('info'|'warning'|'error'|'success')} EventType
 */
export type EventType = 'info' | 'warning' | 'error' | 'success';
/**
 * Defines the system components that can emit events
 *
 * @typedef {string} EventComponent
 */
export type EventComponent = 'System' | 'Database' | 'Library' | 'Manga' | 'Download' | 'Integration' | 'Tasks' | 'Metadata' | 'Calendar';
/**
 * Maps legacy EventType to new event level format
 *
 * @param {EventType} type - Legacy event type
 * @returns {string} Corresponding event level
 */
function mapTypeToLevel(type: EventType): string {
    switch (type) {
        case 'info': return 'info';
        case 'warning': return 'warning';
        case 'error': return 'error';
        case 'success': return 'info';
        default: return 'info';
    }
}
/**
 * Maps legacy component to new source format
 *
 * @param {EventComponent} component - Legacy component
 * @returns {string} Corresponding event source
 */
function mapComponentToSource(component: EventComponent): string {
    return component.toLowerCase();
}
/**
 * Retrieves events from the server
 *
 * @returns {SystemEvent[]} Array of system events
 */
export function getEvents(): SystemEvent[] {
    // During the transition, we'll return an empty array
    // The real events are now fetched directly through the hooks
    return [];
}
/**
 * Extended SystemEvent interface with additional properties for event emission
 */
interface EventOptions extends Partial<SystemEvent> {
    entityId?: string | number;
    entityType?: string;
    entityName?: string;
    errorDetails?: string;
}
/**
 * Emits a new system event
 *
 * This is a client-side function that works with the trpc mutation to create events.
 * It provides backward compatibility for components still using the old emitEvent function.
 *
 * @param {EventType} type - Type of event (info, warning, error, success)
 * @param {string} message - Brief event message
 * @param {EventComponent} component - System component that generated the event
 * @param {EventOptions} [options={}] - Additional event properties
 * @returns {SystemEvent} The created event object
 */
export function emitEvent(type: EventType, message: string, component: EventComponent, options: EventOptions = {}): SystemEvent {
    // Create a placeholder event for immediate UI feedback
    const tempEvent: SystemEvent = {
        id: Date.now().toString(),
        type: type,
        source: mapComponentToSource(component),
        level: mapTypeToLevel(type),
        message,
        timestamp: new Date(),
        details: options.details as Record<string, unknown>
    };
    if (options.entityId !== undefined) {
        tempEvent.relatedID = options.entityId.toString();
    }
    if (options.entityType !== undefined) {
        tempEvent.relatedEntityType = options.entityType;
    }
    if (options.actions !== undefined) {
        tempEvent.actions = options.actions;
    }
    // Log to console for debugging
    logger.info(`[${tempEvent.level.toUpperCase()}] ${tempEvent["source"]}: ${message}`);
    // The actual event creation happens on the server through the trpc router
    // In a production implementation, we would trigger the event creation through trpc
    // but for now we'll just return the temp event
    return tempEvent;
}
/**
 * Legacy initialization code for backward compatibility during transition
 */
 
if (typeof window !== 'undefined') {
    // This code is no longer needed as we're using real events
    // Left here temporarily during the transition period
}
