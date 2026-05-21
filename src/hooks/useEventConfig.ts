/**
 * Event Configuration Hook - Re-export
 *
 * This file re-exports the main useEventConfig hook from the modular implementation.
 * The hook has been decomposed into focused modules for better maintainability.
 *
 * @deprecated Import from '@/hooks/event-config' directly for better tree-shaking
 */

export {
  useEventConfig,
  type UseEventConfigResult,
  type EventConfig,
  type VisibilitySettings
} from './event-config';

// Re-export enums for backward compatibility
// Note: EventLevel and EventSource are exported as values (enums) only
export { EventLevel, EventSource } from './event-config/types';
