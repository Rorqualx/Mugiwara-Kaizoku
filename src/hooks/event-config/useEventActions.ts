/**
 * Event Actions Hook
 *
 * Provides action functions for updating event configuration
 */

import { useConfig } from '../useConfig';

import { showErrorNotification, showSuccessNotification } from './notification-helpers';
import { validateMaxEvents, validateRetentionDays } from './useEventValidation';

import type { EventConfig, EventLevel, EventSource, VisibilitySettings } from './types';
import type { UseEventStateResult } from './useEventState';

export interface UseEventActionsResult {
  updateRetentionDays: (days: number) => Promise<void>;
  updateMinLogLevel: (level: EventLevel) => Promise<void>;
  updateMaxEvents: (maxEvents: number) => Promise<void>;
  updateNotificationSettings: (settings: Partial<EventConfig['notification']>) => Promise<void>;
  updateVisibleSources: (sources: EventSource[]) => Promise<void>;
  updateVisibleLevels: (levels: EventLevel[]) => Promise<void>;
  updateVisibilitySettings: (settings: VisibilitySettings) => Promise<void>;
  updateConfig: (config: Partial<EventConfig>) => Promise<void>;
}

/**
 * Hook for event configuration actions
 */
export function useEventActions(state: UseEventStateResult): UseEventActionsResult {
  const { set } = useConfig();
  const { setEventConfig, setSaving, setError, loadEventConfig } = state;

  /**
   * Update retention days
   */
  const updateRetentionDays = async (days: number): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      validateRetentionDays(days);

      setEventConfig((prev) => ({
        ...prev,
        retention: { ...prev.retention, days }
      }));

      await set('event.retention.days', days);
      showSuccessNotification('Event retention period updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update retention period: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update retention period', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update minimum log level
   */
  const updateMinLogLevel = async (level: EventLevel): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => ({
        ...prev,
        log: { ...prev.log, minLevel: level }
      }));

      await set('event.log.minLevel', level);
      showSuccessNotification('Minimum log level updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update minimum log level: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update minimum log level', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update maximum displayed events
   */
  const updateMaxEvents = async (maxEvents: number): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      validateMaxEvents(maxEvents);

      setEventConfig((prev) => ({
        ...prev,
        display: { ...prev.display, maxEvents }
      }));

      await set('event.display.maxEvents', maxEvents);
      showSuccessNotification('Maximum displayed events updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update maximum displayed events: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update maximum displayed events', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update notification settings
   */
  const updateNotificationSettings = async (settings: Partial<EventConfig['notification']>): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => ({
        ...prev,
        notification: { ...prev.notification, ...settings }
      }));

      const updatePromises: Promise<void>[] = [];
      if (settings.onError !== undefined) {
        updatePromises.push(set('event.notification.onError', settings.onError));
      }
      if (settings.onWarning !== undefined) {
        updatePromises.push(set('event.notification.onWarning', settings.onWarning));
      }

      await Promise.all(updatePromises);
      showSuccessNotification('Notification settings updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update notification settings: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update notification settings', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update visible event sources
   */
  const updateVisibleSources = async (sources: EventSource[]): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => ({
        ...prev,
        visibility: { ...prev.visibility, sources }
      }));

      await set('event.visibility.sources', sources);
      showSuccessNotification('Visible event sources updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update visible event sources: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update visible event sources', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update visible event levels
   */
  const updateVisibleLevels = async (levels: EventLevel[]): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => ({
        ...prev,
        visibility: { ...prev.visibility, levels }
      }));

      await set('event.visibility.levels', levels);
      showSuccessNotification('Visible event levels updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update visible event levels: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update visible event levels', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update visibility settings
   */
  const updateVisibilitySettings = async (settings: VisibilitySettings): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => ({
        ...prev,
        visibility: {
          ...prev.visibility,
          ...(settings.sources !== undefined ? { sources: settings.sources } : {}),
          ...(settings.levels !== undefined ? { levels: settings.levels } : {})
        }
      }));

      const updatePromises: Promise<void>[] = [];
      if (settings.sources !== undefined) {
        updatePromises.push(set('event.visibility.sources', settings.sources));
      }
      if (settings.levels !== undefined) {
        updatePromises.push(set('event.visibility.levels', settings.levels));
      }

      await Promise.all(updatePromises);
      showSuccessNotification('Visibility settings updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update visibility settings: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update visibility settings', err);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Update all event configuration
   */
  const updateConfig = async (config: Partial<EventConfig>): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      setEventConfig((prev) => buildOptimisticUpdate(prev, config));

      const updatePromises: Promise<void>[] = [];
      addConfigUpdates(config.retention, 'event.retention', updatePromises, set);
      addConfigUpdates(config.log, 'event.log', updatePromises, set);
      addConfigUpdates(config.display, 'event.display', updatePromises, set);
      addConfigUpdates(config.notification, 'event.notification', updatePromises, set);
      addConfigUpdates(config.visibility, 'event.visibility', updatePromises, set);

      await Promise.all(updatePromises);
      showSuccessNotification('Event settings updated successfully');
    } catch (err: unknown) {
      void loadEventConfig();
      setError(`Failed to update event settings: ${err instanceof Error ? err.message : String(err)}`);
      showErrorNotification('Failed to update event settings', err);
    } finally {
      setSaving(false);
    }
  };

  return {
    updateRetentionDays,
    updateMinLogLevel,
    updateMaxEvents,
    updateNotificationSettings,
    updateVisibleSources,
    updateVisibleLevels,
    updateVisibilitySettings,
    updateConfig
  };
}

/**
 * Helper to build update promises for config section
 */
function addConfigUpdates<T extends Record<string, unknown>>(
  section: T | undefined,
  prefix: string,
  promises: Promise<void>[],
  setFn: (key: string, value: unknown) => Promise<void>
): void {
  if (!section) return;

  Object.entries(section).forEach(([key, value]) => {
    if (value !== undefined) {
      promises.push(setFn(`${prefix}.${key}`, value));
    }
  });
}

/**
 * Build optimistic event config update
 */
function buildOptimisticUpdate(
  prev: EventConfig,
  config: Partial<EventConfig>
): EventConfig {
  return {
    ...prev,
    ...(config.retention ? { retention: { ...prev.retention, ...config.retention } } : {}),
    ...(config.log ? { log: { ...prev.log, ...config.log } } : {}),
    ...(config.display ? { display: { ...prev.display, ...config.display } } : {}),
    ...(config.notification ? { notification: { ...prev.notification, ...config.notification } } : {}),
    ...(config.visibility ? { visibility: { ...prev.visibility, ...config.visibility } } : {})
  };
}
