/**
 * Events Service - Main Export
 * 
 * Provides unified export of the events service components.
 * Centralizes the event system exports for easier importing.
 * 
 * @module server/services/events
 */

// Export the event service
export { eventService } from './eventService';

// Export the event types and enums
export { 
  EventType, 
  EventSource, 
  EventLevel, 
  EventTypeToLevel, 
  EventLevelToDisplay,
  EventTypeToDisplay
} from './eventTypes';

// Export the event logger
export { eventLogger } from './eventLogger';

// Export the schemas
export {
  createEventSchema,
  eventFilterSchema,
  eventCleanupSchema,
  type CreateEventInput,
  type EventFilterInput,
  type EventCleanupInput
} from './eventSchemas';
