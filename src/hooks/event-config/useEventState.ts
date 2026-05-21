/**
 * Event State Hook
 *
 * Manages local state for event configuration
 */

import { useCallback, useState } from 'react';

import { useConfig } from '../useConfig';

import { defaultEventConfig } from './types';

import type { EventConfig, EventLevel, EventSource } from './types';

export interface UseEventStateResult {
  eventConfig: EventConfig;
  setEventConfig: React.Dispatch<React.SetStateAction<EventConfig>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  loadEventConfig: () => Promise<void>;
}

/**
 * Hook for managing event configuration state
 */
export function useEventState(): UseEventStateResult {
  const { get } = useConfig();

  const [eventConfig, setEventConfig] = useState<EventConfig>(defaultEventConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load event configuration from the server
   */
  const loadEventConfig = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Retention settings
      const retentionDays = (await get<number>('event.retention.days')) ?? defaultEventConfig.retention.days;

      // Logging settings
      const minLogLevel = (await get<EventLevel>('event.log.minLevel')) ?? defaultEventConfig.log.minLevel;

      // Display settings
      const maxEventsDisplayed = (await get<number>('event.display.maxEvents')) ?? defaultEventConfig.display.maxEvents;

      // Notification settings
      const notifyOnError = (await get<boolean>('event.notification.onError')) ?? defaultEventConfig.notification.onError;
      const notifyOnWarning = (await get<boolean>('event.notification.onWarning')) ?? defaultEventConfig.notification.onWarning;

      // Visibility settings
      const visibleSources = (await get<EventSource[]>('event.visibility.sources')) ?? defaultEventConfig.visibility.sources;
      const visibleLevels = (await get<EventLevel[]>('event.visibility.levels')) ?? defaultEventConfig.visibility.levels;

      // Update local state
      setEventConfig({
        retention: { days: retentionDays },
        log: { minLevel: minLogLevel },
        display: { maxEvents: maxEventsDisplayed },
        notification: {
          onError: notifyOnError,
          onWarning: notifyOnWarning
        },
        visibility: {
          sources: visibleSources,
          levels: visibleLevels
        }
      });
    } catch (err: unknown) {
      setError(`Failed to load event configuration: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  return {
    eventConfig,
    setEventConfig,
    isLoading,
    setIsLoading,
    saving,
    setSaving,
    error,
    setError,
    loadEventConfig
  };
}
