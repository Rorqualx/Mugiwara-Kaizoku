/**
 * Legacy Notification Event Mappings
 * 
 * This module provides event mappings for legacy notification system compatibility.
 * It re-exports from the centralized event-constants module.
 */

import {
  EVENT_EMOJIS,
  EVENT_TITLES,
  EVENT_COLORS,
  LEGACY_EVENT_EMOJIS,
  LEGACY_EVENT_TITLES,
  LEGACY_EVENT_COLORS,
} from '../event-constants';

// Re-export the centralized constants
export { EVENT_EMOJIS, EVENT_TITLES, EVENT_COLORS };

// Re-export legacy aliases for backward compatibility
export { LEGACY_EVENT_EMOJIS, LEGACY_EVENT_TITLES, LEGACY_EVENT_COLORS };
