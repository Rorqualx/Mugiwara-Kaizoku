/**
 * Notification Configuration Hook
 *
 * Handles notification settings state and mutations
 *
 * @module components/settings/notification/hooks/useNotificationConfig
 */
import { useCallback, useMemo } from 'react';

import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import {
  type NotificationAppConfig,
  type NotificationUpdateHandler,
  DEFAULT_NOTIFICATION_CONFIG,
  isNotificationConfigKey,
} from '../types';

import { buildNotificationConfig, extractSettingsData } from './utils';

interface UseNotificationConfigReturn {
  config: NotificationAppConfig;
  handleUpdate: NotificationUpdateHandler;
  isPending: boolean;
}

/**
 * Custom hook for notification configuration management
 *
 * Extracts configuration from settings query and provides update handler
 *
 * @returns Configuration data, update handler, and loading state
 */
export function useNotificationConfig(): UseNotificationConfigReturn {
  const settings = trpc.settings.get.useQuery({ key: 'all' });
  const update = trpc.settings.set.useMutation();

  // Extract and normalize config data using memoized helper
  const config = useMemo(() => {
    const checkIsSuccess = <T>(data: unknown): data is T => isSuccess(data as never);
    const settingsData = extractSettingsData(settings.data, checkIsSuccess);
    return buildNotificationConfig(settingsData?.appConfig, DEFAULT_NOTIFICATION_CONFIG);
  }, [settings.data]);

  /**
   * Handles updates to notification settings
   */
  const handleUpdate: NotificationUpdateHandler = useCallback(
    async (configKey: string, value: boolean | string | string[]): Promise<void> => {
      if (!isNotificationConfigKey(configKey)) {
        logger.error(`Invalid config key: ${configKey}`);
        return;
      }

      try {
        await update.mutateAsync({
          key: configKey,
          value,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to update settings:', errorMessage);
      }
    },
    [update]
  );

  return {
    config,
    handleUpdate,
    isPending: settings.isPending,
  };
}
