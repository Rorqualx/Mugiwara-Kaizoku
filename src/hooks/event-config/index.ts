/**
 * Event Configuration Hook - Main Entry Point
 *
 * React hook for accessing and updating event configuration settings
 * from client components. Provides a type-safe interface with loading,
 * error, and saving states for optimal UX.
 *
 * @example
 * ```jsx
 * function EventSettingsComponent() {
 *   const {
 *     config,
 *     isLoading,
 *     saving,
 *     error,
 *     updateRetentionDays,
 *     updateMinLogLevel
 *   } = useEventConfig();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *
 *   return (
 *     <div>
 *       <h2>Event Settings</h2>
 *       <NumberInput
 *         value={config.retention.days}
 *         onChange={updateRetentionDays}
 *         label="Retention Period (days)"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect } from 'react';

import { useConfig } from '../useConfig';

import { useEventActions } from './useEventActions';
import { useEventState } from './useEventState';

export type { EventConfig, EventLevel, EventSource, VisibilitySettings } from './types';

/**
 * Return type for useEventConfig hook
 */
export interface UseEventConfigResult {
  config: import('./types').EventConfig;
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  updateRetentionDays: (days: number) => Promise<void>;
  updateMinLogLevel: (level: import('./types').EventLevel) => Promise<void>;
  updateMaxEvents: (maxEvents: number) => Promise<void>;
  updateNotificationSettings: (settings: Partial<import('./types').EventConfig['notification']>) => Promise<void>;
  updateVisibleSources: (sources: import('./types').EventSource[]) => Promise<void>;
  updateVisibleLevels: (levels: import('./types').EventLevel[]) => Promise<void>;
  updateVisibilitySettings: (settings: import('./types').VisibilitySettings) => Promise<void>;
  updateConfig: (config: Partial<import('./types').EventConfig>) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing event configuration
 *
 * @returns Event configuration management interface
 */
export function useEventConfig(): UseEventConfigResult {
  const { isLoading: configIsLoading } = useConfig();
  const state = useEventState();
  const actions = useEventActions(state);

  // Load configuration on mount
  useEffect(() => {
    if (!configIsLoading) {
      void state.loadEventConfig();
    }
  }, [state, configIsLoading]);

  return {
    config: state.eventConfig,
    isLoading: state.isLoading || configIsLoading,
    saving: state.saving,
    error: state.error,
    ...actions,
    refresh: state.loadEventConfig
  };
}
