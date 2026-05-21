/**
 * System Events Hook
 * 
 * Custom hook for fetching and filtering system events from the server.
 * Provides real-time access to system events with filtering options.
 * 
 * @module hooks/useSystemEvents
 */

import { useState, useEffect, useRef } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { logger } from '@/utils/logger';

import { EventLevel } from '../server/services/events/eventTypes';
import { trpc } from '../utils/trpc-client/index';

import type { EventType, EventSource} from '../server/services/events/eventTypes';

/**
 * Interface representing an action that can be taken on a system event
 */
export interface EventAction {
  label: string; // Display label for the action
  action: string; // Action identifier
  url?: string; // URL to navigate to (if applicable)
  entityId?: number | string; // Entity ID to act upon (if applicable)
}

/**
 * Interface representing a system event
 */
export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  level: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  relatedID?: string;
  relatedEntityType?: string;
  actions?: EventAction[];
}

/**
 * Options for configuring the useSystemEvents hook
 */
interface UseSystemEventsOptions {
  types?: EventType[];
  sources?: EventSource[];
  levels?: EventLevel[];
  startDate?: Date;
  endDate?: Date;
  relatedID?: string;
  relatedEntityType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  pollingInterval?: number;
}

/**
 * Result type for the useSystemEvents hook
 */
interface UseSystemEventsResult {
  events: SystemEvent[];
  isLoading: boolean;
  total: number;
  refetch: () => Promise<void>;
  availableFilters: {
    types: EventType[];
    sources: EventSource[];
    levels: EventLevel[];
  };
}

/**
 * Type guard for raw event data from API
 * @internal Used for type validation during event transformation
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Type definition for event validation
interface RawEventData {
  id: string;
  type: string;
  source: string;
  level: string;
  message: string;
  timestamp: string | Date;
  details?: Record<string, unknown> | null;
  relatedID?: string | null;
  relatedEntityType?: string | null;
}

/**
 * Validate and transform raw event data
 * 
 * @param rawEvent - Raw event data from API
 * @returns Validated SystemEvent or null
 */
function transformRawEvent(rawEvent: unknown): SystemEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  // Validate required fields
  if (
  typeof event["id"] !== 'string' ||
  typeof event["type"] !== 'string' ||
  typeof event["source"] !== 'string' ||
  typeof event["level"] !== 'string' ||
  typeof event["message"] !== 'string')
  {
    logger.warn('[useSystemEvents] Invalid event structure:', event);
    return null;
  }

  // Convert timestamp
  let timestamp: Date;
  if (event["timestamp"] instanceof Date) {
    timestamp = event["timestamp"];
  } else if (typeof event["timestamp"] === 'string') {
    timestamp = new Date(event["timestamp"]);
  } else {
    timestamp = new Date();
  }

  // Build validated event
  const systemEvent: SystemEvent = {
    id: event["id"],
    type: event["type"],
    source: event["source"],
    level: event["level"],
    message: event["message"],
    timestamp
  };

  // Add optional fields
  if (event["details"] && typeof event["details"] === 'object') {
    systemEvent.details = event["details"] as Record<string, unknown>;
  }

  if (typeof event["relatedID"] === 'string') {
    systemEvent.relatedID = event["relatedID"];
  }

  if (typeof event["relatedEntityType"] === 'string') {
    systemEvent.relatedEntityType = event["relatedEntityType"];
  }

  return systemEvent;
}

/**
 * Hook for fetching and filtering system events
 * 
 * This hook provides real-time access to system events with optional filtering.
 * It automatically polls for new events at a configurable interval.
 * 
 * @param {UseSystemEventsOptions} [options={}] - Configuration options
 * @returns {UseSystemEventsResult} Event data and loading state
 * 
 * @example
 * ```tsx
 * const { events} = useSystemEvents({
 *   levels: [EventLevel.ERROR, EventLevel.CRITICAL],
 *   sources: [EventSource.DOWNLOAD],
 *   pollingInterval: 5000
 * });
 * ```
 */
export function useSystemEvents(options: UseSystemEventsOptions = {}): UseSystemEventsResult {
  const {
    types,
    sources,
    levels,
    startDate,
    endDate,
    relatedID,
    relatedEntityType,
    search,
    page = 1,
    pageSize = 50,
    pollingInterval = 30000
  } = options;

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Track if component is still mounted
  const [isActive, setIsActive] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      setIsActive(false);
    };
  }, []);

  // Prepare query parameters
  const queryParams = {
    types,
    sources,
    levels,
    startDate,
    endDate,
    relatedID,
    relatedEntityType,
    search,
    page,
    pageSize
  };

  // Use tRPC to fetch real events (only poll when WebSocket disconnected)
  const { data, error, refetch, isLoading } = trpc.events.list.useQuery(queryParams, {
    refetchInterval: isActive && pollingInterval > 0 && !isConnected ? pollingInterval : false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: isActive,
    staleTime: 5000 // Consider data stale after 5 seconds
  });

  // Subscribe to WebSocket system events for real-time updates
  useEffect(() => {
    if (!isConnected || !isActive) return;

    const unsubscribe = subscribe('system:events', () => {
      void refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, isActive, refetch]);

  // Log errors when they occur (only once per error)
  const errorRef = useRef<unknown>(null);
  useEffect(() => {
    if (error && isMountedRef.current && error !== errorRef.current) {
      logger.error('[useSystemEvents] Query error', { error });
      errorRef.current = error;
    }
  }, [error]);

  // Get available filters
  const typesQuery = trpc.events.getEventTypes.useQuery();
  const sourcesQuery = trpc.events.getEventSources.useQuery();
  const levelsQuery = trpc.events.getEventLevels.useQuery();

  // Transform and add event actions based on event types and related entities
  const eventsWithActions = (data?.events ?? []).map((rawEvent: unknown): SystemEvent | null => {
    // Transform raw event to SystemEvent
    const systemEvent = transformRawEvent(rawEvent);
    if (!systemEvent) {
      return null;
    }

    const actions: EventAction[] = [];

    // Add view entity action if there's a related entity
    if (systemEvent.relatedID && systemEvent.relatedEntityType) {
      switch (systemEvent.relatedEntityType) {
        case 'manga':
          actions.push({
            label: 'View Manga',
            action: 'navigate',
            url: `/manga/${systemEvent.relatedID}`
          });
          break;
        case 'library':
          actions.push({
            label: 'View Library',
            action: 'navigate',
            url: `/library/${systemEvent.relatedID}`
          });
          break;
        case 'task':
          actions.push({
            label: 'View Task',
            action: 'navigate',
            url: `/tasks/${systemEvent.relatedID}`
          });
          break;
        case 'backup':
          actions.push({
            label: 'View Backups',
            action: 'navigate',
            url: `/system/backup`
          });
          break;
        default:
          break;
      }
    }

    // Add error-specific actions
    if (systemEvent.level === EventLevel.ERROR || systemEvent.level === EventLevel.CRITICAL) {
      if (systemEvent.type.includes('download')) {
        actions.push({
          label: 'Retry Download',
          action: 'retryDownload',

          ...(systemEvent.relatedID && { entityId: systemEvent.relatedID })
        });
      } else if (systemEvent.type.includes('task')) {
        actions.push({
          label: 'Retry Task',
          action: 'retryTask',

          ...(systemEvent.relatedID && { entityId: systemEvent.relatedID })
        });
      } else if (systemEvent.type.includes('integration')) {
        actions.push({
          label: 'View Integration Settings',
          action: 'navigate',
          url: '/settings/integrations'
        });
      }
    }

    return {
      ...systemEvent,
      ...(actions.length > 0 && { actions })
    };
  }).filter((event): event is SystemEvent => event !== null);

  return {
    events: eventsWithActions,
    isLoading,
    total: data?.total ?? 0,
    refetch: async () => {
      await refetch();
    },
    availableFilters: {
      types: typesQuery.data ?? [],
      sources: sourcesQuery.data ?? [],
      levels: levelsQuery.data ?? []
    }
  };
}